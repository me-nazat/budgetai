export const dynamic = 'force-dynamic';

/**
 * @fileoverview Accountant shareable read-only link management.
 * Feature 12.2: Shareable View-Only Link with 30-day token.
 *
 * POST   /api/tax/share — Generate 30-day view token
 * GET    /api/tax/share — List active shares
 * DELETE /api/tax/share?token=... — Revoke share token
 *
 * @module api/tax/share
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { module22FiscalReportShares } from '@/db/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import crypto from 'crypto';

const CreateShareSchema = z.object({
  taxYear: z.number().int().min(2020).max(2035).default(new Date().getFullYear()),
  expiresInDays: z.number().int().min(1).max(90).default(30),
});

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const { taxYear, expiresInDays } = parsed.data;
    const token = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + expiresInDays * 86400;

    const id = `share_${crypto.randomUUID()}`;
    await db.insert(module22FiscalReportShares).values({
      id,
      userId,
      taxYear,
      token,
      expiresAt,
      viewCount: 0,
    });

    return NextResponse.json({
      success: true,
      token,
      taxYear,
      expiresAt,
      shareUrl: `/tax/view/${token}`,
    });
  })
);

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const shares = await db
      .select()
      .from(module22FiscalReportShares)
      .where(
        and(
          eq(module22FiscalReportShares.userId, userId),
          isNull(module22FiscalReportShares.revokedAt)
        )
      );

    return NextResponse.json({ shares });
  })
);

export const DELETE = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    await db
      .update(module22FiscalReportShares)
      .set({ revokedAt: Math.floor(Date.now() / 1000) })
      .where(
        and(
          eq(module22FiscalReportShares.token, token),
          eq(module22FiscalReportShares.userId, userId)
        )
      );

    return NextResponse.json({ success: true, revokedToken: token });
  })
);
