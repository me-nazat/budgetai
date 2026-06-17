'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '@/hooks/useApi';
import { motion, AnimatePresence } from 'framer-motion';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';

interface ActionResult {
    action: string;
    target: string;
    count: number;
    detail: string;
}

interface PendingActions {
    financialData: Array<{ type: string; amount: number; category: string; description: string; date: string }>;
    actions: Array<Record<string, unknown>>;
}

interface AttachmentSummary {
    name: string;
    summary: string;
    confidence?: string;
}

interface Session {
    session_id: string;
    latest_content: string;
    latest_time: string;
    message_count: number;
}

interface Message {
    id?: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    mode?: string;
    created_at?: string;
    transactions?: Array<{ id?: number; type: string; amount: number; category: string; description: string; date: string }>;
    actionResults?: ActionResult[];
    pendingActions?: PendingActions | null;
    attachmentSummaries?: AttachmentSummary[];
    isReportRequest?: boolean;
    isTyping?: boolean;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'chat' | 'silent'>('silent');
    const [submitting, setSubmitting] = useState(false);
    const invalidateFinancialData = useInvalidateFinancialData();
    const [loading, setLoading] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showFinanceToast, setShowFinanceToast] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [sessionId, setSessionId] = useState<string>(`session_${Date.now()}`);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historySessions, setHistorySessions] = useState<Session[]>([]);
    const [historySearch, setHistorySearch] = useState('');
    const [historyLoading, setHistoryLoading] = useState(false);
    const [confirmingIdx, setConfirmingIdx] = useState<number | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
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

    const loadHistorySessions = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch('/api/chat/history');
            const data = await res.json();
            setHistorySessions(data.sessions || []);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const openHistory = useCallback(() => {
        setShowHistory(true);
        void loadHistorySessions();
    }, [loadHistorySessions]);

    const loadSession = useCallback(async (sid: string) => {
        setSessionId(sid);
        setLoading(true);
        try {
            const res = await fetch(`/api/chat/messages?sessionId=${sid}`);
            const data = await res.json();
            setMessages(data.messages || []);
            const lastMsg = data.messages?.[data.messages.length - 1];
            if (lastMsg?.mode) setMode(lastMsg.mode === 'silent' ? 'silent' : 'chat');
            setShowHistory(false);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []).slice(0, 5);
        setAttachments(prev => [...prev, ...files].slice(0, 5));
        event.target.value = '';
    }, []);

    const removeAttachment = useCallback((index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
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
        if ((!msg && attachments.length === 0) || loading) return;
        const outgoingAttachments = attachments;
        setInput('');
        setAttachments([]);
        if (inputRef.current) inputRef.current.style.height = 'auto';
        setLoading(true);

        const attachmentLabel = outgoingAttachments.length > 0 ? `\n\nAttachments: ${outgoingAttachments.map(file => file.name).join(', ')}` : '';
        const userMsg: Message = { role: 'user', content: `${msg || 'Analyze these attachments.'}${attachmentLabel}`, mode, created_at: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);

        try {
            let res: Response;
            if (outgoingAttachments.length > 0) {
                const form = new FormData();
                form.set('message', msg);
                form.set('mode', mode);
                form.set('sessionId', sessionId);
                outgoingAttachments.forEach(file => form.append('attachments', file));
                res = await fetch('/api/chat', { method: 'POST', body: form });
            } else {
                res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg, mode, sessionId }),
                });
            }
            const data = await res.json();

            if (data.sessionId) setSessionId(data.sessionId);

            const aiMsg: Message = {
                role: mode === 'chat' ? 'assistant' : 'system',
                content: '',
                mode,
                created_at: new Date().toISOString(),
                transactions: data.transactions,
                actionResults: data.actionResults,
                pendingActions: data.pendingActions,
                attachmentSummaries: data.attachmentSummaries,
                isReportRequest: data.isReportRequest,
                isTyping: mode === 'chat' && !data.pendingActions,
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

    const confirmPendingActions = async (idx: number, pending: PendingActions | null | undefined) => {
        if (!pending || confirmingIdx !== null) return;
        setConfirmingIdx(idx);
        try {
            const res = await fetch('/api/chat/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    mode,
                    financialData: pending.financialData,
                    actions: pending.actions,
                }),
            });
            const data = await res.json();
            setMessages(prev => [
                ...prev.map((message, i) => i === idx ? { ...message, pendingActions: null } : message),
                {
                    role: 'system',
                    content: data.message || 'Confirmed.',
                    mode,
                    created_at: new Date().toISOString(),
                    transactions: data.transactions,
                    actionResults: data.actionResults,
                },
            ]);
            invalidateFinancialData();
        } catch {
            setMessages(prev => [...prev, { role: 'system', content: 'Could not confirm those attachment actions. Please try again.' }]);
        } finally {
            setConfirmingIdx(null);
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
        setAttachments([]);
    };

    const filteredHistorySessions = historySessions.filter(session =>
        !historySearch || session.latest_content?.toLowerCase().includes(historySearch.toLowerCase())
    );

    // Safe inline markdown renderer — returns React elements instead of raw HTML
    const renderInlineMarkdown = (text: string): React.ReactNode[] => {
        const parts: React.ReactNode[] = [];
        // Regex that captures bold (**), italic (*), and inline code (`)
        const tokenRegex = /\*\*(.*?)\*\*|\*(.*?)\*|`(.*?)`/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let partKey = 0;

        while ((match = tokenRegex.exec(text)) !== null) {
            // Text before the match
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }
            if (match[1] !== undefined) {
                // Bold
                parts.push(<strong key={partKey++}>{match[1]}</strong>);
            } else if (match[2] !== undefined) {
                // Italic
                parts.push(<em key={partKey++}>{match[2]}</em>);
            } else if (match[3] !== undefined) {
                // Inline code
                parts.push(<code key={partKey++} className="px-1.5 py-0.5 bg-gray-100 dark:bg-surface-hover rounded text-xs font-mono">{match[3]}</code>);
            }
            lastIndex = match.index + match[0].length;
        }
        // Remaining text after last match
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }
        return parts.length > 0 ? parts : [text];
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
            // List items
            if (line.startsWith('- ') || line.startsWith('• ')) {
                return <div key={i} className="flex gap-2 ml-1"><span className="text-primary mt-0.5 shrink-0">•</span><span>{renderInlineMarkdown(line.slice(2))}</span></div>;
            }
            // Numbered lists
            const numMatch = line.match(/^(\d+)\.\s/);
            if (numMatch) {
                return <div key={i} className="flex gap-2 ml-1"><span className="text-primary font-semibold shrink-0">{numMatch[1]}.</span><span>{renderInlineMarkdown(line.slice(numMatch[0].length))}</span></div>;
            }
            // Empty line
            if (!line.trim()) return <div key={i} className="h-2" />;
            // Normal paragraph
            return <p key={i}>{renderInlineMarkdown(line)}</p>;
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
                { t: 'Generate a full report', i: 'summarize', c: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10', border: 'border-teal-200 dark:border-teal-500/20' },
            ];
        }
        if (h < 17) {
            return [
                { t: 'Show my spending this week', i: 'pie_chart', c: 'text-primary bg-blue-50 dark:bg-primary/10', border: 'border-blue-200 dark:border-primary/20' },
                { t: 'I spent 500 on groceries', i: 'shopping_cart', c: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' },
                { t: 'Am I on track with my budgets?', i: 'account_balance_wallet', c: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
                { t: 'Generate a report for this month', i: 'summarize', c: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10', border: 'border-teal-200 dark:border-teal-500/20' },
            ];
        }
        return [
            { t: 'Summarize my spending today', i: 'query_stats', c: 'text-primary bg-blue-50 dark:bg-primary/10', border: 'border-blue-200 dark:border-primary/20' },
            { t: 'I spent 800 on dinner out', i: 'restaurant', c: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' },
            { t: 'I received 3000 salary', i: 'payments', c: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
            { t: 'Generate my weekly report', i: 'summarize', c: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10', border: 'border-teal-200 dark:border-teal-500/20' },
        ];
    };

    return (
        <div className="flex flex-col h-[calc(100dvh-64px-80px)] lg:h-[100dvh]">
            {/* Header */}
            <div className="h-14 lg:h-16 border-b border-gray-200 dark:border-[#30363d] flex items-center justify-between px-4 lg:px-6 bg-white/80 dark:bg-[#0A0E1A]/80 backdrop-blur-xl sticky top-0 z-10">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-teal-600 flex items-center justify-center shadow-sm shadow-primary/30">
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
                    <button
                        onClick={openHistory}
                        className="hidden sm:flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:border-primary hover:text-primary dark:border-[#30363d] dark:bg-surface-dark dark:text-text-muted"
                        title="Chat history"
                    >
                        <span className="material-symbols-outlined text-[17px]">history</span>
                        History
                    </button>
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
                    <div className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-teal-600 to-primary text-white rounded-xl shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-lg">construction</span>
                        <span className="text-sm font-semibold">Finance Mode is under development — coming soon!</span>
                    </div>
                </div>
            )}

            {showHistory && (
                <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/45 backdrop-blur-sm">
                    <button className="flex-1 cursor-default" aria-label="Close history" onClick={() => setShowHistory(false)} />
                    <aside className="h-full w-full max-w-md border-l border-gray-200 bg-white shadow-2xl dark:border-[#30363d] dark:bg-[#0A0E1A]">
                        <div className="border-b border-gray-200 p-4 dark:border-[#30363d]">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Chat History</h2>
                                    <p className="text-xs text-gray-500 dark:text-text-muted">Open a previous session inside this chat board.</p>
                                </div>
                                <button onClick={() => setShowHistory(false)} className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 dark:bg-white/10 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-gray-400">search</span>
                                <input
                                    value={historySearch}
                                    onChange={event => setHistorySearch(event.target.value)}
                                    placeholder="Search conversations..."
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-primary dark:border-[#30363d] dark:bg-surface-dark dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="h-[calc(100%-112px)] overflow-y-auto p-3">
                            {historyLoading ? (
                                <div className="p-8 text-center text-sm text-gray-400">Loading history...</div>
                            ) : filteredHistorySessions.length === 0 ? (
                                <div className="p-8 text-center text-sm text-gray-400">No conversations found.</div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredHistorySessions.map(session => (
                                        <button
                                            key={session.session_id}
                                            onClick={() => void loadSession(session.session_id)}
                                            className={`w-full rounded-2xl border p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 ${session.session_id === sessionId ? 'border-primary/40 bg-primary/10' : 'border-gray-200 bg-gray-50/70 dark:border-white/10 dark:bg-white/[0.04]'}`}
                                        >
                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{session.latest_content?.slice(0, 46) || 'Conversation'}</p>
                                                <span className="text-[10px] font-semibold text-gray-400">{new Date(session.latest_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-text-muted">{session.message_count} message{session.message_count === 1 ? '' : 's'} - {new Date(session.latest_time).toLocaleDateString()}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto page-enter">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary/20 to-teal-600/20 flex items-center justify-center mb-6 relative animate-glow-pulse">
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
                                    className={`glass-panel p-4 rounded-xl text-left hover:-translate-y-1 transition-all group flex items-center gap-3 border ${s.border}`}
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

                <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                    <motion.div key={i} className={`flex gap-3 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                        {/* Avatar */}
                        <div className={`w-8 h-8 lg:w-9 lg:h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === 'user'
                            ? 'bg-gray-200 dark:bg-surface-hover border border-gray-300 dark:border-[#30363d]'
                            : 'bg-gradient-to-tr from-primary to-teal-600 shadow-lg shadow-primary/20'
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
                                    ? 'glass-panel border-emerald-200/30 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-200 rounded-2xl rounded-tl-sm'
                                    : 'glass-panel text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-sm'
                                }`}>
                                {msg.role === 'user' ? (
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                ) : (
                                    <div className="space-y-1.5">{renderContent(msg.content)}</div>
                                )}
                                {msg.isTyping && (
    <div className="flex gap-1 items-center h-4 ml-1">
        <motion.div className="w-1.5 h-1.5 bg-primary rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
        <motion.div className="w-1.5 h-1.5 bg-primary rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
        <motion.div className="w-1.5 h-1.5 bg-primary rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
    </div>
)}

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

                            {msg.attachmentSummaries && msg.attachmentSummaries.length > 0 && (
                                <div className="mt-2 space-y-1.5 w-full">
                                    {msg.attachmentSummaries.map((summary, j) => (
                                        <div key={`${summary.name}-${j}`} className="rounded-xl border border-teal-200 bg-teal-50/80 px-3 py-2.5 text-xs text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200">
                                            <div className="mb-1 flex items-center gap-2 font-bold">
                                                <span className="material-symbols-outlined text-[15px]">attach_file</span>
                                                <span className="truncate">{summary.name}</span>
                                                {summary.confidence && <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-[10px] uppercase tracking-wide dark:bg-white/10">{summary.confidence}</span>}
                                            </div>
                                            <p className="leading-relaxed">{summary.summary}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {msg.pendingActions && ((msg.pendingActions.financialData?.length || 0) > 0 || (msg.pendingActions.actions?.length || 0) > 0) && (
                                <div className="mt-3 w-full rounded-2xl border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-black text-gray-900 dark:text-white">Review before saving</p>
                                            <p className="text-xs text-gray-500 dark:text-text-muted">Attachment results are extract-only until you confirm.</p>
                                        </div>
                                        <span className="material-symbols-outlined rounded-xl bg-primary/10 p-2 text-primary">rule</span>
                                    </div>
                                    <div className="space-y-2">
                                        {msg.pendingActions.financialData?.map((item, j) => (
                                            <div key={`${item.description}-${j}`} className="flex items-center gap-2 rounded-xl bg-white/75 px-3 py-2 text-xs dark:bg-white/5">
                                                <span className={`material-symbols-outlined text-[16px] ${item.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>{item.type === 'expense' ? 'remove' : 'add'}</span>
                                                <span className={`font-black ${item.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>{item.type === 'expense' ? '-' : '+'}{fmtRaw(item.amount)}</span>
                                                <span className="font-semibold text-gray-600 dark:text-gray-300">{item.category}</span>
                                                <span className="min-w-0 truncate text-gray-400">{item.description}</span>
                                                <span className="ml-auto text-gray-400">{item.date}</span>
                                            </div>
                                        ))}
                                        {(msg.pendingActions.actions?.length || 0) > 0 && (
                                            <div className="rounded-xl bg-white/75 px-3 py-2 text-xs font-semibold text-gray-500 dark:bg-white/5 dark:text-gray-300">
                                                {msg.pendingActions.actions.length} data action{msg.pendingActions.actions.length === 1 ? '' : 's'} proposed.
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <button
                                            onClick={() => void confirmPendingActions(i, msg.pendingActions)}
                                            disabled={confirmingIdx !== null}
                                            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                                        >
                                            <span className="material-symbols-outlined text-[15px]">check</span>
                                            {confirmingIdx === i ? 'Saving...' : 'Confirm & Save'}
                                        </button>
                                        <button
                                            onClick={() => setMessages(prev => prev.map((message, idx) => idx === i ? { ...message, pendingActions: null } : message))}
                                            className="rounded-xl px-4 py-2 text-xs font-bold text-gray-500 hover:text-rose-500"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
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
                    </motion.div>
                ))}
                </AnimatePresence>

                {/* Loading indicator with elapsed timer */}
                {loading && (
                    <div className="flex gap-3 max-w-3xl animate-fade-in">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined text-lg text-white">smart_toy</span>
                        </div>
                        <div className="glass-panel px-5 py-3.5 rounded-2xl rounded-tl-sm">
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
            <div className="p-3 lg:p-4 bg-white/80 dark:bg-[#0A0E1A]/80 backdrop-blur-xl border-t border-gray-200 dark:border-[#30363d]">
                {/* Quick actions toolbar */}
                <div className="flex gap-1.5 mb-3 max-w-3xl mx-auto overflow-x-auto pb-1 scrollbar-hide">
                    <button onClick={() => setInput('📊 Give me a summary of my spending')} className="px-2.5 py-1 flex items-center gap-1 rounded-lg text-xs font-semibold bg-gray-100 text-primary dark:bg-primary/10 hover:bg-gray-200 dark:hover:bg-primary/20 transition-all border border-gray-200 dark:border-primary/20 hover:-translate-y-0.5 whitespace-nowrap shrink-0"><span className="material-symbols-outlined text-[13px]">query_stats</span>Summary</button>
                    <button onClick={() => setInput('💰 I spent 500 on groceries')} className="px-2.5 py-1 flex items-center gap-1 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all border border-orange-200 dark:border-orange-500/20 hover:-translate-y-0.5 whitespace-nowrap shrink-0"><span className="material-symbols-outlined text-[13px]">remove</span>Expense</button>
                    <button onClick={() => setInput('📈 I earned 5000 from freelance')} className="px-2.5 py-1 flex items-center gap-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all border border-emerald-200 dark:border-emerald-500/20 hover:-translate-y-0.5 whitespace-nowrap shrink-0"><span className="material-symbols-outlined text-[13px]">add</span>Earning</button>
                    <button onClick={() => setInput('Generate a full report for this month')} className="px-2.5 py-1 flex items-center gap-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-all border border-teal-200 dark:border-teal-500/20 hover:-translate-y-0.5 whitespace-nowrap shrink-0"><span className="material-symbols-outlined text-[13px]">summarize</span>Report</button>
                </div>
                {attachments.length > 0 && (
                    <div className="mb-3 flex max-w-3xl mx-auto flex-wrap gap-2">
                        {attachments.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="flex max-w-full items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary dark:bg-primary/10">
                                <span className="material-symbols-outlined text-[15px]">{file.type.startsWith('image/') ? 'image' : 'attach_file'}</span>
                                <span className="max-w-[180px] truncate">{file.name}</span>
                                <button onClick={() => removeAttachment(index)} className="grid h-5 w-5 place-items-center rounded-full hover:bg-primary/10" aria-label="Remove attachment">
                                    <span className="material-symbols-outlined text-[13px]">close</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="relative glass-panel rounded-2xl focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all max-w-3xl mx-auto">
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/*,.txt,.md,.csv,.json,.pdf"
                        onChange={handleFileSelect}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute left-2 bottom-1.5 grid h-9 w-9 place-items-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-primary dark:hover:bg-white/10"
                        title="Attach document or photo"
                    >
                        <span className="material-symbols-outlined text-[18px]">attach_file</span>
                    </button>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-transparent border-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0 resize-none py-3.5 pl-14 pr-14 max-h-32 outline-none text-sm"
                        placeholder={mode === 'chat' ? 'Ask anything, or attach a receipt/photo/document...' : 'Enter data to store silently, or attach data to review...'}
                        rows={1}
                    />
                    <div className="absolute right-2 bottom-1.5">
                        <button
                            onClick={handleSend}
                            disabled={loading || (!input.trim() && attachments.length === 0)}
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
