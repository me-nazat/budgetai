'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useDashboard, useTransactions } from '@/hooks/useApi';
import { getCategoryHex, getCategoryIcon, CATEGORIES_EXPENSE, CATEGORIES_INCOME } from '@/lib/categoryUtils';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { generateMonthOptions } from '@/lib/dateUtils';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { useLanguage } from '@/contexts/LanguageContext';

// Modals
import DayDetailPopup, { type DayTransaction, type DayRecurringItem } from '@/components/DayDetailPopup';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import { QuickAddTransactionModal } from '@/components/transactions/QuickAddTransactionModal';
import { ReceiptScannerModal } from '@/components/transactions/ReceiptScannerModal';
import MonthlyHeatmap from '@/components/MonthlyHeatmap';

// Dynamic Chart.js import with SSR disabled
const Line = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), { ssr: false });

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

interface RecurringItem {
    id: number;
    name: string;
    type: 'expense' | 'earning' | string;
    amount: number;
    category: string;
    frequency: string;
    next_date?: string;
    nextDate?: string;
    active: number;
}

function monthRange(monthValue: string) {
    const [yearStr, monthStr] = monthValue.split('-');
    const year = Number(yearStr) || new Date().getFullYear();
    const month = Number(monthStr) || new Date().getMonth() + 1;
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    return { year, month, start, end, endDay };
}

function isoDate(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MyMonthPage() {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0];

    // State
    const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
    const range = useMemo(() => monthRange(selectedMonth), [selectedMonth]);
    const [selectedDay, setSelectedDay] = useState<string>(todayStr.startsWith(selectedMonth) ? todayStr : `${selectedMonth}-01`);
    const [viewMode, setViewMode] = useState<'calendar' | 'ledger' | 'categories'>('calendar');
    const [chartMode, setChartMode] = useState<'flow' | 'trajectory'>('flow');
    const [ledgerSearch, setLedgerSearch] = useState('');
    const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<string>('all');

    // Modals state
    const [popupAnchor, setPopupAnchor] = useState<HTMLElement | null>(null);
    const [popupDate, setPopupDate] = useState<string | null>(null);
    const [selectedTx, setSelectedTx] = useState<any | null>(null);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [quickAddDate, setQuickAddDate] = useState<string | undefined>(undefined);
    const [quickAddTx, setQuickAddTx] = useState<any | null>(null);
    const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
    const [recurring, setRecurring] = useState<RecurringItem[]>([]);

    // Contexts & Hooks
    const { fmt, currency } = useCurrency();
    const { formatAmount } = usePrivacy();
    const { t } = useLanguage();
    const { categories: customCategories } = useCustomCategories('all');
    const { data: dashboardData } = useDashboard(selectedMonth, 'all');
    const { transactions, isLoading } = useTransactions(range.start, range.end, 'all', 1000);
    const invalidateData = useInvalidateFinancialData();

    // Fetch recurring items
    useEffect(() => {
        let cancelled = false;
        fetch('/api/recurring')
            .then((res) => res.json())
            .then((payload) => {
                if (!cancelled) setRecurring(payload.items || []);
            })
            .catch(() => {
                if (!cancelled) setRecurring([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Ensure selectedDay is within selectedMonth
    useEffect(() => {
        if (!selectedDay.startsWith(selectedMonth)) {
            setSelectedDay(`${selectedMonth}-01`);
        }
    }, [selectedMonth, selectedDay]);

    // Arrow-keys keyboard navigation across calendar grid
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
                return;
            }

            if (viewMode !== 'calendar') return;

            const currentDayNum = parseInt(selectedDay.split('-')[2], 10) || 1;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const nextDay = Math.max(1, currentDayNum - 1);
                setSelectedDay(isoDate(range.year, range.month, nextDay));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                const nextDay = Math.min(range.endDay, currentDayNum + 1);
                setSelectedDay(isoDate(range.year, range.month, nextDay));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const nextDay = Math.max(1, currentDayNum - 7);
                setSelectedDay(isoDate(range.year, range.month, nextDay));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextDay = Math.min(range.endDay, currentDayNum + 7);
                setSelectedDay(isoDate(range.year, range.month, nextDay));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                setPopupDate(selectedDay);
                setPopupAnchor(document.getElementById(`calendar-day-${selectedDay}`));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedDay, range.year, range.month, range.endDay, viewMode]);

    // Month Navigation Steppers
    const handlePrevMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const prev = new Date(y, m - 2, 1);
        const nextVal = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(nextVal);
    };

    const handleNextMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const next = new Date(y, m, 1);
        const nextVal = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(nextVal);
    };

    const handleJumpToToday = () => {
        setSelectedMonth(currentMonthStr);
        setSelectedDay(todayStr);
    };

    const monthOptions = useMemo(() => generateMonthOptions(36), []);

    // Calendar Days Structure (Monday = 0, Sunday = 6)
    const days = useMemo(() => {
        const first = new Date(range.year, range.month - 1, 1);
        const offset = first.getDay() === 0 ? 6 : first.getDay() - 1;
        return [
            ...Array.from({ length: offset }).map(() => null),
            ...Array.from({ length: range.endDay }).map((_, index) => {
                const day = index + 1;
                const date = isoDate(range.year, range.month, day);
                return { day, date };
            }),
        ];
    }, [range.endDay, range.month, range.year]);

    // Group transactions by date
    const transactionsByDate = useMemo(() => {
        return transactions.reduce<Record<string, typeof transactions>>((map, tx) => {
            const dateKey = tx.date ? tx.date.split('T')[0].split(' ')[0] : '';
            if (!dateKey) return map;
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(tx);
            return map;
        }, {});
    }, [transactions]);

    // Financial Totals
    const monthIncome = useMemo(
        () => transactions.filter((tx) => tx.type === 'earning').reduce((sum, tx) => sum + tx.amount, 0),
        [transactions]
    );

    const monthExpense = useMemo(
        () => transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0),
        [transactions]
    );

    const monthNet = monthIncome - monthExpense;
    const savingsRate = monthIncome > 0 ? ((monthNet / monthIncome) * 100).toFixed(1) : '0.0';

    // Pacing & Days calculation
    const isCurrentMonth = selectedMonth === currentMonthStr;
    const daysElapsed = isCurrentMonth
        ? Math.min(range.endDay, now.getDate())
        : selectedMonth < currentMonthStr
        ? range.endDay
        : 0;

    const daysRemaining = Math.max(0, range.endDay - daysElapsed);
    const monthElapsedPercent = Math.round((daysElapsed / range.endDay) * 100);

    const dailyAverageSpend = daysElapsed > 0 ? monthExpense / daysElapsed : 0;
    const safeToSpendDaily = dashboardData?.safeToSpend?.dailySafeAllowance ?? (daysRemaining > 0 ? Math.max(0, monthNet) / daysRemaining : 0);

    // Selected Day transactions & items
    const selectedTransactions = transactionsByDate[selectedDay] || [];
    const recurringThisMonth = useMemo(() => {
        return recurring.filter((item) => {
            const itemDate = item.next_date || item.nextDate || '';
            return itemDate >= range.start && itemDate <= range.end;
        });
    }, [recurring, range.start, range.end]);

    const selectedRecurring = recurringThisMonth.filter((item) => (item.next_date || item.nextDate) === selectedDay);

    const selectedExpense = selectedTransactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const selectedIncome = selectedTransactions.filter((tx) => tx.type === 'earning').reduce((sum, tx) => sum + tx.amount, 0);

    // Heatmap dataset
    const heatmapData = useMemo(() => {
        return Object.entries(transactionsByDate).map(([date, txs]) => ({
            date,
            earnings: txs.filter((tx) => tx.type === 'earning').reduce((sum, tx) => sum + tx.amount, 0),
            expenses: txs.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0),
            count: txs.length,
        }));
    }, [transactionsByDate]);

    // Cash flow and Trajectory chart data
    const cashFlowData = useMemo(() => {
        const labels: string[] = [];
        const incomes: number[] = [];
        const expenses: number[] = [];
        const trajectory: number[] = [];
        let runningNet = 0;

        for (let i = 1; i <= range.endDay; i++) {
            const d = isoDate(range.year, range.month, i);
            labels.push(String(i));
            const dayTxs = transactionsByDate[d] || [];
            const dInc = dayTxs.filter((t) => t.type === 'earning').reduce((sum, t) => sum + t.amount, 0);
            const dExp = dayTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

            incomes.push(dInc);
            expenses.push(dExp);
            runningNet += dInc - dExp;
            trajectory.push(runningNet);
        }

        if (chartMode === 'trajectory') {
            return {
                labels,
                datasets: [
                    {
                        label: 'Cumulative Net Net',
                        data: trajectory,
                        borderColor: '#136dec',
                        backgroundColor: (context: any) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                            gradient.addColorStop(0, 'rgba(19, 109, 236, 0.3)');
                            gradient.addColorStop(1, 'rgba(19, 109, 236, 0.0)');
                            return gradient;
                        },
                        fill: true,
                        tension: 0.35,
                        pointRadius: 2,
                        pointHoverRadius: 6,
                        borderWidth: 2.5,
                    },
                ],
            };
        }

        return {
            labels,
            datasets: [
                {
                    label: 'Income',
                    data: incomes,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                },
                {
                    label: 'Expenses',
                    data: expenses,
                    borderColor: '#f43f5e',
                    backgroundColor: 'rgba(244, 63, 94, 0.12)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                },
            ],
        };
    }, [range.endDay, range.year, range.month, transactionsByDate, chartMode]);

    // Category Spending Aggregations
    const categoryTotals = useMemo(() => {
        const map: Record<string, { total: number; count: number }> = {};
        transactions.forEach((tx) => {
            if (tx.type !== 'expense') return;
            const cat = tx.category || 'Uncategorized';
            if (!map[cat]) map[cat] = { total: 0, count: 0 };
            map[cat].total += tx.amount;
            map[cat].count += 1;
        });

        return Object.entries(map)
            .map(([category, { total, count }]) => ({
                category,
                total,
                count,
                percentage: monthExpense > 0 ? (total / monthExpense) * 100 : 0,
            }))
            .sort((a, b) => b.total - a.total);
    }, [transactions, monthExpense]);

    // Filtered ledger transactions
    const filteredLedgerTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            const matchesSearch =
                !ledgerSearch ||
                (tx.description && tx.description.toLowerCase().includes(ledgerSearch.toLowerCase())) ||
                (tx.category && tx.category.toLowerCase().includes(ledgerSearch.toLowerCase())) ||
                (tx.notes && tx.notes.toLowerCase().includes(ledgerSearch.toLowerCase()));

            const matchesCategory =
                ledgerCategoryFilter === 'all' ||
                tx.category?.toLowerCase() === ledgerCategoryFilter.toLowerCase();

            return matchesSearch && matchesCategory;
        });
    }, [transactions, ledgerSearch, ledgerCategoryFilter]);

    // CSV Statement Export
    const handleExportCSV = useCallback(() => {
        if (!transactions || transactions.length === 0) return;
        const headers = ['ID', 'Date', 'Type', 'Category', 'Description', 'Amount', 'Notes'];
        const rows = transactions.map((tx) => [
            tx.id,
            tx.date,
            tx.type,
            `"${(tx.category || '').replace(/"/g, '""')}"`,
            `"${(tx.description || '').replace(/"/g, '""')}"`,
            tx.amount,
            `"${(tx.notes || '').replace(/"/g, '""')}"`,
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `statement-${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [transactions, selectedMonth]);

    const formattedMonthName = new Date(range.year, range.month - 1, 1).toLocaleDateString('en-US', { month: 'long' });

    return (
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_390px] xl:grid-cols-[1fr_440px] text-slate-900 dark:text-slate-100">
            {/* ══════════════════════════════════════════════════════════════
               LEFT / MAIN SECTION: THE MONTHLY COMMAND CENTER
               ══════════════════════════════════════════════════════════════ */}
            <section className="border-r border-slate-200/80 p-4 sm:p-6 lg:p-8 dark:border-white/10 pb-28">
                {/* ── Signature Header ── */}
                <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Monthly Command Center</p>
                        </div>
                        <h1 className="mt-2 text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-baseline gap-3">
                            <span>{formattedMonthName}</span>
                            <span className="text-2xl sm:text-3xl font-light tracking-[0.35em] text-slate-400 dark:text-slate-500">{range.year}</span>
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                            {range.endDay} days cycle • {transactions.length} recorded transactions
                        </p>
                    </div>

                    {/* Navigation and Action Controls */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Month Stepper Toolbar */}
                        <div className="flex items-center rounded-2xl border border-slate-200 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-surface-dark/80 backdrop-blur-md">
                            <button
                                onClick={handlePrevMonth}
                                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                title="Previous Month"
                            >
                                <span className="material-symbols-outlined text-lg leading-none">chevron_left</span>
                            </button>

                            <label className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                                <span className="material-symbols-outlined text-primary text-base">calendar_month</span>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="bg-transparent outline-none cursor-pointer font-bold text-slate-800 dark:text-white"
                                >
                                    {monthOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value} className="bg-white dark:bg-surface-dark text-slate-900 dark:text-white">
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <button
                                onClick={handleNextMonth}
                                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                title="Next Month"
                            >
                                <span className="material-symbols-outlined text-lg leading-none">chevron_right</span>
                            </button>

                            {!isCurrentMonth && (
                                <button
                                    onClick={handleJumpToToday}
                                    className="ml-1 px-3 py-1.5 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-all"
                                >
                                    Today
                                </button>
                            )}
                        </div>

                        {/* Top Action Buttons */}
                        <button
                            onClick={() => {
                                setQuickAddDate(selectedDay);
                                setQuickAddTx(null);
                                setIsQuickAddOpen(true);
                            }}
                            className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            <span className="hidden sm:inline">Add Transaction</span>
                        </button>

                        <button
                            onClick={() => setIsReceiptScannerOpen(true)}
                            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3.5 py-3 text-sm font-bold text-slate-700 shadow-sm dark:border-white/10 dark:bg-surface-dark/80 dark:text-slate-200 hover:border-primary/50 transition-colors"
                            title="Scan Receipt with AI OCR"
                        >
                            <span className="material-symbols-outlined text-primary text-[18px]">document_scanner</span>
                            <span className="hidden md:inline">Scan Receipt</span>
                        </button>

                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm font-bold text-slate-600 shadow-sm dark:border-white/10 dark:bg-surface-dark/80 dark:text-slate-300 hover:text-primary transition-colors"
                            title="Export Month as CSV"
                        >
                            <span className="material-symbols-outlined text-[18px]">file_download</span>
                        </button>

                        <Link
                            href="/budget"
                            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/80 px-3.5 py-3 text-sm font-bold text-slate-700 shadow-sm dark:border-white/10 dark:bg-surface-dark/80 dark:text-slate-200 hover:border-primary/50 transition-colors"
                            title="Envelope Budgets"
                        >
                            <span className="material-symbols-outlined text-primary text-[18px]">mail</span>
                            <span className="hidden xl:inline">Envelopes</span>
                        </Link>
                    </div>
                </div>

                {/* ── Executive 4-Card Month KPI Pulse ── */}
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {/* Income Card */}
                    <div className="glass-panel rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-surface-dark/70 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            <span>Total Income</span>
                            <span className="material-symbols-outlined text-emerald-500 text-lg">arrow_downward</span>
                        </div>
                        <p className="mt-3 text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatAmount(monthIncome, fmt(monthIncome))}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {transactions.filter((tx) => tx.type === 'earning').length} income records
                        </p>
                    </div>

                    {/* Expense Card */}
                    <div className="glass-panel rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-surface-dark/70 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            <span>Total Expenses</span>
                            <span className="material-symbols-outlined text-rose-500 text-lg">arrow_upward</span>
                        </div>
                        <p className="mt-3 text-3xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                            {formatAmount(monthExpense, fmt(monthExpense))}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Avg {formatAmount(dailyAverageSpend, fmt(dailyAverageSpend))} / day
                        </p>
                    </div>

                    {/* Net Cash Flow Card */}
                    <div className="glass-panel rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-surface-dark/70 shadow-sm relative overflow-hidden group">
                        <div className={`absolute top-0 left-0 w-1 h-full ${monthNet >= 0 ? 'bg-primary' : 'bg-rose-500'}`} />
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            <span>Net Cash Flow</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${monthNet >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                                {savingsRate}% Saved
                            </span>
                        </div>
                        <p className={`mt-3 text-3xl font-black tabular-nums ${monthNet >= 0 ? 'text-primary' : 'text-rose-600 dark:text-rose-400'}`}>
                            {formatAmount(monthNet, fmt(monthNet))}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {monthNet >= 0 ? 'Monthly Net Surplus' : 'Monthly Deficit'}
                        </p>
                    </div>

                    {/* Safe-to-Spend / Month Runway Card */}
                    <div className="glass-panel rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-surface-dark/70 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            <span>Safe Daily Allowance</span>
                            <span className="material-symbols-outlined text-amber-500 text-lg">speed</span>
                        </div>
                        <p className="mt-3 text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                            {formatAmount(safeToSpendDaily, fmt(safeToSpendDaily))}
                            <span className="text-xs font-normal text-slate-400">/day</span>
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                            <span>{daysRemaining} days remaining</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{monthElapsedPercent}% elapsed</span>
                        </div>
                    </div>
                </div>

                {/* ── View Switcher Toolbar ── */}
                <div className="mb-6 flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-3">
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl">
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                viewMode === 'calendar'
                                    ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <span className="material-symbols-outlined text-base">calendar_view_month</span>
                            <span>Calendar Grid</span>
                        </button>

                        <button
                            onClick={() => setViewMode('ledger')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                viewMode === 'ledger'
                                    ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <span className="material-symbols-outlined text-base">format_list_bulleted</span>
                            <span>Daily Ledger ({transactions.length})</span>
                        </button>

                        <button
                            onClick={() => setViewMode('categories')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                viewMode === 'categories'
                                    ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <span className="material-symbols-outlined text-base">pie_chart</span>
                            <span>Category Mix</span>
                        </button>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Income
                        <span className="h-2 w-2 rounded-full bg-rose-500 ml-2" /> Expense
                        <span className="h-2 w-2 rounded-full bg-primary ml-2" /> Recurring
                    </div>
                </div>

                {/* ── VIEW 1: THE AUGUST 7-DAY CALENDAR GRID ── */}
                {viewMode === 'calendar' && (
                    <div>
                        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/70 shadow-sm dark:border-white/10 dark:bg-surface-dark/40 backdrop-blur-md">
                        {/* Day of Week Headers */}
                        <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.03]">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                                <div
                                    key={day}
                                    className={`px-3 py-3.5 text-center text-xs font-black uppercase tracking-[0.25em] ${
                                        idx >= 5 ? 'text-primary/70 dark:text-primary/80 font-black' : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                >
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid Cells */}
                        <div className="grid grid-cols-7">
                            {days.map((item, index) => {
                                if (!item) {
                                    return (
                                        <div
                                            key={`blank-${index}`}
                                            className="min-h-[128px] border-b border-r border-slate-200/60 bg-slate-50/40 dark:border-white/5 dark:bg-white/[0.01]"
                                        />
                                    );
                                }

                                const dayTxs = transactionsByDate[item.date] || [];
                                const expense = dayTxs.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
                                const income = dayTxs.filter((tx) => tx.type === 'earning').reduce((sum, tx) => sum + tx.amount, 0);
                                const recurringCount = recurringThisMonth.filter((rec) => (rec.next_date || rec.nextDate) === item.date).length;
                                const isSelected = selectedDay === item.date;
                                const isToday = item.date === todayStr;
                                const isHighSpend = dailyAverageSpend > 0 && expense > dailyAverageSpend * 1.8;

                                return (
                                    <motion.div
                                        key={item.date}
                                        id={`calendar-day-${item.date}`}
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.15, delay: index * 0.005 }}
                                        onClick={(e) => {
                                            setSelectedDay(item.date);
                                            setPopupAnchor(e.currentTarget);
                                            setPopupDate(item.date);
                                        }}
                                        className={`group relative min-h-[128px] border-b border-r border-slate-200/70 p-2.5 sm:p-3 text-left transition-all cursor-pointer dark:border-white/10 ${
                                            isSelected
                                                ? 'bg-primary/10 ring-2 ring-inset ring-primary shadow-sm dark:bg-primary/20'
                                                : isToday
                                                ? 'bg-primary/5 ring-1 ring-inset ring-primary/40 dark:bg-white/[0.03]'
                                                : 'bg-white/50 hover:bg-primary/[0.04] dark:bg-transparent dark:hover:bg-white/[0.04]'
                                        }`}
                                    >
                                        {/* Day Header */}
                                        <div className="mb-2 flex items-center justify-between">
                                            <span
                                                className={`flex h-7 w-7 items-center justify-center rounded-xl text-sm font-bold ${
                                                    isToday
                                                        ? 'bg-primary text-white shadow-sm shadow-primary/30'
                                                        : isSelected
                                                        ? 'bg-primary/20 text-primary font-black'
                                                        : 'text-slate-800 dark:text-slate-200'
                                                }`}
                                            >
                                                {String(item.day).padStart(2, '0')}
                                            </span>

                                            <div className="flex items-center gap-1">
                                                {isHighSpend && (
                                                    <span
                                                        className="material-symbols-outlined text-rose-500 text-[14px]"
                                                        title="High spending alert day"
                                                    >
                                                        warning
                                                    </span>
                                                )}
                                                {recurringCount > 0 && (
                                                    <span
                                                        className="material-symbols-outlined text-[15px] text-primary"
                                                        title={`${recurringCount} recurring bills due`}
                                                    >
                                                        repeat
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Day Financial Deltas */}
                                        <div className="space-y-1">
                                            {income > 0 && (
                                                <p className="truncate text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                    +{formatAmount(income, fmt(income))}
                                                </p>
                                            )}
                                            {expense > 0 && (
                                                <p className="truncate text-[11px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                                                    −{formatAmount(expense, fmt(expense))}
                                                </p>
                                            )}
                                        </div>

                                        {/* Category Color Pills / Dots */}
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {dayTxs.slice(0, 5).map((tx) => (
                                                <span
                                                    key={tx.id}
                                                    className="h-2 w-2 rounded-full transition-transform group-hover:scale-125"
                                                    style={{ backgroundColor: getCategoryHex(tx.category, customCategories) }}
                                                    title={`${tx.category}: ${formatAmount(tx.amount, fmt(tx.amount))}`}
                                                />
                                            ))}
                                            {dayTxs.length > 5 && (
                                                <span className="text-[9px] font-bold text-slate-400">+{dayTxs.length - 5}</span>
                                            )}
                                        </div>

                                        {/* Quick Add Button on Hover */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setQuickAddDate(item.date);
                                                setQuickAddTx(null);
                                                setIsQuickAddOpen(true);
                                            }}
                                            className="absolute right-2 bottom-2 h-6 w-6 rounded-lg bg-primary text-white opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-md hover:bg-primary-hover transition-opacity"
                                            title="Add transaction on this date"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">add</span>
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Keyboard navigation helper */}
                    <div className="mt-3 hidden sm:flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
                        <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">keyboard</span>
                            <span>Navigate days with</span>
                            <div className="flex items-center gap-1 font-mono font-bold">
                                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10">←</kbd>
                                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10">→</kbd>
                                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10">↑</kbd>
                                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10">↓</kbd>
                            </div>
                            <span className="ml-2">• Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 font-mono font-bold">Enter</kbd> to inspect day</span>
                        </div>
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('open-keyboard-shortcuts'))}
                            className="hover:text-primary transition-colors cursor-pointer"
                        >
                            All Shortcuts (?)
                        </button>
                    </div>
                </div>
            )}

                {/* ── VIEW 2: DAILY LEDGER FEED ── */}
                {viewMode === 'ledger' && (
                    <div className="space-y-6">
                        {/* Search & Filter Toolbar */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex-1 min-w-[220px] relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                <input
                                    type="text"
                                    value={ledgerSearch}
                                    onChange={(e) => setLedgerSearch(e.target.value)}
                                    placeholder="Search by merchant, category, notes..."
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark text-xs sm:text-sm outline-none focus:border-primary transition-colors"
                                />
                            </div>

                            <select
                                value={ledgerCategoryFilter}
                                onChange={(e) => setLedgerCategoryFilter(e.target.value)}
                                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                            >
                                <option value="all">All Categories</option>
                                {CATEGORIES_EXPENSE.map((c) => (
                                    <option key={c.label} value={c.label}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Grouped Day Rows */}
                        {filteredLedgerTransactions.length === 0 ? (
                            <div className="glass-panel p-12 text-center rounded-2xl border border-slate-200 dark:border-white/10">
                                <span className="material-symbols-outlined text-4xl text-slate-400">receipt_long</span>
                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mt-2">No transactions match your search filter</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Array.from(new Set(filteredLedgerTransactions.map((tx) => tx.date.split('T')[0]))).sort((a, b) => b.localeCompare(a)).map((date) => {
                                    const dayList = filteredLedgerTransactions.filter((tx) => tx.date.startsWith(date));
                                    const dayExp = dayList.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
                                    const dayInc = dayList.filter((tx) => tx.type === 'earning').reduce((sum, tx) => sum + tx.amount, 0);

                                    return (
                                        <div key={date} className="glass-panel rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-surface-dark/70 overflow-hidden shadow-sm">
                                            {/* Date Header */}
                                            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-primary text-base">event</span>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                                        {new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs font-bold">
                                                    {dayInc > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{formatAmount(dayInc, fmt(dayInc))}</span>}
                                                    {dayExp > 0 && <span className="text-rose-600 dark:text-rose-400">−{formatAmount(dayExp, fmt(dayExp))}</span>}
                                                </div>
                                            </div>

                                            {/* Transactions in Date */}
                                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                                {dayList.map((tx) => (
                                                    <div
                                                        key={tx.id}
                                                        onClick={() => setSelectedTx(tx)}
                                                        className="flex items-center justify-between px-5 py-3 hover:bg-primary/[0.03] transition-colors cursor-pointer group"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div
                                                                className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                                                                    tx.type === 'expense' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
                                                                }`}
                                                            >
                                                                <span className="material-symbols-outlined text-lg">
                                                                    {getCategoryIcon(tx.category, customCategories)}
                                                                </span>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                                    {tx.description || tx.category}
                                                                </p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                    {tx.category} {(tx as any).accountName ? `• ${(tx as any).accountName}` : ''}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm font-bold tabular-nums font-mono ${tx.type === 'expense' ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                {tx.type === 'expense' ? '−' : '+'}{formatAmount(tx.amount, fmt(tx.amount))}
                                                            </span>
                                                            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-sm group-hover:text-primary transition-colors">
                                                                chevron_right
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── VIEW 3: CATEGORY MIX & BREAKDOWN ── */}
                {viewMode === 'categories' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {categoryTotals.map((cat) => {
                                const hex = getCategoryHex(cat.category, customCategories);
                                return (
                                    <div
                                        key={cat.category}
                                        className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-surface-dark/70 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2.5">
                                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: hex }} />
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{cat.category}</h3>
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                                                {cat.percentage.toFixed(1)}%
                                            </span>
                                        </div>

                                        <div className="h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden my-3">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, cat.percentage)}%`, backgroundColor: hex }}
                                            />
                                        </div>

                                        <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                            <span>{cat.count} transactions</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                                {formatAmount(cat.total, fmt(cat.total))}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </section>

            {/* ══════════════════════════════════════════════════════════════
               RIGHT SECTION: FINANCIAL INTELLIGENCE & DAY INSPECTOR
               ══════════════════════════════════════════════════════════════ */}
            <aside className="bg-slate-50/50 p-4 sm:p-6 xl:p-8 dark:bg-[#0A0E1A]/40 pb-28 border-l border-slate-200/40 dark:border-white/5">
                <div className="flex flex-col gap-6 sticky top-6">
                    {/* ── Cash Flow Trajectory Chart Card ── */}
                    <div className="glass-panel rounded-2xl p-5 border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Cash Flow Dynamics</h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    {chartMode === 'flow' ? 'Daily Income vs Expenses' : 'Running Cumulative Net Net'}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-xl text-[11px] font-bold">
                                <button
                                    onClick={() => setChartMode('flow')}
                                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                                        chartMode === 'flow' ? 'bg-white dark:bg-surface-dark text-primary shadow-xs' : 'text-slate-500'
                                    }`}
                                >
                                    Daily
                                </button>
                                <button
                                    onClick={() => setChartMode('trajectory')}
                                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                                        chartMode === 'trajectory' ? 'bg-white dark:bg-surface-dark text-primary shadow-xs' : 'text-slate-500'
                                    }`}
                                >
                                    Net
                                </button>
                            </div>
                        </div>

                        <div className="h-[210px] w-full relative">
                            <Line
                                data={cashFlowData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                            mode: 'index',
                                            intersect: false,
                                            callbacks: {
                                                label: (context) => `${context.dataset.label}: ${formatAmount(Number(context.raw), fmt(Number(context.raw)))}`,
                                            },
                                        },
                                    },
                                    scales: {
                                        x: {
                                            grid: { display: false },
                                            ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 0 },
                                        },
                                        y: {
                                            grid: { color: 'rgba(148, 163, 184, 0.08)' },
                                            border: { display: false },
                                            ticks: {
                                                color: '#94a3b8',
                                                font: { size: 10 },
                                                callback: (val) => fmt(Number(val)),
                                            },
                                        },
                                    },
                                    interaction: { mode: 'nearest', axis: 'x', intersect: false },
                                }}
                            />
                        </div>
                    </div>

                    {/* ── Active Day Inspector Card ── */}
                    <div className="glass-panel rounded-2xl p-5 border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-lg">event_available</span>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Day Inspector</h3>
                            </div>
                            <span className="text-xs font-semibold text-slate-500">{selectedDay}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/5">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Day Spent</p>
                                <p className="text-base font-black text-rose-600 dark:text-rose-400 tabular-nums">
                                    {formatAmount(selectedExpense, fmt(selectedExpense))}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Day Earned</p>
                                <p className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    {formatAmount(selectedIncome, fmt(selectedIncome))}
                                </p>
                            </div>
                        </div>

                        {/* List of day transactions */}
                        <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                            {selectedTransactions.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2 text-center">No transactions on this day</p>
                            ) : (
                                selectedTransactions.map((tx) => (
                                    <div
                                        key={tx.id}
                                        onClick={() => setSelectedTx(tx)}
                                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] hover:bg-primary/10 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="h-2 w-2 rounded-full shrink-0"
                                                style={{ backgroundColor: getCategoryHex(tx.category, customCategories) }}
                                            />
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                                {tx.description || tx.category}
                                            </span>
                                        </div>
                                        <span className={`text-xs font-bold tabular-nums font-mono ${tx.type === 'expense' ? 'text-slate-900 dark:text-white' : 'text-emerald-500'}`}>
                                            {tx.type === 'expense' ? '−' : '+'}{formatAmount(tx.amount, fmt(tx.amount))}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Quick Add for Selected Day */}
                        <button
                            onClick={() => {
                                setQuickAddDate(selectedDay);
                                setQuickAddTx(null);
                                setIsQuickAddOpen(true);
                            }}
                            className="w-full mt-3 flex items-center justify-center gap-2 py-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"
                        >
                            <span className="material-symbols-outlined text-[15px]">add</span>
                            <span>Add transaction for this day</span>
                        </button>
                    </div>

                    {/* ── Monthly Heatmap Card ── */}
                    <div className="glass-panel rounded-2xl p-5 border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Intensity Heatmap</h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formattedMonthName}</span>
                        </div>
                        <MonthlyHeatmap year={range.year} month={range.month} dailySpending={heatmapData} />
                    </div>

                    {/* ── Upcoming Recurring Bills This Month ── */}
                    {recurringThisMonth.length > 0 && (
                        <div className="glass-panel rounded-2xl p-5 border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Subscriptions & Bills</h3>
                                <span className="text-xs font-bold text-primary">{recurringThisMonth.length} items</span>
                            </div>

                            <div className="space-y-2.5 max-h-[220px] overflow-y-auto custom-scrollbar">
                                {recurringThisMonth.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="material-symbols-outlined text-primary text-base">repeat</span>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                                                <p className="text-[10px] text-slate-400">{item.next_date || item.nextDate}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                            {formatAmount(item.amount, fmt(item.amount))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* ══════════════════════════════════════════════════════════════
               MODALS & POPUPS
               ══════════════════════════════════════════════════════════════ */}
            {popupAnchor && popupDate && (
                <DayDetailPopup
                    date={popupDate}
                    anchorEl={popupAnchor}
                    transactions={(transactionsByDate[popupDate] || []).map((t) => ({
                        id: typeof t.id === 'string' ? parseInt(t.id, 10) || 0 : t.id,
                        type: t.type as 'expense' | 'earning',
                        amount: t.amount,
                        category: t.category,
                        description: t.description || t.category,
                        date: t.date,
                        notes: t.notes || undefined,
                        accountId: t.accountId ?? null,
                        accountName: (t as any).accountName,
                    }))}
                    recurringItems={recurringThisMonth.filter((rec) => (rec.next_date || rec.nextDate) === popupDate)}
                    customCategories={customCategories}
                    onClose={() => {
                        setPopupAnchor(null);
                        setPopupDate(null);
                    }}
                    onTransactionClick={(tx) => {
                        setPopupAnchor(null);
                        setPopupDate(null);
                        setSelectedTx(tx);
                    }}
                    onAddClick={(date) => {
                        setQuickAddDate(date);
                        setQuickAddTx(null);
                        setIsQuickAddOpen(true);
                    }}
                />
            )}

            {selectedTx && (
                <TransactionDetailModal
                    transaction={selectedTx}
                    customCategories={customCategories}
                    onClose={() => setSelectedTx(null)}
                    onEdit={(tx) => {
                        setQuickAddDate(undefined);
                        setQuickAddTx(tx);
                        setIsQuickAddOpen(true);
                    }}
                    onDuplicate={(tx) => {
                        const duplicateTx = { ...tx, id: undefined, date: todayStr };
                        setQuickAddDate(undefined);
                        setQuickAddTx(duplicateTx);
                        setIsQuickAddOpen(true);
                    }}
                    onDelete={async (tx) => {
                        if (confirm('Are you sure you want to delete this transaction?')) {
                            await fetch(`/api/transactions?id=${tx.id}`, { method: 'DELETE' });
                            invalidateData();
                            setSelectedTx(null);
                        }
                    }}
                    onNotesChange={() => {
                        invalidateData();
                    }}
                />
            )}

            <QuickAddTransactionModal
                isOpen={isQuickAddOpen}
                onClose={() => {
                    setIsQuickAddOpen(false);
                    setQuickAddTx(null);
                    setQuickAddDate(undefined);
                }}
                initialTransaction={quickAddTx}
                initialDate={quickAddDate}
                onSaveSuccess={() => {
                    invalidateData();
                }}
            />

            <ReceiptScannerModal
                isOpen={isReceiptScannerOpen}
                onClose={() => setIsReceiptScannerOpen(false)}
                onScanComplete={() => {
                    invalidateData();
                }}
            />
        </div>
    );
}
