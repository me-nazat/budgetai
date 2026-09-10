export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  statementImportBatches,
  bankImportReviewQueue,
  transactions,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

interface CommitItem {
  id: number | string;
  resolution: 'merged' | 'kept_both' | 'discarded' | 'pending';
  date?: string;
  description?: string;
  amount?: number;
  category?: string;
  type?: 'expense' | 'earning';
  matchedExistingTransactionId?: number | null;
}

/**
 * POST /api/bank-import/commit
 * Module 16: Atomic Statement Reconciliation Commit Engine
 * Updates bankImportReviewQueue items and inserts confirmed rows ('kept_both')
 * into the canonical transactions ledger. Sets statement reconciliationStatus to 'BALANCED'.
 *
 * Rate limit: 'api'
 */
export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const {
      statementId,
      batchId,
      items = [],
    } = body;

    const resolvedBatchId = Number(batchId || statementId);

    // Fetch batch
    let batch = null;
    if (resolvedBatchId && !isNaN(resolvedBatchId)) {
      const [found] = await db
        .select()
        .from(statementImportBatches)
        .where(
          and(
            eq(statementImportBatches.id, resolvedBatchId),
            eq(statementImportBatches.userId, userId)
          )
        );
      batch = found;
    }

    // Pull items if not explicitly provided
    let itemsToProcess: CommitItem[] = items;
    if (itemsToProcess.length === 0 && resolvedBatchId && !isNaN(resolvedBatchId)) {
      const queueRows = await db
        .select()
        .from(bankImportReviewQueue)
        .where(
          and(
            eq(bankImportReviewQueue.importBatchId, resolvedBatchId),
            eq(bankImportReviewQueue.userId, userId)
          )
        );

      itemsToProcess = queueRows.map((q) => {
        let parsed: any = {};
        try {
          parsed = JSON.parse(q.parsedRowData);
        } catch {}
        return {
          id: q.id,
          resolution: q.resolution as any,
          date: parsed.date,
          description: parsed.description,
          amount: parsed.amount,
          category: parsed.category,
          type: parsed.type,
          matchedExistingTransactionId: q.possibleMatchTransactionId,
        };
      });
    }

    if (itemsToProcess.length === 0) {
      return NextResponse.json(
        { error: 'No items provided for statement reconciliation' },
        { status: 400 }
      );
    }

    let createdCount = 0;
    let mergedCount = 0;
    let discardedCount = 0;
    let pendingCount = 0;

    for (const item of itemsToProcess) {
      const res = item.resolution || 'pending';
      const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;

      if (res === 'kept_both') {
        await db.insert(transactions).values({
          userId,
          type: item.type === 'earning' ? 'earning' : 'expense',
          amount: Math.abs(item.amount || 0),
          category: item.category || 'Other',
          description: item.description || 'Reconciled Bank Transaction',
          date: item.date || new Date().toISOString().split('T')[0],
        });
        createdCount++;
      } else if (res === 'merged') {
        mergedCount++;
      } else if (res === 'discarded') {
        discardedCount++;
      } else {
        pendingCount++;
      }

      if (!isNaN(numericId)) {
        await db
          .update(bankImportReviewQueue)
          .set({
            resolution: res,
            resolvedAt: res === 'pending' ? null : new Date().toISOString(),
          })
          .where(
            and(
              eq(bankImportReviewQueue.id, numericId),
              eq(bankImportReviewQueue.userId, userId)
            )
          );
      }
    }

    // If batch has no remaining 'pending' items, mark reconciliationStatus as 'BALANCED'
    if (resolvedBatchId && !isNaN(resolvedBatchId)) {
      const remainingPending = await db
        .select({ id: bankImportReviewQueue.id })
        .from(bankImportReviewQueue)
        .where(
          and(
            eq(bankImportReviewQueue.importBatchId, resolvedBatchId),
            eq(bankImportReviewQueue.resolution, 'pending')
          )
        );

      const isBalanced = remainingPending.length === 0;

      await db
        .update(statementImportBatches)
        .set({
          reconciliationStatus: isBalanced ? 'BALANCED' : 'UNRECONCILED',
        })
        .where(
          and(
            eq(statementImportBatches.id, resolvedBatchId),
            eq(statementImportBatches.userId, userId)
          )
        );
    }

    return NextResponse.json({
      success: true,
      batchId: resolvedBatchId,
      rowsCommitted: createdCount + mergedCount,
      createdCount,
      mergedCount,
      discardedCount,
      pendingCount,
    });
  }),
  { rateLimit: 'api' }
);
