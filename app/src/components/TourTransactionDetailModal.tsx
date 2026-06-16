'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getCategoryHex } from '@/lib/categoryUtils';
import { useCurrency } from '@/hooks/useCurrency';
import TransactionAttachmentsSection from './TransactionAttachmentsSection';

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

interface TourTransaction {
    id: number;
    amount: number;
    category: string;
    description: string;
    date: string;
    paidByParticipantId?: number;
    paidBy: number;
    splitType: string;
    paidByName?: string | null;
    createdByName?: string | null;
}

interface TourTransactionDetailModalProps {
    transaction: TourTransaction | null;
    customCategories?: { name: string; color: string }[];
    tourId: number;
    onClose: () => void;
    onEdit: (tx: TourTransaction) => void;
    onDelete: (tx: TourTransaction) => void;
}

export default function TourTransactionDetailModal({
    transaction,
    customCategories = [],
    tourId,
    onClose,
    onEdit,
    onDelete,
}: TourTransactionDetailModalProps) {
    const [mounted, setMounted] = useState(false);
    const { fmt } = useCurrency();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!transaction || !mounted) return null;

    const isExpense = true; // Tours are expenses currently
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
                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-lg z-40"
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

                        <div className="flex flex-col gap-4 mb-6 mt-auto">
                            <div className="bg-gray-50 dark:bg-white/[0.03] p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500 mb-1">Paid By</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                    {transaction.createdByName && transaction.createdByName !== transaction.paidByName ? (
                                        <>{transaction.paidByName || 'Unknown'} <span className="font-medium text-gray-500 dark:text-gray-400 text-xs ml-1">(Added by {transaction.createdByName})</span></>
                                    ) : (
                                        transaction.paidByName || 'Unknown'
                                    )}
                                </p>
                            </div>
                            <div className="bg-gray-50 dark:bg-white/[0.03] p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500 mb-1">Split Type</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">{transaction.splitType}</p>
                            </div>
                        </div>

                        {/* Icons-only action bar */}
                        <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-white/5 mt-auto">
                            <button
                                onClick={() => onEdit(transaction)}
                                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-[#0d1117] dark:hover:bg-[#21262d] text-gray-700 dark:text-gray-300 rounded-xl flex justify-center items-center transition-colors group"
                                title="Edit"
                            >
                                <span className="material-symbols-outlined group-hover:text-primary transition-colors text-[20px]">edit</span>
                            </button>
                            <button
                                onClick={() => onDelete(transaction)}
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
                                apiEndpoint={`/api/bill-splits/tours/${tourId}/spendings/${transaction.id}/attachments`}
                            />
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
