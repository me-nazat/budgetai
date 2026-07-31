export const dynamic = 'force-dynamic';

/**
 * @fileoverview Google Calendar auto-sync API route.
 *
 * GET  — Check calendar sync status for the user.
 * POST — Idempotently syncs user's upcoming recurring bills and debt due dates to Google Calendar.
 *
 * @module api/calendar/sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { CalendarRepository } from '@/repositories/calendar.repository';
import { db } from '@/db/client';
import { recurringTransactions, debts, calendarSyncEvents } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { google } from 'googleapis';

/**
 * GET /api/calendar/sync
 */
export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const token = await CalendarRepository.getToken(userId);
    return NextResponse.json({
      isConnected: Boolean(token),
      calendarId: token?.calendarId || null,
      expiresAt: token?.expiresAt || null,
    });
  })
);

/**
 * POST /api/calendar/sync — Trigger Google Calendar Auto-Sync
 */
export const POST = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const token = await CalendarRepository.getToken(userId);

    if (!token) {
      return NextResponse.json({ error: 'Google Calendar is not connected' }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({ error: 'OAuth credentials not configured' }, { status: 503 });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = token.calendarId || 'primary';

    const results = { syncedBills: 0, syncedDebts: 0, skipped: 0 };

    // 1. Sync active recurring bills
    const bills = await db
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.userId, userId),
          eq(recurringTransactions.active, 1)
        )
      );

    for (const bill of bills) {
      const [existingSync] = await db
        .select()
        .from(calendarSyncEvents)
        .where(
          and(
            eq(calendarSyncEvents.userId, userId),
            eq(calendarSyncEvents.entityType, 'recurring_bill'),
            eq(calendarSyncEvents.entityId, bill.id)
          )
        );

      if (existingSync) {
        results.skipped++;
        continue;
      }

      const eventDate = bill.nextDate || new Date().toISOString().split('T')[0];

      try {
        const res = await calendar.events.insert({
          calendarId,
          requestBody: {
            summary: `💸 WealthAI Bill Due: ${bill.name}`,
            description: `Recurring payment of $${bill.amount.toFixed(2)} due for ${bill.name} (${bill.category || 'Subscription'}).`,
            start: { date: eventDate },
            end: { date: eventDate },
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'popup', minutes: 24 * 60 },
                { method: 'popup', minutes: 2 * 24 * 60 },
              ],
            },
          },
        });

        if (res.data.id) {
          await CalendarRepository.recordEventSync({
            userId,
            entityType: 'recurring_bill',
            entityId: bill.id,
            googleEventId: res.data.id,
          });
          results.syncedBills++;
        }
      } catch (err) {
        console.error(`[calendar/sync] Failed to create bill event for ${bill.name}:`, err);
      }
    }

    // 2. Sync debt payment due dates
    const userDebts = await db
      .select()
      .from(debts)
      .where(and(eq(debts.userId, userId), gte(debts.balance, 0.01)));

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    for (const debt of userDebts) {
      if (!debt.dueDayOfMonth) continue;

      const [existingSync] = await db
        .select()
        .from(calendarSyncEvents)
        .where(
          and(
            eq(calendarSyncEvents.userId, userId),
            eq(calendarSyncEvents.entityType, 'debt_payment'),
            eq(calendarSyncEvents.entityId, debt.id)
          )
        );

      if (existingSync) {
        results.skipped++;
        continue;
      }

      const dayStr = String(debt.dueDayOfMonth).padStart(2, '0');
      const eventDate = `${currentYear}-${currentMonth}-${dayStr}`;

      try {
        const res = await calendar.events.insert({
          calendarId,
          requestBody: {
            summary: `💳 WealthAI Debt Payment Due: ${debt.name}`,
            description: `Minimum payment for debt "${debt.name}" (Balance: $${debt.balance.toFixed(2)}, APR: ${debt.interestRateApr}%).`,
            start: { date: eventDate },
            end: { date: eventDate },
            reminders: {
              useDefault: false,
              overrides: [{ method: 'popup', minutes: 24 * 60 }],
            },
          },
        });

        if (res.data.id) {
          await CalendarRepository.recordEventSync({
            userId,
            entityType: 'debt_payment',
            entityId: debt.id,
            googleEventId: res.data.id,
          });
          results.syncedDebts++;
        }
      } catch (err) {
        console.error(`[calendar/sync] Failed to create debt event for ${debt.name}:`, err);
      }
    }

    return NextResponse.json({ success: true, results });
  })
);
