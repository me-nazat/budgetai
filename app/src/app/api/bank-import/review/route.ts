export const dynamic = 'force-dynamic';

/**
 * @fileoverview Canonical Bank Import Review Queue API (Module 16).
 *
 * GET  — Fetch pending review items for the authenticated user, joined with matched transactions.
 * POST — Resolve a single review item ('kept_both' | 'merged' | 'discarded' | 'pending').
 * PUT  — Bulk auto-resolve all pending items at or above a confidence threshold.
 *
 * Rate limit: 'api' on reads/resolutions, 'apiStrict' on bulk mutations.
 *
 * @module api/bank-import/review
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { bankImportReviewQueue, statementImportBatches, transactions } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';

/** 4-way resolution validation */
const VALID_RESOLUTIONS = ['pending', 'kept_both', 'merged', 'discarded'] as const;
type Resolution = typeof VALID_RESOLUTIONS[number];

function isValidResolution(value: unknown): value is Resolution {
  return typeof value === 'string' && (VALID_RESOLUTIONS as readonly string[]).includes(value);
}

/**
 * Executes a single resolution.
 * If 'kept_both', inserts confirmed row into transactions ledger.
 * When all items for a batch are resolved, flips batch reconciliationStatus to 'BALANCED'.
 */
async function executeResolution(
  item: typeof bankImportReviewQueue.$inferSelect,
  resolution: Resolution
) {
  if (resolution === 'kept_both') {
    try {
      const parsed = JSON.parse(item.parsedRowData);
      await db.insert(transactions).values({
        userId: item.userId,
        type: parsed.type || 'expense',
        amount: Math.abs(parseFloat(parsed.amount) || 0),
        category: parsed.category || 'Other',
        description: parsed.description || 'Imported Bank Transaction',
        date: parsed.date || new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      console.error('[bank-import-review] Failed to parse row data for transaction insertion:', err);
    }
  }

  const [updated] = await db
    .update(bankImportReviewQueue)
    .set({
      resolution,
      resolvedAt: resolution === 'pending' ? null : new Date().toISOString(),
    })
    .where(eq(bankImportReviewQueue.id, item.id))
    .returning();

  // Check if batch is 100% resolved
  if (item.importBatchId) {
    const pendingItems = await db
      .select({ id: bankImportReviewQueue.id })
      .from(bankImportReviewQueue)
      .where(
        and(
          eq(bankImportReviewQueue.importBatchId, item.importBatchId),
          eq(bankImportReviewQueue.resolution, 'pending')
        )
      );

    if (pendingItems.length === 0) {
      await db
        .update(statementImportBatches)
        .set({ reconciliationStatus: 'BALANCED' })
        .where(eq(statementImportBatches.id, item.importBatchId));
    }
  }

  return updated;
}

/**
 * GET — Fetch all pending review items for the user with candidate match details.
 */
export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const batchIdParam = url.searchParams.get('batchId');

    const conditions = [
      eq(bankImportReviewQueue.userId, userId),
      eq(bankImportReviewQueue.resolution, 'pending'),
    ];

    if (batchIdParam) {
      const batchId = parseInt(batchIdParam, 10);
      if (!isNaN(batchId)) {
        conditions.push(eq(bankImportReviewQueue.importBatchId, batchId));
      }
    }

    const rows = await db
      .select({
        id: bankImportReviewQueue.id,
        importBatchId: bankImportReviewQueue.importBatchId,
        parsedRowData: bankImportReviewQueue.parsedRowData,
        possibleMatchTransactionId: bankImportReviewQueue.possibleMatchTransactionId,
        matchConfidence: bankImportReviewQueue.matchConfidence,
        resolution: bankImportReviewQueue.resolution,
        createdAt: bankImportReviewQueue.createdAt,
        matchedTxId: transactions.id,
        matchedTxAmount: transactions.amount,
        matchedTxDate: transactions.date,
        matchedTxDesc: transactions.description,
        matchedTxCategory: transactions.category,
      })
      .from(bankImportReviewQueue)
      .leftJoin(transactions, eq(bankImportReviewQueue.possibleMatchTransactionId, transactions.id))
      .where(and(...conditions));

    const items = rows.map((r) => {
      let parsed = {
        date: new Date().toISOString().split('T')[0],
        description: 'Bank Transaction',
        amount: 0,
        type: 'expense',
        category: 'Other',
      };
      try {
        parsed = JSON.parse(r.parsedRowData);
      } catch {}

      return {
        id: r.id,
        importBatchId: r.importBatchId,
        date: parsed.date,
        description: parsed.description,
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category,
        matchConfidence: r.matchConfidence,
        resolution: r.resolution,
        possibleMatchTransactionId: r.possibleMatchTransactionId,
        matchedExistingTransaction: r.matchedTxId
          ? {
              id: r.matchedTxId,
              amount: r.matchedTxAmount,
              date: r.matchedTxDate,
              description: r.matchedTxDesc,
              category: r.matchedTxCategory,
            }
          : null,
      };
    });

    return NextResponse.json({ items });
  }),
  { rateLimit: 'api' }
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
      .where(and(eq(bankImportReviewQueue.id, Number(reviewItemId)), eq(bankImportReviewQueue.userId, userId)));

    if (!item) {
      return NextResponse.json({ error: 'Review item not found' }, { status: 404 });
    }

    const updated = await executeResolution(item, resolution);
    return NextResponse.json({ success: true, item: updated });
  }),
  { rateLimit: 'api' }
);

/**
 * PUT — Bulk auto-resolve all pending items at or above a confidence threshold.
 */
export const PUT = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const threshold = typeof body.threshold === 'number' ? body.threshold : 0.95;
    const batchIdParam = body.batchId;

    if (threshold < 0 || threshold > 1) {
      return NextResponse.json({ error: 'Threshold must be between 0 and 1' }, { status: 400 });
    }

    const conditions = [
      eq(bankImportReviewQueue.userId, userId),
      eq(bankImportReviewQueue.resolution, 'pending'),
      gte(bankImportReviewQueue.matchConfidence, threshold),
    ];

    if (batchIdParam) {
      const batchId = parseInt(batchIdParam, 10);
      if (!isNaN(batchId)) {
        conditions.push(eq(bankImportReviewQueue.importBatchId, batchId));
      }
    }

    const pendingItems = await db
      .select()
      .from(bankImportReviewQueue)
      .where(and(...conditions));

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
