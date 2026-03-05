'use client';

import { useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import { invalidateFinancialData } from '@/hooks/useApi';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { queueTransaction } from '@/lib/offlineDb';

const CATEGORIES_EXPENSE = [
    { label: 'Food', icon: 'restaurant' },
    { label: 'Transport', icon: 'directions_car' },
    { label: 'Entertainment', icon: 'theater_comedy' },
    { label: 'Shopping', icon: 'checkroom' },
    { label: 'Bills', icon: 'receipt' },
    { label: 'Health', icon: 'health_and_safety' },
    { label: 'Education', icon: 'school' },
    { label: 'Housing', icon: 'home' },
    { label: 'Other', icon: 'category' },
];

const CATEGORIES_INCOME = [
    { label: 'Salary', icon: 'payments' },
    { label: 'Freelance', icon: 'work' },
    { label: 'Investment', icon: 'trending_up' },
    { label: 'Business', icon: 'business_center' },
    { label: 'Savings', icon: 'savings' },
    { label: 'Other', icon: 'category' },
];

interface QuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function QuickAddModal({ isOpen, onClose }: QuickAddModalProps) {
    const [type, setType] = useState<'expense' | 'earning'>('expense');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [submitting, setSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const { currency } = useCurrency();
    const sym = CURRENCIES[currency].symbol;
    const { isOnline } = useNetworkStatus();

    const categories = type === 'expense' ? CATEGORIES_EXPENSE : CATEGORIES_INCOME;

    const resetForm = () => {
        setAmount('');
        setCategory('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setType('expense');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSave = async () => {
        const parsed = parseFloat(amount);
        if (!amount || isNaN(parsed) || parsed <= 0 || !category) return;
        setSubmitting(true);

        const payload = {
            actionType: 'add' as const,
            type,
            amount: parsed,
            category,
            description: description || category,
            date,
        };

        try {
            if (isOnline) {
                await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                invalidateFinancialData();
            } else {
                await queueTransaction(payload);
            }

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                handleClose();
            }, 1200);
        } catch {
            alert('Failed to save. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="lg:hidden fixed inset-0 z-[60] flex items-end justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={handleClose}
            />

            {/* Modal Sheet */}
            <div
                className="relative w-full max-h-[90dvh] bg-white dark:bg-[#161b22] rounded-t-3xl overflow-y-auto"
                style={{ animation: 'sheetSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                <div className="px-6 pb-8 pt-2">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Transaction</h2>
                        <button
                            onClick={handleClose}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-lg text-gray-500 dark:text-gray-400">close</span>
                        </button>
                    </div>

                    {/* Type Toggle */}
                    <div className="flex bg-gray-100 dark:bg-[#0d1117] rounded-xl p-1 mb-6">
                        <button
                            onClick={() => { setType('expense'); setCategory(''); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${type === 'expense'
                                ? 'bg-rose-500 text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400'
                                }`}
                        >
                            Expense
                        </button>
                        <button
                            onClick={() => { setType('earning'); setCategory(''); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${type === 'earning'
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400'
                                }`}
                        >
                            Income
                        </button>
                    </div>

                    {/* Amount Input */}
                    <div className="mb-6">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400 dark:text-gray-500">{sym}</span>
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-12 pr-4 py-4 text-3xl font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] rounded-2xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-center"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Category Pills */}
                    <div className="mb-6">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Category</label>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <button
                                    key={cat.label}
                                    onClick={() => setCategory(cat.label)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${category === cat.label
                                        ? type === 'expense'
                                            ? 'bg-rose-500 text-white shadow-sm'
                                            : 'bg-emerald-500 text-white shadow-sm'
                                        : 'bg-gray-100 dark:bg-[#0d1117] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#30363d]'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date Picker */}
                    <div className="mb-4">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                        />
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">What was this for?</label>
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="e.g. Lunch with friends"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                        />
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={submitting || !amount || !category || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
                        className={`w-full py-4 rounded-2xl text-white font-bold text-base transition-all disabled:opacity-40 active:scale-[0.98] ${type === 'expense'
                            ? 'bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/25'
                            : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25'
                            }`}
                    >
                        {showSuccess ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">check_circle</span>
                                Saved!
                            </span>
                        ) : submitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                        ) : (
                            `Save ${type === 'expense' ? 'Expense' : 'Income'}`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
