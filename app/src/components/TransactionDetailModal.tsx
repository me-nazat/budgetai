'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getCategoryHex } from '@/lib/categoryUtils';
import { useCurrency } from '@/hooks/useCurrency';
import TransactionAttachmentsSection from './TransactionAttachmentsSection';

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

interface Transaction {
    id: number;
    type: 'expense' | 'earning';
    amount: number;
    category: string;
    description: string;
    date: string;
    notes?: string;
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

    useEffect(() => {
        const frame = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (transaction) {
            setNotes(transaction.notes || '');
        }
    }, [transaction]);

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

    if (!mounted || !transaction) return null;

    const isExpense = transaction.type === 'expense';
    const amountColor = isExpense ? 'text-rose-600' : 'text-emerald-600';
    const amountBg = isExpense ? 'bg-rose-500/10' : 'bg-emerald-500/10';

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
                            <button onClick={onClose} className="p-2 -mr-2 -mt-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:hidden">
                                <span className="material-symbols-outlined text-gray-500">close</span>
                            </button>
                        </div>

                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                            {transaction.description || transaction.category}
                        </h2>
                        
                        <div className="flex items-baseline gap-3 mb-8">
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
