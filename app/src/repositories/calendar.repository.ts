import { db } from '@/db/client';
import { oauthAccounts, calendarSyncSettings, calendarEventLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { encryptCalendarToken, decryptCalendarToken, revokeGoogleToken } from '@/lib/security/calendarToken';
import { randomUUID } from 'crypto';

export class CalendarRepository {
  /** Get calendar sync OAuth account for user */
  static async getToken(userId: number) {
    const [account] = await db
      .select()
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, 'google_calendar')));

    if (!account) return null;

    const accessToken = decryptCalendarToken(account.encryptedAccessToken || '');
    const refreshToken = decryptCalendarToken(account.encryptedRefreshToken || '');

    // Also get calendarId and email from settings if available
    const [settings] = await db
      .select({ calendarId: calendarSyncSettings.calendarId, googleUserEmail: calendarSyncSettings.googleUserEmail })
      .from(calendarSyncSettings)
      .where(eq(calendarSyncSettings.userId, userId));

    return {
      id: account.id,
      userId: account.userId,
      accessToken,
      refreshToken,
      calendarId: settings?.calendarId || 'primary',
      expiresAt: account.tokenExpiresAt || new Date(Date.now() + 3600 * 1000).toISOString(),
      email: account.email || settings?.googleUserEmail || null,
      scope: account.scope,
    };
  }

  /** Save or update Google Calendar OAuth tokens in oauthAccounts */
  static async saveToken(data: {
    userId: number;
    accessToken: string;
    refreshToken: string;
    calendarId?: string;
    expiresAt: string;
    email?: string;
    displayName?: string;
    scope?: string;
  }) {
    const existing = await this.getToken(data.userId);
    const encryptedAccessToken = encryptCalendarToken(data.accessToken);
    const encryptedRefreshToken = data.refreshToken ? encryptCalendarToken(data.refreshToken) : undefined;

    if (existing) {
      await db
        .update(oauthAccounts)
        .set({
          encryptedAccessToken,
          ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
          tokenExpiresAt: data.expiresAt,
          email: data.email || existing.email,
          scope: data.scope || existing.scope,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(oauthAccounts.id, existing.id));
    } else {
      await db
        .insert(oauthAccounts)
        .values({
          userId: data.userId,
          provider: 'google_calendar',
          providerAccountId: data.email || `google_cal_${data.userId}`,
          email: data.email,
          displayName: data.displayName || 'Google Calendar',
          encryptedAccessToken,
          encryptedRefreshToken: encryptedRefreshToken || encryptedAccessToken,
          tokenExpiresAt: data.expiresAt,
          scope: data.scope || 'https://www.googleapis.com/auth/calendar.events',
        });
    }

    // Ensure calendarSyncSettings row exists and has calendarId/email set
    const [settings] = await db
      .select()
      .from(calendarSyncSettings)
      .where(eq(calendarSyncSettings.userId, data.userId));

    if (settings) {
      await db
        .update(calendarSyncSettings)
        .set({
          calendarId: data.calendarId || settings.calendarId || 'primary',
          googleUserEmail: data.email || settings.googleUserEmail,
        })
        .where(eq(calendarSyncSettings.userId, data.userId));
    } else {
      await db
        .insert(calendarSyncSettings)
        .values({
          id: `cs_${randomUUID()}`,
          userId: data.userId,
          calendarId: data.calendarId || 'primary',
          googleUserEmail: data.email,
          syncBills: 1,
          syncSubscriptions: 1,
          syncDebts: 1,
          reminderDaysBefore: 2,
        });
    }

    return await this.getToken(data.userId);
  }

  /** Revoke/remove calendar token */
  static async removeToken(userId: number) {
    const token = await this.getToken(userId);
    if (token?.refreshToken) {
      await revokeGoogleToken(token.refreshToken);
    }
    return await db
      .delete(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, 'google_calendar')));
  }

  /** Record synced Google Calendar event in calendarEventLogs */
  static async recordEventSync(data: {
    userId: number;
    sourceType: string;
    sourceId: string;
    googleEventId: string;
    lastKnownHash: string;
    nextPushAt?: number | null;
  }) {
    const [existing] = await db
      .select()
      .from(calendarEventLogs)
      .where(
        and(
          eq(calendarEventLogs.userId, data.userId),
          eq(calendarEventLogs.sourceType, data.sourceType),
          eq(calendarEventLogs.sourceId, data.sourceId)
        )
      );

    const nowEpoch = Math.floor(Date.now() / 1000);

    if (existing) {
      const [updated] = await db
        .update(calendarEventLogs)
        .set({
          googleEventId: data.googleEventId,
          lastKnownHash: data.lastKnownHash,
          nextPushAt: data.nextPushAt ?? existing.nextPushAt,
          updatedAt: nowEpoch,
        })
        .where(eq(calendarEventLogs.id, existing.id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(calendarEventLogs)
      .values({
        id: `cel_${randomUUID()}`,
        userId: data.userId,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        googleEventId: data.googleEventId,
        lastKnownHash: data.lastKnownHash,
        nextPushAt: data.nextPushAt ?? null,
        updatedAt: nowEpoch,
      })
      .returning();
    return inserted;
  }

  /** Get existing event log by source */
  static async getEventLog(userId: number, sourceType: string, sourceId: string) {
    const [log] = await db
      .select()
      .from(calendarEventLogs)
      .where(
        and(
          eq(calendarEventLogs.userId, userId),
          eq(calendarEventLogs.sourceType, sourceType),
          eq(calendarEventLogs.sourceId, sourceId)
        )
      );
    return log || null;
  }

  /** Remove synced event record */
  static async deleteSyncedEvent(userId: number, sourceType: string, sourceId: string) {
    return await db
      .delete(calendarEventLogs)
      .where(
        and(
          eq(calendarEventLogs.userId, userId),
          eq(calendarEventLogs.sourceType, sourceType),
          eq(calendarEventLogs.sourceId, sourceId)
        )
      );
  }
}

