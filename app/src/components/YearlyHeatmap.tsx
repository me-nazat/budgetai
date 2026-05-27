import { useState, useMemo } from 'react';
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
    dailyEarnings: DayData[];
    monthlyStats: { month: string; expenses: number; earnings: number }[];
    peakDay: DayData | null;
    totalDaysTracked: number;
}

function getIntensity(amount: number, max: number): number {
    if (amount === 0) return 0;
    if (max === 0) return 0;
    const ratio = amount / max;
    if (ratio > 0.75) return 3;
    if (ratio > 0.4) return 2;
    return 1;
}

const GREEN_INTENSITY = [
    'bg-gray-100 dark:bg-[#161b22]',
    'bg-emerald-300 dark:bg-emerald-500/40',
    'bg-emerald-400 dark:bg-emerald-500/70',
    'bg-emerald-600 dark:bg-emerald-500',
];

const RED_INTENSITY = [
    'bg-gray-100 dark:bg-[#161b22]',
    'bg-rose-300 dark:bg-rose-500/40',
    'bg-rose-400 dark:bg-rose-500/70',
    'bg-rose-600 dark:bg-rose-500',
];

export default function YearlyHeatmap() {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const { fmt } = useCurrency();
    const [mode, setMode] = useState<'earnings' | 'expenses'>('earnings');
    const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; amount: number; count: number } | null>(null);

    const { data, isLoading } = useSWR<HeatmapData>(`/api/heatmap?year=${year}`);

    // Build the grid: 53 weeks x 7 days
    const grid = useMemo(() => {
        if (!data) return [];

        const spendMap = new Map<string, DayData>();
        const targetData = mode === 'earnings' ? (data.dailyEarnings || []) : data.dailySpending;
        targetData.forEach(d => spendMap.set(d.date, d));

        const maxSpend = Math.max(...targetData.map(d => d.total), 1);

        const jan1 = new Date(year, 0, 1);
        const startDay = jan1.getDay(); // 0=Sun
        const totalDays = 365 + (year % 4 === 0 ? 1 : 0);

        const weeks: { date: string; amount: number; count: number; intensity: number; isToday: boolean }[][] = [];
        let currentWeek: typeof weeks[0] = [];

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
    }, [data, year, mode]);

    if (isLoading || !data) return (
        <div className="card-premium rounded-2xl p-6 h-64 flex items-center justify-center mt-8">
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
                        <span className="material-symbols-outlined text-emerald-500">calendar_month</span>
                        Yearly Heatmap
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Visualize your daily activity across the entire year</p>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* iOS Liquid Glass Toggle */}
                    <div className="relative flex items-center p-1 bg-gray-100/80 dark:bg-black/40 backdrop-blur-md rounded-full shadow-inner border border-gray-200/50 dark:border-white/10">
                        <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white dark:bg-[#21262d] shadow-sm transition-transform duration-300 ease-spring ${mode === 'expenses' ? 'translate-x-full ml-1' : 'translate-x-0'}`} />
                        <button onClick={() => setMode('earnings')} className={`relative z-10 px-4 py-1.5 text-xs font-bold transition-colors ${mode === 'earnings' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Earnings</button>
                        <button onClick={() => setMode('expenses')} className={`relative z-10 px-4 py-1.5 text-xs font-bold transition-colors ${mode === 'expenses' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Expenses</button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                        </button>
                        <span className="font-bold text-gray-900 dark:text-white px-2">{year}</span>
                        <button onClick={() => setYear(y => Math.min(y + 1, currentYear))} disabled={year >= currentYear} className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 transition-colors disabled:opacity-30">
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="card-premium rounded-2xl p-6 overflow-x-auto relative">
                <div className="min-w-[750px]">
                    <div className="flex ml-8 mb-2">
                        {MONTHS.map((m, i) => (
                            <div key={i} className="text-[11px] text-gray-400 font-medium" style={{ width: `${100 / 12}%` }}>{m}</div>
                        ))}
                    </div>

                    <div className="flex gap-1.5">
                        <div className="flex flex-col gap-[3px] pr-2 pt-0.5 w-6 shrink-0">
                            {DAYS.map((d, i) => (
                                <div key={i} className="text-[10px] text-gray-400 font-medium h-[14px] flex items-center">{d}</div>
                            ))}
                        </div>

                        <div className="flex gap-[3px] flex-1">
                            {grid.map((week, wi) => (
                                <div key={wi} className="flex flex-col gap-[3px]">
                                    {week.map((day, di) => (
                                        <div
                                            key={di}
                                            className={`w-[14px] h-[14px] rounded-sm transition-colors duration-200
                                                ${day.intensity === -1 ? 'invisible' : colors[day.intensity]}
                                                ${day.isToday ? 'ring-2 ring-primary/50' : ''}
                                                hover:ring-2 hover:ring-primary/50 hover:scale-125 hover:z-10 relative cursor-pointer`}
                                            onClick={(e) => {
                                                if (day.date) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, date: day.date, amount: day.amount, count: day.count });
                                                }
                                            }}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-4 text-[11px] text-gray-400">
                        <span>Less</span>
                        {colors.map((c, i) => (
                            <div key={i} className={`w-[12px] h-[12px] rounded-sm transition-colors duration-300 ${c}`} />
                        ))}
                        <span>More</span>
                    </div>
                </div>

                {tooltip && (
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
            
            {/* Click outside tooltip handler */}
            {tooltip && (
                <div className="fixed inset-0 z-40" onClick={() => setTooltip(null)} />
            )}

            <div className="mt-4 flex gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${mode === 'earnings' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    Total {mode} in {year}: <span className="font-bold text-gray-900 dark:text-white">{fmt(totalAmount)}</span>
                </div>
            </div>
        </div>
    );
}
