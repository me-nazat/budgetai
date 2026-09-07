import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

export interface TaxExportItem {
  date: string;
  merchant: string;
  taxCategory: string;
  amount: number;
  deductibleAmount: number;
  receiptRef: string;
}

export interface MissingReceiptItem {
  date: string;
  merchant: string;
  amount: number;
  reason: string;
}

export interface TaxCategorySummary {
  category: string;
  count: number;
  totalAmount: number;
  deductibleAmount: number;
}

export interface TaxExportData {
  taxYear: string;
  userName: string;
  jurisdiction?: string;
  totalDeductions: number;
  items: TaxExportItem[];
  missingReceipts?: MissingReceiptItem[];
  categoryBreakdown?: TaxCategorySummary[];
}

export function generateTaxPDF(data: TaxExportData): Uint8Array {
  const doc = new jsPDF();
  const jurisdiction = data.jurisdiction || 'US_IRS';

  // Header & Cover Banner
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text(`WealthAI Fiscal & Tax Report - ${data.taxYear}`, 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Taxpayer: ${data.userName} | Jurisdiction: ${jurisdiction} | Date: ${new Date().toLocaleDateString()}`, 14, 28);
  doc.text(`Total Certified Write-Offs: $${data.totalDeductions.toFixed(2)}`, 14, 34);

  // 1. Category Summary Table
  const catSummary = data.categoryBreakdown || [
    { category: 'Schedule C - Office & Software', count: data.items.length, totalAmount: data.totalDeductions, deductibleAmount: data.totalDeductions },
  ];

  autoTable(doc, {
    startY: 40,
    head: [['Deduction Category', 'Item Count', 'Gross Amount', 'Eligible Deductible']],
    body: catSummary.map((c) => [
      c.category,
      c.count,
      `$${c.totalAmount.toFixed(2)}`,
      `$${c.deductibleAmount.toFixed(2)}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
  });

  // 2. Itemized Transactions Table
  const itemStartY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 75;
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Itemized Qualifying Deductions', 14, itemStartY - 3);

  const tableRows = data.items.map((item) => [
    item.date,
    item.merchant,
    item.taxCategory,
    `$${item.amount.toFixed(2)}`,
    `$${item.deductibleAmount.toFixed(2)}`,
    item.receiptRef,
  ]);

  autoTable(doc, {
    startY: itemStartY,
    head: [['Date', 'Merchant / Payee', 'Tax Category', 'Total', 'Deductible', 'Receipt ID']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
  });

  // 3. Missing Receipts Callout (if any)
  if (data.missingReceipts && data.missingReceipts.length > 0) {
    const missingStartY = (doc as any).lastAutoTable.finalY + 12;
    if (missingStartY < 250) {
      doc.setFontSize(12);
      doc.setTextColor(239, 68, 68);
      doc.text('Action Required: Deductions with Missing Receipts (> $75)', 14, missingStartY);

      autoTable(doc, {
        startY: missingStartY + 4,
        head: [['Date', 'Merchant', 'Amount', 'Documentation Flag']],
        body: data.missingReceipts.map((m) => [m.date, m.merchant, `$${m.amount.toFixed(2)}`, m.reason]),
        theme: 'plain',
        headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255] },
        styles: { fontSize: 8 },
      });
    }
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

export async function generateTaxExcel(data: TaxExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WealthAI Fiscal Engine';
  workbook.created = new Date();

  // ── Sheet 1: Summary ──
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 35 },
  ];
  summarySheet.addRows([
    { metric: 'Tax Year', value: data.taxYear },
    { metric: 'Taxpayer', value: data.userName },
    { metric: 'Jurisdiction', value: data.jurisdiction || 'US_IRS' },
    { metric: 'Total Certified Deductions ($)', value: data.totalDeductions },
    { metric: 'Total Claimed Items', value: data.items.length },
    { metric: 'Report Generated At', value: new Date().toISOString() },
  ]);

  // ── Sheet 2: ByCategory ──
  const catSheet = workbook.addWorksheet('ByCategory');
  catSheet.columns = [
    { header: 'Tax Category', key: 'category', width: 32 },
    { header: 'Item Count', key: 'count', width: 14 },
    { header: 'Gross Amount ($)', key: 'totalAmount', width: 20 },
    { header: 'Deductible Amount ($)', key: 'deductibleAmount', width: 22 },
  ];
  const catSummary = data.categoryBreakdown || [
    { category: 'Schedule C - Standard Deductions', count: data.items.length, totalAmount: data.totalDeductions, deductibleAmount: data.totalDeductions },
  ];
  catSummary.forEach((c) => catSheet.addRow(c));

  // ── Sheet 3: ItemizedTransactions ──
  const itemSheet = workbook.addWorksheet('ItemizedTransactions');
  itemSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Merchant / Payee', key: 'merchant', width: 30 },
    { header: 'Tax Category', key: 'taxCategory', width: 25 },
    { header: 'Total Amount ($)', key: 'amount', width: 18 },
    { header: 'Deductible Amount ($)', key: 'deductibleAmount', width: 22 },
    { header: 'Receipt Reference', key: 'receiptRef', width: 20 },
  ];
  data.items.forEach((item) => itemSheet.addRow(item));
  itemSheet.addRow({});
  itemSheet.addRow({
    date: 'TOTAL',
    deductibleAmount: data.totalDeductions,
  });

  // ── Sheet 4: MissingReceipts ──
  const missingSheet = workbook.addWorksheet('MissingReceipts');
  missingSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Merchant', key: 'merchant', width: 30 },
    { header: 'Amount ($)', key: 'amount', width: 16 },
    { header: 'Compliance Reason', key: 'reason', width: 35 },
  ];
  (data.missingReceipts || []).forEach((m) => missingSheet.addRow(m));

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
