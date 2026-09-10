/**
 * @fileoverview Privacy settings API route — GET and PUT endpoints.
 *
 * Provides retrieval and mutation of user-specific privacy configurations:
 * - Auto-lock timeout in minutes (0 = disabled)
 * - Lock on background/tab switch
 * - Shake-to-hide mobile gesture
 * - Account number masking in lists & exports
 *
 * @module api/settings/privacy
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess } from '@/lib/types/api';
import { queryOne, run } from '@/lib/db';

const updatePrivacySettingsSchema = z.object({
  autoLockTimeoutMinutes: z.number().int().min(0).max(120).optional(),
  lockOnBackground: z.boolean().optional(),
  useBiometrics: z.boolean().optional(),
  shakeToHideEnabled: z.boolean().optional(),
  maskAccountNumbers: z.boolean().optional(),
});

export const GET = apiHandler(
  withAuth(async (_request, { userId }) => {
    let settings = await queryOne<{
      id: string;
      user_id: number;
      auto_lock_timeout_minutes: number;
      shake_to_hide_enabled: number;
      mask_account_numbers: number;
    }>(
      'SELECT * FROM user_privacy_settings WHERE user_id = ?',
      [userId]
    );

    if (!settings) {
      const id = crypto.randomUUID();
      await run(
        `INSERT INTO user_privacy_settings (id, user_id, auto_lock_timeout_minutes, shake_to_hide_enabled, mask_account_numbers)
         VALUES (?, ?, 0, 1, 1)`,
        [id, userId]
      );
      settings = {
        id,
        user_id: userId,
        auto_lock_timeout_minutes: 0,
        shake_to_hide_enabled: 1,
        mask_account_numbers: 1,
      };
    }

    return apiSuccess({
      autoLockTimeoutMinutes: settings.auto_lock_timeout_minutes,
      lockOnBackground: settings.auto_lock_timeout_minutes > 0,
      useBiometrics: true,
      shakeToHideEnabled: Boolean(settings.shake_to_hide_enabled),
      maskAccountNumbers: Boolean(settings.mask_account_numbers),
    });
  }),
  { rateLimit: 'apiStrict' }
);

export const PUT = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const validated = updatePrivacySettingsSchema.parse(body);

    // Ensure settings record exists
    const existing = await queryOne<{
      id: string;
      user_id: number;
      auto_lock_timeout_minutes: number;
      shake_to_hide_enabled: number;
      mask_account_numbers: number;
    }>(
      'SELECT * FROM user_privacy_settings WHERE user_id = ?',
      [userId]
    );

    const autoLock = validated.autoLockTimeoutMinutes ?? existing?.auto_lock_timeout_minutes ?? 0;
    const shake = validated.shakeToHideEnabled !== undefined
      ? (validated.shakeToHideEnabled ? 1 : 0)
      : (existing?.shake_to_hide_enabled ?? 1);
    const maskAcc = validated.maskAccountNumbers !== undefined
      ? (validated.maskAccountNumbers ? 1 : 0)
      : (existing?.mask_account_numbers ?? 1);

    if (!existing) {
      const id = crypto.randomUUID();
      await run(
        `INSERT INTO user_privacy_settings (id, user_id, auto_lock_timeout_minutes, shake_to_hide_enabled, mask_account_numbers, updated_at)
         VALUES (?, ?, ?, ?, ?, unixepoch())`,
        [id, userId, autoLock, shake, maskAcc]
      );
    } else {
      await run(
        `UPDATE user_privacy_settings
         SET auto_lock_timeout_minutes = ?, shake_to_hide_enabled = ?, mask_account_numbers = ?, updated_at = unixepoch()
         WHERE user_id = ?`,
        [autoLock, shake, maskAcc, userId]
      );
    }

    return apiSuccess({
      autoLockTimeoutMinutes: autoLock,
      lockOnBackground: autoLock > 0 || (validated.lockOnBackground ?? false),
      useBiometrics: validated.useBiometrics ?? true,
      shakeToHideEnabled: Boolean(shake),
      maskAccountNumbers: Boolean(maskAcc),
    });
  }),
  { rateLimit: 'apiStrict' }
);
