/**
 * @fileoverview User Locale Preference API Route (Module 17 — Native Bilingual Localization).
 *
 * Provides a PUT endpoint to persist the user's preferred interface language ('en' | 'bn').
 *
 * @module api/settings/locale
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess } from '@/lib/types/api';
import { run } from '@/lib/db';

const updateLocaleSchema = z.object({
  locale: z.enum(['en', 'bn']),
});

export const PUT = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { locale } = updateLocaleSchema.parse(body);

    await run(
      'UPDATE users SET preferred_locale = ? WHERE id = ?',
      [locale, userId]
    );

    return apiSuccess({
      locale,
      message: locale === 'bn' ? 'ভাষা সফলভাবে আপডেট করা হয়েছে' : 'Language updated successfully',
    });
  }),
  { rateLimit: 'api' }
);
