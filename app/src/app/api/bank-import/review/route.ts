export const dynamic = 'force-dynamic';

/**
 * @fileoverview Bank import review queue API.
 *
 * GET  — Fetch pending review items for the authenticated user.
 * POST — Resolve a single review item (kept_both | merged | discarded).
 * PUT  — Bulk auto-resolve all pending items at or above a confidence threshold.
 *
 * @module api/bank-import/review
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { bankImportReviewQueue, transactions } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';

/** Shared resolution validation */
const VALID_RESOLUTIONS = ['kept_both', 'merged', 'discarded'] as const;
type Resolution = typeof VALID_RESOLUTIONS[number];

function isValidResolution(value: unknown): value is Resolution {
  return typeof value === 'string' && (VALID_RESOLUTIONS as readonly string[]).includes(value);
}

/**
 * Executes a single resolution. Extracted for reuse by both POST (single) and PUT (bulk).
 */
async function executeResolution(item: typeof bankImportReviewQueue.$inferSelect, resolution: Resolution) {
  if (resolution === 'kept_both') {
    try {
      const parsed = JSON.parse(item.parsedRowData);
      await db.insert(transactions).values({
        userId: item.userId,
        type: parsed.type || 'expense',
        amount: parseFloat(parsed.amount),
        category: parsed.category || 'Other',
        description: parsed.description || 'Imported Transaction',
        date: parsed.date || new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      console.error('[bank-import-review] Failed to parse row data:', err);
    }
  }

  const [updated] = await db
    .update(bankImportReviewQueue)
    .set({
      resolution,
      resolvedAt: new Date().toISOString(),
    })
    .where(eq(bankImportReviewQueue.id, item.id))
    .returning();

  return updated;
}

/**
 * GET — Fetch all pending review items for the user.
 */
export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const items = await db
      .select()
      .from(bankImportReviewQueue)
      .where(and(eq(bankImportReviewQueue.userId, userId), eq(bankImportReviewQueue.resolution, 'pending')));

    return NextResponse.json({ items });
  })
);

/**
 * POST — Resolve a single review item.
 */
export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { reviewItemId, resolution } = body;

    if (!reviewItemId || !isValidResolution(resolution)) {
      return NextResponse.json({ error: 'Valid reviewItemId and resolution are required' }, { status: 400 });
    }

    const [item] = await db
      .select()
      .from(bankImportReviewQueue)
      .where(and(eq(bankImportReviewQueue.id, reviewItemId), eq(bankImportReviewQueue.userId, userId)));

    if (!item) {
      return NextResponse.json({ error: 'Review item not found' }, { status: 404 });
    }

    const updated = await executeResolution(item, resolution);
    return NextResponse.json(updated);
  })
);

/**
 * PUT — Bulk auto-resolve all pending items at or above a confidence threshold.
 *
 * Items with a possibleMatchTransactionId and matchConfidence >= threshold
 * are automatically resolved as 'merged' (duplicate).
 *
 * Rate limit: apiStrict (30/min) since this can mutate many rows.
 */
export const PUT = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const threshold = typeof body.threshold === 'number' ? body.threshold : 0.95;

    if (threshold < 0 || threshold > 1) {
      return NextResponse.json({ error: 'Threshold must be between 0 and 1' }, { status: 400 });
    }

    // Fetch all pending items above threshold that have a possible match
    const pendingItems = await db
      .select()
      .from(bankImportReviewQueue)
      .where(
        and(
          eq(bankImportReviewQueue.userId, userId),
          eq(bankImportReviewQueue.resolution, 'pending'),
          gte(bankImportReviewQueue.matchConfidence, threshold)
        )
      );

    // Filter to only items with a possibleMatchTransactionId
    const eligible = pendingItems.filter((item) => item.possibleMatchTransactionId !== null);

    let resolvedCount = 0;
    for (const item of eligible) {
      try {
        await executeResolution(item, 'merged');
        resolvedCount++;
      } catch (err) {
        console.error(`[bank-import-review] Bulk resolve failed for item ${item.id}:`, err);
      }
    }

    return NextResponse.json({
      resolvedCount,
      totalEligible: eligible.length,
      threshold,
    });
  }),
  { rateLimit: 'apiStrict' }
);
