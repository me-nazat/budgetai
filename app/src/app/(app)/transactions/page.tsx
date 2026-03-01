'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/hooks/useCurrency';

interface Transaction {
    id: number; type: string; amount: number; category: string; description: string; date: string; created_at: string;
}

const categoryIcons: Record<string, string> = {
    Food: 'restaurant', Transport: 'directions_car', Housing: 'home', Utilities: 'bolt',
    Entertainment: 'theater_comedy', Shopping: 'checkroom', Health: 'health_and_safety',
    Education: 'school', Business: 'business_center', Savings: 'savings', Salary: 'payments',
    Freelance: 'work', Investment: 'trending_up', Other: 'category',
};
const QUICK_CATEGORIES = ['Food', 'Transport', 'Housing', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Education', 'Business', 'Savings', 'Salary', 'Freelance', 'Investment', 'Other'];

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedMonth, setSelectedMonth] = useState<string>(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    );
    const [selectedWeek, setSelectedWeek] = useState<string>('all');

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

    const [typeFilter, setTypeFilter] = useState('all');
    const [sortField, setSortField] = useState('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [showSuccess, setShowSuccess] = useState(false);
    const { fmt } = useCurrency();

    // Quick Add state
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [qaType, setQaType] = useState<'expense' | 'earning'>('expense');
    const [qaAmount, setQaAmount] = useState('');
    const [qaCategory, setQaCategory] = useState('');
    const [qaDesc, setQaDesc] = useState('');
    const [qaDate, setQaDate] = useState('');
    const [qaSubmitting, setQaSubmitting] = useState(false);

    useEffect(() => {
        setQaDate(new Date().toISOString().split('T')[0]);
    }, []);

    const submitQuickAdd = async () => {
        const parsed = parseFloat(qaAmount);
        if (!qaAmount || isNaN(parsed) || parsed <= 0 || !qaCategory) return;
        setQaSubmitting(true);
        await fetch('/api/transactions', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: qaType, amount: parsed, category: qaCategory, description: qaDesc || qaCategory, date: qaDate }),
        });
        setQaAmount(''); setQaDesc(''); setQaCategory(''); setShowQuickAdd(false); setQaSubmitting(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        loadData();
    };

    const getDateRanges = () => {
        let currentYear, currentMonth;
        if (selectedMonth && selectedMonth.match(/^\d{4}-\d{2}$/)) {
            [currentYear, currentMonth] = selectedMonth.split('-').map(Number);
        } else {
            const now = new Date();
            currentYear = now.getFullYear();
            currentMonth = now.getMonth() + 1;
        }

        let startDayCurrent = 1;
        let endDayCurrent = new Date(currentYear, currentMonth, 0).getDate();

        if (selectedWeek && selectedWeek !== 'all') {
            const weekNum = parseInt(selectedWeek);
            if (weekNum === 1) { startDayCurrent = 1; endDayCurrent = 7; }
            else if (weekNum === 2) { startDayCurrent = 8; endDayCurrent = 14; }
            else if (weekNum === 3) { startDayCurrent = 15; endDayCurrent = 21; }
            else if (weekNum === 4) { startDayCurrent = 22; /* endDay is already last day of month */ }
        }

        const start = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(startDayCurrent).padStart(2, '0')}`;
        const end = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(endDayCurrent).padStart(2, '0')}`;

        return { start, end };
    };

    const loadData = () => {
        setLoading(true);
        const params = new URLSearchParams();
        const { start, end } = getDateRanges();

        if (start) params.set('start', start);
        if (end) params.set('end', end);
        if (typeFilter !== 'all') params.set('type', typeFilter);
        params.set('limit', '200');

        fetch(`/api/transactions?${params.toString()}`)
            .then(r => r.json())
            .then(d => { setTransactions(d.transactions || []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadData(); }, [selectedMonth, selectedWeek, typeFilter]);

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

    return (
        <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
            {/* Success Toast */}
            {showSuccess && (
                <div className="fixed top-6 right-6 z-50 toast-enter">
                    <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20">
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        <span className="text-sm font-semibold">Transaction saved!</span>
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
                        <select value={qaCategory} onChange={e => setQaCategory(e.target.value)}
                            className="p-2.5 border border-gray-200 dark:border-[#30363d] rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm">
                            <option value="">Category</option>
                            {QUICK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
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
            <div className="card-premium rounded-2xl overflow-hidden" style={{ animation: 'slideUp 0.5s ease-out 0.1s both' }}>
                <div className="overflow-x-auto">
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
                            {loading ? (
                                <tr><td colSpan={4} className="px-6 py-12 text-center">
                                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                    <p className="text-gray-400 dark:text-text-muted text-sm">Loading transactions...</p>
                                </td></tr>
                            ) : sorted.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-12 text-center">
                                    <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 block mb-2">search_off</span>
                                    <p className="text-gray-400 dark:text-text-muted">No transactions found for this period.</p>
                                </td></tr>
                            ) : sorted.map((t, i) => (
                                <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-surface-hover/30 transition-colors duration-200"
                                    style={{ animation: `slideUp 0.3s ease-out ${Math.min(i * 0.03, 0.3)}s both` }}>
                                    <td className="px-6 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'expense' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'}`}>
                                                <span className="material-symbols-outlined text-lg">{categoryIcons[t.category] || 'category'}</span>
                                            </div>
                                            <span className="font-medium text-gray-900 dark:text-white">{t.description || t.category}</span>
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
        </div>
    );
}
