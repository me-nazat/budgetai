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

export interface TaxExportData {
  taxYear: string;
  userName: string;
  totalDeductions: number;
  items: TaxExportItem[];
}

export function generateTaxPDF(data: TaxExportData): Uint8Array {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`WealthAI Tax Write-Off Summary - ${data.taxYear}`, 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Taxpayer: ${data.userName} | Generated: ${new Date().toLocaleDateString()}`, 14, 28);
  doc.text(`Total Claimed Deductions: $${data.totalDeductions.toFixed(2)}`, 14, 34);

  // Table
  const tableRows = data.items.map((item) => [
    item.date,
    item.merchant,
    item.taxCategory,
    `$${item.amount.toFixed(2)}`,
    `$${item.deductibleAmount.toFixed(2)}`,
    item.receiptRef,
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Date', 'Merchant / Payee', 'Tax Category', 'Total', 'Deductible', 'Receipt ID']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
  });

  return new Uint8Array(doc.output('arraybuffer'));
}

export async function generateTaxExcel(data: TaxExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Tax Deductions ${data.taxYear}`);

  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Merchant / Payee', key: 'merchant', width: 30 },
    { header: 'Tax Category', key: 'taxCategory', width: 25 },
    { header: 'Total Amount ($)', key: 'amount', width: 18 },
    { header: 'Deductible Amount ($)', key: 'deductibleAmount', width: 22 },
    { header: 'Receipt Reference', key: 'receiptRef', width: 20 },
  ];

  data.items.forEach((item) => {
    sheet.addRow(item);
  });

  // Add Summary Row
  sheet.addRow({});
  sheet.addRow({
    date: 'TOTAL',
    deductibleAmount: data.totalDeductions,
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
