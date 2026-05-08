'use client';

import { useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';

export default function ReportsPage() {
    const [reportType, setReportType] = useState('full_summary');
    const [dateRange, setDateRange] = useState('30');
    const [format, setFormat] = useState('both');
    const [generating, setGenerating] = useState(false);
    const { currency } = useCurrency();
    const sym = CURRENCIES[currency].symbol;

    const generateReport = async () => {
        setGenerating(true);
        try {
            const days = parseInt(dateRange);
            const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const end = new Date().toISOString().split('T')[0];

            const res = await fetch(`/api/transactions?start=${start}&end=${end}&limit=1000`);
            const { transactions } = await res.json();
            if (!transactions || transactions.length === 0) { alert('No data found for the selected period'); setGenerating(false); return; }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const totalExp = transactions.filter((t: any) => t.type === 'expense').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const totalEarn = transactions.filter((t: any) => t.type === 'earning').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
            const net = totalEarn - totalExp;

            // Build category breakdown
            const catMap: Record<string, { expenses: number; earnings: number }> = {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            transactions.forEach((t: any) => {
                if (!catMap[t.category]) catMap[t.category] = { expenses: 0, earnings: 0 };
                if (t.type === 'expense') catMap[t.category].expenses += t.amount;
                else catMap[t.category].earnings += t.amount;
            });
            const catBreakdown = Object.entries(catMap).sort((a, b) => (b[1].expenses + b[1].earnings) - (a[1].expenses + a[1].earnings));

            // ==================== EXCEL ====================
            if (format === 'excel' || format === 'both') {
                const ExcelJS = await import('exceljs');
                const wb = new ExcelJS.Workbook();
                wb.creator = 'Wealth AI';
                wb.created = new Date();

                // --- Sheet 1: Transactions ---
                const ws = wb.addWorksheet('Transactions');
                // Title row
                const titleRow = ws.addRow(['Wealth AI — Financial Report']);
                titleRow.font = { bold: true, size: 16, color: { argb: 'FF136DEC' } };
                ws.mergeCells('A1:F1');
                const subRow = ws.addRow([`Period: ${start} to ${end}  |  Generated: ${new Date().toLocaleString()}`]);
                subRow.font = { italic: true, size: 10, color: { argb: 'FF888888' } };
                ws.mergeCells('A2:F2');
                ws.addRow([]);

                // Headers
                ws.columns = [
                    { width: 14 }, { width: 10 }, { width: 16 }, { width: 35 }, { width: 18 }, { width: 5 },
                ];
                const headerRow = ws.addRow(['Date', 'Type', 'Category', 'Description', 'Amount', '']);
                headerRow.eachCell((cell, colNum) => {
                    if (colNum <= 5) {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF136DEC' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.border = { bottom: { style: 'thin', color: { argb: 'FF0A47A3' } } };
                    }
                });
                headerRow.height = 28;

                // Data rows with +/- and coloring
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                transactions.forEach((t: any) => {
                    const isExpense = t.type === 'expense';
                    const sign = isExpense ? '−' : '+';
                    const row = ws.addRow([
                        t.date,
                        isExpense ? '▼ Expense' : '▲ Earning',
                        t.category,
                        t.description,
                        `${sign} ${sym}${t.amount.toFixed(2)}`,
                    ]);
                    row.eachCell((cell, colNum) => {
                        if (colNum <= 5) {
                            cell.fill = {
                                type: 'pattern', pattern: 'solid',
                                fgColor: { argb: isExpense ? 'FFFEF2F2' : 'FFF0FDF4' },
                            };
                            cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
                        }
                        if (colNum === 2) cell.font = { color: { argb: isExpense ? 'FFEF4444' : 'FF22C55E' }, bold: true };
                        if (colNum === 5) {
                            cell.font = { bold: true, color: { argb: isExpense ? 'FFDC2626' : 'FF16A34A' } };
                            cell.alignment = { horizontal: 'right' };
                        }
                    });
                });

                // Spacer + Summary rows
                ws.addRow([]);
                const sumHeader = ws.addRow(['', '', '', 'SUMMARY', '', '']);
                sumHeader.getCell(4).font = { bold: true, size: 12, color: { argb: 'FF136DEC' } };

                const expRow = ws.addRow(['', '', '', 'Total Expenses', `− ${sym}${totalExp.toFixed(2)}`]);
                expRow.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };
                expRow.getCell(5).alignment = { horizontal: 'right' };
                expRow.getCell(4).font = { bold: true };

                const earnRow = ws.addRow(['', '', '', 'Total Earnings', `+ ${sym}${totalEarn.toFixed(2)}`]);
                earnRow.getCell(5).font = { bold: true, color: { argb: 'FF16A34A' } };
                earnRow.getCell(5).alignment = { horizontal: 'right' };
                earnRow.getCell(4).font = { bold: true };

                const netRow = ws.addRow(['', '', '', 'Net Balance', `${net >= 0 ? '+' : '−'} ${sym}${Math.abs(net).toFixed(2)}`]);
                netRow.getCell(4).font = { bold: true, size: 12 };
                netRow.getCell(5).font = { bold: true, size: 12, color: { argb: net >= 0 ? 'FF16A34A' : 'FFDC2626' } };
                netRow.getCell(5).alignment = { horizontal: 'right' };
                [expRow, earnRow, netRow].forEach(r => {
                    r.getCell(4).border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
                    r.getCell(5).border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
                });

                // --- Sheet 2: Category Breakdown ---
                const ws2 = wb.addWorksheet('Category Breakdown');
                ws2.columns = [{ width: 20 }, { width: 18 }, { width: 18 }, { width: 18 }];
                const catTitle = ws2.addRow(['Spending by Category']);
                catTitle.font = { bold: true, size: 14, color: { argb: 'FF136DEC' } };
                ws2.mergeCells('A1:D1');
                ws2.addRow([]);
                const catHeader = ws2.addRow(['Category', 'Expenses', 'Earnings', 'Net']);
                catHeader.eachCell(cell => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF136DEC' } };
                    cell.alignment = { horizontal: 'center' };
                });
                catBreakdown.forEach(([cat, data]) => {
                    const catNet = data.earnings - data.expenses;
                    const row = ws2.addRow([
                        cat,
                        data.expenses > 0 ? `− ${sym}${data.expenses.toFixed(2)}` : '—',
                        data.earnings > 0 ? `+ ${sym}${data.earnings.toFixed(2)}` : '—',
                        `${catNet >= 0 ? '+' : '−'} ${sym}${Math.abs(catNet).toFixed(2)}`,
                    ]);
                    row.getCell(2).font = { color: { argb: 'FFDC2626' } };
                    row.getCell(3).font = { color: { argb: 'FF16A34A' } };
                    row.getCell(4).font = { bold: true, color: { argb: catNet >= 0 ? 'FF16A34A' : 'FFDC2626' } };
                    row.eachCell(cell => { cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }; });
                });

                const buffer = await wb.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `Report_${reportType}_${end}.xlsx`; a.click();
                URL.revokeObjectURL(url);
            }

            // ==================== PDF ====================
            if (format === 'pdf' || format === 'both') {
                const { default: jsPDF } = await import('jspdf');
                const { default: autoTable } = await import('jspdf-autotable');
                const doc = new jsPDF();

                // Header bar
                doc.setFillColor(19, 109, 236);
                doc.rect(0, 0, 210, 32, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(20);
                doc.text('Wealth AI', 14, 16);
                doc.setFontSize(10);
                doc.text(`Financial Report  •  ${reportType.replace('_', ' ')}  •  Last ${dateRange} days`, 14, 25);

                // Subtitle
                doc.setTextColor(100, 100, 100);
                doc.setFontSize(9);
                doc.text(`Generated: ${new Date().toLocaleString()}  |  Period: ${start} to ${end}`, 14, 40);

                // Transaction table with +/- and colored type
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                autoTable(doc as any, {
                    startY: 46,
                    head: [['Date', 'Type', 'Category', 'Description', 'Amount']],
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    body: transactions.map((t: any) => {
                        const isExp = t.type === 'expense';
                        return [t.date, isExp ? 'Expense' : 'Earning', t.category, t.description, `${isExp ? '-' : '+'} ${sym}${t.amount.toFixed(2)}`];
                    }),
                    theme: 'striped',
                    headStyles: { fillColor: [19, 109, 236], textColor: 255, fontStyle: 'bold', halign: 'center' },
                    columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    didParseCell: (data: any) => {
                        if (data.section === 'body') {
                            const rowData = data.row.raw as string[];
                            const isExp = rowData[1]?.includes('Expense');
                            if (data.column.index === 1) data.cell.styles.textColor = isExp ? [220, 38, 38] : [22, 163, 74];
                            if (data.column.index === 4) data.cell.styles.textColor = isExp ? [220, 38, 38] : [22, 163, 74];
                        }
                    },
                    styles: { fontSize: 9, cellPadding: 4 },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let y = (doc as any).lastAutoTable?.finalY || 100;
                y += 10;

                // Category Breakdown table
                doc.setTextColor(19, 109, 236);
                doc.setFontSize(13);
                doc.text('Category Breakdown', 14, y);
                y += 4;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                autoTable(doc as any, {
                    startY: y,
                    head: [['Category', 'Expenses', 'Earnings', 'Net']],
                    body: catBreakdown.map(([cat, data]) => {
                        const catNet = data.earnings - data.expenses;
                        return [
                            cat,
                            data.expenses > 0 ? `- ${sym}${data.expenses.toFixed(2)}` : '—',
                            data.earnings > 0 ? `+ ${sym}${data.earnings.toFixed(2)}` : '—',
                            `${catNet >= 0 ? '+' : '-'} ${sym}${Math.abs(catNet).toFixed(2)}`,
                        ];
                    }),
                    theme: 'grid',
                    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', halign: 'center' },
                    columnStyles: { 1: { textColor: [220, 38, 38] }, 2: { textColor: [22, 163, 74] }, 3: { halign: 'right', fontStyle: 'bold' } },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    didParseCell: (data: any) => {
                        if (data.section === 'body' && data.column.index === 3) {
                            const val = String(data.cell.raw);
                            data.cell.styles.textColor = val.startsWith('+') ? [22, 163, 74] : [220, 38, 38];
                        }
                    },
                    styles: { fontSize: 9, cellPadding: 3 },
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                y = (doc as any).lastAutoTable?.finalY || y + 40;
                y += 12;

                // Summary box
                doc.setFillColor(248, 250, 252);
                doc.roundedRect(14, y - 4, 182, 38, 3, 3, 'F');
                doc.setDrawColor(19, 109, 236);
                doc.roundedRect(14, y - 4, 182, 38, 3, 3, 'S');

                doc.setFontSize(12);
                doc.setTextColor(30, 41, 59);
                doc.text('Summary', 20, y + 4);

                doc.setFontSize(10);
                doc.setTextColor(220, 38, 38);
                doc.text(`Total Expenses:  - ${sym}${totalExp.toFixed(2)}`, 20, y + 14);
                doc.setTextColor(22, 163, 74);
                doc.text(`Total Earnings:  + ${sym}${totalEarn.toFixed(2)}`, 20, y + 22);
                doc.setTextColor(net >= 0 ? 22 : 220, net >= 0 ? 163 : 38, net >= 0 ? 74 : 38);
                doc.setFontSize(11);
                doc.text(`Net Balance:  ${net >= 0 ? '+' : '-'} ${sym}${Math.abs(net).toFixed(2)}`, 20, y + 30);

                const pdfBlob = doc.output('blob');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                const pdfA = document.createElement('a');
                pdfA.href = pdfUrl;
                pdfA.download = `Report_${reportType}_${end}.pdf`;
                pdfA.click();
                URL.revokeObjectURL(pdfUrl);
            }
        } catch (err) {
            console.error(err);
            alert('Error generating report');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
            <header className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Reports & Exports</h1>
                <p className="text-gray-500 dark:text-text-muted text-sm">Generate detailed financial reports. Select parameters below.</p>
            </header>

            <div className="card-premium rounded-2xl p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary text-sm">1</span>
                    Report Configuration
                </h2>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-text-muted mb-3">Report Type</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[{ id: 'full_summary', icon: 'summarize', label: 'Full Summary', desc: 'Complete financial overview' },
                            { id: 'budget_breakdown', icon: 'donut_small', label: 'Budget Breakdown', desc: 'Spending vs. Limits' },
                            { id: 'expense_log', icon: 'receipt_long', label: 'Expense Log', desc: 'Detailed history' }].map(t => (
                                <button key={t.id} onClick={() => setReportType(t.id)}
                                    className={`rounded-lg border p-4 text-left transition-all ${reportType === t.id ? 'border-primary bg-primary/10' : 'border-gray-200 dark:border-surface-border bg-gray-50 dark:bg-surface-hover/50 hover:border-primary/50'}`}>
                                    <span className={`material-symbols-outlined text-3xl mb-2 ${reportType === t.id ? 'text-primary' : 'text-gray-400'}`}>{t.icon}</span>
                                    <div className="font-medium text-gray-900 dark:text-white">{t.label}</div>
                                    <div className="text-xs text-gray-500 dark:text-text-muted mt-1">{t.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-text-muted mb-3">Date Range</label>
                            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-surface-border bg-gray-50 dark:bg-surface-hover px-4 py-3 text-gray-900 dark:text-white outline-none focus:border-primary">
                                <option value="7">Last 7 Days</option>
                                <option value="15">Last 15 Days</option>
                                <option value="30">Last 30 Days</option>
                                <option value="90">Last Quarter</option>
                                <option value="365">This Year</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-text-muted mb-3">Format</label>
                            <div className="flex gap-3">
                                {[{ id: 'both', icon: 'file_copy', label: 'Both' }, { id: 'pdf', icon: 'picture_as_pdf', label: 'PDF' }, { id: 'excel', icon: 'table_view', label: 'Excel' }].map(f => (
                                    <button key={f.id} onClick={() => setFormat(f.id)}
                                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-3 transition-all ${format === f.id ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-surface-border text-gray-400 hover:border-primary/50'}`}>
                                        <span className="material-symbols-outlined">{f.icon}</span>
                                        <span className="font-medium">{f.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-surface-border flex justify-end">
                    <button onClick={generateReport} disabled={generating}
                        className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all disabled:opacity-50">
                        <span className="material-symbols-outlined">{generating ? 'hourglass_top' : 'download'}</span>
                        {generating ? 'Generating...' : 'Generate Report'}
                    </button>
                </div>
            </div>
        </div>
    );
}
