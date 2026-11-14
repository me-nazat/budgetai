export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { TaxRepository } from '@/repositories/tax.repository';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || `${new Date().getFullYear()}`, 10);
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    const summary = await TaxRepository.getTaxSummary(userId, year);

    if (format === 'pdf') {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      type PDFDocument = import('jspdf').jsPDF & { lastAutoTable?: { finalY: number } };
      const doc = new jsPDF() as PDFDocument;

      doc.setFontSize(18);
      doc.text(`WealthAI Tax Deduction Schedule — ${year}`, 14, 20);

      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
      doc.text(`Total Deductible Amount: $${summary.totalDeductibleAmount.toFixed(2)}`, 14, 34);

      const tableRows = summary.items.map((item) => [
        item.id.toString(),
        item.transactionDate || '',
        item.transactionName || '',
        item.deductionCategory,
        `$${item.deductibleAmount.toFixed(2)}`,
        item.status,
      ]);

      autoTable(doc as import('jspdf').jsPDF, {
        startY: 42,
        head: [['ID', 'Date', 'Transaction Name', 'Category', 'Amount', 'Status']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [19, 109, 236] },
      });

      const pdfArrayBuffer = doc.output('arraybuffer');
      return new NextResponse(pdfArrayBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="WealthAI_Tax_Deductions_${year}.pdf"`,
        },
      });
    }

    if (format === 'excel' || format === 'xlsx') {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Tax ${year}`);

      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Transaction Name', key: 'name', width: 30 },
        { header: 'Deduction Category', key: 'category', width: 25 },
        { header: 'Deductible Amount ($)', key: 'amount', width: 22 },
        { header: 'Status', key: 'status', width: 15 },
      ];

      summary.items.forEach((item) => {
        worksheet.addRow({
          id: item.id,
          date: item.transactionDate || '',
          name: item.transactionName || '',
          category: item.deductionCategory,
          amount: item.deductibleAmount,
          status: item.status,
        });
      });

      // Style header row
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '136DEC' },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer as ArrayBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="WealthAI_Tax_Deductions_${year}.xlsx"`,
        },
      });
    }

    // Default CSV format
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
  })
);
