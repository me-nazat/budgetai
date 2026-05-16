'use client';

import { useState, useRef } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import { useDashboard, useUser, useMarketNews, useExchangeRates } from '@/hooks/useApi';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, LineElement, PointElement,
    Title, Tooltip, Legend, Filler, ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { getCategoryIcon, getCategoryHex, CATEGORY_HEX_COLORS } from '@/lib/categoryUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler, ArcElement);

const categoryColors = CATEGORY_HEX_COLORS;

const categoryIcons: Record<string, string> = {
    Food: 'restaurant', Transport: 'directions_car', Housing: 'home', Utilities: 'bolt',
    Entertainment: 'theater_comedy', Shopping: 'checkroom', Health: 'health_and_safety',
    Education: 'school', Business: 'business_center', Savings: 'savings', Salary: 'payments',
    Freelance: 'work', Investment: 'trending_up', Other: 'category',
};

export default function DashboardPage() {
    const chartRef = useRef(null);
    const { currency, fmt } = useCurrency();

    const [selectedMonth, setSelectedMonth] = useState<string>(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    );
    const [selectedWeek, setSelectedWeek] = useState<string>('all');

    // SWR hooks — cached, stale-while-revalidate
    const { data, isLoading, isValidating } = useDashboard(selectedMonth, selectedWeek);
    const { user } = useUser();
    const marketNews = useMarketNews();
    const exchangeRates = useExchangeRates(currency);
    const { categories: customCats } = useCustomCategories('all');

    // Intelligence Hub — default to 'news' tab (Task 2)
    const [activeTab, setActiveTab] = useState<'currency' | 'news' | 'calculator'>('news');
    const [calcAmount, setCalcAmount] = useState<number>(500);
    const [calcYears, setCalcYears] = useState<number>(10);
    const [calcRate, setCalcRate] = useState<number>(7);

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

    // Only show full spinner on very first load (no cached data at all)
    if (!data && isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-400 dark:text-text-muted animate-fade-in">Loading your finances...</p>
                </div>
            </div>
        );
    }

    if (!data) return <div className="p-8 text-gray-500">Failed to load dashboard</div>;

    const userName = user?.name || '';
    const sym = CURRENCIES[currency].symbol;
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#21262d' : '#e5e7eb';
    const tickColor = isDark ? '#8b949e' : '#6b7280';

    const barData = {
        labels: data.dailySpending.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [
            { label: 'Expenses', data: data.dailySpending.map(d => d.expenses), backgroundColor: isDark ? 'rgba(19, 109, 236, 0.6)' : 'rgba(19, 109, 236, 0.7)', borderRadius: 6, borderSkipped: false as const },
            { label: 'Earnings', data: data.dailySpending.map(d => d.earnings), backgroundColor: isDark ? 'rgba(16, 185, 129, 0.6)' : 'rgba(16, 185, 129, 0.7)', borderRadius: 6, borderSkipped: false as const },
        ],
    };

    const doughnutData = {
        labels: data.categorySpending.map(c => c.category.charAt(0).toUpperCase() + c.category.slice(1).toLowerCase()),
        datasets: [{
            data: data.categorySpending.map(c => c.total),
            backgroundColor: data.categorySpending.map(c => {
                const cat = c.category.charAt(0).toUpperCase() + c.category.slice(1).toLowerCase();
                return getCategoryHex(cat, customCats);
            }),
            borderWidth: 0,
            spacing: 2,
        }],
    };

    const stats = [
        { label: 'Total Balance', value: fmt(data.balance), change: data.earnings.change, icon: 'account_balance', color: 'text-primary', gradient: 'stat-gradient-blue' },
        { label: 'Monthly Earnings', value: fmt(data.earnings.current), change: data.earnings.change, icon: 'payments', color: 'text-emerald-500', gradient: 'stat-gradient-emerald' },
        { label: 'Monthly Expenses', value: fmt(data.expenses.current), change: data.expenses.change, icon: 'shopping_cart', color: 'text-orange-500', gradient: 'stat-gradient-orange', negative: true },
        { label: 'Net Savings', value: fmt(data.netSavings), change: data.netSavings > 0 ? 8.1 : -5, icon: 'savings', color: 'text-violet-500', gradient: 'stat-gradient-violet' },
    ];

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto page-enter">
            {/* Subtle revalidation indicator — replaces full-screen spinner */}
            {isValidating && (
                <div className="fixed top-0 left-0 lg:left-64 right-0 z-50 h-0.5">
                    <div className="h-full bg-primary/60 animate-pulse rounded-full" />
                </div>
            )}

            {/* ═══════════════════════════════════════════════
               MOBILE HOME VIEW
               ═══════════════════════════════════════════════ */}
            <div className="lg:hidden">
                {/* Mobile Greeting Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-sm text-gray-500 dark:text-text-muted">{greeting()}</p>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {userName || 'Welcome'} 👋
                        </h2>
                    </div>
                    <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-white font-bold text-base shadow-lg shadow-primary/25">
                        {userName ? userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                </div>

                {/* Total Balance Card (Redesigned) */}
                <div className="relative rounded-[2rem] p-6 mb-6 overflow-hidden shadow-2xl shadow-primary/20 dark:shadow-primary/10">
                    {/* Animated background layers */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-600 to-indigo-600 dark:from-primary/80 dark:via-blue-800/80 dark:to-indigo-900/80" />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse" style={{ animationDuration: '4s' }} />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/20 dark:bg-emerald-500/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3 animate-pulse" style={{ animationDuration: '5s', animationDirection: 'reverse' }} />

                    {/* Glass Overlay */}
                    <div className="absolute inset-0 bg-white/5 dark:bg-black/10 backdrop-blur-[2px]" />

                    {/* Content */}
                    <div className="relative z-10">
                        <p className="text-xs font-semibold text-white/80 uppercase tracking-wider mb-1">Total Balance</p>
                        <h3 className="text-4xl font-bold text-white tracking-tight mb-6 number-appear">{fmt(data.balance)}</h3>

                        <div className="flex gap-3">
                            <div className="flex-1 bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl p-3 shadow-inner">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="w-5 h-5 rounded-full bg-emerald-400/20 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-emerald-300 text-[12px] font-bold">arrow_downward</span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider">Income</span>
                                </div>
                                <p className="text-base font-bold text-white">{fmt(data.earnings.current)}</p>
                            </div>
                            <div className="flex-1 bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl p-3 shadow-inner">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white text-[12px] font-bold">arrow_upward</span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider">Expense</span>
                                </div>
                                <p className="text-base font-bold text-white">{fmt(data.expenses.current)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Insight Card (Redesigned) */}
                <div className="relative card-premium rounded-2xl p-5 mb-6 overflow-hidden border border-emerald-100 dark:border-emerald-500/20 bg-gradient-to-br from-white to-emerald-50/50 dark:from-[#161b22] dark:to-emerald-900/10">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_10px_rgb(16,185,129)]" />
                    <div className="flex items-start gap-3">
                        <div className="relative shrink-0 mt-0.5">
                            <div className="absolute inset-0 bg-emerald-400 blur-md rounded-full animate-pulse opacity-50" style={{ animationDuration: '3s' }} />
                            <div className="relative w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
                                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl animate-bounce-in" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5">AI Insight</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                                {data.netSavings > 0
                                    ? `Great job! You've saved ${fmt(data.netSavings)} this period. Your savings rate is ${data.earnings.current > 0 ? ((data.netSavings / data.earnings.current) * 100).toFixed(0) : 0}%.`
                                    : `Heads up — you're spending more than you earn this period. Consider reviewing your top expense categories.`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Recent Transactions (Interactive Redesign) */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Transactions</h3>
                        <a href="/transactions" className="text-xs font-bold text-primary dark:text-emerald-400 hover:text-blue-600 transition-colors">See All</a>
                    </div>
                    <div className="space-y-3">
                        {data.recentTransactions.length === 0 ? (
                            <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-100 dark:border-[#30363d] rounded-2xl p-8 text-center shadow-inner">
                                <div className="w-12 h-12 bg-gray-100 dark:bg-[#21262d] rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="material-symbols-outlined text-2xl text-gray-400 dark:text-gray-500">receipt_long</span>
                                </div>
                                <p className="text-sm font-medium text-gray-500 dark:text-text-muted">No transactions yet</p>
                            </div>
                        ) : data.recentTransactions.slice(0, 6).map(t => (
                            <div key={t.id} className="relative overflow-hidden card-premium rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 active:scale-[0.98] active:bg-gray-50/80 dark:active:bg-surface-hover/80 hover:shadow-md cursor-pointer group">
                                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-transparent via-gray-200 dark:via-[#30363d] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 ${t.type === 'expense' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
                                    <span className={`material-symbols-outlined text-xl ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        {getCategoryIcon(t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase(), customCats)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-base font-bold text-gray-900 dark:text-white truncate mb-0.5">{t.description || t.category}</p>
                                    <p className="text-xs font-medium text-gray-400 dark:text-text-muted">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                </div>
                                <p className={`text-base font-bold shrink-0 ${t.type === 'expense' ? 'text-gray-900 dark:text-white' : 'text-emerald-500'}`}>
                                    {t.type === 'expense' ? '−' : '+'}{fmt(t.amount)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
               DESKTOP VIEW (hidden on mobile)
               ═══════════════════════════════════════════════ */}
            <div className="hidden lg:block">
                {/* Header */}
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {greeting()}{userName ? `, ${userName}` : ''} 👋
                        </h2>
                        <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Here&apos;s what&apos;s happening with your money.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-text-muted bg-gray-100 dark:bg-surface-dark px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#30363d]">
                            <span className="material-symbols-outlined text-base">calendar_month</span>
                            <select
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                                className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 font-medium cursor-pointer"
                            >
                                {monthOptions.map(m => (
                                    <option key={m.value} value={m.value} className="bg-white dark:bg-surface-dark">{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-text-muted bg-gray-100 dark:bg-surface-dark px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#30363d]">
                            <span className="material-symbols-outlined text-base">view_week</span>
                            <select
                                value={selectedWeek}
                                onChange={e => setSelectedWeek(e.target.value)}
                                className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 font-medium cursor-pointer"
                            >
                                {weekOptions.map(w => (
                                    <option key={w.value} value={w.value} className="bg-white dark:bg-surface-dark">{w.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-8">
                    {stats.map((s, i) => (
                        <div key={i} className={`card-premium ${s.gradient} p-5 lg:p-6 rounded-2xl relative overflow-hidden group`}
                            style={{ animationDelay: `${i * 0.08}s`, animation: `slideUp 0.5s ease-out ${i * 0.08}s both` }}>
                            <div className="absolute -right-3 -top-3 opacity-[0.06] group-hover:opacity-[0.12] transition-all duration-500 group-hover:scale-110 group-hover:rotate-12">
                                <span className={`material-symbols-outlined text-7xl ${s.color}`}>{s.icon}</span>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <p className="text-gray-500 dark:text-text-muted text-xs font-semibold uppercase tracking-wider">{s.label}</p>
                                <h3 className="text-gray-900 dark:text-white text-2xl lg:text-3xl font-bold tracking-tight number-appear">{s.value}</h3>
                                <div className="flex items-center gap-1.5 mt-2">
                                    <span className={`${s.change >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'} text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1`}>
                                        <span className="material-symbols-outlined text-sm">{s.change >= 0 ? 'trending_up' : 'trending_down'}</span>
                                        {s.change >= 0 ? '+' : ''}{s.change.toFixed(1)}%
                                    </span>
                                    <span className="text-gray-400 dark:text-text-muted text-xs">vs prev period</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Charts & Alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
                    {/* Spending Trends */}
                    <div className="lg:col-span-2 card-premium p-6 rounded-2xl" style={{ animation: 'slideUp 0.5s ease-out 0.35s both' }}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Spending Trends</h3>
                                <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">Income vs Expenses over time</p>
                            </div>
                        </div>
                        <div className="h-[280px]">
                            <Bar ref={chartRef} data={barData} options={{
                                responsive: true, maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'top' as const, labels: { color: tickColor, usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12, weight: 500 } } },
                                    tooltip: { backgroundColor: isDark ? '#161b22' : '#fff', titleColor: isDark ? '#f0f6fc' : '#1f2937', bodyColor: isDark ? '#8b949e' : '#6b7280', borderColor: isDark ? '#30363d' : '#e5e7eb', borderWidth: 1, padding: 12, cornerRadius: 8, displayColors: true, boxPadding: 4 },
                                },
                                scales: {
                                    x: { grid: { display: false }, ticks: { color: tickColor, maxTicksLimit: 8, font: { size: 11 } } },
                                    y: { grid: { color: gridColor, lineWidth: 0.5 }, ticks: { color: tickColor, callback: (v) => sym + v, font: { size: 11 } }, border: { display: false } },
                                },
                            }} />
                        </div>
                    </div>

                    {/* Budget Alerts & Categories */}
                    <div className="flex flex-col gap-5" style={{ animation: 'slideUp 0.5s ease-out 0.45s both' }}>
                        {/* Budget Alerts */}
                        <div className="card-premium p-6 rounded-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Budget Alerts</h3>
                                {data.budgetAlerts.length > 0 && (
                                    <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold px-2 py-1 rounded-md">
                                        {data.budgetAlerts.filter(b => b.percentage >= 80).length} Alerts
                                    </span>
                                )}
                            </div>
                            <div className="space-y-4">
                                {data.budgetAlerts.length === 0 ? (
                                    <div className="text-center py-4">
                                        <span className="material-symbols-outlined text-3xl text-gray-300 dark:text-gray-600 mb-2 block">verified</span>
                                        <p className="text-sm text-gray-400 dark:text-text-muted">No budget alerts. Set budgets to track spending.</p>
                                    </div>
                                ) : data.budgetAlerts.slice(0, 3).map((b, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{b.category}</span>
                                            <span className={`text-xs font-bold ${b.percentage >= 100 ? 'text-rose-500' : b.percentage >= 80 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {b.percentage >= 100 ? 'Over Budget!' : b.percentage >= 80 ? `${b.percentage}% used` : 'On Track'}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-surface-hover rounded-full h-2 overflow-hidden">
                                            <div className={`h-2 rounded-full transition-all duration-700 ease-out ${b.percentage >= 100 ? 'bg-rose-500' : b.percentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(b.percentage, 100)}%` }} />
                                        </div>
                                        <div className="flex justify-between mt-1 text-xs text-gray-400 dark:text-text-muted">
                                            <span>{fmt(b.spent)} spent</span>
                                            <span>{fmt(b.limit)} limit</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Categories */}
                        {data.categorySpending.length > 0 && (
                            <div className="card-premium p-6 rounded-2xl flex-1">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top Categories</h3>
                                <div className="h-[160px]">
                                    <Doughnut data={doughnutData} options={{
                                        responsive: true, maintainAspectRatio: false,
                                        plugins: {
                                            legend: { position: 'right' as const, labels: { color: tickColor, usePointStyle: true, pointStyle: 'circle', padding: 10, font: { size: 11 } } },
                                            tooltip: { backgroundColor: isDark ? '#161b22' : '#fff', titleColor: isDark ? '#f0f6fc' : '#1f2937', bodyColor: isDark ? '#8b949e' : '#6b7280', borderColor: isDark ? '#30363d' : '#e5e7eb', borderWidth: 1, padding: 10, cornerRadius: 8 },
                                        },
                                        cutout: '68%',
                                    }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Final Row: Recent Transactions & Financial Intelligence Hub */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

                    {/* Recent Transactions (Takes up 2 cols on large) */}
                    <div className="lg:col-span-2 card-premium rounded-2xl overflow-hidden" style={{ animation: 'slideUp 0.5s ease-out 0.55s both' }}>
                        <div className="p-6 border-b border-gray-200 dark:border-[#30363d] flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Transactions</h3>
                            <a href="/transactions" className="text-primary text-sm font-semibold hover:underline flex items-center gap-1">
                                View All <span className="material-symbols-outlined text-base">arrow_forward</span>
                            </a>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 dark:bg-surface-dark/50 text-xs text-gray-500 dark:text-text-muted uppercase tracking-wider">
                                        <th className="px-4 lg:px-6 py-3.5 font-semibold">Transaction</th>
                                        <th className="px-4 lg:px-6 py-3.5 font-semibold hidden md:table-cell">Category</th>
                                        <th className="px-4 lg:px-6 py-3.5 font-semibold hidden sm:table-cell">Date</th>
                                        <th className="px-4 lg:px-6 py-3.5 font-semibold text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-[#21262d] text-sm">
                                    {data.recentTransactions.length === 0 ? (
                                        <tr><td colSpan={4} className="px-6 py-12 text-center">
                                            <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 block mb-2">receipt_long</span>
                                            <p className="text-gray-400 dark:text-text-muted">No transactions yet. Use AI Chat to start tracking!</p>
                                        </td></tr>
                                    ) : data.recentTransactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-surface-hover/50 transition-colors duration-200">
                                            <td className="px-4 lg:px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'expense' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'}`}>
                                                        <span className="material-symbols-outlined text-lg">{getCategoryIcon(t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase(), customCats)}</span>
                                                    </div>
                                                    <span className="font-medium text-gray-900 dark:text-white truncate">{t.description || t.category}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 lg:px-6 py-4 hidden md:table-cell">
                                                <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-gray-100 dark:bg-surface-hover text-gray-600 dark:text-text-muted">
                                                    {t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 lg:px-6 py-4 text-gray-500 dark:text-text-muted hidden sm:table-cell">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                            <td className={`px-4 lg:px-6 py-4 text-right font-semibold ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Financial Intelligence Hub */}
                    <div className="card-premium rounded-2xl flex flex-col overflow-hidden" style={{ animation: 'slideUp 0.5s ease-out 0.65s both' }}>
                        <div className="p-5 border-b border-gray-200 dark:border-[#30363d] bg-gradient-to-r from-violet-500/10 to-transparent">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-violet-500">insights</span>
                                Intelligence Hub
                            </h3>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-[#30363d] text-sm">
                            <button onClick={() => setActiveTab('currency')} className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${activeTab === 'currency' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Rates</button>
                            <button onClick={() => setActiveTab('news')} className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${activeTab === 'news' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>News</button>
                            <button onClick={() => setActiveTab('calculator')} className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${activeTab === 'calculator' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Growth</button>
                        </div>

                        {/* Tab Content */}
                        <div className="p-5 flex-1 bg-white dark:bg-surface-dark overflow-y-auto max-h-[350px]">
                            {activeTab === 'currency' && (
                                <div className="space-y-4 animate-fade-in">
                                    {!exchangeRates ? (
                                        <p className="text-sm text-gray-500 text-center py-4">Loading rates...</p>
                                    ) : (
                                        <>
                                            <p className="text-xs text-gray-500 mb-3 font-medium">1 {currency} equals:</p>
                                            <div className="space-y-3">
                                                {['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'].map(c => {
                                                    // If base is already one of these, skip or show USD instead
                                                    if (c === currency) return null;
                                                    const rate = exchangeRates.rates[c];
                                                    if (!rate) return null;
                                                    return (
                                                        <div key={c} className="flex justify-between items-center group p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors border border-transparent hover:border-gray-100 dark:hover:border-[#30363d]">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#21262d] flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                                                    {c.slice(0, 2)}
                                                                </div>
                                                                <span className="font-semibold text-gray-900 dark:text-white">{c}</span>
                                                            </div>
                                                            <span className="font-mono text-gray-700 dark:text-gray-300 group-hover:text-violet-500 transition-colors">{rate.toFixed(4)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {activeTab === 'news' && (
                                <div className="space-y-4 animate-fade-in">
                                    {marketNews.length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-4">Loading news...</p>
                                    ) : (
                                        marketNews.map(news => (
                                            <a key={news.id} href="#" className="block p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-hover border border-gray-100 dark:border-[#30363d] transition-all hover:scale-[1.02] hover:shadow-md">
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${news.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                                        news.sentiment === 'negative' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' :
                                                            'bg-gray-100 text-gray-700 dark:bg-[#21262d] dark:text-gray-300'
                                                        }`}>
                                                        {news.sentiment}
                                                    </span>
                                                    <span className="text-xs text-gray-400">{news.time}</span>
                                                </div>
                                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug mb-2 group-hover:text-violet-500 transition-colors">{news.title}</h4>
                                                <p className="text-xs text-gray-500 font-medium">{news.source}</p>
                                            </a>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'calculator' && (
                                <div className="space-y-4 animate-fade-in flex flex-col h-full">
                                    <p className="text-xs text-gray-500 mb-2">See how monthly savings grow over time with compound interest.</p>

                                    <div className="space-y-3 flex-1">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex justify-between">Monthly Save <span>{fmt(calcAmount)}</span></label>
                                            <input type="range" min="50" max="5000" step="50" value={calcAmount} onChange={e => setCalcAmount(Number(e.target.value))} className="w-full accent-violet-500" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex justify-between">Years <span>{calcYears} yrs</span></label>
                                            <input type="range" min="1" max="40" step="1" value={calcYears} onChange={e => setCalcYears(Number(e.target.value))} className="w-full accent-violet-500" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex justify-between">Est. Return <span>{calcRate}%</span></label>
                                            <input type="range" min="1" max="15" step="0.5" value={calcRate} onChange={e => setCalcRate(Number(e.target.value))} className="w-full accent-violet-500" />
                                        </div>
                                    </div>

                                    <div className="mt-4 p-4 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 text-center">
                                        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-1">Future Value</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {fmt(calcAmount * 12 * ((Math.pow(1 + calcRate / 100, calcYears) - 1) / (calcRate / 100)))}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Floating AI Button */}
                <a href="/chat" className="hidden lg:flex fixed bottom-8 right-8 bg-primary text-white rounded-2xl p-4 btn-primary-glow items-center gap-2 group z-50 animate-bounce-in shadow-lg">
                    <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform duration-300">smart_toy</span>
                    <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold text-sm">Talk to AI</span>
                </a>
            </div>
            {/* End Desktop View */}
        </div>
    );
}
