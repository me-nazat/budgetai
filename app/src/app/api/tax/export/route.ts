export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { TaxRepository } from '@/repositories/tax.repository';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || `${new Date().getFullYear()}`, 10);
    const format = searchParams.get('format') || 'csv';

    const summary = await TaxRepository.getTaxSummary(userId, year);

    if (format === 'csv') {
      const csvHeaders = 'ID,Date,Transaction Name,Deduction Category,Deductible Amount ($),Status\n';
      const csvRows = summary.items
        .map(
          (item) =>
            `${item.id},"${item.transactionDate || ''}","${(item.transactionName || '').replace(/"/g, '""')}","${item.deductionCategory}",${item.deductibleAmount.toFixed(2)},${item.status}`
        )
        .join('\n');

      return new NextResponse(csvHeaders + csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="WealthAI_Tax_Deductions_${year}.csv"`,
        },
      });
    }

    // JSON summary fallback for PDF client renderer
    return NextResponse.json(summary);
  })
);
