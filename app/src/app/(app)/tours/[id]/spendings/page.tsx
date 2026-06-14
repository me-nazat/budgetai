'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import ReceiptDropZone from '@/components/ReceiptDropZone';

interface Participant {
    id: number;
    name: string;
}

interface TourTransaction {
    id: number;
    amount: number;
    category: string;
    description: string;
    date: string;
    paid_by_name: string;
    split_type: string;
}

export default function TourSpendingsPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [transactions, setTransactions] = useState<TourTransaction[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form state
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('Travel');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [paidBy, setPaidBy] = useState('');
    const [splitType, setSplitType] = useState('equal');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [tourRes, txRes] = await Promise.all([
                    fetch(`/api/bill-splits/tours/${params.id}`),
                    fetch(`/api/bill-splits/tours/${params.id}/transactions`)
                ]);

                if (tourRes.ok && txRes.ok) {
                    const tourData = await tourRes.json();
                    const txData = await txRes.json();
                    
                    setParticipants(tourData.participants || []);
                    if (tourData.participants?.length > 0) {
                        setPaidBy(tourData.participants[0].id.toString());
                    }
                    setTransactions(txData.transactions || []);
                } else {
                    router.push('/tours');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [params.id, router]);

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast.error("Enter a valid amount");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                amount: Number(amount),
                description: description || 'Shared Expense',
                category,
                date,
                paidBy: Number(paidBy),
                splitType
            };

            const res = await fetch(`/api/bill-splits/tours/${params.id}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success('Expense added successfully');
                setIsModalOpen(false);
                setAmount('');
                setDescription('');
                
                // Refresh transactions list
                const txRes = await fetch(`/api/bill-splits/tours/${params.id}/transactions`);
                const txData = await txRes.json();
                setTransactions(txData.transactions || []);
            } else {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to add expense');
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const springTransition = { type: "spring" as const, stiffness: 400, damping: 30 };

    return (
        <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
            <motion.div layoutId={`tour-spendings-${params.id}`}>
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => router.push(`/tours/${params.id}`)}
                            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-heading tracking-tight">Trip Expenses</h1>
                            <p className="text-sm text-gray-500 mt-1">Shared spending feed</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary text-white px-5 py-2.5 rounded-2xl font-semibold shadow-lg shadow-primary/25 hover:bg-blue-600 transition-colors flex items-center gap-2 active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Add Cost
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        {[1, 2, 3].map(i => <div key={i} className="h-20 glass-panel" />)}
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center glass-panel">
                        <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-4">receipt_long</span>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No expenses yet</h3>
                        <p className="text-gray-500">Tap Add Cost to log your first shared expense.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {transactions.map((tx, i) => (
                            <motion.div 
                                key={tx.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="glass-panel p-5 flex items-center justify-between hover:border-primary/30 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined">{tx.category === 'Food' ? 'restaurant' : 'receipt'}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white text-[15px]">{tx.description}</h4>
                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                                            <span className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300 font-medium">
                                                Paid by {tx.paid_by_name}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10">
                                                Split {tx.split_type}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">
                                        ${tx.amount.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">{tx.date}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Add Cost Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={springTransition as any}
                            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#0A0A0A] border-t border-gray-200 dark:border-white/10 rounded-t-3xl p-6 md:p-8 max-w-2xl mx-auto max-h-[90vh] overflow-y-auto shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Shared Cost</h2>
                                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white">
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>

                            <form onSubmit={handleAddExpense} className="space-y-6">
                                {/* Amount & Title */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 ml-1 uppercase">Amount</label>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full text-2xl font-bold font-mono rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 outline-none focus:border-primary transition-all text-gray-900 dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 ml-1 uppercase">What for?</label>
                                        <input
                                            type="text"
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="e.g. Dinner at Luigi's"
                                            className="w-full text-base font-medium rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-4 outline-none focus:border-primary transition-all text-gray-900 dark:text-white mt-1"
                                        />
                                    </div>
                                </div>

                                {/* Paid By & Split Logic */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 ml-1 uppercase">Paid By</label>
                                        <select
                                            value={paidBy}
                                            onChange={e => setPaidBy(e.target.value)}
                                            className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] px-4 py-3 text-sm font-medium outline-none focus:border-primary transition-all text-gray-900 dark:text-white appearance-none"
                                        >
                                            {participants.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 ml-1 uppercase">Split Logic</label>
                                        <select
                                            value={splitType}
                                            onChange={e => setSplitType(e.target.value)}
                                            className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] px-4 py-3 text-sm font-medium outline-none focus:border-primary transition-all text-gray-900 dark:text-white appearance-none"
                                        >
                                            <option value="equal">Split Equally</option>
                                            <option value="exact">Exact Amounts</option>
                                            <option value="percentage">Percentage</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 ml-1 uppercase">Receipt (Optional)</label>
                                    <ReceiptDropZone />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-xl shadow-primary/20 hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : 'Save Shared Cost'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
