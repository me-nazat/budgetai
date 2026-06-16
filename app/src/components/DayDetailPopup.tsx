'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getCategoryHex } from '@/lib/categoryUtils';
import { useCurrency } from '@/hooks/useCurrency';

interface Transaction {
    id: number;
    type: 'expense' | 'earning';
    amount: number;
    category: string;
    description: string;
    date: string;
    notes?: string;
}

interface RecurringItem {
    id: number;
    name: string;
    type: 'expense' | 'earning' | string;
    amount: number;
    category: string;
    frequency: string;
    next_date: string;
}

interface DayDetailPopupProps {
    date: string;
    anchorEl: HTMLElement | null;
    transactions: Transaction[];
    recurringItems: RecurringItem[];
    customCategories?: { name: string; color: string }[];
    onClose: () => void;
    onTransactionClick: (tx: Transaction) => void;
    onAddClick: (date: string) => void;
    compact?: boolean;
}

export default function DayDetailPopup({
    date,
    anchorEl,
    transactions,
    recurringItems,
    customCategories,
    onClose,
    onTransactionClick,
    onAddClick,
    compact = false,
}: DayDetailPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const { fmt } = useCurrency();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    const totalExpense = transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const totalIncome = transactions.filter(tx => tx.type === 'earning').reduce((sum, tx) => sum + tx.amount, 0);

    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    const calculatePosition = useCallback(() => {
        if (!anchorEl) return;
        const rect = anchorEl.getBoundingClientRect();
        const popupWidth = compact ? 355 : 380;
        const popupMaxHeight = compact ? 400 : 440;
        const gap = 8;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        let left: number;
        let top: number;

        // Horizontal: prefer right of cell, flip left if not enough space
        if (rect.right + popupWidth + gap < viewportW) {
            left = rect.right + gap;
        } else if (rect.left - popupWidth - gap > 0) {
            left = rect.left - popupWidth - gap;
        } else {
            left = Math.max(12, (viewportW - popupWidth) / 2);
        }

        // Vertical: center on cell, but clamp to viewport
        top = rect.top + rect.height / 2 - popupMaxHeight / 2;
        top = Math.max(12, Math.min(top, viewportH - popupMaxHeight - 12));

        setPosition({ top, left });
    }, [anchorEl, compact]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        calculatePosition();
        window.addEventListener('resize', calculatePosition);
        return () => window.removeEventListener('resize', calculatePosition);
    }, [calculatePosition]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    if (!mounted || !anchorEl || !position) return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[70]" onClick={onClose}>
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
                />

                {/* Popup Card */}
                <motion.div
                    ref={popupRef}
                    initial={{ opacity: 0, scale: 0.95, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 6 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    onClick={e => e.stopPropagation()}
                    className={`absolute flex flex-col card-premium-v2 rounded-[2rem] shadow-2xl shadow-primary/20 border border-white/20 dark:border-white/10 overflow-hidden ambient-glow
                        ${compact ? 'w-[355px] max-h-[400px]' : 'w-[380px] max-h-[440px]'}`}
                    style={{ top: position.top, left: position.left }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white">{formattedDate}</h3>
                            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                                {recurringItems.length > 0 && ` · ${recurringItems.length} recurring`}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg text-gray-500">close</span>
                        </button>
                    </div>

                    {/* Income / Expense Summary */}
                    {(totalIncome > 0 || totalExpense > 0) && (
                        <div className="mx-5 mb-3 gap-2 grid grid-cols-2">
                            <div className="rounded-xl bg-emerald-500/10 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Income</p>
                                <p className="mt-0.5 text-base font-black text-emerald-600">{fmt(totalIncome)}</p>
                            </div>
                            <div className="rounded-xl bg-rose-500/10 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Expenses</p>
                                <p className="mt-0.5 text-base font-black text-rose-600">{fmt(totalExpense)}</p>
                            </div>
                        </div>
                    )}

                    {/* Transaction List */}
                    <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2 scrollbar-thin">
                        {transactions.map(tx => (
                            <button
                                key={tx.id}
                                onClick={() => onTransactionClick(tx)}
                                className="w-full rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.03] p-3 text-left transition-all hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:border-gray-200 dark:hover:border-white/15 group"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <span
                                            className="h-3 w-3 shrink-0 rounded-full"
                                            style={{ backgroundColor: getCategoryHex(tx.category, customCategories) }}
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                                                {tx.description || tx.category}
                                            </p>
                                            <p className="text-[11px] text-gray-400 dark:text-gray-500">{tx.category}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-sm font-black ${tx.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                            {tx.type === 'expense' ? '-' : '+'}{fmt(tx.amount)}
                                        </span>
                                        <span className="material-symbols-outlined text-[16px] text-gray-300 dark:text-gray-600 group-hover:text-primary transition-colors">
                                            chevron_right
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))}

                        {/* Recurring Items */}
                        {recurringItems.map(item => (
                            <div
                                key={`recurring-${item.id}`}
                                className="rounded-xl border border-primary/15 bg-primary/5 dark:bg-primary/10 p-3"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[14px] text-primary">repeat</span>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</p>
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                            {item.frequency} · {item.category}
                                        </p>
                                    </div>
                                    <span className={`text-sm font-black ${item.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {item.type === 'expense' ? '-' : '+'}{fmt(item.amount)}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Empty State */}
                        {transactions.length === 0 && recurringItems.length === 0 && (
                            <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 p-8 text-center mb-2">
                                <span className="material-symbols-outlined text-3xl text-gray-300 dark:text-gray-600 mb-2 block">event_busy</span>
                                <p className="text-sm text-gray-400 dark:text-gray-500">No activity on this day</p>
                            </div>
                        )}
                        
                        {/* Add Transaction Button */}
                        <div className="pt-2">
                            <button
                                onClick={() => { onClose(); onAddClick(date); }}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm bg-primary hover:bg-primary-hover text-white font-bold transition-all shadow-md hover:shadow-lg active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                Add Transaction
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
