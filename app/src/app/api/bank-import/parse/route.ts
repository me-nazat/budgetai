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
import {
  parseMultiPageStatementPDF,
  calculateMatchConfidence,
} from '@/lib/ai/statementParser';
import { AccountRepository } from '@/repositories/account.repository';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * POST /api/bank-import/parse
 * Module 16: AI-Powered Multi-Page Statement Parser + Duplicate-Reconciliation Queue
 * Accepts PDF up to 25MB, runs multi-page extraction via Gemini, populates
 * canonical statementImportBatches and bankImportReviewQueue with match confidence scoring.
 *
 * Ephemeral by default: statement PDF buffer is discarded from memory after extraction
 * unless opt-in retention is requested (retainFile: true).
 *
 * Rate limited to 'upload' (10/min).
 */
export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bankName = (formData.get('bankName') as string) || 'Primary Bank';
    const accountIdParam = formData.get('accountId') as string | null;
    const retainFile = formData.get('retainFile') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'Statement PDF or document file is required' }, { status: 400 });
    }

    // Resolve or auto-provision target account
    let targetAccountId = accountIdParam ? parseInt(accountIdParam, 10) : null;
    if (!targetAccountId || isNaN(targetAccountId)) {
      const [existingAcc] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .limit(1);

      if (existingAcc) {
        targetAccountId = existingAcc.id;
      } else {
        const newAcc = await AccountRepository.create({
          userId,
          name: bankName || 'Primary Checking',
          type: 'bank',
          currency: 'USD',
          openingBalance: 0,
        });
        targetAccountId = newAcc.id;
      }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    // Opt-in source file retention token
    let sourceFileToken: string | null = null;
    if (retainFile) {
      sourceFileToken = `sft_${crypto.randomUUID()}`;
    }

    try {
      // 1. Multi-page chunked parser via Gemini
      const parsedResult = await parseMultiPageStatementPDF(base64, file.name);

      // 2. Create canonical statementImportBatches record
      const [batch] = await db
        .insert(statementImportBatches)
        .values({
          userId,
          bankName,
          fileName: file.name,
          totalRecords: parsedResult.mergedTransactions.length,
          status: 'completed',
          reconciliationStatus: 'UNRECONCILED',
          openingBalance: parsedResult.openingBalance,
          closingBalance: parsedResult.closingBalance,
          periodStart: parsedResult.statementPeriod.start,
          periodEnd: parsedResult.statementPeriod.end,
          sourceFileToken,
        })
        .returning();

      // 3. Query user's existing ledger transactions to compute match confidence
      const userTxns = await db
        .select({
          id: transactions.id,
          date: transactions.date,
          amount: transactions.amount,
          description: transactions.description,
          category: transactions.category,
          type: transactions.type,
        })
        .from(transactions)
        .where(eq(transactions.userId, userId));

      // 4. Populate bankImportReviewQueue with match scoring
      const queueItems: any[] = [];
      let highConfidenceDuplicatesCount = 0;

      for (const tx of parsedResult.mergedTransactions) {
        let bestScore = 0;
        let matchedTx: any = null;

        for (const existing of userTxns) {
          const score = calculateMatchConfidence(
            { date: tx.date, amount: tx.amount, description: tx.description },
            { date: existing.date, amount: existing.amount, description: existing.description }
          );

          if (score > bestScore) {
            bestScore = score;
            matchedTx = existing;
          }
        }

        const isHighConfidence = bestScore >= 0.92;
        const isMediumConfidence = bestScore >= 0.7 && bestScore < 0.92;
        if (isHighConfidence) highConfidenceDuplicatesCount++;

        const [insertedItem] = await db
          .insert(bankImportReviewQueue)
          .values({
            userId,
            importBatchId: batch.id,
            parsedRowData: JSON.stringify({
              date: tx.date,
              description: tx.description,
              amount: tx.amount,
              type: tx.type === 'earning' ? 'earning' : 'expense',
              category: tx.suggestedCategory,
            }),
            possibleMatchTransactionId: (isHighConfidence || isMediumConfidence) && matchedTx ? matchedTx.id : null,
            matchConfidence: Math.round(bestScore * 100) / 100,
            resolution: 'pending',
          })
          .returning();

        queueItems.push({
          id: insertedItem.id,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          category: tx.suggestedCategory,
          type: tx.type === 'earning' ? 'earning' : 'expense',
          matchConfidence: Math.round(bestScore * 100) / 100,
          isDuplicate: isHighConfidence,
          matchedExistingTransactionId: (isHighConfidence || isMediumConfidence) && matchedTx ? matchedTx.id : null,
          matchedExistingTransaction: (isHighConfidence || isMediumConfidence) && matchedTx ? matchedTx : null,
          resolution: 'pending',
        });
      }

      return NextResponse.json({
        success: true,
        statementId: String(batch.id),
        batchId: batch.id,
        fileName: file.name,
        pageCount: parsedResult.pageCount,
        totalPagesParsed: parsedResult.pages.length,
        totalTransactionsCount: parsedResult.mergedTransactions.length,
        duplicateCount: highConfidenceDuplicatesCount,
        statementPeriod: parsedResult.statementPeriod,
        openingBalance: parsedResult.openingBalance,
        closingBalance: parsedResult.closingBalance,
        sourceFileToken,
        queueItems,
      });
    } catch (parseError: any) {
      console.error('[bank-import-parse] Parsing failed:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse bank statement', details: parseError?.message },
        { status: 500 }
      );
    }
  }),
  { rateLimit: 'upload' }
);
