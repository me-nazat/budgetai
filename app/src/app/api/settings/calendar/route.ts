export const dynamic = 'force-dynamic';

/**
 * @fileoverview Settings Calendar API Route (Module 18).
 * GET /api/settings/calendar — Retrieves calendar connection state, toggles, and recent event logs.
 * PUT /api/settings/calendar — Updates sync toggles (syncBills, syncSubscriptions, syncDebts, reminderDaysBefore).
 * DELETE /api/settings/calendar — Disconnects Google Calendar, revoking OAuth token server-side.
 *
 * @module api/settings/calendar
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { db } from '@/db/client';
import {
  calendarSyncSettings,
  calendarEventLogs,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { CalendarRepository } from '@/repositories/calendar.repository';

export const GET = withAuth(async (_request: NextRequest, { userId }) => {
  try {
    // 1. Fetch or initialize settings
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

    // 2. Check token connection from oauthAccounts
    const token = await CalendarRepository.getToken(userId);
    const isConnected = Boolean(token?.refreshToken || token?.accessToken);
    const googleEmail = settings.googleUserEmail || token?.email || (isConnected ? 'Google Calendar Account' : null);

    // 3. Fetch last 5 sync event logs
    const recentLogs = await db
      .select()
      .from(calendarEventLogs)
      .where(eq(calendarEventLogs.userId, userId))
      .orderBy(desc(calendarEventLogs.updatedAt))
      .limit(5);

    return apiSuccess({
      isConnected,
      googleUserEmail: googleEmail,
      syncBills: Boolean(settings.syncBills),
      syncSubscriptions: Boolean(settings.syncSubscriptions),
      syncDebts: Boolean(settings.syncDebts),
      reminderDaysBefore: settings.reminderDaysBefore ?? 2,
      lastSyncedAt: settings.lastSyncedAt,
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        sourceType: log.sourceType,
        sourceId: log.sourceId,
        googleEventId: log.googleEventId,
        nextPushAt: log.nextPushAt,
        updatedAt: log.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching calendar settings:', error);
    return apiError(new Error(error.message || 'Failed to fetch calendar settings'));
  }
});

export const PUT = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const body = await request.json();
    const { syncBills, syncSubscriptions, syncDebts, reminderDaysBefore } = body;

    const reminderDays =
      typeof reminderDaysBefore === 'number'
        ? Math.min(7, Math.max(1, Math.round(reminderDaysBefore)))
        : 2;

    const [existing] = await db
      .select()
      .from(calendarSyncSettings)
      .where(eq(calendarSyncSettings.userId, userId));

    let updated;
    if (existing) {
      [updated] = await db
        .update(calendarSyncSettings)
        .set({
          syncBills: syncBills !== undefined ? (syncBills ? 1 : 0) : existing.syncBills,
          syncSubscriptions:
            syncSubscriptions !== undefined ? (syncSubscriptions ? 1 : 0) : existing.syncSubscriptions,
          syncDebts: syncDebts !== undefined ? (syncDebts ? 1 : 0) : existing.syncDebts,
          reminderDaysBefore: reminderDays,
        })
        .where(eq(calendarSyncSettings.userId, userId))
        .returning();
    } else {
      [updated] = await db
        .insert(calendarSyncSettings)
        .values({
          id: `cs_${randomUUID()}`,
          userId,
          syncBills: syncBills ? 1 : 0,
          syncSubscriptions: syncSubscriptions ? 1 : 0,
          syncDebts: syncDebts ? 1 : 0,
          reminderDaysBefore: reminderDays,
        })
        .returning();
    }

    return apiSuccess({
      success: true,
      syncBills: Boolean(updated.syncBills),
      syncSubscriptions: Boolean(updated.syncSubscriptions),
      syncDebts: Boolean(updated.syncDebts),
      reminderDaysBefore: updated.reminderDaysBefore,
      message: 'Calendar sync preferences updated.',
    });
  } catch (error: any) {
    console.error('Error updating calendar settings:', error);
    return apiError(new Error(error.message || 'Failed to update calendar settings'));
  }
});

export const DELETE = withAuth(async (_request: NextRequest, { userId }) => {
  try {
    await CalendarRepository.removeToken(userId);

    // Clear settings email & calendarId
    await db
      .update(calendarSyncSettings)
      .set({
        googleUserEmail: null,
        calendarId: null,
      })
      .where(eq(calendarSyncSettings.userId, userId));

    return apiSuccess({
      success: true,
      message: 'Google Calendar integration disconnected and access revoked.',
    });
  } catch (error: any) {
    console.error('Error disconnecting calendar:', error);
    return apiError(new Error(error.message || 'Failed to disconnect calendar'));
  }
});
