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

    const { grid, thresholds } = useMemo(() => {
        const spendMap = new Map<string, DayData>();
        dailySpending.forEach(d => spendMap.set(d.date, d));

        const amounts = dailySpending.map(d => mode === 'earnings' ? d.earnings : d.expenses);
        const calcThresholds = calculateThresholds(amounts);

        const firstDay = new Date(year, month - 1, 1);
        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // 0=Mon
        const daysInMonth = new Date(year, month, 0).getDate();

        // Construct grid horizontally
        const days = [];
        
        // Pad first week
        for (let i = 0; i < startDay; i++) {
            days.push({ date: '', amount: 0, count: 0, intensity: -1, isToday: false, dayNum: '' });
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayData = spendMap.get(dateStr);
            const amount = dayData ? (mode === 'earnings' ? dayData.earnings : dayData.expenses) : 0;
            const count = dayData?.count || 0;

            days.push({
                date: dateStr,
                amount,
                count,
                intensity: getIntensity(amount, calcThresholds),
                isToday: dateStr === todayStr,
                dayNum: String(d)
            });
        }

        return { grid: days, thresholds: calcThresholds };
    }, [year, month, dailySpending, mode]);

    const colors = mode === 'earnings' ? GREEN_INTENSITY : RED_INTENSITY;

    return (
        <div className="glass-panel rounded-3xl p-6 h-full border border-white/10 dark:border-white/5 bg-white/40 dark:bg-black/40 flex flex-col relative z-0 backdrop-blur-2xl">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
                    Calendar View
                </h3>
                
                {/* iOS Liquid Glass Toggle */}
                <div className="relative flex items-center p-1 bg-gray-200/50 dark:bg-white/5 backdrop-blur-md rounded-full shadow-inner border border-gray-300/30 dark:border-white/10">
                    <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white dark:bg-[#21262d] shadow-md transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${mode === 'expenses' ? 'translate-x-full ml-1' : 'translate-x-0'}`} />
                    <button onClick={() => setMode('earnings')} className={`relative z-10 px-4 py-1.5 text-[11px] uppercase tracking-wider font-bold transition-colors duration-300 ${mode === 'earnings' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Earnings</button>
                    <button onClick={() => setMode('expenses')} className={`relative z-10 px-4 py-1.5 text-[11px] uppercase tracking-wider font-bold transition-colors duration-300 ${mode === 'expenses' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Expenses</button>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center relative min-h-0 w-full">
                <div className="w-full max-w-[500px]">
                    {/* Days of Week Header */}
                    <div className="grid grid-cols-7 gap-2 mb-3">
                        {DAYS_OF_WEEK.map(d => (
                            <div key={d} className="text-center text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-2">
                        {grid.map((day, i) => (
                            <div
                                key={i}
                                className={`aspect-square rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm border border-black/5 dark:border-white/5 group relative cursor-pointer z-0
                                    ${day.intensity === -1 ? 'invisible' : colors[day.intensity]}
                                    ${day.isToday ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-[#111114]' : ''}
                                    hover:ring-2 hover:ring-primary/40 hover:scale-110 hover:shadow-xl hover:z-20`}
                                style={{ animationDelay: `${i * 15}ms` }}
                                onClick={(e) => {
                                    if (day.date) {
                                        setPopupTarget({ element: e.currentTarget, date: day.date });
                                    }
                                }}
                            >
                                {day.dayNum}
                                
                                {/* Pure CSS Tooltip (Zero lag) */}
                                {day.date && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-2 bg-gray-900 dark:bg-[#21262d] border border-gray-700 dark:border-white/10 text-white text-xs rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none z-50">
                                        <p className="font-bold mb-1 text-center text-gray-300">
                                            {new Date(day.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                        <div className="px-2 py-1 rounded-md bg-white/10 font-medium flex flex-col items-center">
                                            <span className="text-white/70 text-[10px] uppercase tracking-wider">{mode === 'earnings' ? 'Total Income' : 'Total Expense'}</span>
                                            <span className={`text-sm font-black ${mode === 'earnings' ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(day.amount)}</span>
                                        </div>
                                        {/* Tooltip triangle pointer */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-gray-900 dark:border-t-[#21262d]"></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {popupTarget && (
                <AsyncDayDetailPopup
                    date={popupTarget.date}
                    anchorEl={popupTarget.element}
                    onClose={() => setPopupTarget(null)}
                />
            )}
            
            <div className="flex items-center justify-center gap-2 mt-8 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                <span>Less</span>
                {colors.map((c, i) => (
                    <div key={i} className={`w-[14px] h-[14px] rounded-[4px] transition-colors duration-300 shadow-sm border border-black/5 dark:border-white/5 ${c.split(' ')[0]} ${c.split(' ')[1]}`} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}
