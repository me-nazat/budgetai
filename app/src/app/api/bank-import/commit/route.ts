export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  statementImportBatches,
  bankImportReviewQueue,
  transactions,
  accounts,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

interface CommitItem {
  id: number | string;
  resolution?: 'merged' | 'kept_both' | 'discarded' | 'pending';
  action?: 'import' | 'skip';
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
 * Updates bankImportReviewQueue items and inserts confirmed rows ('kept_both' or action: 'import')
 * into the canonical transactions ledger inside an atomic DB transaction.
 * Automatically adjusts the target account's currentBalance by the net impact.
 * Sets statement reconciliationStatus to 'BALANCED' when all batch items are resolved.
 *
 * Rate limit: 'api'
 */
export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const {
      statementId,
      batchId,
      accountId: accountIdParam,
      items = [],
    } = body;

    const resolvedBatchId = Number(batchId || statementId);
    let targetAccountId = accountIdParam ? parseInt(String(accountIdParam), 10) : null;
    if (isNaN(targetAccountId as number)) targetAccountId = null;

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
        if (!targetAccountId && parsed.accountId) {
          targetAccountId = Number(parsed.accountId);
        }
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

    // Fallback to user's first account if targetAccountId still missing
    if (!targetAccountId) {
      const [firstAcc] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .limit(1);
      if (firstAcc) {
        targetAccountId = firstAcc.id;
      }
    }

    // Atomic execution inside db.transaction
    const result = await db.transaction(async (tx) => {
      let createdCount = 0;
      let mergedCount = 0;
      let discardedCount = 0;
      let pendingCount = 0;
      let netBalanceImpact = 0;

      for (const item of itemsToProcess) {
        // Map user action / resolution: action 'import' -> 'kept_both', action 'skip' -> 'merged'
        let res: 'kept_both' | 'merged' | 'discarded' | 'pending' = 'pending';
        if (item.action === 'import') {
          res = 'kept_both';
        } else if (item.action === 'skip') {
          res = 'merged';
        } else if (item.resolution) {
          res = item.resolution;
        }

        const numericId =
          typeof item.id === 'string'
            ? parseInt(item.id.replace(/\D/g, ''), 10)
            : item.id;

        if (res === 'kept_both') {
          const amt = Math.abs(item.amount || 0);
          const isEarning = item.type === 'earning';

          await tx.insert(transactions).values({
            userId,
            accountId: targetAccountId || null,
            type: isEarning ? 'earning' : 'expense',
            amount: amt,
            category: item.category || 'Other',
            description: item.description || 'Reconciled Bank Transaction',
            date: item.date || new Date().toISOString().split('T')[0],
          });

          createdCount++;
          netBalanceImpact += isEarning ? amt : -amt;
        } else if (res === 'merged') {
          mergedCount++;
        } else if (res === 'discarded') {
          discardedCount++;
        } else {
          pendingCount++;
        }

        if (!isNaN(numericId) && numericId > 0) {
          await tx
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

      // Atomically update target account's currentBalance
      let updatedAccountBalance: number | null = null;
      if (targetAccountId && netBalanceImpact !== 0) {
        await tx
          .update(accounts)
          .set({
            currentBalance: sql`${accounts.currentBalance} + ${netBalanceImpact}`,
          })
          .where(and(eq(accounts.id, targetAccountId), eq(accounts.userId, userId)));

        const [updatedAcc] = await tx
          .select({ currentBalance: accounts.currentBalance })
          .from(accounts)
          .where(eq(accounts.id, targetAccountId))
          .limit(1);

        if (updatedAcc) {
          updatedAccountBalance = updatedAcc.currentBalance;
        }
      }

      // If batch has no remaining 'pending' items, mark reconciliationStatus as 'BALANCED'
      if (resolvedBatchId && !isNaN(resolvedBatchId)) {
        const remainingPending = await tx
          .select({ id: bankImportReviewQueue.id })
          .from(bankImportReviewQueue)
          .where(
            and(
              eq(bankImportReviewQueue.importBatchId, resolvedBatchId),
              eq(bankImportReviewQueue.resolution, 'pending')
            )
          );

        const isBalanced = remainingPending.length === 0;

        await tx
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

      return {
        batchId: resolvedBatchId,
        rowsCommitted: createdCount + mergedCount,
        createdCount,
        mergedCount,
        discardedCount,
        pendingCount,
        netBalanceImpact: Math.round(netBalanceImpact * 100) / 100,
        targetAccountId,
        updatedAccountBalance,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  }),
  { rateLimit: 'api' }
);
