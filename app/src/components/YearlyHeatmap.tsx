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

export default function YearlyHeatmap() {
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
    }, [data, year]);

    if (isLoading || !data) return (
        <div className="card-premium rounded-2xl p-6 h-64 flex items-center justify-center mt-8">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    const totalSpent = data.dailySpending.reduce((s, d) => s + d.total, 0);

    return (
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-white/5 relative z-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-500">calendar_month</span>
                        Yearly Spending Heatmap
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Visualize your daily spending activity across the entire year</p>
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
                                                ${day.intensity === -1 ? 'invisible' : INTENSITY_COLORS[day.intensity]}
                                                ${day.isToday ? 'ring-2 ring-primary/50' : ''}
                                                hover:ring-2 hover:ring-primary/50 hover:scale-125 hover:z-10 relative cursor-pointer`}
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

                    <div className="flex items-center justify-end gap-2 mt-4 text-[11px] text-gray-400">
                        <span>Less</span>
                        {INTENSITY_COLORS.map((c, i) => (
                            <div key={i} className={`w-[12px] h-[12px] rounded-sm ${c}`} />
                        ))}
                        <span>More</span>
                    </div>
                </div>

                {tooltip && (
                    <div className="fixed z-50 px-3 py-2 bg-gray-900 dark:bg-black text-white text-xs rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
                        style={{ left: tooltip.x, top: tooltip.y }}>
                        <p className="font-bold">{new Date(tooltip.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        <p className="text-white/70 mt-0.5">
                            {tooltip.amount > 0 ? `${fmt(tooltip.amount)} spent in ${tooltip.count} transaction${tooltip.count > 1 ? 's' : ''}` : 'No spending'}
                        </p>
                    </div>
                )}
            </div>
            <div className="mt-4 flex gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    Total spent in {year}: <span className="font-bold text-gray-900 dark:text-white">{fmt(totalSpent)}</span>
                </div>
            </div>
        </div>
    );
}
