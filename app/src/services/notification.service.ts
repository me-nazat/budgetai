/**
 * @fileoverview Notification service — business logic for user notifications.
 *
 * @module services/notification.service
 */

import { NotificationRepository } from '@/repositories/notification.repository';
import type { NotificationResponseDTO } from '@/lib/types/dto';

/**
 * NotificationService — business logic for user notifications.
 */
export class NotificationService {
  /**
   * Retrieves all notifications for a user.
   *
   * @param userId - The user's ID.
   * @returns Array of notifications with unread count.
   */
  static async getAll(userId: number): Promise<{
    notifications: NotificationResponseDTO[];
    unreadCount: number;
  }> {
    const [notifications, unreadCount] = await Promise.all([
      NotificationRepository.findAll(userId),
      NotificationRepository.countUnread(userId),
    ]);

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt,
      })),
      unreadCount,
    };
  }

  /**
   * Marks a notification as read.
   *
   * @param userId - The user's ID.
   * @param id - The notification ID.
   */
  static async markRead(userId: number, id: number): Promise<void> {
    await NotificationRepository.markRead(userId, id);
  }

  /**
   * Marks all notifications as read.
   *
   * @param userId - The user's ID.
   */
  static async markAllRead(userId: number): Promise<void> {
    await NotificationRepository.markAllRead(userId);
  }

  /**
   * Deletes a notification.
   *
   * @param userId - The user's ID.
   * @param id - The notification ID.
   */
  static async delete(userId: number, id: number): Promise<void> {
    await NotificationRepository.delete(userId, id);
  }

  /**
   * Creates a system notification for a user.
   *
   * @param userId - The user's ID.
   * @param type - Notification type (info, warning, success, error).
   * @param title - Notification title.
   * @param message - Notification body.
   */
  static async createSystem(
    userId: number,
    type: string,
    title: string,
    message: string
  ): Promise<void> {
    await NotificationRepository.create({ userId, type, title, message });
  }
}
