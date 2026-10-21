'use client';

import React, { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useCurrency } from '@/hooks/useCurrency';
import DayDetailPopup from './DayDetailPopup';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

interface DayData {
    date: string;
    total: number;
    count: number;
}

interface HeatmapData {
    year: number;
    dailySpending: DayData[];
    dailyEarnings: DayData[];
    monthlyStats: { month: string; expenses: number; earnings: number }[];
    peakDay: DayData | null;
    totalDaysTracked: number;
    zeroSpendDaysCount?: number;
    quartiles?: number[];
    median?: number;
    outlierThreshold?: number;
}

function getIntensity(amount: number, thresholds: number[]): number {
    if (amount === 0) return 0;
    if (amount >= thresholds[2]) return 4;
    if (amount >= thresholds[1]) return 3;
    if (amount >= thresholds[0]) return 2;
    return 1;
}

function calculateQuartiles(amounts: number[]) {
    const nonZero = amounts.filter((a) => a > 0).sort((a, b) => a - b);
    if (nonZero.length === 0) return { thresholds: [0, 0, 0], median: 0 };
    const len = nonZero.length;
    const q1 = nonZero[Math.floor(len * 0.25)];
    const median = nonZero[Math.floor(len * 0.50)];
    const q3 = nonZero[Math.floor(len * 0.75)];
    return {
        thresholds: [q1, median, q3],
        median,
    };
}

const GREEN_INTENSITY = [
    'bg-gray-100 dark:bg-white/[0.04]',
    'bg-emerald-200/60 dark:bg-emerald-500/20',
    'bg-emerald-300 dark:bg-emerald-500/40',
    'bg-emerald-500 dark:bg-emerald-500/70',
    'bg-emerald-600 dark:bg-emerald-400',
];

const RED_INTENSITY = [
    'bg-gray-100 dark:bg-white/[0.04]',
    'bg-rose-200/60 dark:bg-rose-500/20',
    'bg-rose-300 dark:bg-rose-500/40',
    'bg-rose-500 dark:bg-rose-500/70',
    'bg-rose-600 dark:bg-rose-400',
];

interface HeatmapSquareProps {
    day: {
        date: string;
        amount: number;
        count: number;
        intensity: number;
        isToday: boolean;
        isOutlier: boolean;
        isZeroSpend: boolean;
    };
    colorClass: string;
    mode: 'earnings' | 'expenses';
    fmt: (val: number) => string;
    onClick: (element: HTMLElement, date: string) => void;
}

const HeatmapSquare = React.memo(function HeatmapSquare({
    day,
    colorClass,
    mode,
    fmt,
    onClick,
}: HeatmapSquareProps) {
    if (day.intensity === -1) {
        return <div className="w-[14px] h-[14px] invisible" />;
    }

    return (
        <div
            className={`w-[14px] h-[14px] rounded-sm transition-all duration-200 shadow-sm relative cursor-pointer group z-10 hover:z-50
                ${colorClass}
                ${day.isOutlier ? 'border border-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]' : ''}
                ${day.isToday ? 'ring-1 ring-primary' : ''}
                hover:ring-2 hover:ring-primary/60 hover:scale-[1.35]`}
            onClick={(e) => {
                if (day.date) {
                    onClick(e.currentTarget, day.date);
                }
            }}
        >
            {day.date && (
                <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-max px-3 py-2 bg-gray-900 dark:bg-[#12182B] border border-gray-700 dark:border-white/10 text-white text-xs rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 pointer-events-none z-[9999]">
                    <p className="font-bold mb-1 text-center text-gray-300">
                        {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                        })}
                    </p>
                    <div className="px-2 py-1 rounded-md bg-white/10 font-medium flex flex-col items-center">
                        <span className="text-white/70 text-[10px] uppercase tracking-wider">
                            {mode === 'earnings' ? 'Income' : 'Expense'}
                        </span>
                        <span
                            className={`text-sm font-bold tabular-nums font-mono ${
                                mode === 'earnings' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                        >
                            {fmt(day.amount)}
                        </span>
                    </div>
                    {day.isOutlier && (
                        <p className="mt-1 text-[10px] text-rose-300 font-bold text-center">
                            Outlier (&gt;2.5x median)
                        </p>
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-gray-900 dark:border-t-[#12182B]"></div>
                </div>
            )}
        </div>
    );
});

export default function YearlyHeatmap() {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const { fmt } = useCurrency();
    const [mode, setMode] = useState<'earnings' | 'expenses'>('expenses');
    const [popupTarget, setPopupTarget] = useState<{ element: HTMLElement; date: string } | null>(null);

    const handleSquareClick = useCallback((element: HTMLElement, date: string) => {
        setPopupTarget({ element, date });
    }, []);

    const { data, isLoading } = useSWR<HeatmapData>(`/api/heatmap?year=${year}`);

    // Build the grid: 53 weeks x 7 days
    const { grid, monthLabels, zeroSpendCount } = useMemo(() => {
        if (!data) return { grid: [], monthLabels: [], zeroSpendCount: 0 };

        const spendMap = new Map<string, DayData>();
        const targetData = mode === 'earnings' ? (data.dailyEarnings || []) : (data.dailySpending || []);
        targetData.forEach((d) => spendMap.set(d.date, d));

        const amounts = targetData.map((d) => d.total);
        const { thresholds, median } = calculateQuartiles(amounts);
        const outlierCutoff = median > 0 ? median * 2.5 : 0;

        const jan1 = new Date(year, 0, 1);
        const startDay = jan1.getDay() === 0 ? 6 : jan1.getDay() - 1; // 0=Mon
        const totalDays = 365 + (year % 4 === 0 ? 1 : 0);

        const weeks: Array<
            Array<{
                date: string;
                amount: number;
                count: number;
                intensity: number;
                isToday: boolean;
                isOutlier: boolean;
                isZeroSpend: boolean;
            }>
        > = [];
        let currentWeek: (typeof weeks)[0] = [];

        for (let i = 0; i < startDay; i++) {
            currentWeek.push({
                date: '',
                amount: 0,
                count: 0,
                intensity: -1,
                isToday: false,
                isOutlier: false,
                isZeroSpend: false,
            });
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        let zeroCount = 0;

        for (let d = 0; d < totalDays; d++) {
            const date = new Date(year, 0, d + 1);
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const dayNum = String(date.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${dayNum}`;
            const dayData = spendMap.get(dateStr);
            const amount = dayData?.total || 0;
            const count = dayData?.count || 0;

            const isZeroSpend = amount === 0 && dateStr <= todayStr;
            if (isZeroSpend && mode === 'expenses') {
                zeroCount++;
            }

            const isOutlier = mode === 'expenses' && outlierCutoff > 0 && amount > outlierCutoff;

            currentWeek.push({
                date: dateStr,
                amount,
                count,
                intensity: getIntensity(amount, thresholds),
                isToday: dateStr === todayStr,
                isOutlier,
                isZeroSpend,
            });

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }

        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push({
                    date: '',
                    amount: 0,
                    count: 0,
                    intensity: -1,
                    isToday: false,
                    isOutlier: false,
                    isZeroSpend: false,
                });
            }
            weeks.push(currentWeek);
        }

        const monthOffsets: number[] = [];
        for (let m = 0; m < 12; m++) {
            const date = new Date(year, m, 1);
            const start = new Date(year, 0, 1);
            const diff = date.getTime() - start.getTime();
            const dayOfYear = Math.round(diff / (1000 * 60 * 60 * 24));
            const col = Math.floor((dayOfYear + startDay) / 7);
            monthOffsets.push(col * 17); // 14px width + 3px gap
        }

        return {
            grid: weeks,
            monthLabels: monthOffsets,
            zeroSpendCount: zeroCount,
        };
    }, [data, year, mode]);

    if (isLoading || !data) {
        return (
            <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const colors = mode === 'earnings' ? GREEN_INTENSITY : RED_INTENSITY;
    const targetData = mode === 'earnings' ? (data.dailyEarnings || []) : (data.dailySpending || []);
    const totalAmount = targetData.reduce((s, d) => s + d.total, 0);

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header with Title, Mode Switcher, and Year Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">calendar_view_month</span>
                        <span>12-Month Annual Activity</span>
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                        Yearly financial pulse across 52 weeks
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Mode Switcher */}
                    <div className="relative flex items-center p-1 bg-gray-150/70 dark:bg-white/5 backdrop-blur-md rounded-xl border border-gray-200/80 dark:border-white/10 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setMode('expenses')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                mode === 'expenses'
                                    ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            Expenses
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('earnings')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                mode === 'earnings'
                                    ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            Income
                        </button>
                    </div>

                    {/* Year Selector */}
                    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 rounded-xl p-1">
                        <button
                            type="button"
                            onClick={() => setYear((y) => y - 1)}
                            className="p-1 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                            title="Previous Year"
                        >
                            <span className="material-symbols-outlined text-sm leading-none">chevron_left</span>
                        </button>
                        <span className="font-bold text-xs text-gray-900 dark:text-white px-2 tabular-nums font-mono">
                            {year}
                        </span>
                        <button
                            type="button"
                            onClick={() => setYear((y) => Math.min(y + 1, currentYear))}
                            disabled={year >= currentYear}
                            className="p-1 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-30"
                            title="Next Year"
                        >
                            <span className="material-symbols-outlined text-sm leading-none">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Scrollable Yearly Heatmap Grid */}
            <div className="overflow-x-auto pb-2 custom-scrollbar">
                <div className="min-w-[760px]">
                    {/* Month Labels */}
                    <div className="ml-8 mb-2 relative h-4">
                        {MONTHS.map((m, i) => (
                            <div
                                key={i}
                                className="absolute text-[10px] text-gray-400 font-bold uppercase tracking-wider"
                                style={{ left: `${monthLabels[i] || 0}px` }}
                            >
                                {m}
                            </div>
                        ))}
                    </div>

                    {/* Grid with Week Columns */}
                    <div className="flex gap-2">
                        <div className="flex flex-col gap-1 pr-2 pt-0.5 w-6 shrink-0">
                            {DAYS.map((d, i) => (
                                <div
                                    key={i}
                                    className="text-[9px] text-gray-400 font-bold uppercase tracking-wider h-[14px] flex items-center justify-end"
                                >
                                    {d}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-1 flex-1 relative">
                            {grid.map((week, wi) => (
                                <div key={wi} className="flex flex-col gap-1 relative z-10 hover:z-50">
                                    {week.map((day, di) => (
                                        <HeatmapSquare
                                            key={di}
                                            day={day}
                                            colorClass={day.intensity === -1 ? 'invisible' : colors[day.intensity]}
                                            mode={mode}
                                            fmt={fmt}
                                            onClick={handleSquareClick}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Summary with Total & Quartile Legend */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-150 dark:border-white/5 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Total {mode} in {year}:</span>
                    <span className="font-bold text-gray-900 dark:text-white tabular-nums font-mono">
                        {fmt(totalAmount)}
                    </span>
                    {mode === 'expenses' && zeroSpendCount > 0 && (
                        <span className="ml-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            • {zeroSpendCount} Zero-Spend Days
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold">Less</span>
                    <div className="flex items-center gap-1">
                        {colors.map((c, i) => (
                            <div
                                key={i}
                                className={`w-3.5 h-3.5 rounded-sm border border-black/5 dark:border-white/5 ${c.split(' ')[0]}`}
                            />
                        ))}
                    </div>
                    <span className="text-[11px] font-semibold">More</span>
                </div>
            </div>

            {/* Day Detail Drilldown Popup */}
            {popupTarget && (
                <DayDetailPopup
                    date={popupTarget.date}
                    anchorEl={popupTarget.element}
                    onClose={() => setPopupTarget(null)}
                />
            )}
        </div>
    );
}
