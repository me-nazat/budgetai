export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateLocaleSchema = z.object({
  locale: z.enum(['en', 'bn']),
});

/**
 * GET /api/settings/locale
 * Returns the current authenticated user's preferred locale.
 */
export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const [user] = await db
      .select({ locale: users.locale, preferredLocale: users.preferredLocale })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return NextResponse.json({
      locale: user?.locale || user?.preferredLocale || 'en',
    });
  })
);

/**
 * PUT /api/settings/locale
 * Updates the user's preferred locale in their database profile.
 */
export const PUT = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { locale } = updateLocaleSchema.parse(body);

    await db
      .update(users)
      .set({ locale, preferredLocale: locale })
      .where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      locale,
      message: locale === 'bn' ? 'ভাষা বাংলা হিসেবে সেট করা হয়েছে' : 'Language set to English',
    });
  })
);

export const POST = PUT;

