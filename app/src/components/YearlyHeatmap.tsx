import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useCurrency } from '@/hooks/useCurrency';
import AsyncDayDetailPopup from './AsyncDayDetailPopup';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function YearlyHeatmap() {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const { fmt } = useCurrency();
    const [mode, setMode] = useState<'earnings' | 'expenses'>('expenses');
    const [popupTarget, setPopupTarget] = useState<{ element: HTMLElement; date: string } | null>(null);

    const { data, isLoading } = useSWR<HeatmapData>(`/api/heatmap?year=${year}`);

    // Build the grid: 53 weeks x 7 days
    const { grid, monthLabels } = useMemo(() => {
        if (!data) return { grid: [], thresholds: [0, 0, 0], monthLabels: [] };

        const spendMap = new Map<string, DayData>();
        const targetData = mode === 'earnings' ? (data.dailyEarnings || []) : data.dailySpending;
        targetData.forEach(d => spendMap.set(d.date, d));

        const amounts = targetData.map(d => d.total);
        const calcThresholds = calculateThresholds(amounts);

        const jan1 = new Date(year, 0, 1);
        const startDay = jan1.getDay() === 0 ? 6 : jan1.getDay() - 1; // 0=Mon
        const totalDays = 365 + (year % 4 === 0 ? 1 : 0);

        const weeks: { date: string; amount: number; count: number; intensity: number; isToday: boolean }[][] = [];
        let currentWeek: typeof weeks[0] = [];

        for (let i = 0; i < startDay; i++) {
            currentWeek.push({ date: '', amount: 0, count: 0, intensity: -1, isToday: false });
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        for (let d = 0; d < totalDays; d++) {
            const date = new Date(year, 0, d + 1);
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const dayNum = String(date.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${dayNum}`;
            const dayData = spendMap.get(dateStr);
            const amount = dayData?.total || 0;
            const count = dayData?.count || 0;

            currentWeek.push({
                date: dateStr,
                amount,
                count,
                intensity: getIntensity(amount, calcThresholds),
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

        const monthLabels: number[] = [];
        for (let m = 0; m < 12; m++) {
            const date = new Date(year, m, 1);
            const start = new Date(year, 0, 1);
            const diff = date.getTime() - start.getTime();
            const dayOfYear = Math.round(diff / (1000 * 60 * 60 * 24));
            const col = Math.floor((dayOfYear + startDay) / 7);
            monthLabels.push(col * 17); // 14px width + 3px gap
        }

        return { grid: weeks, thresholds: calcThresholds, monthLabels };
    }, [data, year, mode]);

    if (isLoading || !data) return (
        <div className="glass-panel rounded-3xl p-6 h-64 flex items-center justify-center mt-8 backdrop-blur-2xl border border-white/10 dark:border-white/5">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    const colors = mode === 'earnings' ? GREEN_INTENSITY : RED_INTENSITY;
    const targetData = mode === 'earnings' ? (data.dailyEarnings || []) : data.dailySpending;
    const totalAmount = targetData.reduce((s, d) => s + d.total, 0);

    return (
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-white/5 relative z-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
                        Yearly Heatmap
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Visualize your daily activity across the entire year</p>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* iOS Liquid Glass Toggle */}
                    <div className="relative flex items-center p-1 bg-gray-200/50 dark:bg-white/5 backdrop-blur-md rounded-full shadow-inner border border-gray-300/30 dark:border-white/10">
                        <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white dark:bg-[#21262d] shadow-md transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${mode === 'expenses' ? 'translate-x-full ml-1' : 'translate-x-0'}`} />
                        <button onClick={() => setMode('earnings')} className={`relative z-10 px-4 py-1.5 text-[11px] uppercase tracking-wider font-bold transition-colors duration-300 ${mode === 'earnings' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Earnings</button>
                        <button onClick={() => setMode('expenses')} className={`relative z-10 px-4 py-1.5 text-[11px] uppercase tracking-wider font-bold transition-colors duration-300 ${mode === 'expenses' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Expenses</button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                        </button>
                        <span className="font-bold text-gray-900 dark:text-white px-3 text-lg tracking-tight">{year}</span>
                        <button onClick={() => setYear(y => Math.min(y + 1, currentYear))} disabled={year >= currentYear} className="p-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors disabled:opacity-30">
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="glass-panel rounded-3xl p-6 overflow-x-auto relative backdrop-blur-2xl border border-white/10 dark:border-white/5 bg-white/40 dark:bg-black/40">
                <div className="min-w-[750px] pb-4">
                    <div className="ml-8 mb-3 relative h-4">
                        {MONTHS.map((m, i) => (
                            <div key={i} className="absolute text-[11px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider" style={{ left: `${monthLabels[i] || 0}px` }}>{m}</div>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <div className="flex flex-col gap-1 pr-3 pt-0.5 w-8 shrink-0">
                            {DAYS.map((d, i) => (
                                <div key={i} className="text-[10px] text-gray-400 font-bold uppercase tracking-wider h-[14px] flex items-center justify-end">{d}</div>
                            ))}
                        </div>

                        <div className="flex gap-1 flex-1 relative">
                            {grid.map((week, wi) => (
                                <div key={wi} className="flex flex-col gap-1 relative z-10 hover:z-50">
                                    {week.map((day, di) => (
                                        <div
                                            key={di}
                                            className={`w-[14px] h-[14px] rounded-sm transition-all duration-300 shadow-sm
                                                ${day.intensity === -1 ? 'invisible' : colors[day.intensity]}
                                                ${day.isToday ? 'ring-1 ring-primary/80' : ''}
                                                hover:ring-2 hover:ring-primary/60 hover:scale-[1.3] relative cursor-pointer group z-10 hover:z-50`}
                                            onClick={(e) => {
                                                if (day.date) {
                                                    setPopupTarget({ element: e.currentTarget, date: day.date });
                                                }
                                            }}
                                        >
                                            {/* Zero-Lag CSS Tooltip */}
                                            {day.date && (
                                                <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-max px-3 py-2 bg-gray-900 dark:bg-[#21262d] border border-gray-700 dark:border-white/10 text-white text-xs rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none z-[9999]">
                                                    <p className="font-bold mb-1 text-center text-gray-300">
                                                        {new Date(day.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </p>
                                                    <div className="px-2 py-1 rounded-md bg-white/10 font-medium flex flex-col items-center">
                                                        <span className="text-white/70 text-[10px] uppercase tracking-wider">{mode === 'earnings' ? 'Total Income' : 'Total Expense'}</span>
                                                        <span className={`text-sm font-black ${mode === 'earnings' ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(day.amount)}</span>
                                                    </div>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-gray-900 dark:border-t-[#21262d]"></div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-6 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                        <span>Less</span>
                        {colors.map((c, i) => (
                            <div key={i} className={`w-[14px] h-[14px] rounded-[4px] shadow-sm transition-colors duration-300 border border-black/5 dark:border-white/5 ${c}`} />
                        ))}
                        <span>More</span>
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

            <div className="mt-4 flex gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-xl">
                    <div className={`w-2.5 h-2.5 rounded-full ${mode === 'earnings' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
                    Total {mode} in {year}: <span className="font-bold text-gray-900 dark:text-white text-base ml-1">{fmt(totalAmount)}</span>
                </div>
            </div>
        </div>
    );
}
