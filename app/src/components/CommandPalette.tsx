'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { ReceiptScannerModal } from '@/components/transactions/ReceiptScannerModal';
import { useTheme } from '@/components/providers/ThemeProvider';

type CommandType = 'navigation' | 'action' | 'ai';

interface CommandItem {
    id: string;
    title: string;
    type: CommandType;
    icon: string;
    keywords: string[];
    action?: string;
    path?: string;
    onExecute?: () => void;
}

const RECENT_STORAGE_KEY = 'wealth_ai_recent_command_ids';

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [recentIds, setRecentIds] = useState<string[]>([]);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { setTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
        try {
            const saved = localStorage.getItem(RECENT_STORAGE_KEY);
            if (saved) {
                setRecentIds(JSON.parse(saved));
            }
        } catch {
            // fallback
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(open => !open);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    const recordRecentCommand = (id: string) => {
        try {
            const updated = [id, ...recentIds.filter(i => i !== id)].slice(0, 5);
            setRecentIds(updated);
            localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
        } catch {
            // fallback
        }
    };

    const toggleTheme = (theme: 'dark' | 'light') => {
        setTheme(theme);
        toast.success(`Switched to ${theme === 'dark' ? 'Dark' : 'Light'} Mode`);
    };

    const executeNaturalCommand = async (input: string) => {
        const addRegex = /add\s+(expense|income)\s+(\d+(?:\.\d+)?)\s*(.*)/i;
        const match = input.match(addRegex);
        if (match) {
            const [, typeStr, amountStr, catStr] = match;
            const isExpense = typeStr.toLowerCase() === 'expense';
            const amount = parseFloat(amountStr);
            const category = catStr.trim() || 'General';

            toast.promise(
                (async () => {
                    const res = await fetch('/api/transactions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: isExpense ? 'EXPENSE' : 'INCOME',
                            amount,
                            category,
                            description: `Quick AI Add: ${category}`,
                            date: new Date().toISOString(),
                        })
                    });
                    if (!res.ok) throw new Error('API failed');
                    return await res.json();
                })(),
                {
                    loading: `Recording ${typeStr.toLowerCase()} of $${amount}...`,
                    success: `Added ${typeStr.toLowerCase()} of $${amount} under ${category}!`,
                    error: `Failed to record transaction. Try manual entry.`
                }
            );
            return true;
        }
        return false;
    };

    const ALL_COMMANDS: CommandItem[] = useMemo(() => [
        { id: 'nav-dash', title: 'Go to Dashboard', type: 'navigation', icon: 'dashboard', keywords: ['home', 'main', 'dashboard'], path: '/dashboard' },
        { id: 'scan', title: 'Smart Receipt Scanner', type: 'action', icon: 'document_scanner', keywords: ['receipt', 'scan', 'camera', 'ocr'], action: 'SCAN_RECEIPT' },
        { id: 'nav-trans', title: 'View Transactions', type: 'navigation', icon: 'receipt_long', keywords: ['history', 'spending', 'ledger'], path: '/transactions' },
        { id: 'nav-bud', title: 'Budget Planner', type: 'navigation', icon: 'account_balance_wallet', keywords: ['limits', 'planner', 'budgets'], path: '/budget' },
        { id: 'nav-wealth', title: 'Wealth & Goals', type: 'navigation', icon: 'savings', keywords: ['net worth', 'goals', 'savings'], path: '/wealth-goals' },
        { id: 'nav-debt', title: 'Debt Payoff Planner', type: 'navigation', icon: 'credit_card', keywords: ['loans', 'payoff', 'debt'], path: '/debts' },
        { id: 'nav-forecast', title: 'Cash Flow Forecast', type: 'navigation', icon: 'timeline', keywords: ['future', 'cash', 'projection'], path: '/forecast' },
        { id: 'nav-fire', title: 'FIRE Simulator', type: 'navigation', icon: 'local_fire_department', keywords: ['retire', 'independence', 'early'], path: '/fire' },
        { id: 'nav-month', title: 'My Month Calendar', type: 'navigation', icon: 'calendar_month', keywords: ['calendar', 'monthly', 'schedule'], path: '/my-month' },
        { id: 'nav-over', title: 'Executive Overview', type: 'navigation', icon: 'insights', keywords: ['executive', 'overview', 'institutional'], path: '/overview' },
        { id: 'nav-report', title: 'Analytics & Reports', type: 'navigation', icon: 'bar_chart', keywords: ['stats', 'graphs', 'charts', 'reports'], path: '/reports' },
        { id: 'nav-recur', title: 'Recurring & Subscriptions', type: 'navigation', icon: 'repeat', keywords: ['subscriptions', 'recurring', 'bills'], path: '/recurring-subscriptions' },
        { id: 'nav-auto', title: 'Automation Rules', type: 'navigation', icon: 'auto_awesome', keywords: ['automation', 'rules', 'smart'], path: '/automation-rules' },
        { id: 'nav-noti', title: 'View Notifications', type: 'navigation', icon: 'notifications', keywords: ['alerts', 'messages', 'notifications'], path: '/notifications' },
        { id: 'nav-set', title: 'Preferences & Settings', type: 'navigation', icon: 'settings', keywords: ['preferences', 'account', 'settings', 'institutional'], path: '/settings' },
        { id: 'action-dark', title: 'Switch to Dark Mode', type: 'action', icon: 'dark_mode', keywords: ['theme', 'night', 'dark'], onExecute: () => toggleTheme('dark') },
        { id: 'action-light', title: 'Switch to Light Mode', type: 'action', icon: 'light_mode', keywords: ['theme', 'day', 'light'], onExecute: () => toggleTheme('light') },
        { 
            id: 'action-export', 
            title: 'Export PDF Report', 
            type: 'action', 
            icon: 'picture_as_pdf', 
            keywords: ['download', 'save', 'pdf', 'export', 'statement'], 
            onExecute: () => {
                toast.info('Generating PDF Report...');
                router.push('/reports');
            } 
        },
        { 
            id: 'ai-add', 
            title: 'Execute Quick AI Command...', 
            type: 'ai', 
            icon: 'smart_toy', 
            keywords: ['add', 'expense', 'income', 'buy', 'spent', 'transaction'],
            onExecute: () => {
                if (!executeNaturalCommand(query)) {
                    toast.info("Try typing: 'Add expense 500 Food'");
                }
            }
        },
    ], [query, router]);

    // Zero-latency memoized index matching
    const filteredCommands = useMemo(() => {
        if (!query.trim()) {
            // Prioritize recent commands when empty
            const recents = recentIds
                .map(id => ALL_COMMANDS.find(c => c.id === id))
                .filter((c): c is CommandItem => Boolean(c));
            
            const remaining = ALL_COMMANDS.filter(c => !recentIds.includes(c.id));
            return [...recents, ...remaining].slice(0, 8);
        }

        const q = query.toLowerCase().trim();
        return ALL_COMMANDS.filter((cmd) => {
            const searchTarget = `${cmd.title} ${cmd.keywords.join(' ')}`.toLowerCase();
            return searchTarget.includes(q);
        });
    }, [query, recentIds, ALL_COMMANDS]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const executeCommand = useCallback((cmd: CommandItem) => {
        recordRecentCommand(cmd.id);
        setIsOpen(false);
        setQuery('');
        if (cmd.action === 'SCAN_RECEIPT') {
            setIsScannerOpen(true);
        } else if (cmd.onExecute) {
            cmd.onExecute();
        } else if (cmd.path) {
            router.push(cmd.path);
        }
    }, [router, recentIds]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : prev));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    executeCommand(filteredCommands[selectedIndex]);
                } else if (query.toLowerCase().startsWith('add ')) {
                    executeNaturalCommand(query).then((success) => {
                        if (success) setIsOpen(false);
                    });
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsOpen(false);
            }
        },
        [filteredCommands, selectedIndex, query, executeCommand]
    );

    if (!mounted) return null;

    return createPortal(
        <>
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-[12vh] sm:pt-[16vh] px-4 pb-20">
                    {/* Glassmorphic Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-slate-950/60 backdrop-blur-2xl"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Floating Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{
                            type: 'spring',
                            stiffness: 350,
                            damping: 28,
                            mass: 0.5,
                        }}
                        className="relative w-full max-w-2xl bg-slate-950/80 dark:bg-slate-950/80 bg-white/80 rounded-2xl shadow-2xl overflow-hidden border border-white/10 dark:border-white/10 border-slate-200/50 backdrop-blur-2xl p-2 sm:p-4"
                        role="dialog"
                        aria-modal="true"
                    >
                        {/* Search Input Bar */}
                        <div className="flex items-center gap-3 rounded-xl bg-black/5 dark:bg-black/50 px-4 py-3.5 border border-black/5 dark:border-white/10 shadow-inner">
                            <span className="material-symbols-outlined text-gray-400 dark:text-white/50 text-xl">search</span>
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full bg-transparent text-base sm:text-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 outline-none font-medium"
                                placeholder="Type a command... (e.g. 'Add expense 500 Food', 'Dark mode')"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                role="combobox"
                                aria-expanded="true"
                                aria-controls="command-palette-results"
                                aria-activedescendant={
                                    filteredCommands[selectedIndex] ? filteredCommands[selectedIndex].id : undefined
                                }
                            />
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/40 font-mono">
                                <kbd className="rounded bg-black/5 dark:bg-white/10 px-2 py-0.5 border border-black/10 dark:border-white/10">ESC</kbd>
                            </div>
                        </div>

                        {/* List Results */}
                        <div
                            id="command-palette-results"
                            className="mt-3 max-h-[55vh] overflow-y-auto px-1 pb-1 scrollbar-thin"
                            role="listbox"
                        >
                            {filteredCommands.length === 0 ? (
                                <div className="py-12 text-center text-sm text-gray-500 dark:text-white/40 flex flex-col items-center gap-2">
                                    <span className="material-symbols-outlined text-3xl opacity-40">search_off</span>
                                    <span>No matching actions found for "{query}"</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {!query.trim() && recentIds.length > 0 && (
                                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/40">
                                            Recently Used & Suggested
                                        </div>
                                    )}

                                    {filteredCommands.map((cmd, index) => {
                                        const isSelected = index === selectedIndex;
                                        const isRecent = !query.trim() && recentIds.includes(cmd.id);

                                        return (
                                            <div
                                                key={cmd.id}
                                                id={cmd.id}
                                                role="option"
                                                aria-selected={isSelected}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                                onClick={() => executeCommand(cmd)}
                                                className={`group relative flex cursor-pointer items-center gap-3.5 rounded-xl px-4 py-3 transition-colors ${
                                                    isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                            >
                                                {/* Spring Animated Selection Highlight */}
                                                {isSelected && (
                                                    <motion.div
                                                        layoutId="command-palette-highlight"
                                                        className="absolute inset-0 rounded-xl bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10"
                                                        initial={false}
                                                        transition={{
                                                            type: 'spring',
                                                            stiffness: 450,
                                                            damping: 35,
                                                        }}
                                                    />
                                                )}

                                                <span className="material-symbols-outlined relative z-10 text-[22px] opacity-75 group-hover:opacity-100">
                                                    {cmd.icon}
                                                </span>

                                                <div className="relative z-10 flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold tracking-tight">{cmd.title}</span>
                                                        {isRecent && (
                                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white/50 font-mono">
                                                                Recent
                                                            </span>
                                                        )}
                                                    </div>
                                                    {cmd.type === 'ai' && (
                                                        <span className="text-[10px] font-mono tracking-wider text-blue-400">
                                                            Natural Command Parser
                                                        </span>
                                                    )}
                                                </div>

                                                {isSelected && (
                                                    <span className="relative z-10 ml-auto flex items-center gap-1.5 text-[11px] font-mono text-gray-500 dark:text-white/40">
                                                        <kbd className="rounded bg-black/10 dark:bg-white/10 px-1.5 py-0.5 border border-black/10 dark:border-white/10">↵</kbd>
                                                        Run
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer Status Bar */}
                        <div className="mt-2 flex items-center justify-between border-t border-gray-200/50 dark:border-white/10 px-4 pt-3 text-[11px] font-mono text-gray-400 dark:text-white/40">
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1"><kbd className="rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5">↑↓</kbd> Navigate</span>
                                <span className="flex items-center gap-1"><kbd className="rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5">↵</kbd> Execute</span>
                            </div>
                            <div className="flex items-center gap-1 font-semibold text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Pro Navigation Active
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
        <ReceiptScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
        </>,
        document.body
    );
}
