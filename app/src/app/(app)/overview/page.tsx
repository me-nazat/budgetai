'use client';

import { useMemo, useState } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Tooltip,
    Filler,
    Legend
} from 'chart.js';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import { useDashboard } from '@/hooks/useApi';
import { getCategoryHex } from '@/lib/categoryUtils';
import { useCustomCategories } from '@/hooks/useCustomCategories';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Filler, Legend);

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
            <div className="p-4 lg:p-8 max-w-[1500px] mx-auto flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-bold tracking-widest uppercase text-sm animate-pulse">Compiling Analytics...</p>
                </div>
            </div>
        );
    }

    if (!data) return <div className="p-8 text-center text-gray-500 font-bold">Failed to load overview data.</div>;

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
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                borderWidth: 2,
            },
            {
                label: 'Expenses',
                data: data.dailySpending.map(day => day.expenses),
                borderColor: '#f43f5e',
                backgroundColor: 'rgba(244, 63, 94, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                borderWidth: 2,
            },
        ],
    };

    const doughnutData = {
        labels: data.categorySpending.map(item => item.category),
        datasets: [{
            data: data.categorySpending.map(item => item.total),
            backgroundColor: data.categorySpending.map(item => getCategoryHex(item.category, customCategories)),
            borderWidth: 0,
            hoverOffset: 10,
        }],
    };

    const kpis = [
        { label: 'Total Saved', value: fmt(Math.max(0, netSavings)), detail: `${savingsRate.toFixed(1)}% savings rate`, icon: 'savings', tone: 'text-emerald-500', bgTone: 'bg-emerald-50 dark:bg-emerald-500/10' },
        { label: 'Cash Flow', value: fmt(totalIncome - totalExpense), detail: `${totalIncome >= totalExpense ? 'Positive' : 'Negative'} monthly cashflow`, icon: 'account_balance_wallet', tone: 'text-primary', bgTone: 'bg-blue-50 dark:bg-blue-500/10' },
        { label: 'Budget Health', value: `${Math.max(0, Math.min(100, Math.round(100 - Math.max(0, totalExpense - totalIncome) / Math.max(1, totalIncome) * 100)))}%`, detail: riskBudgets.length ? `${riskBudgets.length} critical budgets` : 'Budgets stable', icon: 'health_and_safety', tone: 'text-teal-500', bgTone: 'bg-teal-50 dark:bg-teal-500/10' },
    ];

    return (
        <div className="p-4 lg:p-8 max-w-[1500px] mx-auto page-enter">
            {isValidating && <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-primary/70 animate-pulse lg:left-64" />}

            {/* ENHANCED HEADER */}
            <div className="mb-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-3">
                        <span className="material-symbols-outlined text-[16px]">insert_chart</span>
                        Financial Overview
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-gray-900 dark:text-white">Executive Dashboard</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-xl">
                        A comprehensive, high-level breakdown of your spending, saving, and cash flow patterns.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 rounded-2xl border-2 border-gray-100 bg-white px-5 py-3.5 text-sm font-bold text-gray-700 shadow-sm transition-all hover:border-primary dark:border-white/5 dark:bg-bg-dark dark:text-gray-200">
                        <span className="material-symbols-outlined text-primary text-[20px]">calendar_month</span>
                        <select value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="bg-transparent outline-none cursor-pointer">
                            {monthOptions.map(option => <option key={option.value} value={option.value} className="bg-white dark:bg-surface-dark">{option.label}</option>)}
                        </select>
                    </label>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3 mb-6">
                {kpis.map((kpi, index) => (
                    <div key={kpi.label} className="card-premium rounded-[2rem] p-8 animate-slide-up hover:-translate-y-1 transition-all border border-gray-100 dark:border-white/5" style={{ animationDelay: `${index * 0.1}s` }}>
                        <div className="flex items-start justify-between mb-8">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-1">{kpi.label}</p>
                                <p className="text-sm font-bold text-gray-500">{kpi.detail}</p>
                            </div>
                            <div className={`grid h-14 w-14 place-items-center rounded-2xl ${kpi.bgTone}`}>
                                <span className={`material-symbols-outlined text-[28px] ${kpi.tone}`}>{kpi.icon}</span>
                            </div>
                        </div>
                        <p className="text-4xl lg:text-5xl font-black tracking-tighter text-gray-900 dark:text-white">
                            {kpi.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* MAIN CHARTS SECTION */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
                <div className="card-premium rounded-[2rem] p-6 lg:col-span-2 border border-gray-100 dark:border-white/5 flex flex-col">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">Monthly Cash Flow</h2>
                            <p className="text-sm text-gray-500 font-medium">Income vs Expenses over time</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold bg-gray-50 dark:bg-white/5 px-4 py-2 rounded-xl">
                            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" /> Income</span>
                            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" /> Expenses</span>
                        </div>
                    </div>
                    <div className="flex-1 min-h-[350px] relative">
                        <Line data={lineData} options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
                                y: { grid: { color: 'rgba(148, 163, 184, 0.1)', tickLength: 0 }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 }, callback: value => sym + Number(value).toLocaleString() } },
                            },
                            interaction: { mode: 'nearest', axis: 'x', intersect: false }
                        }} />
                    </div>
                </div>

                <div className="card-premium rounded-[2rem] p-6 border border-gray-100 dark:border-white/5 flex flex-col">
                    <div className="mb-6">
                        <h2 className="text-xl font-black text-gray-900 dark:text-white">Expense Distribution</h2>
                        <p className="text-sm text-gray-500 font-medium">Where your money goes</p>
                    </div>
                    <div className="relative h-[250px] mb-6 flex-shrink-0">
                        {data.categorySpending.length > 0 ? (
                            <Doughnut data={doughnutData} options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${sym}${ctx.raw}` } } },
                                cutout: '75%',
                            }} />
                        ) : (
                            <div className="grid h-full place-items-center text-center text-gray-400">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-30">pie_chart</span>
                                <p className="text-sm font-bold">No expense data</p>
                            </div>
                        )}
                        {data.categorySpending.length > 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total</span>
                                <span className="text-2xl font-black text-gray-900 dark:text-white">{fmt(categoryTotal)}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                        {data.categorySpending.map(item => {
                            const pct = categoryTotal > 0 ? ((item.total / categoryTotal) * 100).toFixed(1) : 0;
                            const color = getCategoryHex(item.category, customCategories);
                            return (
                                <div key={item.category} className="group">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{item.category}</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">{fmt(item.total)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 w-8 text-right">{pct}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* AI INSIGHTS */}
            <div className="mb-6 card-premium rounded-[2rem] p-8 border border-transparent hover:border-primary/20 bg-gradient-to-br from-white to-primary/5 dark:from-bg-dark dark:to-primary/10 transition-colors">
                <div className="flex items-center gap-3 mb-6">
                    <span className="material-symbols-outlined text-3xl text-primary animate-pulse">auto_awesome</span>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">AI Financial Insights</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-white/5 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-16 h-16 bg-rose-500/10 rounded-bl-full pointer-events-none"></div>
                        <p className="text-xs font-black uppercase tracking-wider text-rose-500 mb-2">Highest Spending Day</p>
                        <p className="text-gray-800 dark:text-gray-200 font-medium text-sm leading-relaxed">
                            {highestDay ? `Your expenses peaked on ${new Date(highestDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ` : 'No clear peak spending day detected.'}
                            {highestDay && <span className="font-black text-rose-600 dark:text-rose-400">{fmt(highestDay.expenses)}</span>}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-white/5 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full pointer-events-none"></div>
                        <p className="text-xs font-black uppercase tracking-wider text-emerald-500 mb-2">Savings Trajectory</p>
                        <p className="text-gray-800 dark:text-gray-200 font-medium text-sm leading-relaxed">
                            {savingsRate > 20 ? `Excellent! You are saving a robust ${savingsRate.toFixed(1)}% of your income.` :
                            savingsRate > 0 ? `You are currently retaining ${savingsRate.toFixed(1)}% of income. Try to aim for 20%.` :
                            'Your expenses have completely outpaced your income this month. Review your budgets.'}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-white/5 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-16 h-16 bg-amber-500/10 rounded-bl-full pointer-events-none"></div>
                        <p className="text-xs font-black uppercase tracking-wider text-amber-500 mb-2">Budget Pressure</p>
                        <p className="text-gray-800 dark:text-gray-200 font-medium text-sm leading-relaxed">
                            {riskBudgets.length > 0 ? `You have ${riskBudgets.length} budget(s) nearing or exceeding their limit: ${riskBudgets.map(r => r.category).join(', ')}.` : 'Great job! All your spending is well within your budget limits.'}
                        </p>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.3); border-radius: 4px; }
            `}</style>
        </div>
    );
}
