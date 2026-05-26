'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useCurrency } from '@/hooks/useCurrency';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

interface DayData {
    date: string;
    total: number;
    count: number;
}

interface HeatmapData {
    year: number;
    dailySpending: DayData[];
    monthlyStats: { month: string; expenses: number; earnings: number }[];
    peakDay: DayData | null;
    totalDaysTracked: number;
}

function getIntensity(amount: number, max: number): number {
    if (amount === 0) return 0;
    if (max === 0) return 0;
    const ratio = amount / max;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
}

const INTENSITY_COLORS = [
    'bg-gray-100 dark:bg-[#161b22]',                     // 0 - no spend
    'bg-emerald-200/60 dark:bg-emerald-500/20',           // 1 - low
    'bg-emerald-300/70 dark:bg-emerald-500/40',           // 2 - medium
    'bg-emerald-400/80 dark:bg-emerald-500/60',           // 3 - high
    'bg-emerald-500 dark:bg-emerald-400',                 // 4 - very high
];

function HeatmapSkeleton() {
    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
            <div className="h-7 w-64 rounded-lg shimmer-skeleton mb-2" />
            <div className="h-4 w-96 rounded-lg shimmer-skeleton mb-8" />
            <div className="skeleton-panel h-[400px] rounded-2xl" />
        </div>
    );
}

export default function SpendingHeatmapPage() {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const { fmt } = useCurrency();
    const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; amount: number; count: number } | null>(null);

    const { data, isLoading } = useSWR<HeatmapData>(`/api/heatmap?year=${year}`);

    // Build the grid: 53 weeks x 7 days
    const grid = useMemo(() => {
        if (!data) return [];

        const spendMap = new Map<string, DayData>();
        data.dailySpending.forEach(d => spendMap.set(d.date, d));

        const maxSpend = Math.max(...data.dailySpending.map(d => d.total), 1);

        // Find the first day of the year
        const jan1 = new Date(year, 0, 1);
        const startDay = jan1.getDay(); // 0=Sun
        const totalDays = 365 + (year % 4 === 0 ? 1 : 0);

        const weeks: { date: string; amount: number; count: number; intensity: number; isToday: boolean }[][] = [];
        let currentWeek: typeof weeks[0] = [];

        // Fill empty slots before Jan 1
        for (let i = 0; i < startDay; i++) {
            currentWeek.push({ date: '', amount: 0, count: 0, intensity: -1, isToday: false });
        }

        const todayStr = new Date().toISOString().split('T')[0];

        for (let d = 0; d < totalDays; d++) {
            const date = new Date(year, 0, d + 1);
            const dateStr = date.toISOString().split('T')[0];
            const dayData = spendMap.get(dateStr);
            const amount = dayData?.total || 0;
            const count = dayData?.count || 0;

            currentWeek.push({
                date: dateStr,
                amount,
                count,
                intensity: getIntensity(amount, maxSpend),
                isToday: dateStr === todayStr,
            });

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }

        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push({ date: '', amount: 0, count: 0, intensity: -1, isToday: false });
            }
            weeks.push(currentWeek);
        }

        return weeks;
    }, [data, year]);

    if (isLoading || !data) return <HeatmapSkeleton />;

    const totalSpent = data.dailySpending.reduce((s, d) => s + d.total, 0);
    const avgDaily = data.totalDaysTracked > 0 ? totalSpent / data.totalDaysTracked : 0;

    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                        <span className="material-symbols-outlined text-emerald-500 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                        Spending Heatmap
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-text-muted mt-1">Visualize your daily spending patterns throughout the year</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setYear(y => y - 1)} className="p-2 rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-surface-dark hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors">
                        <span className="material-symbols-outlined text-lg text-gray-500 dark:text-gray-400">chevron_left</span>
                    </button>
                    <span className="text-lg font-bold text-gray-900 dark:text-white px-3 tabular-nums">{year}</span>
                    <button onClick={() => setYear(y => Math.min(y + 1, currentYear))} disabled={year >= currentYear}
                        className="p-2 rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-surface-dark hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors disabled:opacity-30">
                        <span className="material-symbols-outlined text-lg text-gray-500 dark:text-gray-400">chevron_right</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                {[
                    { label: 'Total Spent', value: fmt(totalSpent), icon: 'payments', color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10' },
                    { label: 'Avg Daily', value: fmt(avgDaily), icon: 'avg_pace', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
                    { label: 'Peak Day', value: data.peakDay ? fmt(data.peakDay.total) : '—', icon: 'trending_up', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
                    { label: 'Days Tracked', value: String(data.totalDaysTracked), icon: 'calendar_month', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
                ].map((s, i) => (
                    <div key={i} className="card-premium rounded-2xl p-4 lg:p-5" style={{ animation: `slideUp 0.4s ease-out ${i * 0.08}s both` }}>
                        <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
                            <span className="material-symbols-outlined text-lg">{s.icon}</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider">{s.label}</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Heatmap Grid */}
            <div className="card-premium rounded-2xl p-6 overflow-x-auto relative" style={{ animation: 'slideUp 0.5s ease-out 0.35s both' }}>
                <div className="min-w-[750px]">
                    {/* Month labels */}
                    <div className="flex ml-10 mb-2">
                        {MONTHS.map((m, i) => (
                            <div key={i} className="text-xs text-gray-400 dark:text-text-muted font-medium" style={{ width: `${100 / 12}%` }}>{m}</div>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="flex gap-1">
                        {/* Day labels */}
                        <div className="flex flex-col gap-1 pr-2 pt-0.5">
                            {DAYS.map((d, i) => (
                                <div key={i} className="text-[10px] text-gray-400 dark:text-text-muted font-medium h-[14px] flex items-center">{d}</div>
                            ))}
                        </div>

                        {/* Weeks */}
                        <div className="flex gap-[3px] flex-1">
                            {grid.map((week, wi) => (
                                <div key={wi} className="flex flex-col gap-[3px]">
                                    {week.map((day, di) => (
                                        <div
                                            key={di}
                                            className={`w-[14px] h-[14px] rounded-[3px] transition-all duration-200 cursor-pointer
                                                ${day.intensity === -1 ? 'invisible' : INTENSITY_COLORS[day.intensity]}
                                                ${day.isToday ? 'ring-2 ring-primary ring-offset-1 ring-offset-white dark:ring-offset-surface-dark' : ''}
                                                hover:ring-2 hover:ring-primary/50 hover:scale-125`}
                                            onMouseEnter={(e) => {
                                                if (day.date) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, date: day.date, amount: day.amount, count: day.count });
                                                }
                                            }}
                                            onMouseLeave={() => setTooltip(null)}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-400 dark:text-text-muted">
                        <span>Less</span>
                        {INTENSITY_COLORS.map((c, i) => (
                            <div key={i} className={`w-[14px] h-[14px] rounded-[3px] ${c}`} />
                        ))}
                        <span>More</span>
                    </div>
                </div>

                {/* Tooltip */}
                {tooltip && (
                    <div className="fixed z-50 px-3 py-2 bg-gray-900 dark:bg-black text-white text-xs rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
                        style={{ left: tooltip.x, top: tooltip.y }}>
                        <p className="font-bold">{new Date(tooltip.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                        <p className="text-white/70 mt-0.5">
                            {tooltip.amount > 0 ? `${fmt(tooltip.amount)} across ${tooltip.count} transaction${tooltip.count > 1 ? 's' : ''}` : 'No spending'}
                        </p>
                    </div>
                )}
            </div>

            {/* Monthly Breakdown */}
            {data.monthlyStats.length > 0 && (
                <div className="card-premium rounded-2xl p-6 mt-6" style={{ animation: 'slideUp 0.5s ease-out 0.45s both' }}>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Monthly Breakdown</h3>
                    <div className="space-y-3">
                        {data.monthlyStats.map((m, i) => {
                            const maxM = Math.max(...data.monthlyStats.map(ms => ms.expenses), 1);
                            return (
                                <div key={i} className="flex items-center gap-4">
                                    <span className="text-xs font-medium text-gray-500 dark:text-text-muted w-16 shrink-0">{MONTHS[parseInt(m.month.split('-')[1]) - 1]} {m.month.split('-')[0].slice(2)}</span>
                                    <div className="flex-1 h-6 bg-gray-100 dark:bg-[#161b22] rounded-lg overflow-hidden relative">
                                        <div className="h-full bg-gradient-to-r from-rose-400 to-rose-500 dark:from-rose-500/60 dark:to-rose-500/40 rounded-lg transition-all duration-700"
                                            style={{ width: `${(m.expenses / maxM) * 100}%` }} />
                                        <span className="absolute inset-0 flex items-center pl-3 text-xs font-bold text-white mix-blend-difference">{fmt(m.expenses)}</span>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-500 w-20 text-right shrink-0">+{fmt(m.earnings)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
