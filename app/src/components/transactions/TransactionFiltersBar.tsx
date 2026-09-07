'use client';

import React from 'react';

interface TransactionFiltersBarProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    typeFilter: string;
    setTypeFilter: (t: string) => void;
    selectedMonth: string;
    setSelectedMonth: (m: string) => void;
    monthOptions: Array<{ value: string; label: string }>;
    selectedWeek: string;
    setSelectedWeek: (w: string) => void;
    weekOptions: Array<{ value: string; label: string }>;
    totalEarnings: number;
    totalExpenses: number;
    fmt: (v: number) => string;
    biggestExpense: { amount: number; description?: string; category: string } | null;
    topCategory: string | null;
    topCategoryCount: number;
    showQuickAdd: boolean;
    setShowQuickAdd: (v: boolean) => void;
    setIsScannerOpen: (v: boolean) => void;
    exportExcel: () => void;
}

export const TransactionFiltersBar: React.FC<TransactionFiltersBarProps> = ({
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    selectedMonth,
    setSelectedMonth,
    monthOptions,
    selectedWeek,
    setSelectedWeek,
    weekOptions,
    totalEarnings,
    totalExpenses,
    fmt,
    biggestExpense,
    topCategory,
    topCategoryCount,
    showQuickAdd,
    setShowQuickAdd,
    setIsScannerOpen,
    exportExcel,
}) => {
    const netTotal = totalEarnings - totalExpenses;

    return (
        <div className="space-y-5 mb-6">
            {/* Header with Title and Primary Actions */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                        Transactions
                    </h2>
                    <p className="text-gray-500 dark:text-text-muted text-sm mt-1">
                        View, organize, and track your cashflow entries
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setIsScannerOpen(true)}
                        className="px-3.5 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-500/20 active:scale-95 shadow-sm"
                        title="AI Receipt Scanner"
                    >
                        <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                        <span className="hidden sm:inline">Smart Scan</span>
                    </button>
                    <button
                        onClick={() => setShowQuickAdd(!showQuickAdd)}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 btn-primary-glow active:scale-95 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">{showQuickAdd ? 'close' : 'add'}</span>
                        <span>{showQuickAdd ? 'Cancel' : 'Quick Add'}</span>
                    </button>
                    <button
                        onClick={exportExcel}
                        className="px-3.5 py-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl text-sm font-semibold transition-all border border-emerald-200 dark:border-emerald-500/20 hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-1.5 active:scale-95 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        <span>Export</span>
                    </button>
                </div>
            </header>

            {/* Summary KPI Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="glass-panel p-4 rounded-2xl stat-gradient-emerald lg:col-span-1 border border-gray-100 dark:border-white/5">
                    <p className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider">Earnings</p>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">{fmt(totalEarnings)}</p>
                </div>
                <div className="glass-panel p-4 rounded-2xl stat-gradient-orange lg:col-span-1 border border-gray-100 dark:border-white/5">
                    <p className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider">Expenses</p>
                    <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">{fmt(totalExpenses)}</p>
                </div>
                <div className="glass-panel p-4 rounded-2xl stat-gradient-blue col-span-2 lg:col-span-1 border border-gray-100 dark:border-white/5">
                    <p className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider">Net Cashflow</p>
                    <p className={`text-lg font-black mt-1 ${netTotal >= 0 ? 'text-primary' : 'text-rose-500'}`}>
                        {netTotal >= 0 ? '+' : ''}{fmt(netTotal)}
                    </p>
                </div>

                {/* Micro Financial Pulse */}
                <div className="glass-panel p-4 rounded-2xl col-span-2 lg:col-span-2 flex gap-4 bg-gradient-to-r from-teal-500/5 to-cyan-500/5 items-center justify-around border-teal-100 dark:border-teal-500/10 border">
                    <div className="flex flex-col items-center justify-center text-center w-1/2">
                        <span className="material-symbols-outlined text-teal-500 text-sm mb-0.5">priority_high</span>
                        <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Largest Outflow</p>
                        <p className="text-xs font-bold text-gray-900 dark:text-white mt-0.5 truncate w-full px-2" title={biggestExpense?.description || biggestExpense?.category || 'None'}>
                            {biggestExpense ? `${fmt(biggestExpense.amount)} · ${biggestExpense.description || biggestExpense.category}` : 'None'}
                        </p>
                    </div>
                    <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
                    <div className="flex flex-col items-center justify-center text-center w-1/2">
                        <span className="material-symbols-outlined text-cyan-500 text-sm mb-0.5">repeat</span>
                        <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Frequent Category</p>
                        <p className="text-xs font-bold text-gray-900 dark:text-white mt-0.5 truncate w-full px-2">
                            {topCategory ? `${topCategory} (${topCategoryCount}x)` : 'None'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white/70 dark:bg-surface-dark/60 p-2.5 rounded-2xl border border-gray-200/70 dark:border-white/10 backdrop-blur-md">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary transition-colors"
                    />
                </div>

                {/* Type Filter Tabs */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-black/30 p-1 rounded-xl shrink-0">
                    {(['all', 'expense', 'earning'] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTypeFilter(t)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                                typeFilter === t
                                    ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-text-muted hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            {t === 'all' ? 'All' : t === 'expense' ? 'Expenses' : 'Income'}
                        </button>
                    ))}
                </div>

                {/* Month & Week Selectors */}
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent outline-none cursor-pointer text-xs font-bold"
                        >
                            {monthOptions.map((m) => (
                                <option key={m.value} value={m.value} className="bg-white dark:bg-surface-dark">
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <span className="material-symbols-outlined text-[16px] text-primary">view_week</span>
                        <select
                            value={selectedWeek}
                            onChange={(e) => setSelectedWeek(e.target.value)}
                            className="bg-transparent outline-none cursor-pointer text-xs font-bold"
                        >
                            {weekOptions.map((w) => (
                                <option key={w.value} value={w.value} className="bg-white dark:bg-surface-dark">
                                    {w.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>
        </div>
    );
};
