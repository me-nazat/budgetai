'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getCategoryHex, CATEGORIES_EXPENSE, CATEGORIES_INCOME } from '@/lib/categoryUtils';
import { useCurrency } from '@/hooks/useCurrency';
import TransactionAttachmentsSection from './TransactionAttachmentsSection';
import { SplitCategoryBuilder } from './transactions/QuickAddTransactionModal';
import type { TransactionSplitItem } from '@/hooks/useApi';

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

interface Transaction {
    id: number;
    type: 'expense' | 'earning';
    amount: number;
    category: string;
    description: string;
    date: string;
    notes?: string;
    splits?: TransactionSplitItem[];
}

interface TransactionDetailModalProps {
    transaction: Transaction | null;
    customCategories?: { name: string; color: string }[];
    onClose: () => void;
    onEdit: (tx: Transaction) => void;
    onDuplicate: (tx: Transaction) => void;
    onDelete: (tx: Transaction) => void;
    onNotesChange: (id: number, newNotes: string) => void;
}

export default function TransactionDetailModal({
    transaction,
    customCategories,
    onClose,
    onEdit,
    onDuplicate,
    onDelete,
    onNotesChange
}: TransactionDetailModalProps) {
    const { fmt } = useCurrency();
    const [notes, setNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Split category state
    const [isEditingSplits, setIsEditingSplits] = useState(false);
    const [splits, setSplits] = useState<TransactionSplitItem[]>([]);
    const [isSavingSplits, setIsSavingSplits] = useState(false);
    const [ruleSaved, setRuleSaved] = useState(false);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (transaction) {
            setNotes(transaction.notes || '');
            if (transaction.splits && transaction.splits.length > 0) {
                setSplits(transaction.splits);
            } else {
                setSplits([]);
            }
            setIsEditingSplits(false);
        }
    }, [transaction]);

    const categoryOptions = useMemo(() => {
        const standard = transaction?.type === 'earning' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;
        return [
            ...standard.map((c) => c.label),
            ...(customCategories ? customCategories.map((c) => c.name) : []),
        ];
    }, [transaction?.type, customCategories]);

    const handleSaveNotes = async () => {
        if (!transaction) return;
        setIsSavingNotes(true);
        try {
            const res = await fetch('/api/transactions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...transaction, notes })
            });
            if (res.ok) {
                onNotesChange(transaction.id, notes);
            }
        } finally {
            setIsSavingNotes(false);
        }
    };

    const handleSaveSplits = async () => {
        if (!transaction) return;
        setIsSavingSplits(true);
        try {
            const res = await fetch('/api/transactions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: transaction.id,
                    splits,
                    category: splits.length > 0 ? 'Split Transaction' : transaction.category,
                })
            });
            if (res.ok) {
                transaction.splits = splits;
                transaction.category = splits.length > 0 ? 'Split Transaction' : transaction.category;
                setIsEditingSplits(false);
                onNotesChange(transaction.id, notes);
            }
        } finally {
            setIsSavingSplits(false);
        }
    };

    if (!mounted || !transaction) return null;

    const isExpense = transaction.type === 'expense';
    const amountColor = isExpense ? 'text-rose-600' : 'text-emerald-600';
    const amountBg = isExpense ? 'bg-rose-500/10' : 'bg-emerald-500/10';

    const splitsTotal = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const splitsRemaining = Math.round((transaction.amount - splitsTotal) * 100) / 100;
    const isSplitsBalanced = Math.abs(splitsRemaining) <= 0.01;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={spring}
                    className="relative w-full max-w-4xl bg-background/95 backdrop-blur-xl z-50 shadow-2xl rounded-[2rem] overflow-hidden flex flex-col md:flex-row border border-white/20 dark:border-white/10 max-h-[90vh] ring-1 ring-white/10"
                >
                    {/* Left Column: Details */}
                    <div className="flex-1 p-6 md:p-8 flex flex-col border-b md:border-b-0 md:border-r border-gray-100 dark:border-white/5 overflow-y-auto scrollbar-thin">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <span
                                    className="h-4 w-4 rounded-full shadow-sm"
                                    style={{ backgroundColor: getCategoryHex(transaction.category, customCategories) }}
                                />
                                <span className="text-sm font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase">
                                    {transaction.category}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isEditingSplits) {
                                            if (!splits || splits.length === 0) {
                                                const half = Math.round((transaction.amount / 2) * 100) / 100;
                                                const otherHalf = Math.round((transaction.amount - half) * 100) / 100;
                                                setSplits([
                                                    { id: `split_${Date.now()}_1`, category: transaction.category || 'Food', amount: half, note: '' },
                                                    { id: `split_${Date.now()}_2`, category: 'Shopping', amount: otherHalf, note: '' },
                                                ]);
                                            }
                                            setIsEditingSplits(true);
                                        } else {
                                            setIsEditingSplits(false);
                                        }
                                    }}
                                    className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                        isEditingSplits
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[14px]">call_split</span>
                                    <span>
                                        {isEditingSplits
                                            ? 'Cancel Split'
                                            : splits && splits.length > 0
                                            ? 'Edit Splits'
                                            : 'Split across categories'}
                                    </span>
                                </button>
                                <button onClick={onClose} className="p-2 -mr-2 -mt-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:hidden">
                                    <span className="material-symbols-outlined text-gray-500">close</span>
                                </button>
                            </div>
                        </div>

                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                            {transaction.description || transaction.category}
                        </h2>
                        
                        <div className="flex items-baseline gap-3 mb-6">
                            <div className={`px-4 py-2 rounded-xl inline-flex ${amountBg}`}>
                                <span className={`text-3xl font-black ${amountColor}`}>
                                    {isExpense ? '-' : '+'}{fmt(transaction.amount)}
                                </span>
                            </div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                {new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>

                        {/* 1-Click Inline Automation Rule Checkbox */}
                        {transaction.description && transaction.category && (
                            <label className="flex items-center gap-2 mb-6 p-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={ruleSaved}
                                    onChange={async (e) => {
                                        if (e.target.checked) {
                                            try {
                                                const res = await fetch('/api/automation-rules', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        name: `Auto: ${transaction.description.trim()}`,
                                                        triggerType: 'description_contains',
                                                        triggerValue: transaction.description.trim(),
                                                        actionType: 'set_category',
                                                        actionValue: transaction.category,
                                                    }),
                                                });
                                                if (res.ok) setRuleSaved(true);
                                            } catch {}
                                        }
                                    }}
                                    className="rounded border-gray-300 text-emerald-500 focus:ring-0"
                                />
                                <span>
                                    {ruleSaved ? '✓ Rule active: ' : 'Always categorize '}
                                    <strong className="text-gray-900 dark:text-white">"{transaction.description}"</strong> as{' '}
                                    <strong className="text-emerald-500">{transaction.category}</strong>
                                </span>
                            </label>
                        )}

                        {/* Interactive Split Builder Mode */}
                        {isEditingSplits && (
                            <div className="mb-6 space-y-3 p-3 rounded-2xl bg-gray-50 dark:bg-[#0A0E1A] border border-gray-200 dark:border-white/10 animate-fade-in">
                                <SplitCategoryBuilder
                                    splits={splits}
                                    onChange={setSplits}
                                    totalAmount={transaction.amount}
                                    sym={fmt(0).replace(/[0-9.,\s]/g, '') || '$'}
                                    categoryOptions={categoryOptions}
                                />
                                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingSplits(false)}
                                        className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={
                                            isSavingSplits ||
                                            !isSplitsBalanced ||
                                            splits.length === 0 ||
                                            !splits.every((s) => (Number(s.amount) || 0) > 0)
                                        }
                                        onClick={handleSaveSplits}
                                        className="px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover disabled:opacity-40 transition-all flex items-center gap-1.5"
                                    >
                                        {isSavingSplits && (
                                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        )}
                                        <span>Save Split Breakdown</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Read-Only Split Breakdown Card */}
                        {!isEditingSplits && splits && splits.length > 0 && (
                            <div className="mb-6 p-4 rounded-2xl bg-gray-50 dark:bg-[#0A0E1A] border border-gray-200/80 dark:border-white/10 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-primary">pie_chart</span>
                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            Split Breakdown ({splits.length} categories)
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingSplits(true)}
                                        className="text-xs font-bold text-primary hover:underline cursor-pointer"
                                    >
                                        Edit
                                    </button>
                                </div>
                                <div className="space-y-1.5 pt-1 divide-y divide-gray-100 dark:divide-white/5">
                                    {splits.map((s, idx) => {
                                        const pct = transaction.amount > 0 ? Math.round((s.amount / transaction.amount) * 100) : 0;
                                        return (
                                            <div key={s.id || idx} className="pt-1.5 flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2 truncate max-w-[200px]">
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: getCategoryHex(s.category, customCategories) }}
                                                    />
                                                    <span className="font-bold text-gray-800 dark:text-gray-200 truncate">
                                                        {s.category}
                                                    </span>
                                                    {s.note && (
                                                        <span className="text-[11px] text-gray-400 truncate">({s.note})</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 font-mono tabular-nums">
                                                    <span className="font-bold text-gray-900 dark:text-white">{fmt(s.amount)}</span>
                                                    <span className="text-[11px] text-gray-400">({pct}%)</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Notes Section */}
                        <div className="flex-1 flex flex-col min-h-[160px] mb-6">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                More Description (Notes)
                            </label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Add extra details, context, or receipt notes..."
                                className="w-full flex-1 min-h-[120px] p-4 rounded-2xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none resize-none transition-all text-[15px] leading-relaxed text-gray-800 dark:text-gray-200 placeholder-gray-400 whitespace-pre-wrap shadow-sm"
                            />
                            {notes !== (transaction.notes || '') && (
                                <button
                                    onClick={handleSaveNotes}
                                    disabled={isSavingNotes}
                                    className="mt-3 self-end px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-sm font-bold transition-colors flex items-center gap-2 active:scale-95"
                                >
                                    {isSavingNotes ? <span className="material-symbols-outlined animate-spin text-[16px]">sync</span> : null}
                                    Save Notes
                                </button>
                            )}
                        </div>

                        {/* Icons-only action bar */}
                        <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-white/5 mt-auto">
                            <button
                                onClick={() => { onClose(); onEdit(transaction); }}
                                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-[#0A0E1A] dark:hover:bg-[#21262d] text-gray-700 dark:text-gray-300 rounded-xl flex justify-center items-center transition-colors group"
                                title="Edit"
                            >
                                <span className="material-symbols-outlined group-hover:text-primary transition-colors text-[20px]">edit</span>
                            </button>
                            <button
                                onClick={() => { onClose(); onDuplicate(transaction); }}
                                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-[#0A0E1A] dark:hover:bg-[#21262d] text-gray-700 dark:text-gray-300 rounded-xl flex justify-center items-center transition-colors group"
                                title="Duplicate"
                            >
                                <span className="material-symbols-outlined group-hover:text-primary transition-colors text-[20px]">content_copy</span>
                            </button>
                            <button
                                onClick={() => { onClose(); onDelete(transaction); }}
                                className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 rounded-xl flex justify-center items-center transition-colors"
                                title="Delete"
                            >
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Attachments */}
                    <div className="flex-1 p-6 md:p-8 bg-black/5 dark:bg-black/40 relative overflow-y-auto scrollbar-thin border-l border-white/10 dark:border-white/5">
                        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors hidden md:block">
                            <span className="material-symbols-outlined text-gray-500 text-[20px]">close</span>
                        </button>
                        <div className="h-full md:mt-8">
                            <TransactionAttachmentsSection 
                                transactionId={transaction.id} 
                                transactionDescription={transaction.description || transaction.category} 
                            />
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
