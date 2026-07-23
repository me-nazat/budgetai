export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { StatementRepository } from '@/repositories/statement.repository';

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { bankName, fileName, rows } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No transaction rows provided for commit' }, { status: 400 });
    }

    const batch = await StatementRepository.createBatch({
      userId,
      bankName: bankName || 'Imported Statement',
      fileName: fileName || 'statement.pdf',
      totalRecords: rows.length,
    });

    const committedTransactions = await StatementRepository.commitReconciledTransactions(
      userId,
      rows
    );

    return NextResponse.json({
      batchId: batch.id,
      committedCount: committedTransactions.length,
      transactions: committedTransactions,
    });
  })
);
