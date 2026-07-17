/**
 * @fileoverview Push notification service.
 *
 * Handles VAPID key management, subscription lifecycle, and sending
 * push notifications to user devices.
 *
 * @security
 * - VAPID private key is read from environment variables.
 * - Failed subscriptions are automatically cleaned up.
 *
 * @module services/push.service
 */

import { PushRepository } from '@/repositories/push.repository';

// Web Push is imported dynamically to avoid edge runtime issues
let webpush: typeof import('web-push') | null = null;

async function getWebPush() {
  if (!webpush) {
    webpush = await import('web-push');
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@wealthai.app';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    }
  }
  return webpush;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string }>;
}

export class PushService {
  /**
   * Subscribes a device for push notifications.
   */
  static async subscribe(
    userId: number,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  ) {
    return PushRepository.upsert(
      userId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth
    );
  }

  /**
   * Unsubscribes a device from push notifications.
   */
  static async unsubscribe(userId: number, endpoint: string) {
    return PushRepository.removeByEndpoint(userId, endpoint);
  }

  /**
   * Sends a push notification to all of a user's subscribed devices.
   */
  static async sendToUser(userId: number, payload: PushPayload) {
    const wp = await getWebPush();
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.warn('[push] VAPID keys not configured — skipping push notification');
      return;
    }

    const subscriptions = await PushRepository.listByUser(userId);

    for (const sub of subscriptions) {
      // Check quiet hours
      if (sub.quietHoursStart && sub.quietHoursEnd) {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (isInQuietHours(currentTime, sub.quietHoursStart, sub.quietHoursEnd)) {
          continue;
        }
      }

      // Check category filter
      if (payload.tag) {
        try {
          const enabledCategories = JSON.parse(sub.enabledCategories || '[]') as string[];
          if (enabledCategories.length > 0 && !enabledCategories.includes(payload.tag)) {
            continue;
          }
        } catch {
          // Invalid JSON — send anyway
        }
      }

      try {
        await wp.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        // 404 or 410 = subscription expired/invalid — clean up
        if (statusCode === 404 || statusCode === 410) {
          await PushRepository.removeById(sub.id);
          console.log(`[push] Cleaned up expired subscription ${sub.id}`);
        } else {
          console.error(`[push] Failed to send to subscription ${sub.id}:`, error);
        }
      }
    }
  }

  /**
   * Gets the VAPID public key for client-side subscription.
   */
  static getPublicKey(): string | undefined {
    return process.env.VAPID_PUBLIC_KEY;
  }
}

/**
 * Checks if the current time falls within quiet hours.
 */
function isInQuietHours(current: string, start: string, end: string): boolean {
  if (start <= end) {
    // Same-day range (e.g., 22:00 - 08:00 is overnight, but 08:00 - 22:00 is same-day)
    return current >= start && current < end;
  }
  // Overnight range (e.g., 22:00 - 08:00)
  return current >= start || current < end;
}
