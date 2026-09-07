export const dynamic = 'force-dynamic';

/**
 * @fileoverview Google Calendar & Push Alert Sync Engine (Module 18).
 * POST /api/calendar/sync — Synchronizes bills, subscriptions, and debt milestones
 * with Google Calendar and schedules Web-Push morning alerts (8 AM on due_date - reminderDaysBefore).
 *
 * @module api/calendar/sync
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { db } from '@/db/client';
import {
  calendarSyncSettings,
  calendarEventLogs,
  module28PushScheduledJobs,
  recurringTransactions,
  debts,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  computeEventHash,
  computePushScheduleTime,
} from '@/lib/security/calendarToken';

interface SyncItem {
  sourceType: 'BILL' | 'SUBSCRIPTION' | 'DEBT';
  sourceId: string;
  title: string;
  amount: number;
  dueDate: string;
  url: string;
}

export const POST = withAuth(async (_request: NextRequest, { userId }) => {
  try {
    const nowEpoch = Math.floor(Date.now() / 1000);

    // 1. Fetch or initialize user's calendar settings
    let [settings] = await db
      .select()
      .from(calendarSyncSettings)
      .where(eq(calendarSyncSettings.userId, userId));

    if (!settings) {
      const defaultId = `cs_${randomUUID()}`;
      [settings] = await db
        .insert(calendarSyncSettings)
        .values({
          id: defaultId,
          userId,
          syncBills: 1,
          syncSubscriptions: 1,
          syncDebts: 1,
          reminderDaysBefore: 2,
        })
        .returning();
    }

    const reminderDays = settings.reminderDaysBefore ?? 2;
    const syncItems: SyncItem[] = [];

    // 2. Collect enabled sources
    // A. Recurring Bills & Subscriptions
    if (settings.syncBills || settings.syncSubscriptions) {
      const recurrings = await db
        .select()
        .from(recurringTransactions)
        .where(
          and(
            eq(recurringTransactions.userId, userId),
            eq(recurringTransactions.active, 1),
            eq(recurringTransactions.type, 'expense')
          )
        );

      for (const rec of recurrings) {
        const isSub =
          (rec.category || '').toLowerCase().includes('sub') ||
          (rec.name || '').toLowerCase().includes('netflix') ||
          (rec.name || '').toLowerCase().includes('spotify');

        if (isSub && !settings.syncSubscriptions) continue;
        if (!isSub && !settings.syncBills) continue;

        syncItems.push({
          sourceType: isSub ? 'SUBSCRIPTION' : 'BILL',
          sourceId: String(rec.id),
          title: isSub ? `Subscription: ${rec.name}` : `Bill Due: ${rec.name}`,
          amount: rec.amount,
          dueDate: rec.nextDate,
          url: `/transactions/new?prefillAmount=${encodeURIComponent(rec.amount)}&prefillCategory=${encodeURIComponent(rec.category)}&prefillNote=${encodeURIComponent(rec.name)}`,
        });
      }
    }

    // B. Debt Payoff Milestones & Due Dates
    if (settings.syncDebts) {
      const userDebts = await db
        .select()
        .from(debts)
        .where(and(eq(debts.userId, userId)));

      const today = new Date();
      for (const debtItem of userDebts) {
        if (debtItem.balance <= 0) continue;

        const dueDay = debtItem.dueDayOfMonth || 15;
        let dueYear = today.getFullYear();
        let dueMonth = today.getMonth();

        // If today is past the due day, schedule for next month
        if (today.getDate() > dueDay) {
          dueMonth++;
          if (dueMonth > 11) {
            dueMonth = 0;
            dueYear++;
          }
        }

        const calculatedDate = new Date(dueYear, dueMonth, dueDay);
        const dateStr = calculatedDate.toISOString().split('T')[0];

        syncItems.push({
          sourceType: 'DEBT',
          sourceId: String(debtItem.id),
          title: `Debt Minimum Payment: ${debtItem.name}`,
          amount: debtItem.minimumPayment || 0,
          dueDate: dateStr,
          url: `/debts?id=${debtItem.id}`,
        });
      }
    }

    let billsCreated = 0;
    let subscriptionsUpdated = 0;
    let debtsScheduled = 0;
    const activeSourceKeys = new Set<string>();

    // 3. Process items: hash comparison & push job creation
    for (const item of syncItems) {
      const sourceKey = `${item.sourceType}:${item.sourceId}`;
      activeSourceKeys.add(sourceKey);

      const currentHash = computeEventHash({
        title: item.title,
        amount: item.amount,
        dueDate: item.dueDate,
      });

      const [existingLog] = await db
        .select()
        .from(calendarEventLogs)
        .where(
          and(
            eq(calendarEventLogs.userId, userId),
            eq(calendarEventLogs.sourceType, item.sourceType),
            eq(calendarEventLogs.sourceId, item.sourceId)
          )
        );

      const nextPushAt = computePushScheduleTime(item.dueDate, reminderDays);
      const googleEventId = existingLog?.googleEventId || `gcal_${item.sourceType.toLowerCase()}_${item.sourceId}`;

      const payload = {
        title: item.title,
        body: `${item.title} (৳${item.amount.toLocaleString()}) is due on ${item.dueDate}. Tap to record as paid.`,
        tag: `calendar-${item.sourceType.toLowerCase()}-${item.sourceId}`,
        url: item.url,
        amount: item.amount,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
      };

      if (!existingLog) {
        // Insert new audit log
        await db.insert(calendarEventLogs).values({
          id: `cel_${randomUUID()}`,
          userId,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          googleEventId,
          lastKnownHash: currentHash,
          nextPushAt,
        });

        // Insert pending scheduled job
        await db.insert(module28PushScheduledJobs).values({
          id: `psj_${randomUUID()}`,
          userId,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          runAt: nextPushAt,
          payloadJson: JSON.stringify(payload),
          status: 'pending',
        });

        if (item.sourceType === 'BILL') billsCreated++;
        else if (item.sourceType === 'SUBSCRIPTION') subscriptionsUpdated++;
        else debtsScheduled++;
      } else if (existingLog.lastKnownHash !== currentHash) {
        // Updated event: reschedule
        await db
          .update(calendarEventLogs)
          .set({
            lastKnownHash: currentHash,
            nextPushAt,
            updatedAt: sql`(unixepoch())`,
          })
          .where(eq(calendarEventLogs.id, existingLog.id));

        // Update pending push job
        const [existingJob] = await db
          .select()
          .from(module28PushScheduledJobs)
          .where(
            and(
              eq(module28PushScheduledJobs.userId, userId),
              eq(module28PushScheduledJobs.sourceType, item.sourceType),
              eq(module28PushScheduledJobs.sourceId, item.sourceId),
              eq(module28PushScheduledJobs.status, 'pending')
            )
          );

        if (existingJob) {
          await db
            .update(module28PushScheduledJobs)
            .set({
              runAt: nextPushAt,
              payloadJson: JSON.stringify(payload),
            })
            .where(eq(module28PushScheduledJobs.id, existingJob.id));
        } else {
          await db.insert(module28PushScheduledJobs).values({
            id: `psj_${randomUUID()}`,
            userId,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            runAt: nextPushAt,
            payloadJson: JSON.stringify(payload),
            status: 'pending',
          });
        }

        if (item.sourceType === 'BILL') billsCreated++;
        else if (item.sourceType === 'SUBSCRIPTION') subscriptionsUpdated++;
        else debtsScheduled++;
      }
    }

    // 4. Two-way prune: cancel jobs for deleted or completed items
    const allUserLogs = await db
      .select()
      .from(calendarEventLogs)
      .where(eq(calendarEventLogs.userId, userId));

    let prunedCount = 0;
    for (const log of allUserLogs) {
      const key = `${log.sourceType}:${log.sourceId}`;
      if (!activeSourceKeys.has(key)) {
        // Cancel pending push jobs
        await db
          .update(module28PushScheduledJobs)
          .set({ status: 'cancelled' })
          .where(
            and(
              eq(module28PushScheduledJobs.userId, userId),
              eq(module28PushScheduledJobs.sourceType, log.sourceType as any),
              eq(module28PushScheduledJobs.sourceId, log.sourceId),
              eq(module28PushScheduledJobs.status, 'pending')
            )
          );
        prunedCount++;
      }
    }

    // 5. Update settings lastSyncedAt
    await db
      .update(calendarSyncSettings)
      .set({ lastSyncedAt: nowEpoch })
      .where(eq(calendarSyncSettings.userId, userId));

    return apiSuccess({
      success: true,
      syncedEventsCount: {
        billsCreated,
        subscriptionsUpdated,
        debtsScheduled,
        prunedCount,
      },
      lastSyncedAt: nowEpoch,
      message: 'Calendar sync and smart push alerts scheduled successfully.',
    });
  } catch (error: any) {
    console.error('Error in POST /api/calendar/sync:', error);
    return apiError(new Error(error.message || 'Failed to synchronize calendar events'));
  }
});
