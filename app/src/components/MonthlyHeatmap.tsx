import { useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';

interface DayData {
    date: string;
    earnings: number;
    expenses: number;
    count: number;
}

const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

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

    const grid = useMemo(() => {
        const spendMap = new Map<string, DayData>();
        dailySpending.forEach(d => spendMap.set(d.date, d));

        const maxSpend = Math.max(...dailySpending.map(d => mode === 'earnings' ? d.earnings : d.expenses), 1);

        const firstDay = new Date(year, month - 1, 1);
        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // 0=Mon
        const daysInMonth = new Date(year, month, 0).getDate();

        const weeks: { date: string; amount: number; count: number; intensity: number; isToday: boolean }[][] = [];
        let currentWeek: typeof weeks[0] = [];

        for (let i = 0; i < startDay; i++) {
            currentWeek.push({ date: '', amount: 0, count: 0, intensity: -1, isToday: false });
        }

        const todayStr = new Date().toISOString().split('T')[0];

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayData = spendMap.get(dateStr);
            const amount = dayData ? (mode === 'earnings' ? dayData.earnings : dayData.expenses) : 0;
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
    }, [year, month, dailySpending, mode]);

    const colors = mode === 'earnings' ? GREEN_INTENSITY : RED_INTENSITY;

    return (
        <div className="card-premium rounded-2xl p-6 h-full border border-gray-200 dark:border-white/5 bg-white dark:bg-[#111827] flex flex-col relative z-0">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Monthly Heatmap</h3>
                
                {/* iOS Liquid Glass Toggle */}
                <div className="relative flex items-center p-1 bg-gray-100/80 dark:bg-black/40 backdrop-blur-md rounded-full shadow-inner border border-gray-200/50 dark:border-white/10">
                    <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white dark:bg-[#21262d] shadow-sm transition-transform duration-300 ease-spring ${mode === 'expenses' ? 'translate-x-full ml-1' : 'translate-x-0'}`} />
                    <button onClick={() => setMode('earnings')} className={`relative z-10 px-4 py-1.5 text-xs font-bold transition-colors ${mode === 'earnings' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Earnings</button>
                    <button onClick={() => setMode('expenses')} className={`relative z-10 px-4 py-1.5 text-xs font-bold transition-colors ${mode === 'expenses' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Expenses</button>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto relative min-h-0 flex items-center justify-center">
                <div className="flex gap-1.5 justify-center">
                    <div className="flex flex-col gap-[6px] pr-2 pt-1 w-6 shrink-0">
                        {DAYS.map((d, i) => (
                            <div key={i} className="text-xs text-gray-400 font-medium h-[20px] flex items-center">{d}</div>
                        ))}
                    </div>

                    <div className="flex gap-[6px]">
                        {grid.map((week, wi) => (
                            <div key={wi} className="flex flex-col gap-[6px]">
                                {week.map((day, di) => (
                                    <div
                                        key={di}
                                        className={`w-[20px] h-[20px] rounded-md transition-colors duration-300
                                            ${day.intensity === -1 ? 'invisible' : colors[day.intensity]}
                                            ${day.isToday ? 'ring-2 ring-primary/50' : ''}
                                            hover:ring-2 hover:ring-primary/50 hover:scale-110 relative cursor-pointer z-0 hover:z-10`}
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

            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400">
                <span>Less</span>
                {colors.map((c, i) => (
                    <div key={i} className={`w-[16px] h-[16px] rounded-md transition-colors duration-300 ${c}`} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}
