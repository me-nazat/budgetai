'use client';

import { useMemo, useState } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Tooltip,
    Filler,
} from 'chart.js';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import { useDashboard } from '@/hooks/useApi';
import { getCategoryHex } from '@/lib/categoryUtils';
import { useCustomCategories } from '@/hooks/useCustomCategories';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Filler);

export default function OverviewPage() {
    const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const { currency, fmt } = useCurrency();
    const sym = CURRENCIES[currency].symbol;
    const { categories: customCategories } = useCustomCategories('all');
    const { data, isLoading, isValidating } = useDashboard(selectedMonth, 'all');

    const monthOptions = useMemo(() => Array.from({ length: 12 }).map((_, index) => {
        const date = new Date();
        date.setMonth(date.getMonth() - index);
        return {
            value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        };
    }), []);

    if (!data && isLoading) {
        return (
            <div className="p-4 lg:p-8 max-w-[1500px] mx-auto">
                <div className="h-10 w-64 rounded-full shimmer-skeleton" />
                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {[0, 1, 2].map(item => <div key={item} className="skeleton-panel h-48" />)}
                </div>
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="skeleton-panel h-[360px] lg:col-span-2" />
                    <div className="skeleton-panel h-[360px]" />
                </div>
            </div>
        );
    }

    if (!data) return <div className="p-8 text-gray-500">Failed to load overview</div>;

    const totalIncome = data.earnings.current;
    const totalExpense = data.expenses.current;
    const netSavings = data.netSavings;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
    const topCategory = data.categorySpending[0];
    const categoryTotal = data.categorySpending.reduce((sum, item) => sum + item.total, 0);
    const highestDay = [...data.dailySpending].sort((a, b) => b.expenses - a.expenses)[0];
    const riskBudgets = data.budgetAlerts.filter(alert => alert.percentage >= 80);

    const lineData = {
        labels: data.dailySpending.map(day => new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [
            {
                label: 'Income',
                data: data.dailySpending.map(day => day.earnings),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                fill: true,
                tension: 0.35,
                pointRadius: 3,
            },
            {
                label: 'Expenses',
                data: data.dailySpending.map(day => day.expenses),
                borderColor: '#f43f5e',
                backgroundColor: 'rgba(244, 63, 94, 0.08)',
                fill: true,
                tension: 0.35,
                pointRadius: 3,
            },
        ],
    };

    const doughnutData = {
        labels: data.categorySpending.map(item => item.category),
        datasets: [{
            data: data.categorySpending.map(item => item.total),
            backgroundColor: data.categorySpending.map(item => getCategoryHex(item.category, customCategories)),
            borderWidth: 0,
            spacing: 3,
        }],
    };

    const kpis = [
        { label: 'Total Completed', value: fmt(Math.max(0, netSavings)), detail: `${savingsRate.toFixed(1)}% savings rate`, icon: 'savings', tone: 'text-emerald-600 bg-emerald-500/10' },
        { label: 'Active Flow', value: fmt(totalIncome - totalExpense), detail: `${totalIncome >= totalExpense ? 'Positive' : 'Negative'} monthly cashflow`, icon: 'sync_alt', tone: 'text-primary bg-primary/10' },
        { label: 'Focus Accuracy', value: `${Math.max(0, Math.min(100, Math.round(100 - Math.max(0, totalExpense - totalIncome) / Math.max(1, totalIncome) * 100)))}%`, detail: riskBudgets.length ? `${riskBudgets.length} budget risk${riskBudgets.length === 1 ? '' : 's'}` : 'Budgets stable', icon: 'track_changes', tone: 'text-violet-600 bg-violet-500/10' },
    ];

    const insights = [
        {
            icon: 'bolt',
            title: 'Peak Spend Signal',
            text: highestDay ? `${new Date(highestDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} carried the highest expenses at ${fmt(highestDay.expenses)}.` : 'No daily spending pattern yet.',
        },
        {
            icon: 'donut_small',
            title: 'Category Pressure',
            text: topCategory ? `${topCategory.category} is ${categoryTotal > 0 ? Math.round((topCategory.total / categoryTotal) * 100) : 0}% of tracked spending.` : 'No category spending yet.',
        },
        {
            icon: 'psychology',
            title: 'AI Readiness',
            text: 'Wealth AI can use this overview with transactions, budgets, goals, net worth, alerts, and recurring items when answering.',
        },
    ];

    return (
        <div className="p-4 lg:p-8 max-w-[1500px] mx-auto page-enter">
            {isValidating && <div className="fixed left-0 right-0 top-0 z-50 h-0.5 bg-primary/70 lg:left-64" />}

            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Analytics hub</p>
                    <h1 className="mt-2 text-3xl lg:text-5xl font-black tracking-tight text-gray-900 dark:text-white">Overview</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-text-muted">Performance tracking and strategic financial insights for your month.</p>
                </div>
                <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                    <span className="material-symbols-outlined text-primary">calendar_month</span>
                    <select value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="bg-transparent outline-none">
                        {monthOptions.map(option => <option key={option.value} value={option.value} className="bg-white dark:bg-surface-dark">{option.label}</option>)}
                    </select>
                </label>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {kpis.map((kpi, index) => (
                    <div key={kpi.label} className="card-premium rounded-2xl p-7 animate-slide-up" style={{ animationDelay: `${index * 0.08}s` }}>
                        <div className="mb-8 flex items-start justify-between">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500 dark:text-text-muted">{kpi.label}</p>
                            <span className={`material-symbols-outlined grid h-11 w-11 place-items-center rounded-2xl ${kpi.tone}`}>{kpi.icon}</span>
                        </div>
                        <p className="text-4xl lg:text-5xl font-black tracking-tight text-gray-900 dark:text-white">{kpi.value}</p>
                        <p className="mt-5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{kpi.detail}</p>
                    </div>
                ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="card-premium rounded-2xl p-6 xl:col-span-2">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cashflow Trends</h2>
                            <p className="text-sm text-gray-500 dark:text-text-muted">Income and expenses across the selected month.</p>
                        </div>
                        <div className="hidden items-center gap-4 text-xs font-bold text-gray-500 sm:flex">
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Income</span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Expenses</span>
                        </div>
                    </div>
                    <div className="h-[340px]">
                        <Line data={lineData} options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: '#64748b', maxTicksLimit: 8 } },
                                y: { grid: { color: 'rgba(148, 163, 184, 0.15)' }, ticks: { color: '#64748b', callback: value => sym + Number(value).toLocaleString() } },
                            },
                        }} />
                    </div>
                </div>

                <div className="card-premium rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Distribution</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-text-muted">Expense concentration by category.</p>
                    <div className="mt-5 h-[220px]">
                        {data.categorySpending.length > 0 ? (
                            <Doughnut data={doughnutData} options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                cutout: '68%',
                            }} />
                        ) : (
                            <div className="grid h-full place-items-center text-center text-gray-400">No expense data yet.</div>
                        )}
                    </div>
                    <div className="mt-5 space-y-3">
                        {data.categorySpending.slice(0, 5).map(item => {
                            const pct = categoryTotal > 0 ? Math.round((item.total / categoryTotal) * 100) : 0;
                            return (
                                <div key={item.category}>
                                    <div className="mb-1 flex items-center justify-between text-xs font-bold">
                                        <span className="text-gray-600 dark:text-gray-300">{item.category}</span>
                                        <span className="text-primary">{pct}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {insights.map((insight, index) => (
                    <div key={insight.title} className="card-premium rounded-2xl p-6 animate-slide-up" style={{ animationDelay: `${0.2 + index * 0.08}s` }}>
                        <span className="material-symbols-outlined mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">{insight.icon}</span>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">{insight.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-text-muted">{insight.text}</p>
                    </div>
                ))}
            </div>

            <div className="mt-10 overflow-hidden rounded-[1.75rem] border border-primary/15 bg-gradient-to-r from-primary to-violet-700 p-8 text-white shadow-2xl shadow-primary/20">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-white/70">Financial clarity</p>
                <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight">Clarity is the bridge between spending, saving, and confident decisions.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/78">This overview turns the whole app into one readable control surface: cashflow, category pressure, savings momentum, alerts, and AI-ready context.</p>
            </div>
        </div>
    );
}

