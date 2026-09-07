export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { importedStatements, module26StatementPages, reconciliationQueue } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/bank-import/status/[id]
 * Module 16.1: Live Parsing Progress & Status Tracker
 * Returns multi-page PDF parse progress (percentage, pages parsed vs total, and readiness).
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<{ id: string }> }>(async (request: NextRequest, { userId }, routeContext) => {
    const resolvedParams = await routeContext.params;
    const statementId = resolvedParams?.id;

    if (!statementId) {
      return NextResponse.json({ error: 'Statement ID is required' }, { status: 400 });
    }

    const [statement] = await db
      .select()
      .from(importedStatements)
      .where(and(eq(importedStatements.id, statementId), eq(importedStatements.userId, userId)));

    if (!statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    // Fetch parsed pages count
    const pages = await db
      .select({
        id: module26StatementPages.id,
        pageNumber: module26StatementPages.pageNumber,
        parseStatus: module26StatementPages.parseStatus,
      })
      .from(module26StatementPages)
      .where(eq(module26StatementPages.statementId, statementId));

    const totalPages = Math.max(statement.pageCount || 1, pages.length || 1);
    const parsedPagesCount = pages.filter((p) => p.parseStatus === 'parsed').length;

    let percentage = 0;
    const isReady = statement.reconciliationStatus === 'UNRECONCILED' || statement.reconciliationStatus === 'COMMITTED';
    const isFailed = statement.reconciliationStatus === 'FAILED';

    if (isReady) {
      percentage = 100;
    } else if (isFailed) {
      percentage = 0;
    } else {
      percentage = Math.min(95, Math.round((parsedPagesCount / totalPages) * 100));
    }

    // If ready, also fetch queue summary
    let pendingQueueCount = 0;
    if (isReady) {
      const queue = await db
        .select({ id: reconciliationQueue.id })
        .from(reconciliationQueue)
        .where(eq(reconciliationQueue.statementId, statementId));
      pendingQueueCount = queue.length;
    }

    return NextResponse.json({
      statementId,
      fileName: statement.fileName,
      status: statement.reconciliationStatus,
      pageCount: totalPages,
      pagesParsed: parsedPagesCount,
      percentage,
      totalTransactions: statement.totalTransactionsCount,
      pendingQueueCount,
      ready: isReady,
      failed: isFailed,
    });
  })
);
