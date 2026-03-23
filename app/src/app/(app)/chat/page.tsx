'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { invalidateFinancialData } from '@/hooks/useApi';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';

interface ActionResult {
    action: string;
    target: string;
    count: number;
    detail: string;
}

interface Message {
    id?: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    mode?: string;
    created_at?: string;
    transactions?: Array<{ type: string; amount: number; category: string; description: string; date: string }>;
    actionResults?: ActionResult[];
    isReportRequest?: boolean;
    isTyping?: boolean;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'chat' | 'silent'>('silent');
    const [loading, setLoading] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showFinanceToast, setShowFinanceToast] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [sessionId, setSessionId] = useState<string>(`session_${Date.now()}`);
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { currency, fmtRaw } = useCurrency();
    const sym = CURRENCIES[currency].symbol;

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const sid = searchParams.get('session_id');
        if (sid) {
            setSessionId(sid);
            setLoading(true);
            fetch(`/api/chat/messages?sessionId=${sid}`)
                .then(r => r.json())
                .then(d => {
                    if (d.messages && d.messages.length > 0) {
                        setMessages(d.messages);
                        const lastMsg = d.messages[d.messages.length - 1];
                        if (lastMsg && lastMsg.mode) {
                            setMode(lastMsg.mode === 'silent' ? 'silent' : 'chat');
                        } else {
                            setMode('chat');
                        }
                    }
                })
                .catch(err => console.error('Failed to load chat history:', err))
                .finally(() => setLoading(false));

            // Rewrite URL without reload to clean it up
            window.history.replaceState({}, '', '/chat');
        }
    }, [setMode]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Elapsed timer for loading state
    useEffect(() => {
        if (loading) {
            setElapsedTime(0);
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 0.1);
            }, 100);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [loading]);

    // Auto-resize textarea
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
    }, []);

    // Copy message to clipboard
    const copyMessage = useCallback((text: string, idx: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIdx(idx);
            setTimeout(() => setCopiedIdx(null), 2000);
        });
    }, []);

    // Typewriter effect for AI responses — faster and smoother
    const typeMessage = useCallback((fullContent: string, msgIndex: number) => {
        let i = 0;
        const speed = 5; // ms per tick — faster
        const charsPerTick = 5; // type 5 chars at a time
        const interval = setInterval(() => {
            i += charsPerTick;
            if (i >= fullContent.length) {
                i = fullContent.length;
                clearInterval(interval);
                setMessages(prev => prev.map((m, idx) =>
                    idx === msgIndex ? { ...m, content: fullContent, isTyping: false } : m
                ));
            } else {
                setMessages(prev => prev.map((m, idx) =>
                    idx === msgIndex ? { ...m, content: fullContent.substring(0, i) } : m
                ));
            }
        }, speed);
        return () => clearInterval(interval);
    }, []);

    const handleSend = async () => {
        const msg = input.trim();
        if (!msg || loading) return;
        setInput('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
        setLoading(true);

        const userMsg: Message = { role: 'user', content: msg, mode, created_at: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, mode, sessionId }),
            });
            const data = await res.json();

            if (data.sessionId) setSessionId(data.sessionId);

            const aiMsg: Message = {
                role: mode === 'chat' ? 'assistant' : 'system',
                content: '',
                mode,
                created_at: new Date().toISOString(),
                transactions: data.transactions,
                actionResults: data.actionResults,
                isReportRequest: data.isReportRequest,
                isTyping: mode === 'chat',
            };

            const fullContent = data.message || '';

            if (fullContent || (aiMsg.transactions && aiMsg.transactions.length > 0) || (aiMsg.actionResults && aiMsg.actionResults.length > 0)) {
                setMessages(prev => {
                    const newMessages = [...prev, { ...aiMsg, content: mode === 'chat' ? '' : fullContent }];
                    // Start typewriter effect for chat mode
                    if (mode === 'chat' && fullContent) {
                        setTimeout(() => typeMessage(fullContent, newMessages.length - 1), 100);
                    }
                    return newMessages;
                });

                // Invalidate dashboard & transaction caches if data was mutated
                if ((aiMsg.transactions && aiMsg.transactions.length > 0) || (aiMsg.actionResults && aiMsg.actionResults.length > 0)) {
                    invalidateFinancialData();
                }
            }

            // If report requested, generate downloads
            if (data.isReportRequest) {
                await generateReportFiles(data.dateRange, data.reportFormat);
            }
        } catch {
            setMessages(prev => [...prev, { role: 'system', content: '⚠️ Error: Could not reach AI. Please try again.' }]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const generateReportFiles = async (dateRange?: { start: string; end: string }, format: string = 'both') => {
        try {
            const params = new URLSearchParams();
            if (dateRange?.start) params.set('start', dateRange.start);
            if (dateRange?.end) params.set('end', dateRange.end);

            const res = await fetch(`/api/transactions?${params.toString()}`);
            const { transactions } = await res.json();
            if (!transactions || transactions.length === 0) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const totalExpenses = transactions.filter((t: any) => t.type === 'expense').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const totalEarnings = transactions.filter((t: any) => t.type === 'earning').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
            const net = totalEarnings - totalExpenses;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

                const ws = wb.addWorksheet('Transactions');
                const titleRow = ws.addRow(['Wealth AI — Financial Report']);
                titleRow.font = { bold: true, size: 16, color: { argb: 'FF136DEC' } };
                ws.mergeCells('A1:F1');
                const subRow = ws.addRow([`Generated: ${new Date().toLocaleString()}`]);
                subRow.font = { italic: true, size: 10, color: { argb: 'FF888888' } };
                ws.mergeCells('A2:F2');
                ws.addRow([]);

                ws.columns = [{ width: 14 }, { width: 10 }, { width: 16 }, { width: 35 }, { width: 18 }, { width: 5 }];
                const headerRow = ws.addRow(['Date', 'Type', 'Category', 'Description', 'Amount', '']);
                headerRow.eachCell((cell, colNum) => {
                    if (colNum <= 5) {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF136DEC' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                });
                headerRow.height = 28;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                transactions.forEach((t: any) => {
                    const isExp = t.type === 'expense';
                    const row = ws.addRow([t.date, isExp ? '▼ Expense' : '▲ Earning', t.category, t.description, `${isExp ? '−' : '+'} ${sym}${t.amount.toFixed(2)}`]);
                    row.eachCell((cell, colNum) => {
                        if (colNum <= 5) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isExp ? 'FFFEF2F2' : 'FFF0FDF4' } };
                        if (colNum === 2) cell.font = { color: { argb: isExp ? 'FFEF4444' : 'FF22C55E' }, bold: true };
                        if (colNum === 5) { cell.font = { bold: true, color: { argb: isExp ? 'FFDC2626' : 'FF16A34A' } }; cell.alignment = { horizontal: 'right' }; }
                    });
                });

                ws.addRow([]);
                const sumH = ws.addRow(['', '', '', 'SUMMARY', '', '']);
                sumH.getCell(4).font = { bold: true, size: 12, color: { argb: 'FF136DEC' } };
                const expR = ws.addRow(['', '', '', 'Total Expenses', `− ${sym}${totalExpenses.toFixed(2)}`]);
                expR.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } }; expR.getCell(5).alignment = { horizontal: 'right' }; expR.getCell(4).font = { bold: true };
                const earR = ws.addRow(['', '', '', 'Total Earnings', `+ ${sym}${totalEarnings.toFixed(2)}`]);
                earR.getCell(5).font = { bold: true, color: { argb: 'FF16A34A' } }; earR.getCell(5).alignment = { horizontal: 'right' }; earR.getCell(4).font = { bold: true };
                const netR = ws.addRow(['', '', '', 'Net Balance', `${net >= 0 ? '+' : '−'} ${sym}${Math.abs(net).toFixed(2)}`]);
                netR.getCell(4).font = { bold: true, size: 12 };
                netR.getCell(5).font = { bold: true, size: 12, color: { argb: net >= 0 ? 'FF16A34A' : 'FFDC2626' } };
                netR.getCell(5).alignment = { horizontal: 'right' };

                const ws2 = wb.addWorksheet('Category Breakdown');
                ws2.columns = [{ width: 20 }, { width: 18 }, { width: 18 }, { width: 18 }];
                const catT = ws2.addRow(['Spending by Category']); catT.font = { bold: true, size: 14, color: { argb: 'FF136DEC' } }; ws2.mergeCells('A1:D1');
                ws2.addRow([]);
                const catH = ws2.addRow(['Category', 'Expenses', 'Earnings', 'Net']);
                catH.eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF136DEC' } }; cell.alignment = { horizontal: 'center' }; });
                catBreakdown.forEach(([cat, data]) => {
                    const cn = data.earnings - data.expenses;
                    const row = ws2.addRow([cat, data.expenses > 0 ? `− ${sym}${data.expenses.toFixed(2)}` : '—', data.earnings > 0 ? `+ ${sym}${data.earnings.toFixed(2)}` : '—', `${cn >= 0 ? '+' : '−'} ${sym}${Math.abs(cn).toFixed(2)}`]);
                    row.getCell(2).font = { color: { argb: 'FFDC2626' } }; row.getCell(3).font = { color: { argb: 'FF16A34A' } };
                    row.getCell(4).font = { bold: true, color: { argb: cn >= 0 ? 'FF16A34A' : 'FFDC2626' } };
                });

                const buffer = await wb.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
                a.download = `Financial_Report_${new Date().toISOString().split('T')[0]}.xlsx`; a.click(); URL.revokeObjectURL(url);
            }

            // ==================== PDF ====================
            if (format === 'pdf' || format === 'both') {
                const { default: jsPDF } = await import('jspdf');
                const { default: autoTable } = await import('jspdf-autotable');
                const doc = new jsPDF();

                doc.setFillColor(19, 109, 236); doc.rect(0, 0, 210, 32, 'F');
                doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.text('Wealth AI', 14, 16);
                doc.setFontSize(10); doc.text(`Financial Report  •  Generated: ${new Date().toLocaleString()}`, 14, 25);
                doc.setTextColor(100, 100, 100); doc.setFontSize(9); doc.text(`Period: ${dateRange?.start || 'All'} to ${dateRange?.end || 'Now'}`, 14, 40);

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
                            const rd = data.row.raw as string[]; const isExp = rd[1]?.includes('Expense');
                            if (data.column.index === 1) data.cell.styles.textColor = isExp ? [220, 38, 38] : [22, 163, 74];
                            if (data.column.index === 4) data.cell.styles.textColor = isExp ? [220, 38, 38] : [22, 163, 74];
                        }
                    },
                    styles: { fontSize: 9, cellPadding: 4 }, alternateRowStyles: { fillColor: [248, 250, 252] },
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let y = (doc as any).lastAutoTable?.finalY || 100; y += 10;
                doc.setTextColor(19, 109, 236); doc.setFontSize(13); doc.text('Category Breakdown', 14, y); y += 4;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                autoTable(doc as any, {
                    startY: y,
                    head: [['Category', 'Expenses', 'Earnings', 'Net']],
                    body: catBreakdown.map(([cat, data]) => {
                        const cn = data.earnings - data.expenses;
                        return [cat, data.expenses > 0 ? `- ${sym}${data.expenses.toFixed(2)}` : '—', data.earnings > 0 ? `+ ${sym}${data.earnings.toFixed(2)}` : '—', `${cn >= 0 ? '+' : '-'} ${sym}${Math.abs(cn).toFixed(2)}`];
                    }),
                    theme: 'grid',
                    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', halign: 'center' },
                    columnStyles: { 1: { textColor: [220, 38, 38] }, 2: { textColor: [22, 163, 74] }, 3: { halign: 'right', fontStyle: 'bold' } },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    didParseCell: (data: any) => {
                        if (data.section === 'body' && data.column.index === 3) {
                            data.cell.styles.textColor = String(data.cell.raw).startsWith('+') ? [22, 163, 74] : [220, 38, 38];
                        }
                    },
                    styles: { fontSize: 9, cellPadding: 3 },
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                y = (doc as any).lastAutoTable?.finalY || y + 40; y += 12;

                doc.setFillColor(248, 250, 252); doc.roundedRect(14, y - 4, 182, 38, 3, 3, 'F');
                doc.setDrawColor(19, 109, 236); doc.roundedRect(14, y - 4, 182, 38, 3, 3, 'S');
                doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.text('Summary', 20, y + 4);
                doc.setFontSize(10); doc.setTextColor(220, 38, 38); doc.text(`Total Expenses:  - ${sym}${totalExpenses.toFixed(2)}`, 20, y + 14);
                doc.setTextColor(22, 163, 74); doc.text(`Total Earnings:  + ${sym}${totalEarnings.toFixed(2)}`, 20, y + 22);
                doc.setTextColor(net >= 0 ? 22 : 220, net >= 0 ? 163 : 38, net >= 0 ? 74 : 38);
                doc.setFontSize(11); doc.text(`Net Balance:  ${net >= 0 ? '+' : '-'} ${sym}${Math.abs(net).toFixed(2)}`, 20, y + 30);

                const pdfBlob = doc.output('blob');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                const pdfA = document.createElement('a');
                pdfA.href = pdfUrl;
                pdfA.download = `Financial_Report_${new Date().toISOString().split('T')[0]}.pdf`;
                pdfA.click();
                URL.revokeObjectURL(pdfUrl);
            }

            let downloadedFormatName = 'Both PDF and Excel files have';
            if (format === 'pdf') downloadedFormatName = 'The PDF file has';
            if (format === 'excel') downloadedFormatName = 'The Excel file has';

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `📊 Report generated! ${downloadedFormatName} been downloaded.`,
                isReportRequest: true,
            }]);
        } catch (err) {
            console.error('Report generation error:', err);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const clearChat = () => {
        setMessages([]);
        setSessionId(`session_${Date.now()}`);
    };

    // Enhanced markdown-like rendering for AI messages
    const renderContent = (text: string) => {
        if (!text) return null;
        const lines = text.split('\n');
        return lines.map((line, i) => {
            // Headers
            if (line.startsWith('### ')) {
                return <h4 key={i} className="text-sm font-bold text-gray-800 dark:text-white mt-2 mb-1">{line.slice(4)}</h4>;
            }
            if (line.startsWith('## ')) {
                return <h3 key={i} className="text-base font-bold text-gray-900 dark:text-white mt-3 mb-1">{line.slice(3)}</h3>;
            }
            // Horizontal rule
            if (line.trim() === '---' || line.trim() === '***') {
                return <hr key={i} className="border-gray-200 dark:border-[#30363d] my-2" />;
            }
            // Bold
            let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            // Italic
            processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
            // Inline code
            processed = processed.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 dark:bg-surface-hover rounded text-xs font-mono">$1</code>');

            // List items
            if (processed.startsWith('- ') || processed.startsWith('• ')) {
                return <div key={i} className="flex gap-2 ml-1"><span className="text-primary mt-0.5 shrink-0">•</span><span dangerouslySetInnerHTML={{ __html: processed.slice(2) }} /></div>;
            }
            // Numbered lists
            const numMatch = processed.match(/^(\d+)\.\s/);
            if (numMatch) {
                return <div key={i} className="flex gap-2 ml-1"><span className="text-primary font-semibold shrink-0">{numMatch[1]}.</span><span dangerouslySetInnerHTML={{ __html: processed.slice(numMatch[0].length) }} /></div>;
            }
            // Empty line
            if (!processed.trim()) return <div key={i} className="h-2" />;
            // Normal paragraph
            return <p key={i} dangerouslySetInnerHTML={{ __html: processed }} />;
        });
    };

    // Dynamic suggestions based on time of day
    const getSuggestions = () => {
        const h = new Date().getHours();
        if (h < 12) {
            return [
                { t: 'Good morning! Show my spending today', i: 'wb_sunny', c: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' },
                { t: 'I spent 200 on breakfast', i: 'restaurant', c: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' },
                { t: 'How much have I saved this month?', i: 'savings', c: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
                { t: 'Generate a full report', i: 'summarize', c: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200 dark:border-violet-500/20' },
            ];
        }
        if (h < 17) {
            return [
                { t: 'Show my spending this week', i: 'pie_chart', c: 'text-primary bg-blue-50 dark:bg-primary/10', border: 'border-blue-200 dark:border-primary/20' },
                { t: 'I spent 500 on groceries', i: 'shopping_cart', c: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' },
                { t: 'Am I on track with my budgets?', i: 'account_balance_wallet', c: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
                { t: 'Generate a report for this month', i: 'summarize', c: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200 dark:border-violet-500/20' },
            ];
        }
        return [
            { t: 'Summarize my spending today', i: 'query_stats', c: 'text-primary bg-blue-50 dark:bg-primary/10', border: 'border-blue-200 dark:border-primary/20' },
            { t: 'I spent 800 on dinner out', i: 'restaurant', c: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' },
            { t: 'I received 3000 salary', i: 'payments', c: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
            { t: 'Generate my weekly report', i: 'summarize', c: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200 dark:border-violet-500/20' },
        ];
    };

    return (
        <div className="flex flex-col h-[calc(100dvh-64px-80px)] lg:h-[100dvh]">
            {/* Header */}
            <div className="h-14 lg:h-16 border-b border-gray-200 dark:border-[#30363d] flex items-center justify-between px-4 lg:px-6 bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-xl sticky top-0 z-10">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-violet-600 flex items-center justify-center shadow-sm shadow-primary/30">
                        <span className="material-symbols-outlined text-white text-lg">smart_toy</span>
                    </div>
                    <div>
                        <h2 className="text-sm lg:text-base font-bold text-gray-900 dark:text-white leading-tight">Wealth AI</h2>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs text-gray-400 dark:text-text-muted">Online • Ultra-fast</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 lg:gap-3">
                    {/* Mode Toggle */}
                    <div className="bg-gray-100 dark:bg-surface-dark p-0.5 rounded-xl border border-gray-200 dark:border-[#30363d] flex text-xs">
                        <button
                            onClick={() => setMode('chat')}
                            className={`px-2.5 lg:px-4 py-1.5 rounded-lg font-semibold transition-all duration-200 ${mode === 'chat' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 dark:text-text-muted hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            <span className="hidden sm:inline">💬 Conversational</span>
                            <span className="sm:hidden">💬</span>
                        </button>
                        <button
                            onClick={() => setMode('silent')}
                            className={`px-2.5 lg:px-4 py-1.5 rounded-lg font-semibold transition-all duration-200 ${mode === 'silent' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 dark:text-text-muted hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            <span className="hidden sm:inline">⚡ Silent</span>
                            <span className="sm:hidden">⚡</span>
                        </button>
                        <button
                            onClick={() => { setShowFinanceToast(true); setTimeout(() => setShowFinanceToast(false), 3000); }}
                            className="px-2.5 lg:px-4 py-1.5 rounded-lg font-semibold transition-all duration-200 text-gray-500 dark:text-text-muted hover:text-gray-900 dark:hover:text-white"
                        >
                            <span className="hidden sm:inline">📊 Finance</span>
                            <span className="sm:hidden">📊</span>
                        </button>
                    </div>
                    {/* Clear chat button */}
                    {messages.length > 0 && (
                        <button onClick={clearChat} className="p-2 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors" title="Clear chat">
                            <span className="material-symbols-outlined text-lg">delete_sweep</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Finance Mode Toast */}
            {showFinanceToast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 toast-enter">
                    <div className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-violet-600 to-primary text-white rounded-xl shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-lg">construction</span>
                        <span className="text-sm font-semibold">Finance Mode is under development — coming soon!</span>
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto page-enter">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary/20 to-violet-600/20 flex items-center justify-center mb-6 relative animate-glow-pulse">
                            <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping opacity-50" style={{ animationDuration: '2s' }} />
                            <span className="material-symbols-outlined text-4xl text-primary relative z-10">smart_toy</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Wealth AI Assistant</h3>
                        <p className="text-gray-500 dark:text-text-muted mb-2 max-w-md leading-relaxed">
                            Ultra-fast financial assistant. Track expenses, analyze trends, and get instant insights.
                        </p>
                        <p className="text-xs text-gray-400 dark:text-text-muted mb-8 max-w-sm">
                            I can also answer general questions about anything — science, tech, health, cooking, and more.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                            {getSuggestions().map((s, i) => (
                                <button key={i} onClick={() => setInput(s.t)}
                                    className={`card-premium p-4 rounded-xl text-left hover:-translate-y-1 transition-all group flex items-center gap-3 border ${s.border}`}
                                    style={{ animation: `slideUp 0.4s ease-out ${0.1 + i * 0.08}s both` }}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.c}`}>
                                        <span className="material-symbols-outlined">{s.i}</span>
                                    </div>
                                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{s.t}</span>
                                </button>
                            ))}
                        </div>
                        <div className="mt-8 text-xs text-gray-400 dark:text-text-muted flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${mode === 'chat' ? 'bg-primary' : 'bg-gray-400'}`} />
                            Mode: <span className="font-semibold text-gray-600 dark:text-gray-300">{mode === 'chat' ? 'Conversational' : 'Silent (Storage Only)'}</span>
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                        style={{ animation: 'slideUp 0.3s ease-out both' }}
                    >
                        {/* Avatar */}
                        <div className={`w-8 h-8 lg:w-9 lg:h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === 'user'
                            ? 'bg-gray-200 dark:bg-surface-hover border border-gray-300 dark:border-[#30363d]'
                            : 'bg-gradient-to-tr from-primary to-violet-600 shadow-lg shadow-primary/20'
                            }`}>
                            <span className={`material-symbols-outlined text-base lg:text-lg ${msg.role === 'user' ? 'text-gray-500 dark:text-text-muted' : 'text-white'}`}>
                                {msg.role === 'user' ? 'person' : 'smart_toy'}
                            </span>
                        </div>

                        {/* Message */}
                        <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                            <div className="flex items-center gap-2">
                                {msg.role === 'user' ? (
                                    <>
                                        <span className="text-[10px] text-gray-400 dark:text-text-muted">{msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">You</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Wealth AI</span>
                                        <span className="text-[10px] text-gray-400 dark:text-text-muted">{msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                    </>
                                )}
                            </div>

                            <div className={`relative group px-4 py-3 leading-relaxed text-sm ${msg.role === 'user'
                                ? 'bg-primary text-white rounded-2xl rounded-tr-sm shadow-[0_4px_16px_-4px_rgba(19,109,236,0.35)]'
                                : msg.role === 'system'
                                    ? 'card-premium border-emerald-200/30 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-200 rounded-2xl rounded-tl-sm'
                                    : 'card-premium text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-sm'
                                }`}>
                                {msg.role === 'user' ? (
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                ) : (
                                    <div className="space-y-1.5">{renderContent(msg.content)}</div>
                                )}
                                {msg.isTyping && <span className="inline-block w-1.5 h-4 bg-primary/60 rounded-full ml-0.5 animate-pulse" />}

                                {/* Copy button — appears on hover for AI messages */}
                                {msg.role !== 'user' && msg.content && !msg.isTyping && (
                                    <button
                                        onClick={() => copyMessage(msg.content, i)}
                                        className="absolute -bottom-3 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-surface-dark border border-gray-200 dark:border-[#30363d] text-[10px] text-gray-500 dark:text-text-muted hover:text-primary dark:hover:text-primary shadow-sm"
                                        title="Copy message"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">{copiedIdx === i ? 'check' : 'content_copy'}</span>
                                        {copiedIdx === i ? 'Copied!' : 'Copy'}
                                    </button>
                                )}
                            </div>

                            {/* Show stored transactions */}
                            {msg.transactions && msg.transactions.length > 0 && (
                                <div className="mt-2 space-y-1.5 w-full">
                                    {msg.transactions.map((t, j) => (
                                        <div key={j} className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/80 dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-[#30363d] text-xs"
                                            style={{ animation: `slideUp 0.3s ease-out ${0.05 * j}s both` }}
                                        >
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${t.type === 'expense' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
                                                <span className={`material-symbols-outlined text-sm ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                    {t.type === 'expense' ? 'remove' : 'add'}
                                                </span>
                                            </div>
                                            <span className={`font-bold ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {t.type === 'expense' ? '−' : '+'}{fmtRaw(t.amount)}
                                            </span>
                                            <span className="text-gray-500 dark:text-gray-400 font-medium">{t.category}</span>
                                            <span className="text-gray-400">•</span>
                                            <span className="text-gray-400 truncate">{t.description}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Show action results (edit/delete/reset) */}
                            {msg.actionResults && msg.actionResults.length > 0 && (
                                <div className="mt-2 space-y-1.5 w-full">
                                    {msg.actionResults.map((r, j) => {
                                        const isEdit = r.action === 'edit';
                                        const isDelete = r.action === 'delete';
                                        const icon = isEdit ? 'edit' : isDelete ? 'delete' : 'restart_alt';
                                        const color = isEdit
                                            ? 'text-amber-500 bg-amber-50/80 dark:bg-amber-500/10 border-amber-200 dark:border-amber-800/30'
                                            : isDelete
                                                ? 'text-rose-500 bg-rose-50/80 dark:bg-rose-500/10 border-rose-200 dark:border-rose-800/30'
                                                : 'text-primary bg-blue-50/80 dark:bg-primary/10 border-blue-200 dark:border-primary/20';
                                        return (
                                            <div key={j} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs ${color}`}
                                                style={{ animation: `slideUp 0.3s ease-out ${0.05 * j}s both` }}
                                            >
                                                <span className="material-symbols-outlined text-sm">{icon}</span>
                                                <span className="font-bold">
                                                    {r.count > 0 ? '✓' : '✗'} {r.detail}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Loading indicator with elapsed timer */}
                {loading && (
                    <div className="flex gap-3 max-w-3xl animate-fade-in">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined text-lg text-white">smart_toy</span>
                        </div>
                        <div className="card-premium px-5 py-3.5 rounded-2xl rounded-tl-sm">
                            <div className="flex gap-1.5 items-center">
                                <span className="w-2 h-2 bg-primary/60 rounded-full typing-dot" />
                                <span className="w-2 h-2 bg-primary/60 rounded-full typing-dot" />
                                <span className="w-2 h-2 bg-primary/60 rounded-full typing-dot" />
                                <span className="text-xs text-gray-400 dark:text-text-muted ml-2 tabular-nums">
                                    Thinking... <span className="font-mono text-primary/70">{elapsedTime.toFixed(1)}s</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={endRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 lg:p-4 bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-xl border-t border-gray-200 dark:border-[#30363d]">
                {/* Quick actions toolbar */}
                <div className="flex gap-1.5 mb-3 max-w-3xl mx-auto overflow-x-auto pb-1 scrollbar-hide">
                    <button onClick={() => setInput('📊 Give me a summary of my spending')} className="px-2.5 py-1 flex items-center gap-1 rounded-lg text-xs font-semibold bg-gray-100 text-primary dark:bg-primary/10 hover:bg-gray-200 dark:hover:bg-primary/20 transition-all border border-gray-200 dark:border-primary/20 hover:-translate-y-0.5 whitespace-nowrap shrink-0"><span className="material-symbols-outlined text-[13px]">query_stats</span>Summary</button>
                    <button onClick={() => setInput('💰 I spent 500 on groceries')} className="px-2.5 py-1 flex items-center gap-1 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all border border-orange-200 dark:border-orange-500/20 hover:-translate-y-0.5 whitespace-nowrap shrink-0"><span className="material-symbols-outlined text-[13px]">remove</span>Expense</button>
                    <button onClick={() => setInput('📈 I earned 5000 from freelance')} className="px-2.5 py-1 flex items-center gap-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all border border-emerald-200 dark:border-emerald-500/20 hover:-translate-y-0.5 whitespace-nowrap shrink-0"><span className="material-symbols-outlined text-[13px]">add</span>Earning</button>
                    <button onClick={() => setInput('Generate a full report for this month')} className="px-2.5 py-1 flex items-center gap-1 rounded-lg text-xs font-semibold bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-all border border-violet-200 dark:border-violet-500/20 hover:-translate-y-0.5 whitespace-nowrap shrink-0"><span className="material-symbols-outlined text-[13px]">summarize</span>Report</button>
                </div>
                <div className="relative card-premium rounded-2xl focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all max-w-3xl mx-auto">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-transparent border-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0 resize-none py-3.5 px-4 pr-14 max-h-32 outline-none text-sm"
                        placeholder={mode === 'chat' ? 'Ask anything — finances, general questions, or just chat...' : 'Enter data to store silently...'}
                        rows={1}
                    />
                    <div className="absolute right-2 bottom-1.5">
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className="w-9 h-9 flex items-center justify-center bg-primary hover:bg-primary-hover text-white rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:hover:bg-primary hover:shadow-md active:scale-95"
                        >
                            <span className="material-symbols-outlined text-[18px]">send</span>
                        </button>
                    </div>
                </div>
                <div className="flex justify-center mt-2 gap-4 text-[11px] text-gray-400 dark:text-text-muted">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">lock</span>Private</span>
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">bolt</span>Ultra-fast AI</span>
                    <span className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${mode === 'chat' ? 'bg-primary' : 'bg-gray-400'}`} />
                        {mode === 'chat' ? 'Conversational' : 'Silent'}
                    </span>
                </div>
            </div>
        </div>
    );
}
