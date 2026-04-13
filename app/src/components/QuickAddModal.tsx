'use client';

import { useState, useEffect } from 'react';
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

const CUSTOM_ICONS = ['emoji_objects', 'flight_takeoff', 'pets', 'fitness_center', 'sports_esports', 'palette', 'camera_alt', 'auto_stories', 'rocket_launch', 'local_cafe', 'celebration', 'diamond'];
const CUSTOM_COLORS = ['rose', 'orange', 'amber', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'fuchsia', 'pink'];

interface CustomCategory {
    id: number;
    name: string;
    type: string;
    icon: string;
    color: string;
}

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
    
    // Custom Categories State
    const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
    const [isCreatingCustom, setIsCreatingCustom] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customIcon, setCustomIcon] = useState(CUSTOM_ICONS[0]);
    const [customColor, setCustomColor] = useState(CUSTOM_COLORS[0]);

    const { currency } = useCurrency();
    const sym = CURRENCIES[currency].symbol;
    const { isOnline } = useNetworkStatus();

    const fetchCustomCategories = async () => {
        try {
            const res = await fetch(`/api/categories?type=${type}`);
            const data = await res.json();
            if (data.categories) setCustomCategories(data.categories);
        } catch (e) {
            console.error('Failed to fetch custom categories', e);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchCustomCategories();
        }
    }, [isOpen, type]);

    const standardCategories = type === 'expense' ? CATEGORIES_EXPENSE : CATEGORIES_INCOME;
    const allCategories = [
        ...standardCategories,
        ...customCategories.map(c => ({
            label: c.name,
            icon: c.icon,
            color: c.color,
            isCustom: true,
            id: c.id
        }))
    ];

    const resetForm = () => {
        setAmount('');
        setCategory('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setType('expense');
        setIsCreatingCustom(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSaveCustomCategory = async () => {
        if (!customName) return;
        setSubmitting(true);
        try {
            await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: customName,
                    type,
                    icon: customIcon,
                    color: customColor
                })
            });
            await fetchCustomCategories();
            setCategory(customName);
            setIsCreatingCustom(false);
            setCustomName('');
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
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

    const deleteCustomCategory = async (id: number, catName: string) => {
        if (!confirm('Delete this custom category? (Existing transactions will keep the text)')) return;
        try {
            await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
            if (category === catName) setCategory('');
            fetchCustomCategories();
        } catch (e) {
            console.error(e);
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
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {isCreatingCustom ? 'New Custom Category' : 'Add Transaction'}
                        </h2>
                        <button
                            onClick={() => isCreatingCustom ? setIsCreatingCustom(false) : handleClose()}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-lg text-gray-500 dark:text-gray-400">
                                {isCreatingCustom ? 'arrow_back' : 'close'}
                            </span>
                        </button>
                    </div>

                    {!isCreatingCustom ? (
                        <>
                            {/* Type Toggle */}
                            <div className="flex bg-gray-100 dark:bg-[#0d1117] rounded-xl p-1 mb-6">
                                <button
                                    onClick={() => { setType('expense'); setCategory(''); setIsCreatingCustom(false); }}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${type === 'expense'
                                        ? 'bg-rose-500 text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                >
                                    Expense
                                </button>
                                <button
                                    onClick={() => { setType('earning'); setCategory(''); setIsCreatingCustom(false); }}
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
                                    {allCategories.map(cat => {
                                        const isSelected = category === cat.label;
                                        // Dynamic color styling for custom categories ONLY when selected
                                        let selectedBg = type === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'bg-emerald-500 text-white shadow-sm';
                                        if (isSelected && cat.color) {
                                            selectedBg = `bg-${cat.color}-500 text-white shadow-sm`;
                                        }

                                        return (
                                            <div key={cat.label} className="relative group/cat">
                                                <button
                                                    onClick={() => setCategory(cat.label)}
                                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${isSelected
                                                        ? selectedBg
                                                        : 'bg-gray-100 dark:bg-[#0d1117] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#30363d]'
                                                        }`}
                                                >
                                                    <span className={`material-symbols-outlined text-[16px] ${!isSelected && cat.color ? `text-${cat.color}-500` : ''}`}>
                                                        {cat.icon}
                                                    </span>
                                                    {cat.label}
                                                </button>
                                                {cat.isCustom && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); deleteCustomCategory(cat.id!, cat.label); }}
                                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full hidden group-hover/cat:flex items-center justify-center text-[10px] shadow"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">close</span>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    
                                    <button
                                        onClick={() => setIsCreatingCustom(true)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add</span>
                                        Custom
                                    </button>
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
                        </>
                    ) : (
                        <div className="animate-fade-in">
                            {/* Create Custom Category Form */}
                            <div className="mb-6">
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Category Name</label>
                                <input
                                    type="text"
                                    value={customName}
                                    onChange={e => setCustomName(e.target.value)}
                                    placeholder="e.g. Crypto, Pets, Coffee"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                                    autoFocus
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Color</label>
                                <div className="flex flex-wrap gap-3">
                                    {CUSTOM_COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setCustomColor(color)}
                                            className={`w-8 h-8 rounded-full bg-${color}-500 flex items-center justify-center transition-all ${
                                                customColor === color ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#161b22] ring-gray-900 dark:ring-white scale-110' : 'hover:scale-110'
                                            }`}
                                        >
                                            {customColor === color && <span className="material-symbols-outlined text-white text-[16px]">check</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Icon</label>
                                <div className="grid grid-cols-6 gap-3">
                                    {CUSTOM_ICONS.map(icon => (
                                        <button
                                            key={icon}
                                            onClick={() => setCustomIcon(icon)}
                                            className={`aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                                                customIcon === icon 
                                                ? `bg-${customColor}-500 text-white shadow-md scale-110` 
                                                : 'bg-gray-100 dark:bg-[#0d1117] text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined">{icon}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleSaveCustomCategory}
                                disabled={submitting || !customName.trim()}
                                className="w-full py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-base transition-all disabled:opacity-40 active:scale-[0.98]"
                            >
                                {submitting ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" /> : 'Create Category'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
