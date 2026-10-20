'use client';

import React, { useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import DayDetailPopup from './DayDetailPopup';

interface DayData {
    date: string;
    earnings: number;
    expenses: number;
    count?: number;
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
    'bg-gray-100 dark:bg-[#161b22] text-gray-400',
    'bg-emerald-200/60 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200',
    'bg-emerald-300 dark:bg-emerald-500/40 text-emerald-900 dark:text-emerald-100',
    'bg-emerald-500 dark:bg-emerald-500/70 text-white',
    'bg-emerald-600 dark:bg-emerald-400 text-white dark:text-black',
];

const RED_INTENSITY = [
    'bg-gray-100 dark:bg-[#161b22] text-gray-400',
    'bg-rose-200/60 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200',
    'bg-rose-300 dark:bg-rose-500/40 text-rose-900 dark:text-rose-100',
    'bg-rose-500 dark:bg-rose-500/70 text-white',
    'bg-rose-600 dark:bg-rose-400 text-white dark:text-black',
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MonthlyHeatmap({
    year,
    month,
    dailySpending,
}: {
    year: number;
    month: number;
    dailySpending: DayData[];
}) {
    const { fmt } = useCurrency();
    const [mode, setMode] = useState<'earnings' | 'expenses'>('expenses');
    const [popupTarget, setPopupTarget] = useState<{ element: HTMLElement; date: string } | null>(null);

    const { grid, zeroSpendDaysCount } = useMemo(() => {
        const spendMap = new Map<string, DayData>();
        dailySpending.forEach((d) => spendMap.set(d.date, d));

        const amounts = dailySpending.map((d) => (mode === 'earnings' ? d.earnings : d.expenses));
        const { thresholds, median } = calculateQuartiles(amounts);
        const outlierCutoff = median > 0 ? median * 2.5 : 0;

        const firstDay = new Date(year, month - 1, 1);
        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // 0=Mon
        const daysInMonth = new Date(year, month, 0).getDate();

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const days = [];
        let zeroSpendCount = 0;

        // Pad first week offset
        for (let i = 0; i < startDay; i++) {
            days.push({
                date: '',
                amount: 0,
                count: 0,
                intensity: -1,
                isToday: false,
                isZeroSpend: false,
                isOutlier: false,
                dayNum: '',
            });
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayData = spendMap.get(dateStr);
            const amount = dayData ? (mode === 'earnings' ? dayData.earnings : dayData.expenses) : 0;
            const count = dayData?.count || 0;

            const isZeroSpend = amount === 0 && dateStr <= todayStr;
            if (isZeroSpend && mode === 'expenses') {
                zeroSpendCount++;
            }

            const isOutlier = mode === 'expenses' && outlierCutoff > 0 && amount > outlierCutoff;

            days.push({
                date: dateStr,
                amount,
                count,
                intensity: getIntensity(amount, thresholds),
                isToday: dateStr === todayStr,
                isZeroSpend,
                isOutlier,
                dayNum: String(d),
            });
        }

        return {
            grid: days,
            zeroSpendDaysCount: zeroSpendCount,
        };
    }, [year, month, dailySpending, mode]);

    const colors = mode === 'earnings' ? GREEN_INTENSITY : RED_INTENSITY;

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header with Title, Mode Switcher, and Zero-Spend Days Badge */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">calendar_month</span>
                        <span>Calendar Heatmap</span>
                    </h3>

                    {mode === 'expenses' && zeroSpendDaysCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm" />
                            <span>{zeroSpendDaysCount} Zero-Spend Days</span>
                        </span>
                    )}
                </div>

                {/* Earnings vs Expenses Pill Switcher */}
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
            </div>

            {/* Calendar Grid Container */}
            <div className="flex-1 flex flex-col justify-center items-center w-full">
                <div className="w-full max-w-[540px]">
                    {/* Days of Week Header */}
                    <div className="grid grid-cols-7 gap-2 mb-2">
                        {DAYS_OF_WEEK.map((d) => (
                            <div key={d} className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Month Days Grid */}
                    <div className="grid grid-cols-7 gap-2">
                        {grid.map((day, i) => {
                            if (day.intensity === -1) {
                                return <div key={i} className="aspect-square invisible" />;
                            }

                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={(e) => {
                                        if (day.date) {
                                            setPopupTarget({ element: e.currentTarget, date: day.date });
                                        }
                                    }}
                                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center font-bold text-xs transition-all duration-200 relative group cursor-pointer border ${
                                        colors[day.intensity]
                                    } ${
                                        day.isOutlier
                                            ? 'border-2 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                                            : 'border-black/5 dark:border-white/5'
                                    } ${
                                        day.isToday ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-[#161b22]' : ''
                                    } hover:scale-105 hover:z-20 hover:shadow-lg`}
                                    title={day.isOutlier ? 'High spending outlier (>2.5x median)' : undefined}
                                >
                                    <span>{day.dayNum}</span>

                                    {/* Subtle emerald dot for Zero-Spend Days */}
                                    {day.isZeroSpend && mode === 'expenses' && (
                                        <span
                                            className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute bottom-1.5 shadow-[0_0_4px_#10b981]"
                                            title="Zero-Spend Day"
                                        />
                                    )}

                                    {/* Outlier indicator dot */}
                                    {day.isOutlier && (
                                        <span
                                            className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-1.5 right-1.5 shadow-[0_0_4px_#f43f5e]"
                                            title="Spending Outlier"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Quartile Legend Footer */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-150 dark:border-white/5 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[11px]">Zero-Spend Day</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold">Less</span>
                    <div className="flex items-center gap-1">
                        {colors.map((c, idx) => (
                            <div
                                key={idx}
                                className={`w-3.5 h-3.5 rounded-md border border-black/5 dark:border-white/5 ${c.split(' ')[0]}`}
                            />
                        ))}
                    </div>
                    <span className="text-[11px] font-semibold">More</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-md border-2 border-rose-500" />
                    <span className="text-[11px]">Outlier (&gt;2.5x)</span>
                </div>
            </div>

            {/* Interactive Day Detail Drilldown Popup */}
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
