'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Participant {
    id: number;
    name: string;
}

interface TourAddCostModalProps {
    isOpen: boolean;
    onClose: () => void;
    participants: Participant[];
    tourId: number;
    onSaveSuccess: () => void;
}

export default function TourAddCostModal({ isOpen, onClose, participants, tourId, onSaveSuccess }: TourAddCostModalProps) {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('Travel');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [paidBy, setPaidBy] = useState<number>(participants[0]?.id || 0);
    const [splitType, setSplitType] = useState<'equal' | 'percentage' | 'exact'>('equal');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Receipt dropzone state
    const [receipt, setReceipt] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !description || !paidBy) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/bill-splits/tours/${tourId}/spendings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    description,
                    category,
                    date,
                    paidBy,
                    splitType
                })
            });

            if (res.ok) {
                onSaveSuccess();
                onClose();
            } else {
                alert('Failed to save transaction.');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setReceipt(e.dataTransfer.files[0]);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-4 sm:p-0">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
                />
                
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-lg overflow-hidden rounded-t-[2rem] sm:rounded-3xl bg-white/90 dark:bg-[#0d1117]/90 shadow-2xl backdrop-blur-2xl border border-white/50 dark:border-white/10 z-10"
                >
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Tour Cost</h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Amount</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full mt-1 bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                                    <input 
                                        type="date" 
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full mt-1 bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                                <input 
                                    type="text" 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full mt-1 bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Dinner at restaurant..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Paid By</label>
                                    <select 
                                        value={paidBy}
                                        onChange={(e) => setPaidBy(parseInt(e.target.value))}
                                        className="w-full mt-1 bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        {participants.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Split Type</label>
                                    <select 
                                        value={splitType}
                                        onChange={(e) => setSplitType(e.target.value as any)}
                                        className="w-full mt-1 bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="equal">Equally</option>
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="exact">Exact Amounts</option>
                                    </select>
                                </div>
                            </div>

                            {/* Receipt Dropzone */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Receipt</label>
                                <div 
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                >
                                    {receipt ? (
                                        <div className="flex items-center justify-between bg-white dark:bg-black/20 p-3 rounded-xl shadow-sm">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">{receipt.name}</span>
                                            </div>
                                            <button type="button" onClick={() => setReceipt(null)} className="text-gray-400 hover:text-rose-500 transition-colors">
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2">cloud_upload</span>
                                            <p className="text-sm font-bold text-gray-500">Drag & drop receipt here</p>
                                            <p className="text-xs text-gray-400 mt-1">or click to browse files</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full rounded-2xl bg-primary px-6 py-4 font-bold text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
                            >
                                {isSubmitting ? 'Saving...' : 'Add Cost'}
                            </button>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
