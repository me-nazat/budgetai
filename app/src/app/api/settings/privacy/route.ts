/**
 * @fileoverview Privacy settings API route — GET endpoint.
 *
 * Returns the authenticated user's privacy settings (auto-lock timeout,
 * shake-to-hide, account number masking). Creates a default row on first access.
 *
 * The full PUT endpoint for updating settings will ship with Module 14.
 *
 * @module api/settings/privacy
 */

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess } from '@/lib/types/api';
import { queryOne, run } from '@/lib/db';

export const GET = apiHandler(
  withAuth(async (_request, { userId }) => {
    // Try to fetch existing settings
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

    // Create default row if none exists
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
      shakeToHideEnabled: Boolean(settings.shake_to_hide_enabled),
      maskAccountNumbers: Boolean(settings.mask_account_numbers),
    });
  }),
  { rateLimit: 'api' }
);
