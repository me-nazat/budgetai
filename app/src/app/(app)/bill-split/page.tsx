'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useCurrency } from '@/hooks/useCurrency';

interface Participant {
    id: string;
    name: string;
    amount: number;
    paid: boolean;
}

interface BillSplit {
    id: number;
    description: string;
    totalAmount: number;
    date: string;
    splitMode: string;
    participants: Participant[];
}

export default function BillSplitPage() {
    const { data: splits, mutate } = useSWR<BillSplit[]>('/api/bill-splits');
    const { fmt } = useCurrency();
    const [isCreating, setIsCreating] = useState(false);
    const [description, setDescription] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([{ id: '1', name: 'You', amount: 0, paid: true }]);

    const settlementSuggestions = useMemo(() => {
        if (!splits) return [];
        
        const owesMe = new Map<string, number>();
        
        for (const split of splits) {
            for (const p of split.participants) {
                if (p.name.toLowerCase() !== 'you' && !p.paid) {
                    // Standardize names (e.g. "alice" -> "Alice")
                    const formattedName = p.name.trim().charAt(0).toUpperCase() + p.name.trim().slice(1).toLowerCase();
                    owesMe.set(formattedName, (owesMe.get(formattedName) || 0) + p.amount);
                }
            }
        }
        
        return Array.from(owesMe.entries()).filter(([_, amt]) => amt > 0);
    }, [splits]);

    const handleAddParticipant = () => {
        setParticipants([...participants, { id: Math.random().toString(), name: '', amount: 0, paid: false }]);
    };

    const handleParticipantChange = (id: string, field: keyof Participant, value: any) => {
        setParticipants(participants.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleRemoveParticipant = (id: string) => {
        setParticipants(participants.filter(p => p.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const total = parseFloat(totalAmount);
        if (isNaN(total) || total <= 0) return alert('Invalid total amount');
        
        const splitAmount = total / participants.length;
        const updatedParticipants = participants.map(p => ({ ...p, amount: splitAmount }));

        try {
            await fetch('/api/bill-splits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description,
                    totalAmount: total,
                    splitMode: 'Equal',
                    participants: updatedParticipants
                })
            });
            mutate();
            setIsCreating(false);
            setDescription('');
            setTotalAmount('');
            setParticipants([{ id: '1', name: 'You', amount: 0, paid: true }]);
        } catch (error) {
            console.error(error);
        }
    };

    const handleTogglePaid = async (splitId: number, participantId: string, paidStatus: boolean) => {
        try {
            await fetch(`/api/bill-splits/${splitId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participantId,
                    paid: paidStatus
                })
            });
            mutate();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter pb-24">
            <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                        <span className="material-symbols-outlined text-blue-500 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                        Bill Splitter
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-text-muted mt-1">Easily split bills with friends and track who paid what</p>
                </div>
                <button 
                    onClick={() => setIsCreating(!isCreating)}
                    className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-primary/25"
                >
                    <span className="material-symbols-outlined text-sm">{isCreating ? 'close' : 'add'}</span>
                    {isCreating ? 'Cancel' : 'New Split'}
                </button>
            </div>

            {isCreating && (
                <div className="glass-panel rounded-3xl p-6 mb-8 animate-fade-in-up border border-gray-200 dark:border-white/10">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Create New Split</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Description</label>
                                <input 
                                    type="text" 
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="e.g. Dinner at Mario's"
                                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-bg-dark px-4 py-3 text-sm font-medium outline-none focus:border-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Total Amount</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={totalAmount}
                                    onChange={e => setTotalAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-bg-dark px-4 py-3 text-sm font-medium outline-none focus:border-primary"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Participants</label>
                                <button type="button" onClick={handleAddParticipant} className="text-sm font-bold text-primary flex items-center gap-1 hover:text-blue-600">
                                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                                    Add Person
                                </button>
                            </div>
                            
                            <div className="space-y-3">
                                {participants.map((p, i) => (
                                    <div key={p.id} className="flex items-center gap-3 animate-fade-in">
                                        <div className="flex-1">
                                            <input 
                                                type="text" 
                                                value={p.name}
                                                onChange={e => handleParticipantChange(p.id, 'name', e.target.value)}
                                                placeholder={i === 0 ? "You" : "Friend's name"}
                                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-bg-dark px-4 py-2 text-sm outline-none focus:border-primary"
                                                required
                                            />
                                        </div>
                                        {i !== 0 && (
                                            <button type="button" onClick={() => handleRemoveParticipant(p.id)} className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors">
                                                <span className="material-symbols-outlined text-[20px]">close</span>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button type="submit" className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:shadow-cyan-500/25 transition-all">
                                Create Split
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {settlementSuggestions.length > 0 && !isCreating && (
                <div className="glass-panel rounded-3xl p-6 mb-8 animate-fade-in-up border border-gray-200 dark:border-white/10">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-green-500">account_balance_wallet</span>
                        Settlement Suggestions
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {settlementSuggestions.map(([name, amount]) => (
                            <div key={name} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-bg-dark border border-gray-100 dark:border-white/5 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                                        {name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-white">{name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500 mb-0.5">Owes you</div>
                                    <div className="font-black text-green-500">{fmt(amount)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {!splits && !isCreating ? (
                    [0, 1, 2].map(i => <div key={i} className="h-64 rounded-3xl shimmer-skeleton" />)
                ) : splits?.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-gray-500">
                        <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">receipt_long</span>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No splits yet</h3>
                        <p>Create a split to start tracking shared expenses</p>
                    </div>
                ) : (
                    splits?.map(split => (
                        <div key={split.id} className="glass-panel rounded-3xl p-6 border border-gray-200 dark:border-white/10 relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{split.description}</h3>
                                    <p className="text-xs text-gray-500 mt-1">{new Date(split.date).toLocaleDateString()}</p>
                                </div>
                                <span className="font-black text-primary text-xl">{fmt(split.totalAmount)}</span>
                            </div>

                            <div className="space-y-3 mt-6">
                                {split.participants.map(p => (
                                    <div key={p.id} className="flex justify-between items-center bg-gray-50 dark:bg-bg-dark rounded-xl p-3">
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => handleTogglePaid(split.id, p.id, !p.paid)}
                                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${p.paid ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-transparent'}`}
                                            >
                                                <span className="material-symbols-outlined text-[14px]">check</span>
                                            </button>
                                            <span className={`text-sm font-medium ${p.paid ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{p.name}</span>
                                        </div>
                                        <span className={`text-sm font-bold ${p.paid ? 'text-gray-400' : 'text-rose-500'}`}>{fmt(p.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
