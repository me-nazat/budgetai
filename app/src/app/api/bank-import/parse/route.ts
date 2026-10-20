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
  automationRules,
} from '@/db/schema';
import {
  parseMultiPageStatementPDF,
  parseStatementCSV,
  reconcileWithLedger,
  ParsedStatementResult,
} from '@/lib/ai/statementParser';
import { AccountRepository } from '@/repositories/account.repository';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * POST /api/bank-import/parse
 * Module 16: Multi-Page Statement Parser + Duplicate-Reconciliation Queue
 * Automatically distinguishes CSV/TSV files (zero LLM latency/cost) from PDF statements.
 * Populates statementImportBatches and bankImportReviewQueue with match confidence scoring.
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
      return NextResponse.json({ error: 'Statement file (CSV, TSV, or PDF) is required' }, { status: 400 });
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

    // Opt-in source file retention token
    let sourceFileToken: string | null = null;
    if (retainFile) {
      sourceFileToken = `sft_${crypto.randomUUID()}`;
    }

    try {
      const fileNameLower = file.name.toLowerCase();
      const isCSV =
        fileNameLower.endsWith('.csv') ||
        fileNameLower.endsWith('.tsv') ||
        fileNameLower.endsWith('.txt') ||
        file.type.includes('csv') ||
        file.type.includes('tab') ||
        file.type.includes('text');

      let parsedResult: ParsedStatementResult;
      let pageCount = 1;
      let pagesCount = 1;

      if (isCSV) {
        // Fast deterministic CSV/TSV parsing without LLM invocation
        const csvText = await file.text();
        parsedResult = parseStatementCSV(csvText);
        pageCount = 1;
        pagesCount = 1;
      } else {
        // PDF parser via Gemini structured extraction (or fallback)
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = buffer.toString('base64');
        const multiPage = await parseMultiPageStatementPDF(base64, file.name);

        parsedResult = {
          accountNumberLast4: multiPage.accountNumberLast4,
          statementPeriod: multiPage.statementPeriod,
          openingBalance: multiPage.openingBalance,
          closingBalance: multiPage.closingBalance,
          transactions: multiPage.mergedTransactions,
        };
        pageCount = multiPage.pageCount;
        pagesCount = multiPage.pages.length;
      }

      // 1. Fetch user's active automation rules to auto-categorize
      const userRules = await db
        .select({
          triggerValue: automationRules.triggerValue,
          actionValue: automationRules.actionValue,
        })
        .from(automationRules)
        .where(and(eq(automationRules.userId, userId), eq(automationRules.active, 1)));

      // 2. Fetch existing transactions to detect duplicates
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

      // 3. Reconcile with ledger
      const reconciledItems = reconcileWithLedger(
        parsedResult.transactions,
        userTxns,
        userRules
      );

      // 4. Create canonical statementImportBatches record
      const [batch] = await db
        .insert(statementImportBatches)
        .values({
          userId,
          bankName,
          fileName: file.name,
          totalRecords: reconciledItems.length,
          status: 'completed',
          reconciliationStatus: 'UNRECONCILED',
          openingBalance: parsedResult.openingBalance,
          closingBalance: parsedResult.closingBalance,
          periodStart: parsedResult.statementPeriod.start,
          periodEnd: parsedResult.statementPeriod.end,
          sourceFileToken,
        })
        .returning();

      // 5. Populate review queue
      const queueItems: any[] = [];
      let exactMatchCount = 0;
      let probableDuplicateCount = 0;
      let newTransactionCount = 0;

      for (const item of reconciledItems) {
        if (item.status === 'exact_match') exactMatchCount++;
        else if (item.status === 'probable_duplicate') probableDuplicateCount++;
        else newTransactionCount++;

        const isDuplicate = item.status === 'exact_match' || item.status === 'probable_duplicate';

        const [insertedItem] = await db
          .insert(bankImportReviewQueue)
          .values({
            userId,
            importBatchId: batch.id,
            parsedRowData: JSON.stringify({
              date: item.date,
              description: item.description,
              amount: item.amount,
              type: item.type,
              category: item.category,
              accountId: targetAccountId,
              status: item.status,
            }),
            possibleMatchTransactionId: item.matchedExistingTransactionId,
            matchConfidence: item.matchConfidence,
            resolution: item.status === 'exact_match' ? 'merged' : 'pending',
          })
          .returning();

        queueItems.push({
          id: insertedItem.id,
          date: item.date,
          description: item.description,
          amount: item.amount,
          category: item.category,
          type: item.type,
          status: item.status,
          matchConfidence: item.matchConfidence,
          isDuplicate,
          matchedExistingTransactionId: item.matchedExistingTransactionId,
          matchedExistingTransaction: item.matchedExistingTransaction,
          resolution: item.status === 'exact_match' ? 'merged' : 'pending',
          action: item.status === 'exact_match' ? 'skip' : 'import',
        });
      }

      return NextResponse.json({
        success: true,
        statementId: String(batch.id),
        batchId: batch.id,
        targetAccountId,
        fileName: file.name,
        pageCount,
        totalPagesParsed: pagesCount,
        totalTransactionsCount: reconciledItems.length,
        exactMatchCount,
        probableDuplicateCount,
        newTransactionCount,
        duplicateCount: exactMatchCount + probableDuplicateCount,
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
