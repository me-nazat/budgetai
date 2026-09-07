export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  importedStatements,
  reconciliationQueue,
  module26StatementPages,
  transactions,
  accounts,
} from '@/db/schema';
import {
  parseMultiPageStatementPDF,
  calculateMatchConfidence,
} from '@/lib/ai/statementParser';
import { AccountRepository } from '@/repositories/account.repository';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/bank-import/parse
 * Module 16.1: Multi-Page PDF Bank/Card Statement Parser + Duplicate-Reconciliation Queue
 * Accepts PDF up to 25MB, runs multi-page chunked extraction, records each page in
 * module_26_statement_pages, and scores each entry against existing transactions.
 * Rate limited to 10 requests / min.
 */
export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bankName = (formData.get('bankName') as string) || 'Primary Bank';
    const accountIdParam = formData.get('accountId') as string | null;

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
    const statementId = uuidv4();

    // 1. Initialize statement status as PROCESSING
    await db.insert(importedStatements).values({
      id: statementId,
      userId,
      accountId: targetAccountId,
      fileName: file.name,
      pageCount: 1,
      multiPageStrategy: 'split-then-merge',
      reconciliationStatus: 'PROCESSING',
    });

    try {
      // 2. Multi-page chunked parser
      const parsedResult = await parseMultiPageStatementPDF(base64, file.name);

      // 3. Record each extracted page into module_26_statement_pages
      for (const page of parsedResult.pages) {
        await db.insert(module26StatementPages).values({
          id: uuidv4(),
          statementId,
          pageNumber: page.pageNumber,
          rawText: page.rawTextSummary,
          parsedJson: JSON.stringify(page.transactions),
          parseStatus: 'parsed',
        });
      }

      // 4. Query user's existing ledger transactions to compute confidence score
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

      // 5. Populate reconciliation_queue with scoring rubric
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

        const queueId = uuidv4();
        const initialResolution = isHighConfidence ? 'merged' : 'kept_both';

        await db.insert(reconciliationQueue).values({
          id: queueId,
          statementId,
          transactionDate: tx.date,
          description: tx.description,
          amount: tx.amount,
          categorySuggestion: tx.suggestedCategory,
          matchConfidence: bestScore,
          isDuplicate: isHighConfidence ? 1 : 0,
          matchedExistingTransactionId: (isHighConfidence || isMediumConfidence) && matchedTx ? matchedTx.id : null,
          resolution: initialResolution,
          reviewStatus: 'PENDING',
        });

        queueItems.push({
          id: queueId,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          category: tx.suggestedCategory,
          type: tx.type === 'earning' ? 'earning' : 'expense',
          matchConfidence: bestScore,
          isDuplicate: isHighConfidence,
          matchedExistingTransactionId: (isHighConfidence || isMediumConfidence) && matchedTx ? matchedTx.id : null,
          matchedExistingTransaction: (isHighConfidence || isMediumConfidence) && matchedTx ? matchedTx : null,
          resolution: initialResolution,
        });
      }

      // 6. Update statement metadata & status
      await db
        .update(importedStatements)
        .set({
          statementPeriodStart: parsedResult.statementPeriod.start,
          statementPeriodEnd: parsedResult.statementPeriod.end,
          openingBalance: parsedResult.openingBalance,
          closingBalance: parsedResult.closingBalance,
          pageCount: parsedResult.pageCount,
          totalTransactionsCount: parsedResult.mergedTransactions.length,
          reconciliationStatus: 'UNRECONCILED',
        })
        .where(eq(importedStatements.id, statementId));

      return NextResponse.json({
        success: true,
        statementId,
        fileName: file.name,
        pageCount: parsedResult.pageCount,
        totalPagesParsed: parsedResult.pages.length,
        totalTransactionsCount: parsedResult.mergedTransactions.length,
        duplicateCount: highConfidenceDuplicatesCount,
        statementPeriod: parsedResult.statementPeriod,
        openingBalance: parsedResult.openingBalance,
        closingBalance: parsedResult.closingBalance,
        queueItems,
      });
    } catch (parseError: any) {
      await db
        .update(importedStatements)
        .set({ reconciliationStatus: 'FAILED' })
        .where(eq(importedStatements.id, statementId));

      return NextResponse.json(
        { error: 'Failed to parse multi-page statement', details: parseError?.message },
        { status: 500 }
      );
    }
  }),
  { rateLimit: 'upload' }
);
