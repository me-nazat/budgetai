'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Participant {
    name: string;
    amount: number;
    percentage: number;
}

export default function BillSplitterModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { currency, fmt } = useCurrency();
    const [description, setDescription] = useState('');
    const [totalAmount, setTotalAmount] = useState<number | ''>('');
    const [splitMode, setSplitMode] = useState<'Equal' | 'Percentage' | 'Custom'>('Equal');
    const [participants, setParticipants] = useState<Participant[]>([
        { name: 'Me', amount: 0, percentage: 0 },
        { name: 'Friend 1', amount: 0, percentage: 0 }
    ]);

    const handleAmountChange = (val: string) => {
        setTotalAmount(val === '' ? '' : Number(val));
        recalculateSplits(val === '' ? 0 : Number(val), splitMode, participants);
    };

    const handleModeChange = (mode: 'Equal' | 'Percentage' | 'Custom') => {
        setSplitMode(mode);
        recalculateSplits(Number(totalAmount) || 0, mode, participants);
    };

    const addParticipant = () => {
        const newParticipants = [...participants, { name: `Friend ${participants.length}`, amount: 0, percentage: 0 }];
        setParticipants(newParticipants);
        recalculateSplits(Number(totalAmount) || 0, splitMode, newParticipants);
    };

    const removeParticipant = (index: number) => {
        const newParticipants = participants.filter((_, i) => i !== index);
        setParticipants(newParticipants);
        recalculateSplits(Number(totalAmount) || 0, splitMode, newParticipants);
    };

    const updateParticipant = (index: number, field: keyof Participant, value: string | number) => {
        const newP = [...participants];
        newP[index] = { ...newP[index], [field]: value };

        if (splitMode === 'Percentage' && field === 'percentage') {
            newP[index].amount = ((Number(totalAmount) || 0) * Number(value)) / 100;
        } else if (splitMode === 'Custom' && field === 'amount') {
            const total = Number(totalAmount) || 0;
            newP[index].percentage = total > 0 ? (Number(value) / total) * 100 : 0;
        }

        setParticipants(newP);
    };

    const recalculateSplits = (total: number, mode: 'Equal' | 'Percentage' | 'Custom', currentParticipants: Participant[]) => {
        if (mode === 'Equal') {
            const split = total / currentParticipants.length;
            const pct = 100 / currentParticipants.length;
            setParticipants(currentParticipants.map(p => ({ ...p, amount: split, percentage: pct })));
        }
    };

    const generateWhatsAppText = () => {
        const lines = [
            `*Bill Split: ${description || 'Dinner/Event'}*`,
            `Total: ${fmt(Number(totalAmount) || 0)}`,
            `-------------------`
        ];
        participants.forEach(p => {
            lines.push(`${p.name}: ${fmt(p.amount)}`);
        });
        lines.push(`-------------------`);
        lines.push(`Please send your share! 💸`);
        return encodeURIComponent(lines.join('\n'));
    };

    const shareWhatsApp = () => {
        window.open(`https://wa.me/?text=${generateWhatsAppText()}`, '_blank');
    };

    const handleSave = async () => {
        if (!description || !totalAmount) return;
        
        await fetch('/api/bill-splits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description,
                total_amount: Number(totalAmount),
                date: new Date().toISOString(),
                split_mode: splitMode,
                participants_json: JSON.stringify(participants)
            })
        });

        onClose();
        setDescription('');
        setTotalAmount('');
        setSplitMode('Equal');
        setParticipants([{ name: 'Me', amount: 0, percentage: 0 }, { name: 'Friend 1', amount: 0, percentage: 0 }]);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-[#1a1f2e] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gradient-to-r from-teal-500/10 to-blue-500/10">
                        <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
                            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                            <h2 className="text-lg font-bold">Split a Bill</h2>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                                <input type="text" placeholder="e.g. Pizza Night" value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-teal-500 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currency === 'BDT' ? '৳' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '৳'}</span>
                                    <input type="number" min="0" step="0.01" placeholder="0.00" value={totalAmount} onChange={e => handleAmountChange(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 pl-8 pr-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-teal-500 dark:text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Split Mode */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Split Mode</label>
                            <div className="flex bg-gray-100 dark:bg-white/5 rounded-xl p-1">
                                {['Equal', 'Percentage', 'Custom'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => handleModeChange(mode as any)}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${splitMode === mode ? 'bg-white dark:bg-[#2d3343] text-teal-600 dark:text-teal-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Participants */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Participants</label>
                                <button onClick={addParticipant} className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline">
                                    + Add Person
                                </button>
                            </div>
                            <div className="space-y-3">
                                {participants.map((p, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <input type="text" value={p.name} onChange={e => updateParticipant(i, 'name', e.target.value)} className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:text-white" />
                                        
                                        {splitMode === 'Equal' && (
                                            <div className="w-24 text-right px-3 py-2 text-sm font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                                                {fmt(p.amount)}
                                            </div>
                                        )}
                                        {splitMode === 'Percentage' && (
                                            <div className="relative w-24">
                                                <input type="number" min="0" max="100" value={p.percentage || ''} onChange={e => updateParticipant(i, 'percentage', e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:text-white" />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                                            </div>
                                        )}
                                        {splitMode === 'Custom' && (
                                            <input type="number" min="0" value={p.amount || ''} onChange={e => updateParticipant(i, 'amount', e.target.value)} className="w-24 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:text-white" />
                                        )}
                                        
                                        {participants.length > 2 && (
                                            <button onClick={() => removeParticipant(i)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg">
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex gap-3">
                        <button onClick={shareWhatsApp} disabled={!description || !totalAmount} className="flex-1 py-3 px-4 rounded-xl font-bold bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            <span className="material-symbols-outlined">chat</span> Share on WA
                        </button>
                        <button onClick={handleSave} disabled={!description || !totalAmount} className="flex-1 py-3 px-4 rounded-xl font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                            Save Split
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
