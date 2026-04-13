'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { mutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import { useTransactions, invalidateFinancialData } from '@/hooks/useApi';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { queueTransaction, deleteSyncedTransaction } from '@/lib/offlineDb';
import { useRouter } from 'next/navigation';
import { useCustomCategories } from '@/hooks/useCustomCategories';

const categoryIcons: Record<string, string> = {
    Food: 'restaurant', Transport: 'directions_car', Housing: 'home', Utilities: 'bolt',
    Entertainment: 'theater_comedy', Shopping: 'checkroom', Health: 'health_and_safety',
    Education: 'school', Business: 'business_center', Savings: 'savings', Salary: 'payments',
    Freelance: 'work', Investment: 'trending_up', Other: 'category',
};
const QUICK_CATEGORIES = ['Food', 'Transport', 'Housing', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Education', 'Business', 'Savings', 'Salary', 'Freelance', 'Investment', 'Other'];

export default function TransactionsPage() {
    const [selectedMonth, setSelectedMonth] = useState<string>(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    );
    const router = useRouter();
    const [selectedWeek, setSelectedWeek] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortField, setSortField] = useState('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastSubmitOffline, setLastSubmitOffline] = useState(false);
    const { fmt } = useCurrency();
    const { isOnline } = useNetworkStatus();

    // Quick Add state
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [qaType, setQaType] = useState<'expense' | 'earning'>('expense');
    const [qaAmount, setQaAmount] = useState('');
    const [qaCategory, setQaCategory] = useState('');
    const [qaDesc, setQaDesc] = useState('');
    const [qaDate, setQaDate] = useState(new Date().toISOString().split('T')[0]);
    const [qaSubmitting, setQaSubmitting] = useState(false);

    // Custom Category Add State (Desktop Inline)
    const [qaAddingCustomCategory, setQaAddingCustomCategory] = useState(false);
    const [qaCustomCategoryName, setQaCustomCategoryName] = useState('');
    const { categories: customCategories, mutate: mutateCategories } = useCustomCategories('all');

    // Edit/Action state
    const [actionMenuOpenId, setActionMenuOpenId] = useState<number | string | null>(null);
    const [editingTx, setEditingTx] = useState<any>(null);
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [deletingTxId, setDeletingTxId] = useState<number | string | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Global click-outside handler for the dropdown
    useEffect(() => {
        if (actionMenuOpenId === null) return;
        
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            // Close if we clicked outside the menu container
            if (!target.closest('.action-menu-container')) {
                setActionMenuOpenId(null);
            }
        };

        // Use mousedown to act before click events can fire inappropriately
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [actionMenuOpenId]);

    // Compute date ranges from month/week selection
    const dateRange = useMemo(() => {
        let currentYear: number, currentMonth: number;
        if (selectedMonth && selectedMonth.match(/^\d{4}-\d{2}$/)) {
            [currentYear, currentMonth] = selectedMonth.split('-').map(Number);
        } else {
            const now = new Date();
            currentYear = now.getFullYear();
            currentMonth = now.getMonth() + 1;
        }

        let startDay = 1;
        let endDay = new Date(currentYear, currentMonth, 0).getDate();

        if (selectedWeek && selectedWeek !== 'all') {
            const weekNum = parseInt(selectedWeek);
            if (weekNum === 1) { startDay = 1; endDay = 7; }
            else if (weekNum === 2) { startDay = 8; endDay = 14; }
            else if (weekNum === 3) { startDay = 15; endDay = 21; }
            else if (weekNum === 4) { startDay = 22; /* endDay is already last day of month */ }
        }

        const start = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
        const end = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
        return { start, end };
    }, [selectedMonth, selectedWeek]);

    // SWR hook — cached, stale-while-revalidate
    const { transactions, isLoading, isValidating } = useTransactions(
        dateRange.start, dateRange.end, typeFilter
    );

    // Build the SWR key to match what useTransactions generates
    const swrKey = useMemo(() => {
        const params = new URLSearchParams();
        if (dateRange.start) params.set('start', dateRange.start);
        if (dateRange.end) params.set('end', dateRange.end);
        if (typeFilter !== 'all') params.set('type', typeFilter);
        params.set('limit', '200');
        return `/api/transactions?${params.toString()}`;
    }, [dateRange.start, dateRange.end, typeFilter]);

    const submitQuickAdd = async () => {
        const parsed = parseFloat(qaAmount);
        if (!qaAmount || isNaN(parsed) || parsed <= 0 || !qaCategory) return;
        setQaSubmitting(true);

        const payload = {
            actionType: 'add' as const,
            type: qaType,
            amount: parsed,
            category: qaCategory,
            description: qaDesc || qaCategory,
            date: qaDate,
        };

        try {
            if (qaAddingCustomCategory && qaCustomCategoryName) {
                try {
                    await fetch('/api/categories', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: qaCustomCategoryName, type: qaType, icon: 'category', color: 'gray' })
                    });
                    mutateCategories(); // Refresh the list
                } catch (e) {}
            }

            if (isOnline) {
                // Online: POST directly to API
                const res = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('API add failed');
                
                invalidateFinancialData();
                mutate(swrKey);
                router.refresh();
                setLastSubmitOffline(false);
            } else {
                // Offline: queue to IndexedDB + optimistic SWR update
                await queueTransaction(payload);
                mutate(
                    swrKey,
                    (current: { transactions: any[]; total: number } | undefined) => {
                        const optimistic = {
                            id: Date.now(),
                            ...payload,
                            created_at: new Date().toISOString(),
                            pending: true,
                        };
                        return {
                            transactions: [optimistic, ...(current?.transactions || [])],
                            total: (current?.total || 0) + 1,
                        };
                    },
                    { revalidate: false }
                );
                setLastSubmitOffline(true);
            }

            setQaAmount(''); setQaDesc(''); setQaCategory(''); setShowQuickAdd(false); setQaSubmitting(false);
            setQaAddingCustomCategory(false); setQaCustomCategoryName('');
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error('Quick Add error:', error);
            setQaSubmitting(false);
        }
    };

    const handleCustomCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === 'ADD_CUSTOM') {
            setQaAddingCustomCategory(true);
            setQaCategory('');
        } else {
            setQaCategory(e.target.value);
            setQaAddingCustomCategory(false);
        }
    };

    const submitEdit = async () => {
        const parsed = parseFloat(editingTx.amount);
        if (!editingTx.amount || isNaN(parsed) || parsed <= 0 || !editingTx.category) return;
        setEditSubmitting(true);

        const payload = {
            actionType: 'edit' as const,
            id: editingTx.id,
            type: editingTx.type,
            amount: parsed,
            category: editingTx.category,
            description: editingTx.description || editingTx.category,
            date: editingTx.date,
        };

        try {
            if (isOnline) {
                // Online: PUT directly to API
                const res = await fetch('/api/transactions', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingTx.id,
                        type: editingTx.type,
                        amount: parsed,
                        category: editingTx.category,
                        description: editingTx.description || editingTx.category,
                        date: editingTx.date,
                    }),
                });
                if (!res.ok) throw new Error('API update failed');
                
                invalidateFinancialData();
                mutate(swrKey);
                router.refresh();
                setLastSubmitOffline(false);
            } else {
                // Offline: queue to IndexedDB + optimistic update
                await queueTransaction(payload);
                mutate(
                    swrKey,
                    (current: { transactions: any[]; total: number } | undefined) => {
                        const updated = (current?.transactions || []).map(t =>
                            t.id === editingTx.id ? { ...t, ...payload, pending: true } : t
                        );
                        return { transactions: updated, total: current?.total || 0 };
                    },
                    { revalidate: false }
                );
                setLastSubmitOffline(true);
            }

            setEditingTx(null); setEditSubmitting(false); setActionMenuOpenId(null);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error('Edit error:', error);
            setEditSubmitting(false);
        }
    };

    const submitDelete = async () => {
        if (!deletingTxId) return;
        setDeleteSubmitting(true);

        const payload = { actionType: 'delete' as const, id: Number(deletingTxId) };

        try {
            if (isOnline) {
                const res = await fetch(`/api/transactions?id=${deletingTxId}`, {
                    method: 'DELETE',
                });
                if (!res.ok) throw new Error('API delete failed');

                invalidateFinancialData();
                mutate(swrKey);
                router.refresh();
                setLastSubmitOffline(false);
            } else {
                await queueTransaction(payload);
                mutate(
                    swrKey,
                    (current: { transactions: any[]; total: number } | undefined) => {
                        const filtered = (current?.transactions || []).filter(t => t.id !== deletingTxId);
                        return { transactions: filtered, total: Math.max(0, (current?.total || 1) - 1) };
                    },
                    { revalidate: false }
                );
                setLastSubmitOffline(true);
            }
            setActionMenuOpenId(null);
            setDeletingTxId(null);
            setDeleteSubmitting(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error('Delete error:', error);
            setDeleteSubmitting(false);
        }
    };

    const submitDuplicate = async (tx: any) => {
        const payload = {
            actionType: 'add' as const,
            type: tx.type,
            amount: tx.amount,
            category: tx.category,
            description: tx.description,
            date: new Date().toISOString().split('T')[0], // Use today for duplication
        };

        try {
            if (isOnline) {
                const res = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('API duplicate failed');
                
                invalidateFinancialData();
                mutate(swrKey);
                router.refresh();
                setLastSubmitOffline(false);
            } else {
                await queueTransaction(payload);
                mutate(
                    swrKey,
                    (current: { transactions: any[]; total: number } | undefined) => {
                        const optimistic = {
                            id: Date.now(),
                            ...payload,
                            created_at: new Date().toISOString(),
                            pending: true,
                        };
                        return {
                            transactions: [optimistic, ...(current?.transactions || [])],
                            total: (current?.total || 0) + 1,
                        };
                    },
                    { revalidate: false }
                );
                setLastSubmitOffline(true);
            }
            setActionMenuOpenId(null);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error('Duplicate error:', error);
        }
    };

    // Generate last 12 months for the dropdown
    const monthOptions = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return {
            value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        };
    });

    const weekOptions = [
        { value: 'all', label: 'Full Month' },
        { value: '1', label: 'Week 1 (1st-7th)' },
        { value: '2', label: 'Week 2 (8th-14th)' },
        { value: '3', label: 'Week 3 (15th-21st)' },
        { value: '4', label: 'Week 4 (22nd-End)' },
    ];

    const sorted = [...transactions].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortField === 'date') return (a.date > b.date ? 1 : -1) * dir;
        if (sortField === 'amount') return (a.amount - b.amount) * dir;
        if (sortField === 'category') return a.category.localeCompare(b.category) * dir;
        return 0;
    });

    const toggleSort = (field: string) => {
        if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    const exportExcel = async () => {
        const ExcelJS = await import('exceljs');
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Transactions');
        ws.columns = [
            { header: 'Date', key: 'date', width: 15 }, { header: 'Type', key: 'type', width: 10 },
            { header: 'Category', key: 'category', width: 15 }, { header: 'Description', key: 'description', width: 30 },
            { header: 'Amount', key: 'amount', width: 12 },
        ];
        ws.getRow(1).font = { bold: true };
        sorted.forEach(t => ws.addRow(t));
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Transactions_${new Date().toISOString().split('T')[0]}.xlsx`; a.click();
        URL.revokeObjectURL(url);
    };

    const totalExpenses = sorted.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalEarnings = sorted.filter(t => t.type === 'earning').reduce((s, t) => s + t.amount, 0);

    // Wealth Insights logic based purely on currently loaded/filtered table data
    const expensesOnly = sorted.filter(t => t.type === 'expense');

    // 1. Biggest Single Expense
    let biggestExpense = null;
    if (expensesOnly.length > 0) {
        biggestExpense = expensesOnly.reduce((max, t) => t.amount > max.amount ? t : max, expensesOnly[0]);
    }

    // 2. Most Frequent Category
    const categoryCounts: Record<string, number> = {};
    expensesOnly.forEach(t => { categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1; });

    let topCategory = null;
    let topCategoryCount = 0;
    Object.entries(categoryCounts).forEach(([cat, count]) => {
        if (count > topCategoryCount) {
            topCategoryCount = count;
            topCategory = cat;
        }
    });

    // Show loading only on first ever load (no cached data)
    const showFullLoading = !transactions.length && isLoading;

    return (
        <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
            {/* Subtle revalidation indicator */}
            {isValidating && (
                <div className="fixed top-0 left-0 lg:left-64 right-0 z-50 h-0.5">
                    <div className="h-full bg-primary/60 animate-pulse rounded-full" />
                </div>
            )}

            {/* Success Toast */}
            {showSuccess && (
                <div className="fixed top-6 right-6 z-50 toast-enter">
                    <div className={`flex items-center gap-2 px-4 py-3 text-white rounded-xl shadow-lg ${lastSubmitOffline ? 'bg-amber-500 shadow-amber-500/20' : 'bg-emerald-500 shadow-emerald-500/20'}`}>
                        <span className="material-symbols-outlined text-lg">{lastSubmitOffline ? 'schedule' : 'check_circle'}</span>
                        <span className="text-sm font-semibold">{lastSubmitOffline ? 'Queued — will sync when online' : 'Transaction saved!'}</span>
                    </div>
                </div>
            )}

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Transactions</h2>
                    <p className="text-gray-500 dark:text-text-muted text-sm mt-1">View and manage your expenses and earnings</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowQuickAdd(!showQuickAdd)} className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5 btn-primary-glow active:scale-95">
                        <span className="material-symbols-outlined text-[18px]">{showQuickAdd ? 'close' : 'add'}</span> {showQuickAdd ? 'Cancel' : 'Quick Add'}
                    </button>
                    <button onClick={exportExcel} className="px-4 py-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl text-sm font-semibold transition-all border border-emerald-200 dark:border-emerald-500/20 hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-1.5 active:scale-95">
                        <span className="material-symbols-outlined text-[18px]">download</span> Export
                    </button>
                </div>
            </header>

            {/* Summary Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                <div className="card-premium p-4 rounded-xl stat-gradient-emerald lg:col-span-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider">Earnings</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{fmt(totalEarnings)}</p>
                </div>
                <div className="card-premium p-4 rounded-xl stat-gradient-orange lg:col-span-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider">Expenses</p>
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">{fmt(totalExpenses)}</p>
                </div>
                <div className="card-premium p-4 rounded-xl stat-gradient-blue col-span-2 lg:col-span-1 border-r border-transparent lg:border-gray-200 lg:dark:border-[#30363d]">
                    <p className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider">Net</p>
                    <p className={`text-lg font-bold mt-1 ${totalEarnings - totalExpenses >= 0 ? 'text-primary' : 'text-rose-500'}`}>
                        {totalEarnings - totalExpenses >= 0 ? '+' : ''}{fmt(totalEarnings - totalExpenses)}
                    </p>
                </div>

                {/* Wealth Insights Widget */}
                <div className="card-premium p-4 rounded-xl col-span-2 lg:col-span-2 flex gap-4 bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 items-center justify-around border-violet-100 dark:border-violet-500/10 border">
                    <div className="flex flex-col items-center justify-center text-center w-1/2">
                        <span className="material-symbols-outlined text-violet-500 text-sm mb-0.5">warning</span>
                        <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Largest Expense</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white mt-1 truncate w-full px-2" title={biggestExpense?.description || biggestExpense?.category || 'None'}>
                            {biggestExpense ? `${fmt(biggestExpense.amount)} (${biggestExpense.description || biggestExpense.category})` : 'N/A'}
                        </p>
                    </div>
                    <div className="w-px h-10 bg-gray-200 dark:bg-[#30363d]"></div>
                    <div className="flex flex-col items-center justify-center text-center w-1/2">
                        <span className="material-symbols-outlined text-fuchsia-500 text-sm mb-0.5">repeat</span>
                        <p className="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 uppercase tracking-wider">Frequent Category</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white mt-1 truncate w-full px-2">
                            {topCategory ? `${topCategory} (${topCategoryCount}x)` : 'N/A'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Add Form */}
            {showQuickAdd && (
                <form onSubmit={e => { e.preventDefault(); submitQuickAdd(); }} className="card-premium p-5 rounded-2xl mb-5 animate-slide-up">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">add_circle</span>Quick Add Transaction
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                        <select value={qaType} onChange={e => setQaType(e.target.value as 'expense' | 'earning')}
                            className="p-2.5 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm">
                            <option value="expense">Expense</option>
                            <option value="earning">Earning</option>
                        </select>
                        <input type="number" step="0.01" placeholder="Amount" value={qaAmount} onChange={e => setQaAmount(e.target.value)}
                            className="p-2.5 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm" />
                        
                        {qaAddingCustomCategory ? (
                            <div className="flex items-center gap-2 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 p-1">
                                <input
                                    type="text"
                                    placeholder="New Category"
                                    value={qaCustomCategoryName}
                                    onChange={e => {
                                        setQaCustomCategoryName(e.target.value);
                                        setQaCategory(e.target.value);
                                    }}
                                    className="p-1.5 w-full bg-transparent text-gray-900 dark:text-white outline-none text-sm"
                                    autoFocus
                                />
                                <button type="button" onClick={() => { setQaAddingCustomCategory(false); setQaCustomCategoryName(''); setQaCategory(''); }} className="p-1 text-gray-400 hover:text-rose-500 transition-colors">
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            </div>
                        ) : (
                            <select value={qaCategory} onChange={handleCustomCategoryChange}
                                className="p-2.5 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm">
                                <option value="">Category</option>
                                {QUICK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                <optgroup label="Custom Categories">
                                    {customCategories.filter(c => c.type === qaType).map(c => (
                                        <option key={`cc-${c.id}`} value={c.name}>{c.name}</option>
                                    ))}
                                </optgroup>
                                <option value="ADD_CUSTOM" className="text-primary font-bold">+ Add Custom Category</option>
                            </select>
                        )}

                        <input type="date" value={qaDate} onChange={e => setQaDate(e.target.value)}
                            className="p-2.5 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm" />
                        <input type="text" placeholder="Description" value={qaDesc} onChange={e => setQaDesc(e.target.value)}
                            className="p-2.5 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm" />
                        <button type="submit" disabled={qaSubmitting || !qaAmount || !qaCategory || isNaN(parseFloat(qaAmount)) || parseFloat(qaAmount) <= 0}
                            className="bg-primary text-white rounded-xl p-2.5 font-bold hover:bg-primary-hover transition-all btn-primary-glow flex justify-center items-center min-h-[42px] disabled:opacity-40 active:scale-95">
                            {qaSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : 'Save'}
                        </button>
                    </div>
                </form>
            )}

            {/* Filters */}
            <div className="card-premium flex flex-wrap gap-3 mb-5 p-3 rounded-xl">
                <div className="bg-gray-100 dark:bg-surface-dark p-0.5 rounded-xl flex text-xs border border-gray-200 dark:border-[#30363d]">
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                        <span className="material-symbols-outlined text-[16px] text-gray-500">calendar_month</span>
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 font-semibold cursor-pointer"
                        >
                            {monthOptions.map(m => (
                                <option key={m.value} value={m.value} className="bg-white dark:bg-surface-dark">{m.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-gray-100 dark:bg-surface-dark p-0.5 rounded-xl flex text-xs border border-gray-200 dark:border-[#30363d]">
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                        <span className="material-symbols-outlined text-[16px] text-gray-500">view_week</span>
                        <select
                            value={selectedWeek}
                            onChange={e => setSelectedWeek(e.target.value)}
                            className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 font-semibold cursor-pointer"
                        >
                            {weekOptions.map(w => (
                                <option key={w.value} value={w.value} className="bg-white dark:bg-surface-dark">{w.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-gray-100 dark:bg-surface-dark p-0.5 rounded-xl flex text-xs border border-gray-200 dark:border-[#30363d]">
                    {['all', 'expense', 'earning'].map(t => (
                        <button key={t} onClick={() => setTypeFilter(t)}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition-all capitalize ${typeFilter === t ? 'bg-primary text-white shadow-sm' : 'text-gray-500 dark:text-text-muted hover:text-gray-900 dark:hover:text-white'}`}>
                            {t === 'all' ? 'All' : t + 's'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="card-premium rounded-2xl" style={{ animation: 'slideUp 0.5s ease-out 0.1s both' }}>
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-surface-dark/50 text-xs text-gray-500 dark:text-text-muted uppercase tracking-wider border-b border-gray-200 dark:border-[#30363d]">
                                {[['Transaction', ''], ['Category', 'category'], ['Date', 'date'], ['Amount', 'amount']].map(([label, field]) => (
                                    <th key={label} className={`px-6 py-3.5 font-semibold ${field ? 'cursor-pointer group hover:text-primary transition-colors' : ''} ${label === 'Amount' ? 'text-right' : ''}`}
                                        onClick={() => field && toggleSort(field)}>
                                        <span className={`flex items-center gap-1 ${label === 'Amount' ? 'justify-end' : 'justify-start'}`}>
                                            {label}{field && sortField === field && <span className="material-symbols-outlined text-xs text-primary">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#21262d] text-sm">
                            {showFullLoading ? (
                                <tr><td colSpan={4} className="px-6 py-12 text-center">
                                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                    <p className="text-gray-400 dark:text-text-muted text-sm">Loading transactions...</p>
                                </td></tr>
                            ) : sorted.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center">
                                    <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 block mb-2">search_off</span>
                                    <p className="text-gray-400 dark:text-text-muted">No transactions found for this period.</p>
                                </td></tr>
                            ) : sorted.map((t, i) => (
                                <tr key={t.id} className={`group hover:bg-gray-50/50 dark:hover:bg-surface-hover/30 transition-colors duration-200 ${actionMenuOpenId === t.id ? 'relative z-50' : 'relative z-0'}`}
                                    style={{ animation: `slideUp 0.3s ease-out ${Math.min(i * 0.03, 0.3)}s both` }}>
                                    <td className="px-6 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'expense' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'}`}>
                                                <span className="material-symbols-outlined text-lg">
                                                    {categoryIcons[t.category] || customCategories.find(c => c.name === t.category)?.icon || 'category'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900 dark:text-white">{t.description || t.category}</span>
                                                {(t as any).pending && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                        Pending sync
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3.5">
                                        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-gray-100 dark:bg-surface-hover text-gray-600 dark:text-text-muted">
                                            {t.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3.5 text-gray-500 dark:text-text-muted">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                    <td className={`px-6 py-3.5 text-right font-semibold ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        {t.type === 'expense' ? '−' : '+'}{fmt(t.amount)}
                                    </td>
                                    <td className="px-6 py-3.5 text-right w-12">
                                        <div className="relative inline-block text-left action-menu-container">
                                            <button
                                                onClick={() => setActionMenuOpenId(actionMenuOpenId === t.id ? null : t.id)}
                                                className={`p-1.5 rounded-full transition-colors ${actionMenuOpenId === t.id ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'hover:bg-gray-100 dark:hover:bg-surface-dark text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                            </button>

                                            <AnimatePresence>
                                                {actionMenuOpenId === t.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden"
                                                    >
                                                        <div className="flex flex-col py-1">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingTx({ ...t });
                                                                    setActionMenuOpenId(null);
                                                                }}
                                                                className="px-4 py-3 text-sm text-left hover:bg-gray-50 dark:hover:bg-white/10 flex items-center gap-3 text-gray-700 dark:text-gray-200 transition-colors w-full cursor-pointer"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => submitDuplicate(t)}
                                                                className="px-4 py-3 text-sm text-left hover:bg-gray-50 dark:hover:bg-white/10 flex items-center gap-3 text-gray-700 dark:text-gray-200 transition-colors w-full cursor-pointer"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                                                                Duplicate
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setDeletingTxId(t.id);
                                                                    setActionMenuOpenId(null);
                                                                }}
                                                                className="px-4 py-3 text-sm text-left hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center gap-3 transition-colors w-full cursor-pointer"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-gray-200 dark:border-[#30363d] text-xs text-gray-400 dark:text-text-muted flex items-center justify-between">
                    <span>Showing {sorted.length} transaction{sorted.length !== 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">filter_list</span>
                        {selectedWeek === 'all' ? selectedMonth : `${selectedMonth} (Week ${selectedWeek})`}
                    </span>
                </div>
            </div>

            {/* Edit Modal / Portal */}
            {mounted && createPortal(
                <AnimatePresence>
                    {editingTx && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-[#30363d]"
                        >
                            <div className="p-5 border-b border-gray-200 dark:border-[#30363d] flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">edit</span>
                                    Edit Transaction
                                </h3>
                                <button onClick={() => { setEditingTx(null); setEditSubmitting(false); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <form onSubmit={e => { e.preventDefault(); submitEdit(); }} className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-text-muted mb-1.5 uppercase tracking-wider">Type</label>
                                        <select value={editingTx.type} onChange={e => setEditingTx({...editingTx, type: e.target.value})}
                                            className="w-full p-2.5 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm">
                                            <option value="expense">Expense</option>
                                            <option value="earning">Earning</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-text-muted mb-1.5 uppercase tracking-wider">Amount</label>
                                        <input type="number" step="0.01" value={editingTx.amount} onChange={e => setEditingTx({...editingTx, amount: e.target.value})}
                                            className="w-full p-2.5 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-text-muted mb-1.5 uppercase tracking-wider">Category</label>
                                    <select value={editingTx.category} onChange={e => setEditingTx({...editingTx, category: e.target.value})}
                                        className="w-full p-2.5 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm">
                                        <option value="">Select Category</option>
                                        {QUICK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        <optgroup label="Custom Categories">
                                            {customCategories.filter(c => c.type === editingTx.type).map(c => (
                                                <option key={`cc-e-${c.id}`} value={c.name}>{c.name}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-text-muted mb-1.5 uppercase tracking-wider">Date</label>
                                        <input type="date" value={editingTx.date ? (editingTx.date.includes('T') ? editingTx.date.split('T')[0] : editingTx.date) : ''} onChange={e => setEditingTx({...editingTx, date: e.target.value})}
                                            className="w-full p-2.5 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-text-muted mb-1.5 uppercase tracking-wider">Description</label>
                                    <input type="text" value={editingTx.description || ''} onChange={e => setEditingTx({...editingTx, description: e.target.value})}
                                        placeholder="Optional description"
                                        className="w-full p-2.5 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm" />
                                </div>
                                <div className="pt-2 flex gap-3">
                                    <button type="button" onClick={() => { setEditingTx(null); setEditSubmitting(false); }}
                                        className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-surface-dark dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm transition-colors cursor-pointer">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={editSubmitting || !editingTx.amount || !editingTx.category || isNaN(parseFloat(editingTx.amount)) || parseFloat(editingTx.amount) <= 0}
                                        className="flex-1 py-2.5 px-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-all btn-primary-glow flex justify-center items-center disabled:opacity-40 active:scale-95 cursor-pointer">
                                        {editSubmitting ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
                </AnimatePresence>,
            document.body)}

            {/* Delete Confirmation Modal / Portal */}
            {mounted && createPortal(
                <AnimatePresence>
                    {deletingTxId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-[#30363d]"
                            >
                                <div className="p-5 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-[32px]">delete_forever</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Transaction?</h3>
                                    <p className="text-gray-500 dark:text-text-muted text-sm mb-6">
                                        This action cannot be undone. This transaction will be permanently removed from your history and net balance.
                                    </p>
                                    <div className="flex gap-3 w-full">
                                        <button onClick={() => { setDeletingTxId(null); setDeleteSubmitting(false); }}
                                            className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-surface-dark dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm transition-colors cursor-pointer">
                                            Cancel
                                        </button>
                                        <button onClick={() => submitDelete()} disabled={deleteSubmitting}
                                            className="flex-1 py-2.5 px-4 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/30 flex justify-center items-center disabled:opacity-40 active:scale-95 cursor-pointer">
                                            {deleteSubmitting ? (
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : 'Delete'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
            document.body)}
        </div>
    );
}
