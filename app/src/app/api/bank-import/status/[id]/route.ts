export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { statementImportBatches, bankImportReviewQueue } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/bank-import/status/[id]
 * Module 16: Statement Import Batch Status & Queue Summary
 * Returns reconciliation status, total records, and count of pending items.
 *
 * Rate limit: 'api'
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<{ id: string }> }>(async (request: NextRequest, { userId }, routeContext) => {
    const resolvedParams = await routeContext.params;
    const batchIdStr = resolvedParams?.id;
    const batchId = parseInt(batchIdStr, 10);

    if (isNaN(batchId)) {
      return NextResponse.json({ error: 'Valid batch ID is required' }, { status: 400 });
    }

    const [batch] = await db
      .select()
      .from(statementImportBatches)
      .where(and(eq(statementImportBatches.id, batchId), eq(statementImportBatches.userId, userId)));

    if (!batch) {
      return NextResponse.json({ error: 'Statement import batch not found' }, { status: 404 });
    }

    const queueItems = await db
      .select({
        id: bankImportReviewQueue.id,
        resolution: bankImportReviewQueue.resolution,
      })
      .from(bankImportReviewQueue)
      .where(eq(bankImportReviewQueue.importBatchId, batchId));

    const pendingCount = queueItems.filter((q) => q.resolution === 'pending').length;
    const resolvedCount = queueItems.length - pendingCount;
    const isBalanced = batch.reconciliationStatus === 'BALANCED' || (queueItems.length > 0 && pendingCount === 0);

    return NextResponse.json({
      batchId: batch.id,
      fileName: batch.fileName,
      bankName: batch.bankName,
      status: batch.status,
      reconciliationStatus: isBalanced ? 'BALANCED' : batch.reconciliationStatus,
      totalRecords: batch.totalRecords,
      totalQueueCount: queueItems.length,
      pendingCount,
      resolvedCount,
      isBalanced,
      createdAt: batch.createdAt,
    });
  }),
  { rateLimit: 'api' }
);
