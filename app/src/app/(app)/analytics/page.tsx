'use client';

import { useState, useRef } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import { useDashboard } from '@/hooks/useApi';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, LineElement, PointElement,
    Title, Tooltip, Legend, Filler, ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import TrophyRoom from '@/components/charts/TrophyRoom';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler, ArcElement);

const categoryColors: Record<string, string> = {
    Food: '#f97316', Transport: '#14b8a6', Housing: '#3b82f6', Utilities: '#eab308',
    Entertainment: '#ec4899', Shopping: '#6366f1', Health: '#10b981', Education: '#06b6d4',
    Business: '#0ea5e9', Savings: '#22c55e', Salary: '#14b8a6', Other: '#6b7280',
};

export default function AnalyticsPage() {
    const chartRef = useRef(null);
    const { currency, fmt } = useCurrency();
    const sym = CURRENCIES[currency].symbol;

    const [selectedMonth] = useState<string>(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    );

    const { data, isLoading } = useDashboard(selectedMonth, 'all');

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#21262d' : '#e5e7eb';
    const tickColor = isDark ? '#8b949e' : '#6b7280';

    if (!data && isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-400 dark:text-text-muted">Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (!data) return <div className="p-8 text-gray-500">Failed to load analytics</div>;

    const totalIncome = data.earnings.current;
    const totalExpense = data.expenses.current;
    const netSavings = data.netSavings;
    const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100) : 0;

    // Bar chart — last 6 months simulation using daily data
    const barData = {
        labels: data.dailySpending.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [
            { label: 'Expense', data: data.dailySpending.map(d => d.expenses), backgroundColor: '#ef4444', borderRadius: 4, borderSkipped: false as const },
            { label: 'Income', data: data.dailySpending.map(d => d.earnings), backgroundColor: '#10b981', borderRadius: 4, borderSkipped: false as const },
        ],
    };

    // Doughnut chart
    const doughnutData = {
        labels: data.categorySpending.map(c => c.category.charAt(0).toUpperCase() + c.category.slice(1).toLowerCase()),
        datasets: [{
            data: data.categorySpending.map(c => c.total),
            backgroundColor: data.categorySpending.map(c => {
                const cat = c.category.charAt(0).toUpperCase() + c.category.slice(1).toLowerCase();
                return categoryColors[cat] || '#6b7280';
            }),
            borderWidth: 0,
            spacing: 3,
        }],
    };

    // Top expenses sorted
    const topExpenses = [...data.categorySpending].sort((a, b) => b.total - a.total);

    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
            {/* Mobile Header */}
            <div className="flex items-center gap-3 mb-6 lg:mb-8">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Analytics</h2>
            </div>

            {/* Summary Cards Row */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="card-premium p-4 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-emerald-500 text-lg">trending_up</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-500 dark:text-text-muted">Total Income</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{fmt(totalIncome)}</p>
                </div>
                <div className="card-premium p-4 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-rose-500 text-lg">trending_down</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-500 dark:text-text-muted">Total Expense</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{fmt(totalExpense)}</p>
                </div>
            </div>

            {/* Net Savings + Savings Rate */}
            <div className="card-premium p-4 rounded-2xl mb-6 bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-500/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{sym}</span>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-text-muted">Net Savings</p>
                            <p className={`text-xl font-bold ${netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                {fmt(netSavings)}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-semibold text-gray-500 dark:text-text-muted">Savings Rate</p>
                        <p className={`text-xl font-bold ${savingsRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                            {savingsRate.toFixed(1)}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="card-premium p-5 rounded-2xl mb-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Income vs Expense</h3>
                <p className="text-xs text-gray-500 dark:text-text-muted mb-4">Daily breakdown for current period</p>
                <div className="h-[220px] lg:h-[300px]">
                    <Bar ref={chartRef} data={barData} options={{
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' as const, labels: { color: tickColor, usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11 } } },
                            tooltip: { backgroundColor: isDark ? '#161b22' : '#fff', titleColor: isDark ? '#f0f6fc' : '#1f2937', bodyColor: isDark ? '#8b949e' : '#6b7280', borderColor: isDark ? '#30363d' : '#e5e7eb', borderWidth: 1, padding: 10, cornerRadius: 8 },
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: tickColor, maxTicksLimit: 6, font: { size: 10 } } },
                            y: { grid: { color: gridColor, lineWidth: 0.5 }, ticks: { color: tickColor, callback: (v) => sym + v, font: { size: 10 } }, border: { display: false } },
                        },
                    }} />
                </div>
            </div>

            {/* Doughnut Chart */}
            {data.categorySpending.length > 0 && (
                <div className="card-premium p-5 rounded-2xl mb-6">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Spending by Category</h3>
                    <div className="h-[220px] lg:h-[280px]">
                        <Doughnut data={doughnutData} options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: {
                                legend: { position: 'bottom' as const, labels: { color: tickColor, usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
                                tooltip: { backgroundColor: isDark ? '#161b22' : '#fff', titleColor: isDark ? '#f0f6fc' : '#1f2937', bodyColor: isDark ? '#8b949e' : '#6b7280', borderColor: isDark ? '#30363d' : '#e5e7eb', borderWidth: 1, padding: 10, cornerRadius: 8 },
                            },
                            cutout: '65%',
                        }} />
                    </div>
                </div>
            )}

            {/* Gamification / Trophy Room */}
            <div className="mb-6">
                <TrophyRoom 
                    transactionsCount={data.totalTransactions || data.recentTransactions.length}
                    savingsRate={savingsRate}
                    monthsActive={1} 
                    budgetAlertsAvoided={data.budgetAlerts.length === 0}
                />
            </div>

            {/* Top Expenses */}
            {topExpenses.length > 0 && (
                <div className="card-premium rounded-2xl overflow-hidden mb-6">
                    <div className="p-5 border-b border-gray-200 dark:border-[#30363d]">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Top Expenses</h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-[#21262d]">
                        {topExpenses.slice(0, 8).map((cat, i) => {
                            const catName = cat.category.charAt(0).toUpperCase() + cat.category.slice(1).toLowerCase();
                            const color = categoryColors[catName] || '#6b7280';
                            return (
                                <div key={i} className="flex items-center justify-between px-5 py-3.5">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                                            style={{ backgroundColor: color + '18' }}
                                        >
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                        </div>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">{catName}</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{fmt(cat.total)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
