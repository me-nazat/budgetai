/**
 * @fileoverview Calendar OAuth token encryption, remote revocation,
 * and push notification scheduling utilities (Module 18).
 *
 * @module lib/security/calendarToken
 */

import { encryptField, decryptField, isEncrypted } from '@/lib/crypto/encryption';
import { createHash } from 'crypto';

const CALENDAR_TOKEN_CONTEXT = 'google-calendar-oauth-token';

/**
 * Encrypts a Google OAuth token (access or refresh token) using AES-256-GCM.
 */
export function encryptCalendarToken(token: string): string {
  if (!token) return '';
  if (isEncrypted(token)) return token; // Avoid double encryption
  return encryptField(token, CALENDAR_TOKEN_CONTEXT);
}

/**
 * Decrypts an encrypted Google OAuth token using AES-256-GCM.
 */
export function decryptCalendarToken(encryptedToken: string): string {
  if (!encryptedToken) return '';
  if (!isEncrypted(encryptedToken)) return encryptedToken; // Legacy unencrypted fallback
  return decryptField(encryptedToken, CALENDAR_TOKEN_CONTEXT);
}

/**
 * Revokes a Google OAuth token server-side via Google's token revocation endpoint.
 */
export async function revokeGoogleToken(rawOrEncryptedToken: string): Promise<boolean> {
  const plainToken = decryptCalendarToken(rawOrEncryptedToken);
  if (!plainToken) return false;

  try {
    const res = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(plainToken)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return res.ok;
  } catch (error) {
    console.error('Error revoking Google OAuth token:', error);
    return false;
  }
}

/**
 * Computes deterministic SHA-256 hash of an event for two-way change detection.
 */
export function computeEventHash(data: {
  title: string;
  amount?: number | null;
  dueDate: string;
  status?: string;
  isPaid?: boolean;
}): string {
  const normalized = JSON.stringify({
    title: (data.title || '').trim().toLowerCase(),
    amount: Number(data.amount || 0).toFixed(2),
    dueDate: data.dueDate.slice(0, 10),
    isPaid: Boolean(data.isPaid),
    status: data.status || '',
  });
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Computes Unix timestamp (seconds) for 8:00 AM on (due_date - reminderDaysBefore).
 */
export function computePushScheduleTime(
  dueDateInput: string | Date,
  reminderDaysBefore: number = 2
): number {
  const date = typeof dueDateInput === 'string' ? new Date(dueDateInput) : new Date(dueDateInput.getTime());
  if (isNaN(date.getTime())) {
    // Fallback: 2 days from now at 8 AM
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 2);
    fallback.setHours(8, 0, 0, 0);
    return Math.floor(fallback.getTime() / 1000);
  }

  // Subtract reminderDaysBefore
  date.setDate(date.getDate() - Math.max(1, reminderDaysBefore));
  // Set to 8:00:00 AM
  date.setHours(8, 0, 0, 0);

  return Math.floor(date.getTime() / 1000);
}
