'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import useSWR from 'swr';
import { getCategoryIcon, getCategoryHex } from '@/lib/categoryUtils';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { useCurrency } from '@/hooks/useCurrency';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { QuickAddTransactionModal } from '@/components/transactions/QuickAddTransactionModal';
import TransactionDetailModal from '@/components/TransactionDetailModal';

export interface DayTransaction {
    id: number;
    type: 'expense' | 'earning' | string;
    amount: number;
    category: string;
    description: string;
    date: string;
    notes?: string;
    accountId?: number | null;
    accountName?: string;
}

export interface DayRecurringItem {
    id: number;
    name: string;
    type: 'expense' | 'earning' | string;
    amount: number;
    category: string;
    frequency: string;
    next_date?: string;
    nextDate?: string;
    active?: number;
}

export interface DayDetailPopupProps {
    date: string;
    anchorEl?: HTMLElement | null;
    transactions?: DayTransaction[];
    recurringItems?: DayRecurringItem[];
    customCategories?: Array<{ name: string; color?: string; icon?: string }>;
    onClose: () => void;
    onTransactionClick?: (tx: DayTransaction) => void;
    onAddClick?: (date: string) => void;
    compact?: boolean;
    loading?: boolean;
}

export default function DayDetailPopup({
    date,
    anchorEl,
    transactions: propTransactions,
    recurringItems: propRecurring,
    customCategories: propCustomCats,
    onClose,
    onTransactionClick,
    onAddClick,
    compact = false,
    loading: propLoading,
}: DayDetailPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const { fmt } = useCurrency();
    const { formatAmount } = usePrivacy();
    const invalidateData = useInvalidateFinancialData();
    const [mounted, setMounted] = useState(false);

    // Modals internal state
    const [selectedTx, setSelectedTx] = useState<DayTransaction | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editModalTx, setEditModalTx] = useState<DayTransaction | null>(null);

    // Custom categories hook if not passed
    const { categories: fetchedCats } = useCustomCategories('all');
    const customCategories = propCustomCats || fetchedCats;

    // Async fetching if transactions are not provided as props
    const shouldFetch = !propTransactions;
    const { data: txData, error: txError } = useSWR<{ transactions: DayTransaction[] }>(
        shouldFetch && date ? `/api/transactions?start=${date}&end=${date}&limit=1000` : null
    );
    const { data: recurringData } = useSWR<{ items: DayRecurringItem[] }>(
        shouldFetch ? `/api/recurring` : null
    );
    const { data: accountsData } = useSWR<{ accounts: Array<{ id: number; name: string }> }>(
        `/api/accounts`
    );

    const isAsyncLoading = shouldFetch && !txData && !txError;
    const isLoading = propLoading !== undefined ? propLoading : isAsyncLoading;

    // Map account names
    const accountMap = useMemo(() => {
        const map = new Map<number, string>();
        if (accountsData?.accounts) {
            accountsData.accounts.forEach((a) => map.set(a.id, a.name));
        }
        return map;
    }, [accountsData]);

    // Resolved transactions
    const resolvedTransactions: DayTransaction[] = useMemo(() => {
        const raw = propTransactions || txData?.transactions || [];
        return raw.map((tx) => ({
            ...tx,
            accountName: tx.accountId ? accountMap.get(tx.accountId) : undefined,
        }));
    }, [propTransactions, txData, accountMap]);

    // Resolved recurring items for this date
    const resolvedRecurring: DayRecurringItem[] = useMemo(() => {
        if (propRecurring) return propRecurring;
        const items = recurringData?.items || [];
        return items.filter((r) => {
            if (r.active === 0) return false;
            const rDate = r.nextDate || r.next_date;
            if (!rDate) return false;
            return rDate === date || rDate.startsWith(date);
        });
    }, [propRecurring, recurringData, date]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    // Summary calculations
    const totalIncome = useMemo(() => {
        return resolvedTransactions
            .filter((tx) => tx.type === 'earning')
            .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    }, [resolvedTransactions]);

    const totalExpense = useMemo(() => {
        return resolvedTransactions
            .filter((tx) => tx.type === 'expense')
            .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    }, [resolvedTransactions]);

    const netCashflow = totalIncome - totalExpense;

    const formattedDate = useMemo(() => {
        if (!date) return '';
        try {
            return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        } catch {
            return date;
        }
    }, [date]);

    // Positioning calculation relative to anchorEl with viewport containment
    const calculatePosition = useCallback(() => {
        if (typeof window === 'undefined') return;
        const popupWidth = compact ? 360 : 390;
        const popupMaxHeight = 460;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        if (!anchorEl || viewportW < 640) {
            // Center modal on small screens or when anchorEl is not provided
            setPosition({
                left: Math.max(12, (viewportW - popupWidth) / 2),
                top: Math.max(16, (viewportH - popupMaxHeight) / 2),
            });
            return;
        }

        const rect = anchorEl.getBoundingClientRect();
        const gap = 10;
        let left: number;
        let top: number;

        if (rect.right + popupWidth + gap < viewportW) {
            left = rect.right + gap;
        } else if (rect.left - popupWidth - gap > 0) {
            left = rect.left - popupWidth - gap;
        } else {
            left = Math.max(12, (viewportW - popupWidth) / 2);
        }

        top = rect.top + rect.height / 2 - popupMaxHeight / 2;
        top = Math.max(12, Math.min(top, viewportH - popupMaxHeight - 12));

        setPosition({ top, left });
    }, [anchorEl, compact]);

    useEffect(() => {
        const frame = requestAnimationFrame(calculatePosition);
        window.addEventListener('resize', calculatePosition);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', calculatePosition);
        };
    }, [calculatePosition]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handleRowClick = (tx: DayTransaction) => {
        if (onTransactionClick) {
            onTransactionClick(tx);
        } else {
            setSelectedTx(tx);
        }
    };

    const handleAddTrigger = () => {
        if (onAddClick) {
            onAddClick(date);
        } else {
            setIsAddModalOpen(true);
        }
    };

    if (!mounted || !position) return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[70] flex items-center justify-center sm:block" onClick={onClose}>
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 bg-black/40 backdrop-blur-[3px]"
                />

                {/* Popup Card */}
                <motion.div
                    ref={popupRef}
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    className={`fixed z-[75] flex flex-col rounded-3xl bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl border border-gray-200/90 dark:border-white/10 shadow-2xl overflow-hidden ${
                        compact ? 'w-[360px] max-h-[440px]' : 'w-[390px] max-h-[480px]'
                    }`}
                    style={{ top: position.top, left: position.left }}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-gray-150 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02]">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Day Ledger</span>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{formattedDate}</h3>
                            <p className="text-[11px] text-gray-400 dark:text-text-muted mt-0.5">
                                {resolvedTransactions.length} transaction{resolvedTransactions.length !== 1 ? 's' : ''}
                                {resolvedRecurring.length > 0 && ` · ${resolvedRecurring.length} scheduled bill${resolvedRecurring.length !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-150 dark:hover:bg-white/10 transition-colors"
                            title="Close"
                        >
                            <span className="material-symbols-outlined text-lg leading-none">close</span>
                        </button>
                    </div>

                    {/* Financial Summary KPI Strip */}
                    <div className="px-5 py-3 grid grid-cols-3 gap-2 border-b border-gray-150 dark:border-white/5 bg-white/50 dark:bg-black/10">
                        <div className="rounded-xl p-2 bg-emerald-500/10 border border-emerald-500/20 text-center">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">Income</span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono block mt-0.5 truncate">
                                +{formatAmount(totalIncome, fmt(totalIncome))}
                            </span>
                        </div>
                        <div className="rounded-xl p-2 bg-rose-500/10 border border-rose-500/20 text-center">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 block">Expenses</span>
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums font-mono block mt-0.5 truncate">
                                −{formatAmount(totalExpense, fmt(totalExpense))}
                            </span>
                        </div>
                        <div className={`rounded-xl p-2 border text-center ${
                            netCashflow >= 0
                                ? 'bg-primary/10 border-primary/20 text-primary'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                        }`}>
                            <span className="text-[9px] font-bold uppercase tracking-wider block opacity-80">Net Cashflow</span>
                            <span className="text-xs font-bold tabular-nums font-mono block mt-0.5 truncate">
                                {netCashflow >= 0 ? '+' : '−'}{formatAmount(Math.abs(netCashflow), fmt(Math.abs(netCashflow)))}
                            </span>
                        </div>
                    </div>

                    {/* Transaction & Recurring Items List */}
                    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 custom-scrollbar">
                        {isLoading ? (
                            <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-gray-400">Loading day activity...</span>
                            </div>
                        ) : resolvedTransactions.length === 0 && resolvedRecurring.length === 0 ? (
                            <div className="py-6 text-center text-gray-400">
                                <span className="material-symbols-outlined text-3xl opacity-30 block mb-1">calendar_today</span>
                                <p className="text-xs font-medium">No transactions recorded on this date.</p>
                            </div>
                        ) : (
                            <>
                                {resolvedTransactions.map((tx) => {
                                    const categoryColor = getCategoryHex(tx.category, customCategories as { name: string; color: string }[]);
                                    return (
                                        <button
                                            key={tx.id}
                                            type="button"
                                            onClick={() => handleRowClick(tx)}
                                            className="w-full text-left p-2.5 rounded-xl border border-gray-150 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02] hover:bg-primary/5 hover:border-primary/25 transition-all group flex items-center justify-between gap-3"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-sm"
                                                    style={{ backgroundColor: categoryColor }}
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">
                                                        {getCategoryIcon(tx.category, customCategories as { name: string; icon: string }[])}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">
                                                        {tx.description || tx.category}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 dark:text-text-muted truncate">
                                                        {tx.category} {tx.accountName ? `• ${tx.accountName}` : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0 flex items-center gap-1.5">
                                                <span
                                                    className={`text-xs font-bold tabular-nums font-mono ${
                                                        tx.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'
                                                    }`}
                                                >
                                                    {tx.type === 'expense' ? '−' : '+'}{formatAmount(tx.amount, fmt(tx.amount))}
                                                </span>
                                                <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-sm group-hover:text-primary transition-colors">
                                                    chevron_right
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}

                                {resolvedRecurring.map((item) => (
                                    <div
                                        key={`rec-${item.id}`}
                                        className="p-2.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-[16px]">schedule</span>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                        {item.name}
                                                    </span>
                                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                                                        Bill
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 capitalize">
                                                    {item.frequency} recurrence
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums font-mono">
                                            {formatAmount(item.amount, fmt(item.amount))}
                                        </span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Footer Action */}
                    <div className="p-4 border-t border-gray-150 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02]">
                        <button
                            type="button"
                            onClick={handleAddTrigger}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
                        >
                            <span className="material-symbols-outlined text-[16px]">add_circle</span>
                            <span>Add transaction on this date</span>
                        </button>
                    </div>
                </motion.div>

                {/* Transaction Edit/View Detail Modal */}
                {selectedTx && (
                    <TransactionDetailModal
                        transaction={selectedTx as any}
                        customCategories={customCategories as { name: string; color: string }[]}
                        onClose={() => setSelectedTx(null)}
                        onEdit={(tx) => {
                            setSelectedTx(null);
                            setEditModalTx(tx as any);
                        }}
                        onDuplicate={(tx) => {
                            setSelectedTx(null);
                            setEditModalTx({
                                ...(tx as any),
                                id: undefined as unknown as number,
                                date: new Date().toISOString().split('T')[0],
                            });
                        }}
                        onDelete={async (tx) => {
                            if (confirm('Are you sure you want to delete this transaction?')) {
                                await fetch(`/api/transactions?id=${tx.id}`, { method: 'DELETE' });
                                await invalidateData();
                                setSelectedTx(null);
                            }
                        }}
                        onNotesChange={async () => {
                            await invalidateData();
                        }}
                    />
                )}

                {/* Quick Add Modal */}
                <QuickAddTransactionModal
                    isOpen={isAddModalOpen || Boolean(editModalTx)}
                    onClose={() => {
                        setIsAddModalOpen(false);
                        setEditModalTx(null);
                    }}
                    initialDate={date}
                    initialTransaction={editModalTx as any}
                    onSaveSuccess={async () => {
                        await invalidateData();
                        setIsAddModalOpen(false);
                        setEditModalTx(null);
                    }}
                />
            </div>
        </AnimatePresence>,
        document.body
    );
}
