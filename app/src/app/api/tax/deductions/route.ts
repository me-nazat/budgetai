export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { TaxRepository } from '@/repositories/tax.repository';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || `${new Date().getFullYear()}`, 10);

    const summary = await TaxRepository.getTaxSummary(userId, year);
    return NextResponse.json(summary);
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { transactionId, taxYear, deductionCategory, deductibleAmount, receiptDocumentId } = body;

    if (!deductionCategory || deductibleAmount === undefined) {
      return NextResponse.json({ error: 'Category and amount are required' }, { status: 400 });
    }

    const item = await TaxRepository.flagDeduction({
      userId,
      transactionId: transactionId ? parseInt(transactionId, 10) : undefined,
      taxYear: taxYear ? parseInt(taxYear, 10) : new Date().getFullYear(),
      deductionCategory,
      deductibleAmount: parseFloat(deductibleAmount),
      receiptDocumentId: receiptDocumentId ? parseInt(receiptDocumentId, 10) : undefined,
    });

    return NextResponse.json(item, { status: 201 });
  })
);

export const DELETE = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Deduction ID required' }, { status: 400 });

    await TaxRepository.removeDeduction(parseInt(id, 10), userId);
    return NextResponse.json({ success: true });
  })
);
