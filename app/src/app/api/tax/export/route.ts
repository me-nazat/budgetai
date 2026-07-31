import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { generateTaxPDF, generateTaxExcel, TaxExportData } from '@/lib/export/taxExporter';

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2026';
  const format = searchParams.get('format') || 'pdf';

  const mockTaxData: TaxExportData = {
    taxYear: year,
    userName: `User #${userId}`,
    totalDeductions: 12450.0,
    items: [
      {
        date: `${year}-02-14`,
        merchant: 'Apple Store / Office Hardware',
        taxCategory: 'Schedule C - Office Equipment',
        amount: 2140.0,
        deductibleAmount: 2140.0,
        receiptRef: 'REC-90812',
      },
      {
        date: `${year}-03-01`,
        merchant: 'JetBrains / GitHub / Vercel Pro',
        taxCategory: 'Schedule C - Software & Subscriptions',
        amount: 1890.0,
        deductibleAmount: 1890.0,
        receiptRef: 'REC-90813',
      },
      {
        date: `${year}-04-10`,
        merchant: 'Delta Air Lines / Client Onsite Visit',
        taxCategory: 'Schedule C - Business Travel',
        amount: 8420.0,
        deductibleAmount: 8420.0,
        receiptRef: 'REC-90814',
      },
    ],
  };

  if (format === 'xlsx') {
    const excelBuffer = await generateTaxExcel(mockTaxData);
    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="WealthAI_TaxPack_${year}.xlsx"`,
      },
    });
  }

  // Default to PDF
  const pdfBytes = generateTaxPDF(mockTaxData);
  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="WealthAI_TaxPack_${year}.pdf"`,
    },
  });
});
