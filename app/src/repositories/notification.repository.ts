/**
 * @fileoverview Notification repository — data access for user notifications.
 *
 * @module repositories/notification.repository
 */

import { db } from '@/db/client';
import { notifications } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Input data for creating a notification.
 */
export interface CreateNotificationInput {
  userId: number;
  type: string;
  title: string;
  message: string;
}

/**
 * NotificationRepository — data access for user-facing alerts and messages.
 */
export class NotificationRepository {
  /**
   * Retrieves all notifications for a user, newest first.
   *
   * @param userId - The user's ID.
   * @param limit - Maximum number of notifications to return (default: 50).
   * @returns Array of notification records.
   */
  static async findAll(
    userId: number,
    limit: number = 50
  ): Promise<Array<typeof notifications.$inferSelect>> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  /**
   * Counts unread notifications for a user.
   *
   * @param userId - The user's ID.
   * @returns The number of unread notifications.
   */
  static async countUnread(userId: number): Promise<number> {
    const results = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.read, 0)
        )
      );

    return results.length;
  }

  /**
   * Creates a new notification.
   *
   * @param data - Notification creation data.
   * @returns The created notification record.
   */
  static async create(
    data: CreateNotificationInput
  ): Promise<typeof notifications.$inferSelect> {
    const result = await db
      .insert(notifications)
      .values(data)
      .returning();

    return result[0];
  }

  /**
   * Marks a single notification as read.
   *
   * @param userId - The user's ID.
   * @param id - The notification ID.
   * @returns The updated notification, or undefined.
   */
  static async markRead(
    userId: number,
    id: number
  ): Promise<typeof notifications.$inferSelect | undefined> {
    const result = await db
      .update(notifications)
      .set({ read: 1 })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    return result[0];
  }

  /**
   * Marks all notifications as read for a user.
   *
   * @param userId - The user's ID.
   */
  static async markAllRead(userId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ read: 1 })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.read, 0)
        )
      );
  }

  /**
   * Deletes a notification by ID.
   *
   * @param userId - The user's ID.
   * @param id - The notification ID.
   * @returns The deleted notification, or undefined.
   */
  static async delete(
    userId: number,
    id: number
  ): Promise<typeof notifications.$inferSelect | undefined> {
    const result = await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    return result[0];
  }
}
