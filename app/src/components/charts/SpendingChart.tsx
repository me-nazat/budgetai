'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useCurrency } from '@/hooks/useCurrency';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { getCategoryIcon, getCategoryHex } from '@/lib/categoryUtils';
import { useCustomCategories } from '@/hooks/useCustomCategories';

export interface SpendingChartProps {
    data?: Array<{ date: string; expenses: number; earnings?: number }>;
    dailySpending?: Array<{ date: string; expenses: number; earnings?: number }>;
    previousMonthDailySpending?: Array<{ date: string; expenses: number; earnings?: number }>;
    categorySpending?: Array<{ category: string; total?: number; amount?: number; percentage?: number; delta?: number }>;
    activeMonth?: string;
    variant?: 'area' | 'bar';
}

const PALETTE = ['#136dec', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#64748b'];

export default function SpendingChart({
    data = [],
    dailySpending,
    previousMonthDailySpending = [],
    categorySpending = [],
    activeMonth,
}: SpendingChartProps) {
    const router = useRouter();
    const { fmt } = useCurrency();
    const { formatAmount } = usePrivacy();
    const { categories: customCats } = useCustomCategories('all');

    const [viewMode, setViewMode] = useState<'trajectory' | 'breakdown'>('trajectory');

    // Resolve active daily spend data (favor dailySpending prop over data)
    const currentDaily = useMemo(() => {
        if (dailySpending && dailySpending.length > 0) return dailySpending;
        return data;
    }, [dailySpending, data]);

    // Derive active month string if not provided (e.g. YYYY-MM from first date or today)
    const resolvedActiveMonth = useMemo(() => {
        if (activeMonth) return activeMonth;
        if (currentDaily.length > 0 && currentDaily[0].date) {
            return currentDaily[0].date.slice(0, 7);
        }
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }, [activeMonth, currentDaily]);

    // Determine current day for cutoff if viewing the active calendar month
    const today = new Date();
    const currentCalendarMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentActiveMonth = resolvedActiveMonth === currentCalendarMonth;
    const currentDayN = today.getDate();

    // Compute cumulative trajectory
    const trajectoryData = useMemo(() => {
        const [y, m] = resolvedActiveMonth.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();

        // Build daily expense maps
        const currentMap = new Map<number, number>();
        currentDaily.forEach((item) => {
            const dayNum = parseInt(item.date.split('-')[2], 10);
            if (!isNaN(dayNum)) {
                currentMap.set(dayNum, (currentMap.get(dayNum) || 0) + (item.expenses || 0));
            }
        });

        const prevMap = new Map<number, number>();
        previousMonthDailySpending.forEach((item) => {
            const dayNum = parseInt(item.date.split('-')[2], 10);
            if (!isNaN(dayNum)) {
                prevMap.set(dayNum, (prevMap.get(dayNum) || 0) + (item.expenses || 0));
            }
        });

        let cumCurrent = 0;
        let cumPrev = 0;
        const result = [];

        for (let d = 1; d <= daysInMonth; d++) {
            cumPrev += prevMap.get(d) || 0;

            const isFutureDayInCurrentMonth = isCurrentActiveMonth && d > currentDayN;
            if (!isFutureDayInCurrentMonth) {
                cumCurrent += currentMap.get(d) || 0;
            }

            result.push({
                day: d,
                label: `Day ${d}`,
                currentSpend: isFutureDayInCurrentMonth ? null : cumCurrent,
                prevSpend: cumPrev,
                diff: isFutureDayInCurrentMonth ? null : cumCurrent - cumPrev,
            });
        }

        return result;
    }, [resolvedActiveMonth, currentDaily, previousMonthDailySpending, isCurrentActiveMonth, currentDayN]);

    // Normalized category spending
    const normalizedCategories = useMemo(() => {
        const totalExpense = categorySpending.reduce((sum, c) => sum + (c.amount ?? c.total ?? 0), 0);
        return categorySpending
            .map((c, idx) => {
                const amount = c.amount ?? c.total ?? 0;
                const percentage = c.percentage ?? (totalExpense > 0 ? (amount / totalExpense) * 100 : 0);
                const delta = c.delta ?? 0;
                const hexColor = getCategoryHex(c.category, customCats) || PALETTE[idx % PALETTE.length];
                return {
                    category: c.category,
                    amount,
                    percentage: Math.round(percentage * 10) / 10,
                    delta,
                    color: hexColor,
                };
            })
            .sort((a, b) => b.amount - a.amount);
    }, [categorySpending, customCats]);

    const handleCategoryClick = (category: string) => {
        const url = `/transactions?category=${encodeURIComponent(category)}&month=${encodeURIComponent(resolvedActiveMonth)}`;
        router.push(url);
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header with Segmented View Switcher */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">
                            {viewMode === 'trajectory' ? 'ssid_chart' : 'donut_small'}
                        </span>
                        {viewMode === 'trajectory' ? 'Spending Burn Trajectory' : 'Category Distribution'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                        {viewMode === 'trajectory'
                            ? 'Cumulative daily run-rate vs last month'
                            : 'Top spending envelopes & month-over-month deltas'}
                    </p>
                </div>

                {/* Segmented Control */}
                <div className="inline-flex items-center p-1 rounded-xl bg-gray-150/70 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setViewMode('trajectory')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                            viewMode === 'trajectory'
                                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[15px]">stacked_line_chart</span>
                        <span>Burn Trajectory</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('breakdown')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                            viewMode === 'breakdown'
                                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[15px]">pie_chart</span>
                        <span>Category Breakdown</span>
                    </button>
                </div>
            </div>

            {/* Viewport Content */}
            <div className="flex-1 min-h-[300px]">
                <AnimatePresence mode="wait">
                    {viewMode === 'trajectory' ? (
                        <motion.div
                            key="trajectory"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="h-full flex flex-col"
                        >
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="activeMonthGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#136dec" stopOpacity={0.25} />
                                                <stop offset="100%" stopColor="#136dec" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                                        <XAxis
                                            dataKey="day"
                                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(val) => `D${val}`}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                                            width={38}
                                        />
                                        <RechartsTooltip
                                            content={({ active, payload }) => {
                                                if (!active || !payload?.length) return null;
                                                const d = payload[0]?.payload;
                                                if (!d) return null;
                                                const currentVal = d.currentSpend;
                                                const prevVal = d.prevSpend;
                                                const diff = d.diff;

                                                return (
                                                    <div className="rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-xl p-3.5 shadow-xl text-xs min-w-[200px]">
                                                        <p className="font-bold text-gray-900 dark:text-white mb-2">
                                                            Day {d.day} of month
                                                        </p>
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                                                    <span className="w-2 h-2 rounded-full bg-primary" />
                                                                    <span>This Month</span>
                                                                </span>
                                                                <span className="font-bold tabular-nums font-mono text-gray-900 dark:text-white">
                                                                    {currentVal !== null ? formatAmount(currentVal, fmt(currentVal)) : '—'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-4">
                                                                <span className="flex items-center gap-1.5 text-gray-400">
                                                                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                                                                    <span>Last Month</span>
                                                                </span>
                                                                <span className="font-bold tabular-nums font-mono text-gray-500 dark:text-gray-400">
                                                                    {formatAmount(prevVal, fmt(prevVal))}
                                                                </span>
                                                            </div>
                                                            {diff !== null && (
                                                                <div className="pt-2 mt-1 border-t border-gray-150 dark:border-white/10 flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                                                        Pace Gap
                                                                    </span>
                                                                    <span
                                                                        className={`text-xs font-bold tabular-nums font-mono ${
                                                                            diff <= 0
                                                                                ? 'text-emerald-500'
                                                                                : 'text-rose-500'
                                                                        }`}
                                                                    >
                                                                        {diff <= 0 ? '−' : '+'}{formatAmount(Math.abs(diff), fmt(Math.abs(diff)))}{' '}
                                                                        ({diff <= 0 ? 'Under' : 'Ahead'})
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        />
                                        {/* Last Month Cumulative (Dashed Slate) */}
                                        <Area
                                            type="monotone"
                                            dataKey="prevSpend"
                                            name="Last Month"
                                            stroke="#64748b"
                                            strokeWidth={2}
                                            strokeDasharray="4 4"
                                            fill="transparent"
                                            isAnimationActive={false}
                                        />
                                        {/* Active Month Cumulative (Solid Indigo) */}
                                        <Area
                                            type="monotone"
                                            dataKey="currentSpend"
                                            name="This Month"
                                            stroke="#136dec"
                                            strokeWidth={2.5}
                                            fill="url(#activeMonthGradient)"
                                            isAnimationActive={true}
                                            animationDuration={800}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Chart Legend Footer */}
                            <div className="flex items-center justify-center gap-6 mt-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-0.5 bg-primary rounded-full" />
                                    <span>Active Month Cumulative</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-0.5 border-t border-dashed border-slate-400" />
                                    <span>Prior Month Same Day</span>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="breakdown"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center"
                        >
                            {/* Donut Summary */}
                            <div className="md:col-span-5 h-[240px] flex items-center justify-center relative">
                                {normalizedCategories.length === 0 ? (
                                    <p className="text-xs text-gray-400">No category spending recorded</p>
                                ) : (
                                    <>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={normalizedCategories}
                                                    dataKey="amount"
                                                    nameKey="category"
                                                    innerRadius={55}
                                                    outerRadius={85}
                                                    paddingAngle={2}
                                                    onClick={(entry: any) => handleCategoryClick(entry?.category || entry?.name)}
                                                    cursor="pointer"
                                                >
                                                    {normalizedCategories.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip
                                                    content={({ active, payload }) => {
                                                        if (!active || !payload?.length) return null;
                                                        const c = payload[0]?.payload;
                                                        return (
                                                            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-xl p-2.5 shadow-xl text-xs">
                                                                <p className="font-bold text-gray-900 dark:text-white">{c.category}</p>
                                                                <p className="tabular-nums font-mono text-primary font-semibold mt-0.5">
                                                                    {formatAmount(c.amount, fmt(c.amount))} ({c.percentage}%)
                                                                </p>
                                                            </div>
                                                        );
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Top Share</span>
                                            <span className="text-base font-black text-gray-900 dark:text-white tabular-nums font-mono">
                                                {normalizedCategories[0]?.percentage || 0}%
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Horizontal Category List with MoM Delta & Drilldown */}
                            <div className="md:col-span-7 space-y-2.5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                                {normalizedCategories.length === 0 ? (
                                    <p className="text-xs text-gray-400">No categories to display</p>
                                ) : (
                                    normalizedCategories.map((c) => (
                                        <button
                                            key={c.category}
                                            type="button"
                                            onClick={() => handleCategoryClick(c.category)}
                                            className="w-full text-left p-2.5 rounded-xl border border-gray-150/70 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] hover:bg-primary/5 hover:border-primary/30 transition-all group"
                                            title="Click to inspect category transactions"
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span
                                                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-white text-xs"
                                                        style={{ backgroundColor: c.color }}
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">
                                                            {getCategoryIcon(c.category, customCats)}
                                                        </span>
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">
                                                        {c.category}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span
                                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums font-mono ${
                                                            c.delta > 0
                                                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                                                : c.delta < 0
                                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
                                                        }`}
                                                    >
                                                        {c.delta > 0 ? `+${c.delta}%` : `${c.delta}%`} MoM
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums font-mono">
                                                        {formatAmount(c.amount, fmt(c.amount))}
                                                    </span>
                                                    <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-sm group-hover:text-primary transition-colors">
                                                        chevron_right
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Bar Progress */}
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 rounded-full bg-gray-200/80 dark:bg-white/10 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min(100, c.percentage)}%`, backgroundColor: c.color }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-semibold text-gray-400 tabular-nums font-mono shrink-0">
                                                    {c.percentage}%
                                                </span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
