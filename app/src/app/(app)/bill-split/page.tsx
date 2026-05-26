'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';

interface Participant {
    name: string;
    share: number;
    amount: number;
}

interface BillSplit {
    id: number;
    description: string;
    totalAmount: number;
    date: string;
    splitMode: 'Equal' | 'Percentage' | 'Custom';
    participants: Participant[];
    created_at: string;
}

function BillSplitSkeleton() {
    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
            <div className="h-7 w-64 rounded-lg shimmer-skeleton mb-2" />
            <div className="h-4 w-96 rounded-lg shimmer-skeleton mb-8" />
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 skeleton-panel h-[500px] rounded-2xl" />
                <div className="lg:col-span-2 space-y-4">
                    {[0, 1, 2].map(i => <div key={i} className="skeleton-panel h-32 rounded-2xl" />)}
                </div>
            </div>
        </div>
    );
}

export default function BillSplitPage() {
    const { data: splits, isLoading } = useSWR<BillSplit[]>('/api/bill-splits');
    const { fmt } = useCurrency();
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [description, setDescription] = useState('');
    const [totalAmount, setTotalAmount] = useState<string>('');
    const [splitMode, setSplitMode] = useState<'Equal' | 'Percentage' | 'Custom'>('Equal');
    const [participants, setParticipants] = useState<Participant[]>([
        { name: 'You', share: 1, amount: 0 },
        { name: '', share: 1, amount: 0 }
    ]);

    // Recalculate amounts whenever mode, totalAmount, or participants change
    useEffect(() => {
        const total = parseFloat(totalAmount) || 0;
        
        if (splitMode === 'Equal') {
            const validCount = participants.filter(p => p.name.trim() || p.name === 'You').length;
            if (validCount === 0) return;
            const amountPerPerson = total / validCount;
            setParticipants(prev => prev.map(p => ({
                ...p,
                amount: p.name.trim() || p.name === 'You' ? Number(amountPerPerson.toFixed(2)) : 0
            })));
        } else if (splitMode === 'Percentage') {
            const totalPercent = participants.reduce((sum, p) => sum + (Number(p.share) || 0), 0);
            if (totalPercent === 0) return;
            setParticipants(prev => prev.map(p => ({
                ...p,
                amount: Number(((total * (Number(p.share) || 0)) / 100).toFixed(2))
            })));
        }
    }, [totalAmount, splitMode, participants.map(p => p.share).join(','), participants.map(p => p.name).join(',')]); // Only depend on specific nested fields to avoid infinite loops

    const handleAddParticipant = () => {
        setParticipants([...participants, { name: '', share: splitMode === 'Percentage' ? 0 : 1, amount: 0 }]);
    };

    const handleRemoveParticipant = (index: number) => {
        if (participants.length <= 2) {
            toast.error('You need at least 2 participants');
            return;
        }
        const newP = [...participants];
        newP.splice(index, 1);
        setParticipants(newP);
    };

    const handleParticipantChange = (index: number, field: keyof Participant, value: string | number) => {
        const newP = [...participants];
        newP[index] = { ...newP[index], [field]: value };
        setParticipants(newP);
    };

    const handleCreateSplit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const total = parseFloat(totalAmount);
        if (isNaN(total) || total <= 0) {
            toast.error('Please enter a valid total amount');
            return;
        }

        const validParticipants = participants.filter(p => p.name.trim() !== '');
        if (validParticipants.length < 2) {
            toast.error('Please enter at least 2 valid participant names');
            return;
        }

        // Validate totals
        const sumAmounts = validParticipants.reduce((sum, p) => sum + Number(p.amount), 0);
        if (Math.abs(sumAmounts - total) > 0.1) {
            toast.error(`Amounts don't match total! Sum: ${fmt(sumAmounts)}, Total: ${fmt(total)}`);
            return;
        }

        if (splitMode === 'Percentage') {
            const sumPercent = validParticipants.reduce((sum, p) => sum + Number(p.share), 0);
            if (Math.abs(sumPercent - 100) > 0.1) {
                toast.error(`Percentages must add up to 100! Currently: ${sumPercent}%`);
                return;
            }
        }

        try {
            setIsSubmitting(true);
            const res = await fetch('/api/bill-splits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description,
                    totalAmount: total,
                    date: new Date().toISOString().split('T')[0],
                    splitMode,
                    participants: validParticipants
                })
            });

            if (!res.ok) throw new Error(await res.text());
            
            toast.success('Bill split created!');
            mutate('/api/bill-splits');
            
            // Reset form
            setDescription('');
            setTotalAmount('');
            setParticipants([
                { name: 'You', share: splitMode === 'Percentage' ? 50 : 1, amount: 0 },
                { name: '', share: splitMode === 'Percentage' ? 50 : 1, amount: 0 }
            ]);
        } catch (error) {
            console.error('Failed to create split:', error);
            toast.error('Failed to create bill split');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this bill split?')) return;
        
        try {
            const res = await fetch(`/api/bill-splits/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            toast.success('Deleted successfully');
            mutate('/api/bill-splits');
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    if (isLoading) return <BillSplitSkeleton />;

    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                    <span className="material-symbols-outlined text-purple-500 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>call_split</span>
                    Bill Splitter
                </h1>
                <p className="text-sm text-gray-500 dark:text-text-muted mt-1">Easily split dining, travel, or household bills with friends.</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Create Form */}
                <div className="lg:col-span-1">
                    <div className="card-premium rounded-2xl p-6 sticky top-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">add_circle</span>
                            New Split
                        </h2>
                        
                        <form onSubmit={handleCreateSplit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 dark:text-text-muted uppercase mb-1.5">Description</label>
                                <input
                                    type="text"
                                    required
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g. Dinner at Mario's"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-text-muted uppercase mb-1.5">Total Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                                        <input
                                            type="number"
                                            required
                                            min="0.01"
                                            step="0.01"
                                            value={totalAmount}
                                            onChange={(e) => setTotalAmount(e.target.value)}
                                            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-text-muted uppercase mb-1.5">Split Mode</label>
                                    <select
                                        value={splitMode}
                                        onChange={(e) => {
                                            const val = e.target.value as any;
                                            setSplitMode(val);
                                            if (val === 'Percentage') {
                                                const even = 100 / participants.length;
                                                setParticipants(p => p.map(x => ({ ...x, share: even })));
                                            } else {
                                                setParticipants(p => p.map(x => ({ ...x, share: 1 })));
                                            }
                                        }}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none"
                                    >
                                        <option value="Equal">Equally</option>
                                        <option value="Percentage">By Percentage</option>
                                        <option value="Custom">Custom Amount</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-gray-100 dark:border-[#30363d]">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-text-muted uppercase">Participants</label>
                                    <button
                                        type="button"
                                        onClick={handleAddParticipant}
                                        className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">add</span> Add Person
                                    </button>
                                </div>

                                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    {participants.map((p, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                placeholder={`Person ${i + 1}`}
                                                value={p.name}
                                                onChange={(e) => handleParticipantChange(i, 'name', e.target.value)}
                                                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#21262d] text-gray-900 dark:text-white"
                                            />
                                            
                                            {splitMode === 'Percentage' && (
                                                <div className="relative w-20">
                                                    <input
                                                        type="number"
                                                        value={p.share}
                                                        onChange={(e) => handleParticipantChange(i, 'share', Number(e.target.value))}
                                                        className="w-full px-3 py-2 pr-6 text-sm text-right rounded-lg border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#21262d] text-gray-900 dark:text-white"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                                                </div>
                                            )}

                                            {(splitMode === 'Custom' || splitMode === 'Equal' || splitMode === 'Percentage') && (
                                                <div className="relative w-24">
                                                    <input
                                                        type="number"
                                                        disabled={splitMode !== 'Custom'}
                                                        value={p.amount}
                                                        onChange={(e) => handleParticipantChange(i, 'amount', Number(e.target.value))}
                                                        className="w-full px-3 py-2 text-sm text-right rounded-lg border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#21262d] text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveParticipant(i)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-lg">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-3 mt-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">receipt_long</span>
                                        Save Split
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* History */}
                <div className="lg:col-span-2">
                    {splits?.length === 0 ? (
                        <div className="card-premium rounded-2xl p-12 text-center flex flex-col items-center justify-center border-dashed border-2">
                            <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center mb-4 text-purple-500">
                                <span className="material-symbols-outlined text-3xl">groups</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No splits yet</h3>
                            <p className="text-sm text-gray-500 dark:text-text-muted max-w-sm">Create your first bill split to keep track of shared expenses with friends or family.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {splits?.map((split) => (
                                <div key={split.id} className="card-premium rounded-2xl p-5 hover:border-primary/30 transition-colors group">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                                                <span className="material-symbols-outlined text-xl">receipt_long</span>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{split.description}</h3>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-text-muted">
                                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">calendar_today</span> {new Date(split.date).toLocaleDateString()}</span>
                                                    <span>•</span>
                                                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#30363d] font-medium">{split.splitMode}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1">
                                            <span className="text-xl font-bold text-gray-900 dark:text-white">{fmt(split.totalAmount)}</span>
                                            <button
                                                onClick={() => handleDelete(split.id)}
                                                className="text-gray-400 hover:text-red-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-[#161b22] rounded-xl p-3">
                                        <div className="flex flex-wrap gap-2">
                                            {split.participants.map((p, i) => (
                                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#21262d] border border-gray-100 dark:border-[#30363d] text-sm shadow-sm">
                                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                                        {p.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-gray-700 dark:text-gray-300">{p.name}</span>
                                                    <span className="text-gray-400 dark:text-gray-500 mx-1">—</span>
                                                    <span className="font-bold text-gray-900 dark:text-white">{fmt(p.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
