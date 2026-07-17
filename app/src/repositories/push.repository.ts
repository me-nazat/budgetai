/**
 * @fileoverview Push notification subscription repository.
 *
 * Data access layer for the `push_subscriptions` table.
 *
 * @module repositories/push.repository
 */

import { db } from '@/db/client';
import { pushSubscriptions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export class PushRepository {
  /**
   * Saves or updates a push subscription for a user/endpoint pair.
   */
  static async upsert(
    userId: number,
    endpoint: string,
    p256dh: string,
    auth: string
  ) {
    // Check if subscription already exists for this endpoint
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(pushSubscriptions)
        .set({ p256dh, auth })
        .where(eq(pushSubscriptions.id, existing[0].id));
      return existing[0].id;
    }

    const result = await db
      .insert(pushSubscriptions)
      .values({ userId, endpoint, p256dh, auth })
      .returning({ id: pushSubscriptions.id });

    return result[0].id;
  }

  /**
   * Removes a push subscription by endpoint.
   */
  static async removeByEndpoint(userId: number, endpoint: string) {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );
  }

  /**
   * Gets all active subscriptions for a user.
   */
  static async listByUser(userId: number) {
    return db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }

  /**
   * Gets all subscriptions (for cron push check).
   */
  static async listAll() {
    return db.select().from(pushSubscriptions);
  }

  /**
   * Updates notification preferences for a subscription.
   */
  static async updatePreferences(
    id: number,
    preferences: {
      enabledCategories?: string;
      quietHoursStart?: string | null;
      quietHoursEnd?: string | null;
    }
  ) {
    await db
      .update(pushSubscriptions)
      .set(preferences)
      .where(eq(pushSubscriptions.id, id));
  }

  /**
   * Removes a subscription by ID (cleanup failed subscriptions).
   */
  static async removeById(id: number) {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.id, id));
  }
}
