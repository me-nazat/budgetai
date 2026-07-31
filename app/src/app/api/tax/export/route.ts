export const dynamic = 'force-dynamic';

/**
 * @fileoverview Tax deduction export API with multi-year and multi-sheet Excel export.
 *
 * GET /api/tax/export?year=2025&format=xlsx|csv|pdf
 * GET /api/tax/export?years=2024,2025,2026&format=xlsx
 *
 * @module api/tax/export
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { TaxRepository } from '@/repositories/tax.repository';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const yearsParam = searchParams.get('years');
    const singleYear = parseInt(searchParams.get('year') || `${new Date().getFullYear()}`, 10);
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    const targetYears: number[] = yearsParam
      ? yearsParam.split(',').map(y => parseInt(y.trim(), 10)).filter(y => !isNaN(y) && y > 2000)
      : [singleYear];

    if (targetYears.length === 0) targetYears.push(new Date().getFullYear());

    if (format === 'excel' || format === 'xlsx') {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();

      // Summary sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Tax Year', key: 'year', width: 15 },
        { header: 'Total Deductions Count', key: 'count', width: 25 },
        { header: 'Total Deductible Amount ($)', key: 'total', width: 30 },
      ];
      summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
      summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '136DEC' } };

      let grandTotal = 0;

      for (const yr of targetYears) {
        const summary = await TaxRepository.getTaxSummary(userId, yr);
        summarySheet.addRow({
          year: yr,
          count: summary.items.length,
          total: summary.totalDeductibleAmount,
        });
        grandTotal += summary.totalDeductibleAmount;

        const sheet = workbook.addWorksheet(`Tax ${yr}`);
        sheet.columns = [
          { header: 'ID', key: 'id', width: 10 },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Transaction Name', key: 'name', width: 30 },
          { header: 'Deduction Category', key: 'category', width: 25 },
          { header: 'Deductible Amount ($)', key: 'amount', width: 22 },
          { header: 'Receipt Verified', key: 'verified', width: 18 },
          { header: 'Status', key: 'status', width: 15 },
        ];

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '136DEC' } };

        summary.items.forEach((item) => {
          sheet.addRow({
            id: item.id,
            date: item.transactionDate || '',
            name: item.transactionName || '',
            category: item.deductionCategory,
            amount: item.deductibleAmount,
            verified: item.receiptDocumentId ? 'Yes (Linked)' : 'No',
            status: item.status,
          });
        });
      }

      summarySheet.addRow({ year: 'TOTAL', count: '', total: grandTotal });
      summarySheet.getRow(summarySheet.rowCount).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = targetYears.length === 1
        ? `WealthAI_Tax_Deductions_${targetYears[0]}.xlsx`
        : `WealthAI_Tax_Deductions_MultiYear_${targetYears.join('_')}.xlsx`;

      return new NextResponse(buffer as ArrayBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === 'pdf') {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      type PDFDocument = import('jspdf').jsPDF & { lastAutoTable?: { finalY: number } };
      const doc = new jsPDF() as PDFDocument;
      const summary = await TaxRepository.getTaxSummary(userId, targetYears[0]);

      doc.setFontSize(18);
      doc.text(`WealthAI Tax Deduction Schedule — ${targetYears[0]}`, 14, 20);

      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
      doc.text(`Total Deductible Amount: $${summary.totalDeductibleAmount.toFixed(2)}`, 14, 34);

      const tableRows = summary.items.map((item) => [
        item.id.toString(),
        item.transactionDate || '',
        item.transactionName || '',
        item.deductionCategory,
        `$${item.deductibleAmount.toFixed(2)}`,
        item.receiptDocumentId ? 'Verified' : 'Unverified',
        item.status,
      ]);

      autoTable(doc as import('jspdf').jsPDF, {
        startY: 42,
        head: [['ID', 'Date', 'Transaction Name', 'Category', 'Amount', 'Receipt', 'Status']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [19, 109, 236] },
      });

      const pdfArrayBuffer = doc.output('arraybuffer');
      return new NextResponse(pdfArrayBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="WealthAI_Tax_Deductions_${targetYears[0]}.pdf"`,
        },
      });
    }

    // Default CSV format
    const summary = await TaxRepository.getTaxSummary(userId, targetYears[0]);
    const csvHeaders = 'ID,Date,Transaction Name,Deduction Category,Deductible Amount ($),Receipt Verified,Status\n';
    const csvRows = summary.items
      .map(
        (item) =>
          `${item.id},"${item.transactionDate || ''}","${(item.transactionName || '').replace(/"/g, '""')}","${item.deductionCategory}",${item.deductibleAmount.toFixed(2)},"${item.receiptDocumentId ? 'Yes' : 'No'}",${item.status}`
      )
      .join('\n');

    return new NextResponse(csvHeaders + csvRows, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="WealthAI_Tax_Deductions_${targetYears[0]}.csv"`,
      },
    });
  })
);
