'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Subscription {
    id: number;
    name: string;
    amount: number;
    currency: string;
    billing_cycle: 'weekly' | 'monthly' | 'yearly';
    next_renewal_date: string;
    category: string;
    is_active: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function SubscriptionsContent() {
    const { currency, fmtRaw, convert, fmt } = useCurrency();
    const { data, mutate, isLoading } = useSWR<{ subscriptions: Subscription[] }>('/api/subscriptions', fetcher);
    
    const [showAddModal, setShowAddModal] = useState(false);
    const [editMode, setEditMode] = useState<Subscription | null>(null);
    
    // Form state
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [subCurrency, setSubCurrency] = useState(currency);
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [nextRenewal, setNextRenewal] = useState('');
    const [category, setCategory] = useState('Entertainment');
    
    const subs = data?.subscriptions || [];
    
    const totalMonthlyCost = subs.filter(s => s.is_active).reduce((sum, s) => {
        let amt = convert(s.amount, s.currency as any, currency as any);
        if (s.billing_cycle === 'yearly') amt = amt / 12;
        if (s.billing_cycle === 'weekly') amt = amt * 4.33;
        return sum + amt;
    }, 0);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const payload = {
            name,
            amount: parseFloat(amount),
            currency: subCurrency,
            billing_cycle: billingCycle,
            next_renewal_date: nextRenewal,
            category,
            is_active: 1
        };

        if (editMode) {
            await fetch(`/api/subscriptions/${editMode.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            await fetch('/api/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        
        closeModal();
        mutate();
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this subscription?')) return;
        await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
        mutate();
    };

    const toggleActive = async (sub: Subscription) => {
        await fetch(`/api/subscriptions/${sub.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: sub.is_active ? 0 : 1 })
        });
        mutate();
    };

    const openEdit = (sub: Subscription) => {
        setEditMode(sub);
        setName(sub.name);
        setAmount(sub.amount.toString());
        setSubCurrency(sub.currency as any);
        setBillingCycle(sub.billing_cycle);
        setNextRenewal(sub.next_renewal_date);
        setCategory(sub.category);
        setShowAddModal(true);
    };

    const closeModal = () => {
        setShowAddModal(false);
        setEditMode(null);
        setName('');
        setAmount('');
        setBillingCycle('monthly');
        setNextRenewal('');
    };

    return (
        <div className="w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Active Subscriptions</h2>
                    <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Manage your subscriptions and memberships</p>
                </div>
                
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined">add</span>
                    Add Subscription
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="card-premium p-6 rounded-3xl border-2 border-primary/20 bg-primary/5">
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">Total Monthly Cost</p>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white">{fmtRaw(totalMonthlyCost)}</h3>
                </div>
                <div className="card-premium p-6 rounded-3xl border border-gray-100 dark:border-white/5">
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">Active Subs</p>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white">{subs.filter(s => s.is_active).length}</h3>
                </div>
                <div className="card-premium p-6 rounded-3xl border border-gray-100 dark:border-white/5">
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">Yearly Projection</p>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white">{fmtRaw(totalMonthlyCost * 12)}</h3>
                </div>
            </div>

            {/* Subscriptions List */}
            {isLoading ? (
                <div className="flex justify-center p-12">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : subs.length === 0 ? (
                <div className="text-center py-16 card-premium rounded-3xl border border-gray-100 dark:border-white/5">
                    <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">video_library</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Subscriptions Yet</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">Track your Netflix, Spotify, or gym memberships to see how much they cost you over time.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subs.map(sub => (
                        <div key={sub.id} className={`card-premium p-5 rounded-3xl border transition-all ${sub.is_active ? 'border-gray-200 dark:border-white/10 hover:border-primary/50' : 'border-gray-100 dark:border-white/5 opacity-60'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                                        <span className="text-xl">{sub.name.charAt(0)}</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{sub.name}</h3>
                                        <p className="text-xs text-gray-500 capitalize">{sub.category} • {sub.billing_cycle}</p>
                                    </div>
                                </div>
                                <button onClick={() => toggleActive(sub)} className={`w-10 h-5 rounded-full relative transition-colors ${sub.is_active ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${sub.is_active ? 'translate-x-5' : 'translate-x-0'}`}></span>
                                </button>
                            </div>
                            
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Next Payment: {new Date(sub.next_renewal_date).toLocaleDateString()}</p>
                                    <h4 className="text-xl font-black text-gray-900 dark:text-white">
                                        {formatAmountStatic(sub.amount, sub.currency)} <span className="text-sm font-medium text-gray-400">/{sub.billing_cycle === 'monthly' ? 'mo' : sub.billing_cycle === 'yearly' ? 'yr' : 'wk'}</span>
                                    </h4>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => openEdit(sub)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button onClick={() => handleDelete(sub.id)} className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-bg-dark border border-gray-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {editMode ? 'Edit Subscription' : 'Add Subscription'}
                                </h2>
                                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Service Name</label>
                                    <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Netflix, Spotify" className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary dark:text-white" />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Amount</label>
                                        <input required type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Currency</label>
                                        <select value={subCurrency} onChange={e => setSubCurrency(e.target.value as any)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary dark:text-white">
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="GBP">GBP</option>
                                            <option value="INR">INR</option>
                                            <option value="BDT">BDT</option>
                                            <option value="CAD">CAD</option>
                                            <option value="AUD">AUD</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Billing Cycle</label>
                                        <select value={billingCycle} onChange={e => setBillingCycle(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary dark:text-white">
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                            <option value="yearly">Yearly</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Next Payment</label>
                                        <input required type="date" value={nextRenewal} onChange={e => setNextRenewal(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary dark:text-white" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary dark:text-white">
                                        <option value="Entertainment">Entertainment</option>
                                        <option value="Software">Software</option>
                                        <option value="Utilities">Utilities</option>
                                        <option value="Gym">Gym/Fitness</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={closeModal} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Cancel</button>
                                    <button type="submit" className="flex-1 py-3 px-4 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">Save</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Simple formatter for the cards that don't need context
function formatAmountStatic(amount: number, currencyCode: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount);
}
