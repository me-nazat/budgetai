'use client';

import { useState, useMemo } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { HealthScoreWidget } from '@/components/dashboard/HealthScoreWidget';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface Transaction {
    id: number;
    type: 'expense' | 'earning';
    amount: number;
    category: string;
    description: string;
    date: string;
}

export default function ReportsPage() {
    const [reportType, setReportType] = useState('full_summary');
    const [dateRange, setDateRange] = useState('30');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [format, setFormat] = useState('live');
    const [generating, setGenerating] = useState(false);
    const [liveData, setLiveData] = useState<{
        transactions: Transaction[],
        totalExp: number,
        totalEarn: number,
        catBreakdown: [string, { expenses: number; earnings: number }][]
    } | null>(null);

    const { currency, fmt } = useCurrency();
    const sym = CURRENCIES[currency].symbol;

    const generateReport = async () => {
        setGenerating(true);
        try {
            let start = '', end = '';
            if (dateRange === 'custom') {
                if (!customStart || !customEnd) { alert('Please select start and end dates'); setGenerating(false); return; }
                start = customStart;
                end = customEnd;
            } else {
                const days = parseInt(dateRange);
                start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                end = new Date().toISOString().split('T')[0];
            }

            const res = await fetch(`/api/transactions?start=${start}&end=${end}&limit=5000`);
            const { transactions } = await res.json();
            if (!transactions || transactions.length === 0) { alert('No data found for the selected period'); setGenerating(false); return; }

            const totalExp = transactions.filter((t: any) => t.type === 'expense').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
            const totalEarn = transactions.filter((t: any) => t.type === 'earning').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
            const net = totalEarn - totalExp;

            const catMap: Record<string, { expenses: number; earnings: number }> = {};
            transactions.forEach((t: any) => {
                if (!catMap[t.category]) catMap[t.category] = { expenses: 0, earnings: 0 };
                if (t.type === 'expense') catMap[t.category].expenses += t.amount;
                else catMap[t.category].earnings += t.amount;
            });
            const catBreakdown = Object.entries(catMap).sort((a, b) => (b[1].expenses + b[1].earnings) - (a[1].expenses + a[1].earnings));

            if (format === 'live') {
                setLiveData({ transactions, totalExp, totalEarn, catBreakdown });
                setGenerating(false);
                return;
            }

            // EXCEL EXPORT
            if (format === 'excel' || format === 'both') {
                const ExcelJS = await import('exceljs');
                const wb = new ExcelJS.Workbook();
                wb.creator = 'Wealth AI';
                wb.created = new Date();

                const ws = wb.addWorksheet('Transactions');
                const titleRow = ws.addRow(['Wealth AI — Financial Report']);
                titleRow.font = { bold: true, size: 16, color: { argb: 'FF136DEC' } };
                ws.mergeCells('A1:F1');
                const subRow = ws.addRow([`Period: ${start} to ${end}  |  Generated: ${new Date().toLocaleString()}`]);
                subRow.font = { italic: true, size: 10, color: { argb: 'FF888888' } };
                ws.mergeCells('A2:F2');
                ws.addRow([]);

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

                const buffer = await wb.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `Report_${reportType}_${end}.xlsx`; a.click();
                URL.revokeObjectURL(url);
            }

            // PDF EXPORT - Fixed formatting issues
            if (format === 'pdf' || format === 'both') {
                const { default: jsPDF } = await import('jspdf');
                const { default: autoTable } = await import('jspdf-autotable');
                const doc = new jsPDF();

                doc.setFillColor(19, 109, 236);
                doc.rect(0, 0, 210, 32, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(22);
                doc.text('Wealth AI', 14, 18);
                doc.setFontSize(11);
                doc.text(`Financial Report  •  ${reportType.replace('_', ' ').toUpperCase()}`, 14, 26);

                doc.setTextColor(80, 80, 80);
                doc.setFontSize(10);
                doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);
                doc.text(`Period: ${start} to ${end}`, 14, 46);

                autoTable(doc as any, {
                    startY: 52,
                    head: [['Date', 'Type', 'Category', 'Description', 'Amount']],
                    body: transactions.map((t: any) => {
                        const isExp = t.type === 'expense';
                        return [
                            t.date, 
                            isExp ? 'Expense' : 'Earning', 
                            t.category, 
                            t.description, 
                            `${isExp ? '-' : '+'} ${sym}${t.amount.toFixed(2)}`
                        ];
                    }),
                    theme: 'striped',
                    headStyles: { fillColor: [19, 109, 236], textColor: 255, fontStyle: 'bold', halign: 'left' },
                    columnStyles: { 
                        0: { cellWidth: 25 },
                        1: { cellWidth: 20 },
                        2: { cellWidth: 35 },
                        3: { cellWidth: 'auto' },
                        4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } 
                    },
                    didParseCell: (data: any) => {
                        if (data.section === 'body') {
                            const rowData = data.row.raw as string[];
                            const isExp = rowData[1] === 'Expense';
                            if (data.column.index === 1) data.cell.styles.textColor = isExp ? [220, 38, 38] : [22, 163, 74];
                            if (data.column.index === 4) data.cell.styles.textColor = isExp ? [220, 38, 38] : [22, 163, 74];
                        }
                    },
                    styles: { fontSize: 9, cellPadding: 4, font: 'helvetica' },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                });

                let y = (doc as any).lastAutoTable?.finalY || 100;
                y += 15;

                doc.setTextColor(19, 109, 236);
                doc.setFontSize(14);
                doc.text('Category Breakdown', 14, y);
                y += 5;

                autoTable(doc as any, {
                    startY: y,
                    head: [['Category', 'Expenses', 'Earnings', 'Net']],
                    body: catBreakdown.map(([cat, data]) => {
                        const catNet = data.earnings - data.expenses;
                        return [
                            cat,
                            data.expenses > 0 ? `- ${sym}${data.expenses.toFixed(2)}` : '--',
                            data.earnings > 0 ? `+ ${sym}${data.earnings.toFixed(2)}` : '--',
                            `${catNet >= 0 ? '+' : '-'} ${sym}${Math.abs(catNet).toFixed(2)}`,
                        ];
                    }),
                    theme: 'grid',
                    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', halign: 'left' },
                    columnStyles: { 
                        1: { textColor: [220, 38, 38], halign: 'right' }, 
                        2: { textColor: [22, 163, 74], halign: 'right' }, 
                        3: { halign: 'right', fontStyle: 'bold' } 
                    },
                    didParseCell: (data: any) => {
                        if (data.section === 'body' && data.column.index === 3) {
                            const val = String(data.cell.raw);
                            data.cell.styles.textColor = val.startsWith('+') ? [22, 163, 74] : [220, 38, 38];
                        }
                    },
                    styles: { fontSize: 9, cellPadding: 4 },
                });

                y = (doc as any).lastAutoTable?.finalY || y + 40;
                y += 15;

                // Improved Summary box
                doc.setFillColor(248, 250, 252);
                doc.roundedRect(14, y, 182, 45, 3, 3, 'F');
                doc.setDrawColor(19, 109, 236);
                doc.setLineWidth(0.5);
                doc.roundedRect(14, y, 182, 45, 3, 3, 'S');

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text('Financial Summary', 20, y + 10);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);
                doc.setTextColor(220, 38, 38);
                doc.text(`Total Expenses:`, 20, y + 20);
                doc.text(`- ${sym}${totalExp.toFixed(2)}`, 180, y + 20, { align: 'right' });
                
                doc.setTextColor(22, 163, 74);
                doc.text(`Total Earnings:`, 20, y + 28);
                doc.text(`+ ${sym}${totalEarn.toFixed(2)}`, 180, y + 28, { align: 'right' });
                
                doc.setDrawColor(200, 200, 200);
                doc.line(20, y + 33, 190, y + 33);
                
                doc.setTextColor(net >= 0 ? 22 : 220, net >= 0 ? 163 : 38, net >= 0 ? 74 : 38);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(`Net Balance:`, 20, y + 41);
                doc.text(`${net >= 0 ? '+' : '-'} ${sym}${Math.abs(net).toFixed(2)}`, 180, y + 41, { align: 'right' });

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

    const chartData = useMemo(() => {
        if (!liveData) return null;
        
        // Expense vs Income Doughnut
        const expVsInc = {
            labels: ['Expenses', 'Earnings'],
            datasets: [{
                data: [liveData.totalExp, liveData.totalEarn],
                backgroundColor: ['#ef4444', '#22c55e'],
                borderWidth: 0,
            }]
        };

        // Category Bar Chart
        const catBar = {
            labels: liveData.catBreakdown.slice(0, 7).map(c => c[0]),
            datasets: [
                {
                    label: 'Expenses',
                    data: liveData.catBreakdown.slice(0, 7).map(c => c[1].expenses),
                    backgroundColor: '#ef4444',
                    borderRadius: 4,
                },
                {
                    label: 'Earnings',
                    data: liveData.catBreakdown.slice(0, 7).map(c => c[1].earnings),
                    backgroundColor: '#22c55e',
                    borderRadius: 4,
                }
            ]
        };

        return { expVsInc, catBar };
    }, [liveData]);

    return (
        <div className="p-4 lg:p-8 max-w-[1500px] mx-auto page-enter">
            <header className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Intelligence Center</p>
                <h1 className="mt-2 text-2xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">Reports & Analysis</h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-text-muted">
                    Generate live interactive reports or export them for offline analysis.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-1 flex flex-col gap-6 h-fit">
                    <div className="card-premium rounded-3xl p-6 border border-gray-200/50 dark:border-white/5">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm shadow-inner">1</span>
                        Configure View
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Topic</label>
                            <select value={reportType} onChange={(e) => setReportType(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-bg-dark px-4 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                                <option value="full_summary">Full Summary (All Data)</option>
                                <option value="budget_breakdown">Budget Breakdown</option>
                                <option value="expense_log">Detailed Expense Log</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Date Range</label>
                            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-bg-dark px-4 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary mb-3">
                                <option value="7">Last 7 Days</option>
                                <option value="30">Last 30 Days (Month)</option>
                                <option value="90">Last 90 Days (Quarter)</option>
                                <option value="365">This Year</option>
                                <option value="custom">Custom Range...</option>
                            </select>
                            
                            {dateRange === 'custom' && (
                                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-bg-dark px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-primary" />
                                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-bg-dark px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-primary" />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Output Format</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[{ id: 'live', icon: 'monitoring', label: 'Live View' }, 
                                  { id: 'pdf', icon: 'picture_as_pdf', label: 'PDF Export' }, 
                                  { id: 'excel', icon: 'table_view', label: 'Excel Export' },
                                  { id: 'both', icon: 'file_copy', label: 'PDF & Excel' }].map(f => (
                                    <button key={f.id} onClick={() => setFormat(f.id)}
                                        className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all ${format === f.id ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-gray-200 dark:border-white/10 text-gray-500 hover:border-gray-300 dark:hover:border-white/20'}`}>
                                        <span className="material-symbols-outlined">{f.icon}</span>
                                        <span className="text-xs font-bold">{f.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button onClick={generateReport} disabled={generating}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:bg-blue-600 transition-all disabled:opacity-50 active:scale-[0.98]">
                            <span className="material-symbols-outlined text-[20px]">{generating ? 'hourglass_top' : (format === 'live' ? 'play_arrow' : 'download')}</span>
                            {generating ? 'Processing...' : (format === 'live' ? 'View Live Report' : 'Generate & Download')}
                        </button>
                    </div>
                    </div>
                    
                    <div className="w-full animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        <HealthScoreWidget compact={true} />
                    </div>
                </div>

                {/* LIVE VIEW DASHBOARD */}
                <div className="lg:col-span-2 space-y-6">
                    {liveData && chartData ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                                <div className="card-premium rounded-3xl p-5 border border-gray-100 dark:border-white/5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-1">Total Expenses</p>
                                    <p className="text-3xl font-black text-gray-900 dark:text-white">{fmt(liveData.totalExp)}</p>
                                </div>
                                <div className="card-premium rounded-3xl p-5 border border-gray-100 dark:border-white/5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-1">Total Earnings</p>
                                    <p className="text-3xl font-black text-gray-900 dark:text-white">{fmt(liveData.totalEarn)}</p>
                                </div>
                                <div className="card-premium rounded-3xl p-5 border border-gray-100 dark:border-white/5 relative overflow-hidden">
                                    <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-20 ${(liveData.totalEarn - liveData.totalExp) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${(liveData.totalEarn - liveData.totalExp) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>Net Balance</p>
                                    <p className="text-3xl font-black text-gray-900 dark:text-white">{fmt(Math.abs(liveData.totalEarn - liveData.totalExp))}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                                <div className="card-premium rounded-3xl p-6 border border-gray-100 dark:border-white/5 h-[320px] flex flex-col">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Cash Flow Ratio</h3>
                                    <div className="flex-1 relative flex justify-center pb-2">
                                        <Doughnut data={chartData.expVsInc} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '75%' }} />
                                    </div>
                                </div>
                                <div className="card-premium rounded-3xl p-6 border border-gray-100 dark:border-white/5 h-[320px] flex flex-col">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Top Categories</h3>
                                    <div className="flex-1">
                                        <Bar data={chartData.catBar} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }, y: { display: false } } }} />
                                    </div>
                                </div>
                            </div>

                            <div className="card-premium rounded-3xl p-6 border border-gray-100 dark:border-white/5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Recent Transactions in Period</h3>
                                <div className="divide-y divide-gray-100 dark:divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                    {liveData.transactions.slice(0, 50).map(t => (
                                        <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'expense' ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'}`}>
                                                    <span className="material-symbols-outlined text-[20px]">{t.type === 'expense' ? 'south_east' : 'north_west'}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{t.description || t.category}</p>
                                                    <p className="text-xs font-medium text-gray-500">{t.category} • {new Date(t.date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <span className={`text-sm font-bold whitespace-nowrap ${t.type === 'expense' ? 'text-gray-900 dark:text-white' : 'text-emerald-500'}`}>
                                                {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                                            </span>
                                        </div>
                                    ))}
                                    {liveData.transactions.length > 50 && (
                                        <p className="text-center text-xs font-medium text-gray-400 pt-4">Showing top 50 transactions. Export to view all {liveData.transactions.length}.</p>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full min-h-[400px] card-premium rounded-3xl border border-dashed border-gray-300 dark:border-white/10 flex flex-col items-center justify-center text-center p-8">
                            <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-4xl text-gray-400">query_stats</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Live Data Active</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                                Configure your parameters on the left and select "Live View" to generate an interactive dashboard here.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
