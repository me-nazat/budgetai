'use client';

/**
 * @fileoverview Deterministic Financial Copilot Command Bar (Module 19 & Batch 9).
 * Single-column workspace grounded in financialContext and agentTools, with
 * compact session switcher dropdown, 4 live data-driven quick prompt pills,
 * and zero unconfirmed writes via ChatActionCard diffs.
 *
 * @module app/(app)/chat/page
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import ChatActionCard from '@/components/chat/ChatActionCard';
import { toast } from 'sonner';

interface ActionResult {
    action: string;
    target: string;
    count: number;
    detail: string;
    requiresApproval?: boolean;
    status?: 'PENDING_APPROVAL' | 'EXECUTED' | 'REJECTED';
    actionLogId?: string;
    amount?: number;
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
    toolCall?: {
        name: string;
        parameters: Record<string, any>;
        executionId?: number;
        actionLogId?: string;
    } | null;
    attachmentSummaries?: AttachmentSummary[];
    isReportRequest?: boolean;
    isTyping?: boolean;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'chat' | 'silent'>('chat');
    const invalidateFinancialData = useInvalidateFinancialData();
    const [loading, setLoading] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [sessionId, setSessionId] = useState<string>(`session_${Date.now()}`);
    const [attachments, setAttachments] = useState<File[]>([]);
    
    // Session Switcher Dropdown State
    const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);
    const [historySessions, setHistorySessions] = useState<Session[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { currency, fmtRaw } = useCurrency();
    const sym = CURRENCIES[currency]?.symbol || '$';

    // Close session dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setSessionDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load recent sessions for dropdown
    const loadSessions = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch('/api/chat/history');
            const data = await res.json();
            setHistorySessions(data.sessions || []);
        } catch {
            setHistorySessions([]);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const toggleSessionDropdown = () => {
        if (!sessionDropdownOpen) {
            void loadSessions();
        }
        setSessionDropdownOpen(!sessionDropdownOpen);
    };

    const startNewSession = () => {
        const newSid = `session_${Date.now()}`;
        setSessionId(newSid);
        setMessages([]);
        setAttachments([]);
        setSessionDropdownOpen(false);
        toast.info('Started a new Financial Copilot session');
    };

    const switchSession = async (sid: string) => {
        setSessionId(sid);
        setSessionDropdownOpen(false);
        setLoading(true);
        try {
            const res = await fetch(`/api/chat/messages?sessionId=${sid}`);
            const data = await res.json();
            setMessages(data.messages || []);
        } catch {
            toast.error('Could not load session messages');
        } finally {
            setLoading(false);
        }
    };

    const clearCurrentHistory = () => {
        setMessages([]);
        setAttachments([]);
        setSessionDropdownOpen(false);
        toast.info('Cleared conversation history for this session');
    };

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
                    }
                })
                .catch(err => console.error('Failed to load chat history:', err))
                .finally(() => setLoading(false));
            window.history.replaceState({}, '', '/chat');
        }
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
    }, []);

    const copyMessage = useCallback((text: string, idx: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIdx(idx);
            setTimeout(() => setCopiedIdx(null), 2000);
        });
    }, []);

    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []).slice(0, 5);
        setAttachments(prev => [...prev, ...files].slice(0, 5));
        event.target.value = '';
    }, []);

    const removeAttachment = useCallback((index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleSend = async (overridePrompt?: string) => {
        const msg = (overridePrompt ?? input).trim();
        if ((!msg && attachments.length === 0) || loading) return;
        const outgoingAttachments = attachments;
        setInput('');
        setAttachments([]);
        if (inputRef.current) inputRef.current.style.height = 'auto';
        setLoading(true);

        const attachmentLabel = outgoingAttachments.length > 0
            ? `\n\nAttachments: ${outgoingAttachments.map(f => f.name).join(', ')}`
            : '';
        const userMsg: Message = {
            role: 'user',
            content: `${msg || 'Analyze these attachments.'}${attachmentLabel}`,
            mode,
            created_at: new Date().toISOString(),
        };
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
                content: data.message || '',
                mode,
                created_at: new Date().toISOString(),
                transactions: data.transactions,
                actionResults: data.actionResults,
                pendingActions: data.pendingActions,
                toolCall: data.toolCall,
                attachmentSummaries: data.attachmentSummaries,
                isReportRequest: data.isReportRequest,
            };

            setMessages(prev => [...prev, aiMsg]);

            if ((aiMsg.transactions && aiMsg.transactions.length > 0) || (aiMsg.actionResults && aiMsg.actionResults.length > 0)) {
                invalidateFinancialData();
            }

            if (data.isReportRequest) {
                await generateReportFiles(data.dateRange, data.reportFormat);
            }
        } catch {
            setMessages(prev => [
                ...prev,
                { role: 'system', content: 'Could not reach Financial Copilot. Please check your connection and try again.' },
            ]);
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

            const totalExpenses = transactions.filter((t: any) => t.type === 'expense').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
            const totalEarnings = transactions.filter((t: any) => t.type === 'earning').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
            const net = totalEarnings - totalExpenses;

            // Excel export
            if (format === 'excel' || format === 'both') {
                const ExcelJS = await import('exceljs');
                const wb = new ExcelJS.Workbook();
                wb.creator = 'Financial Copilot';
                const ws = wb.addWorksheet('Transactions');
                ws.addRow(['Financial Report', `Generated: ${new Date().toISOString()}`]);
                ws.addRow(['Date', 'Type', 'Category', 'Description', 'Amount']);
                transactions.forEach((t: any) => {
                    ws.addRow([t.date, t.type, t.category, t.description, t.amount]);
                });
                const buffer = await wb.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Financial_Audit_${new Date().toISOString().split('T')[0]}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
            }

            // PDF export
            if (format === 'pdf' || format === 'both') {
                const { default: jsPDF } = await import('jspdf');
                const { default: autoTable } = await import('jspdf-autotable');
                const doc = new jsPDF();
                doc.setFontSize(16);
                doc.text('Financial Copilot Ledger Audit', 14, 18);
                doc.setFontSize(10);
                doc.text(`Period: ${dateRange?.start || 'All'} to ${dateRange?.end || 'Current'} | Net: ${sym}${net.toFixed(2)}`, 14, 26);

                autoTable(doc as any, {
                    startY: 32,
                    head: [['Date', 'Type', 'Category', 'Description', 'Amount']],
                    body: transactions.map((t: any) => [
                        t.date,
                        t.type,
                        t.category,
                        t.description,
                        `${t.type === 'expense' ? '-' : '+'}${sym}${Number(t.amount).toFixed(2)}`,
                    ]),
                    theme: 'striped',
                });

                const pdfBlob = doc.output('blob');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                const pdfA = document.createElement('a');
                pdfA.href = pdfUrl;
                pdfA.download = `Financial_Audit_${new Date().toISOString().split('T')[0]}.pdf`;
                pdfA.click();
                URL.revokeObjectURL(pdfUrl);
            }

            toast.success('Generated and downloaded ledger report');
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

    // 4 Data-Driven Quick Prompt Pills
    const QUICK_PROMPT_PILLS = [
        {
            title: 'Audit my spending pace this month vs. last month',
            icon: 'speed',
            badge: 'Pace Audit',
        },
        {
            title: 'How much can I safely spend per day for the rest of the month?',
            icon: 'account_balance_wallet',
            badge: 'Daily Allowance',
        },
        {
            title: 'Find subscriptions or categories where I can cut 10%',
            icon: 'content_cut',
            badge: 'Cost Reduction',
        },
        {
            title: 'Log an expense or rebalance my over-budget categories',
            icon: 'tune',
            badge: 'Envelope Balance',
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100dvh-64px)] max-w-4xl mx-auto w-full px-3 sm:px-6">
            {/* Header: Minimalist Financial Command Bar */}
            <header className="h-14 sm:h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                            Financial Copilot
                        </h1>
                    </div>

                    {/* Compact Session Switcher Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={toggleSessionDropdown}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[15px] text-slate-400">forum</span>
                            <span className="max-w-[110px] sm:max-w-[150px] truncate">
                                {sessionId.replace('session_', 'Session ')}
                            </span>
                            <span className="material-symbols-outlined text-[15px] text-slate-400">arrow_drop_down</span>
                        </button>

                        {/* Dropdown Menu */}
                        {sessionDropdownOpen && (
                            <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-1.5 z-30 animate-in fade-in slide-in-from-top-1 duration-150">
                                <button
                                    type="button"
                                    onClick={startNewSession}
                                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-sm text-emerald-500">add_circle</span>
                                    New Session
                                </button>

                                <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />

                                <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Recent Sessions
                                </div>

                                <div className="max-h-48 overflow-y-auto">
                                    {historyLoading ? (
                                        <div className="px-3.5 py-2 text-xs text-slate-400">Loading...</div>
                                    ) : historySessions.length === 0 ? (
                                        <div className="px-3.5 py-2 text-xs text-slate-400">No previous sessions</div>
                                    ) : (
                                        historySessions.slice(0, 5).map(s => (
                                            <button
                                                key={s.session_id}
                                                type="button"
                                                onClick={() => switchSession(s.session_id)}
                                                className={`w-full px-3.5 py-2 text-left text-xs truncate flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                                                    s.session_id === sessionId
                                                        ? 'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/5'
                                                        : 'text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                <span className="truncate">
                                                    {s.latest_content || s.session_id.replace('session_', 'Session ')}
                                                </span>
                                                <span className="text-[10px] text-slate-400 shrink-0">
                                                    {s.message_count}m
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>

                                <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />

                                <button
                                    type="button"
                                    onClick={clearCurrentHistory}
                                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-sm">delete_sweep</span>
                                    Clear History
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Header Action: Mode Toggle */}
                <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-800 text-xs">
                        <button
                            type="button"
                            onClick={() => setMode('chat')}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                                mode === 'chat'
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            Conversational
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('silent')}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                                mode === 'silent'
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            Silent Staging
                        </button>
                    </div>
                </div>
            </header>

            {/* Chat Messages Workspace */}
            <main className="flex-1 overflow-y-auto py-5 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-xl mx-auto px-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 mb-4 shadow-xs">
                            <span className="material-symbols-outlined text-2xl">account_balance</span>
                        </div>
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1.5">
                            Deterministic Financial Copilot
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 leading-relaxed max-w-md">
                            Directly grounded in your accounts, ledger transactions, and envelope budgets. Every numerical response is verified against active balances.
                        </p>

                        {/* 4 Data-Driven Quick Prompt Pills */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                            {QUICK_PROMPT_PILLS.map((pill, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSend(pill.title)}
                                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all group flex flex-col justify-between gap-2 shadow-xs cursor-pointer"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                            {pill.badge}
                                        </span>
                                        <span className="material-symbols-outlined text-sm text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                            arrow_outward
                                        </span>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                                        {pill.title}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Message Stream */}
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex flex-col gap-1.5 max-w-2xl ${
                            msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                        }`}
                    >
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 px-1">
                            <span>{msg.role === 'user' ? 'You' : 'Financial Copilot'}</span>
                            {msg.created_at && (
                                <>
                                    <span>•</span>
                                    <span className="tabular-nums">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Bubble */}
                        <div
                            className={`relative px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                                msg.role === 'user'
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-tr-xs shadow-xs'
                                    : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-xs shadow-xs w-full'
                            }`}
                        >
                            <p className="whitespace-pre-wrap">{msg.content}</p>

                            {/* Copy button on assistant messages */}
                            {msg.role !== 'user' && msg.content && (
                                <button
                                    type="button"
                                    onClick={() => copyMessage(msg.content, i)}
                                    className="mt-2 text-[10px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[12px]">
                                        {copiedIdx === i ? 'check' : 'content_copy'}
                                    </span>
                                    {copiedIdx === i ? 'Copied' : 'Copy'}
                                </button>
                            )}

                            {/* Staged Tool Call Diff Card */}
                            {msg.toolCall && (
                                <ChatActionCard
                                    executionId={msg.toolCall.executionId}
                                    actionLogId={msg.toolCall.actionLogId}
                                    toolName={msg.toolCall.name}
                                    parameters={msg.toolCall.parameters}
                                    onActionComplete={() => invalidateFinancialData()}
                                    onUndoComplete={() => invalidateFinancialData()}
                                />
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="mr-auto flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                        <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        <span>Verifying ledger constraints...</span>
                    </div>
                )}

                <div ref={endRef} />
            </main>

            {/* Input Bar */}
            <footer className="pt-2 pb-4 shrink-0 bg-transparent">
                {/* Pending Attachments Strip */}
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {attachments.map((file, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                                <span className="material-symbols-outlined text-xs">attach_file</span>
                                <span className="max-w-[140px] truncate">{file.name}</span>
                                <button
                                    type="button"
                                    onClick={() => removeAttachment(idx)}
                                    className="text-slate-400 hover:text-rose-500"
                                >
                                    <span className="material-symbols-outlined text-xs">close</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-end gap-2 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        multiple
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer rounded-xl"
                        title="Attach receipt, CSV or statement"
                    >
                        <span className="material-symbols-outlined text-xl">attach_file</span>
                    </button>

                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Financial Copilot or propose a ledger transaction..."
                        rows={1}
                        className="flex-1 max-h-36 py-2 px-1 text-xs sm:text-sm bg-transparent outline-none resize-none text-slate-900 dark:text-white placeholder:text-slate-400"
                    />

                    <button
                        type="button"
                        onClick={() => handleSend()}
                        disabled={loading || (!input.trim() && attachments.length === 0)}
                        className="p-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 cursor-pointer shrink-0"
                    >
                        <span className="material-symbols-outlined text-lg">arrow_upward</span>
                    </button>
                </div>
            </footer>
        </div>
    );
}
