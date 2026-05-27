'use client';

import { useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import AsyncDayDetailPopup from './AsyncDayDetailPopup';

interface DayData {
    date: string;
    earnings: number;
    expenses: number;
    count: number;
}

function getIntensity(amount: number, thresholds: number[]): number {
    if (amount === 0) return 0;
    if (amount >= thresholds[2]) return 4;
    if (amount >= thresholds[1]) return 3;
    if (amount >= thresholds[0]) return 2;
    return 1;
}

function calculateThresholds(amounts: number[]) {
    const nonZero = amounts.filter(a => a > 0).sort((a, b) => a - b);
    if (nonZero.length === 0) return [0, 0, 0];
    return [
        nonZero[Math.floor(nonZero.length * 0.25)],
        nonZero[Math.floor(nonZero.length * 0.50)],
        nonZero[Math.floor(nonZero.length * 0.75)],
    ];
}

const GREEN_INTENSITY = [
    'bg-gray-100 dark:bg-[#161b22]',
    'bg-emerald-200/60 dark:bg-emerald-500/20',
    'bg-emerald-300 dark:bg-emerald-500/40',
    'bg-emerald-500 dark:bg-emerald-500/70',
    'bg-emerald-600 dark:bg-emerald-400',
];

const RED_INTENSITY = [
    'bg-gray-100 dark:bg-[#161b22]',
    'bg-rose-200/60 dark:bg-rose-500/20',
    'bg-rose-300 dark:bg-rose-500/40',
    'bg-rose-500 dark:bg-rose-500/70',
    'bg-rose-600 dark:bg-rose-400',
];

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
    const [mode, setMode] = useState<'earnings' | 'expenses'>('earnings');
    const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; amount: number; count: number } | null>(null);
    const [popupTarget, setPopupTarget] = useState<{ element: HTMLElement; date: string } | null>(null);

    const { grid } = useMemo(() => {
        const spendMap = new Map<string, DayData>();
        dailySpending.forEach(d => spendMap.set(d.date, d));

        const amounts = dailySpending.map(d => mode === 'earnings' ? d.earnings : d.expenses);
        const calcThresholds = calculateThresholds(amounts);

        const firstDay = new Date(year, month - 1, 1);
        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // 0=Mon
        const daysInMonth = new Date(year, month, 0).getDate();

        // Construct a single flat list of days representing a calendar view:
        // Mon Tue Wed Thu Fri Sat Sun running horizontally
        const daysList: { date: string; amount: number; count: number; intensity: number; isToday: boolean }[] = [];

        // Pad first week with empty days
        for (let r = 0; r < startDay; r++) {
            daysList.push({ date: '', amount: 0, count: 0, intensity: -1, isToday: false });
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayData = spendMap.get(dateStr);
            const amount = dayData ? (mode === 'earnings' ? dayData.earnings : dayData.expenses) : 0;
            const count = dayData?.count || 0;

            daysList.push({
                date: dateStr,
                amount,
                count,
                intensity: getIntensity(amount, calcThresholds),
                isToday: dateStr === todayStr,
            });
        }

        // Pad the last week to align complete 7-day rows
        while (daysList.length % 7 !== 0) {
            daysList.push({ date: '', amount: 0, count: 0, intensity: -1, isToday: false });
        }

        return { grid: daysList, thresholds: calcThresholds };
    }, [year, month, dailySpending, mode]);

    const colors = mode === 'earnings' ? GREEN_INTENSITY : RED_INTENSITY;

    return (
        <div className="card-premium rounded-2xl p-6 h-full border border-gray-200 dark:border-white/5 bg-white dark:bg-[#111827] flex flex-col relative z-0">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500">grid_on</span>
                    Monthly Activity
                </h3>
                
                {/* iOS Liquid Glass Toggle */}
                <div className="relative flex items-center p-1 bg-gray-100/80 dark:bg-black/40 backdrop-blur-md rounded-full shadow-inner border border-gray-200/50 dark:border-white/10">
                    <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white dark:bg-[#21262d] shadow-sm transition-transform duration-300 ease-spring ${mode === 'expenses' ? 'translate-x-full ml-1' : 'translate-x-0'}`} />
                    <button onClick={() => setMode('earnings')} className={`relative z-10 px-4 py-1.5 text-xs font-bold transition-colors ${mode === 'earnings' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Earnings</button>
                    <button onClick={() => setMode('expenses')} className={`relative z-10 px-4 py-1.5 text-xs font-bold transition-colors ${mode === 'expenses' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Expenses</button>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center relative min-h-0">
                <div className="w-full max-w-[240px]">
                    {/* Horizontal headers (Mon - Sun) */}
                    <div className="grid grid-cols-7 gap-2.5 mb-3 text-center">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                            <div key={i} className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{d}</div>
                        ))}
                    </div>

                    {/* Flat Grid in 7 Columns */}
                    <div className="grid grid-cols-7 gap-2.5">
                        {grid.map((day, index) => (
                            <div
                                key={index}
                                className={`w-[26px] h-[26px] rounded-[6px] transition-all duration-300 shadow-sm border border-black/5 dark:border-white/5
                                    ${day.intensity === -1 ? 'invisible' : colors[day.intensity]}
                                    ${day.isToday ? 'ring-2 ring-primary/60 scale-105' : ''}
                                    hover:ring-2 hover:ring-primary/40 hover:scale-115 relative cursor-pointer z-0 hover:z-10`}
                                onClick={(e) => {
                                    if (day.date) {
                                        setPopupTarget({ element: e.currentTarget, date: day.date });
                                    }
                                }}
                                onMouseEnter={(e) => {
                                    if (day.date && !popupTarget) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, date: day.date, amount: day.amount, count: day.count });
                                    }
                                }}
                                onMouseLeave={() => setTooltip(null)}
                            />
                        ))}
                    </div>
                </div>
                
                {tooltip && !popupTarget && (
                    <div className="fixed z-50 px-3 py-2 bg-gray-900 dark:bg-[#21262d] border border-gray-700 dark:border-white/10 text-white text-xs rounded-xl shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
                        style={{ left: tooltip.x, top: tooltip.y }}>
                        <p className="font-bold mb-1 text-center">{new Date(tooltip.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        <div className={`px-2 py-1 rounded-md bg-white/10 font-medium flex flex-col items-center`}>
                            <span className="text-white/70 text-[10px] uppercase tracking-wider">{mode === 'earnings' ? 'Total Income' : 'Total Expense'}</span>
                            <span className={`text-sm font-bold ${mode === 'earnings' ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(tooltip.amount)}</span>
                        </div>
                    </div>
                )}
            </div>

            {popupTarget && (
                <AsyncDayDetailPopup
                    date={popupTarget.date}
                    anchorEl={popupTarget.element}
                    onClose={() => setPopupTarget(null)}
                />
            )}
            
            <div className="flex items-center justify-center gap-2 mt-6 text-[11px] text-gray-400">
                <span>Less</span>
                {colors.map((c, i) => (
                    <div key={i} className={`w-[12px] h-[12px] rounded-sm transition-colors duration-300 shadow-sm ${c}`} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}
