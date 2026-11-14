import { db } from '@/db/client';
import { calendarSyncTokens, calendarSyncEvents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export class CalendarRepository {
  /** Get calendar sync tokens for user */
  static async getToken(userId: number) {
    const [token] = await db
      .select()
      .from(calendarSyncTokens)
      .where(eq(calendarSyncTokens.userId, userId));
    return token || null;
  }

  /** Save or update Google Calendar OAuth tokens */
  static async saveToken(data: {
    userId: number;
    accessToken: string;
    refreshToken: string;
    calendarId?: string;
    expiresAt: string;
  }) {
    const existing = await this.getToken(data.userId);

    if (existing) {
      const [updated] = await db
        .update(calendarSyncTokens)
        .set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          calendarId: data.calendarId || existing.calendarId,
          expiresAt: data.expiresAt,
        })
        .where(eq(calendarSyncTokens.id, existing.id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(calendarSyncTokens)
      .values({
        userId: data.userId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        calendarId: data.calendarId || 'primary',
        expiresAt: data.expiresAt,
      })
      .returning();
    return inserted;
  }

  /** Revoke/remove calendar token */
  static async removeToken(userId: number) {
    return await db.delete(calendarSyncTokens).where(eq(calendarSyncTokens.userId, userId));
  }

  /** Record synced Google Calendar event */
  static async recordEventSync(data: {
    userId: number;
    entityType: string;
    entityId: number;
    googleEventId: string;
  }) {
    const [existing] = await db
      .select()
      .from(calendarSyncEvents)
      .where(
        and(
          eq(calendarSyncEvents.userId, data.userId),
          eq(calendarSyncEvents.entityType, data.entityType),
          eq(calendarSyncEvents.entityId, data.entityId)
        )
      );

    if (existing) {
      const [updated] = await db
        .update(calendarSyncEvents)
        .set({
          googleEventId: data.googleEventId,
          lastSyncedAt: new Date().toISOString(),
        })
        .where(eq(calendarSyncEvents.id, existing.id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(calendarSyncEvents)
      .values({
        userId: data.userId,
        entityType: data.entityType,
        entityId: data.entityId,
        googleEventId: data.googleEventId,
      })
      .returning();
    return inserted;
  }

  /** Remove synced event record */
  static async deleteSyncedEvent(userId: number, entityType: string, entityId: number) {
    return await db
      .delete(calendarSyncEvents)
      .where(
        and(
          eq(calendarSyncEvents.userId, userId),
          eq(calendarSyncEvents.entityType, entityType),
          eq(calendarSyncEvents.entityId, entityId)
        )
      );
  }
}
