import { useMemo } from 'react';

interface DayData {
    date: string;
    total: number;
    count: number;
}

const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

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
    'bg-gray-100 dark:bg-[#161b22]',
    'bg-emerald-200/60 dark:bg-emerald-500/20',
    'bg-emerald-300/70 dark:bg-emerald-500/40',
    'bg-emerald-400/80 dark:bg-emerald-500/60',
    'bg-emerald-500 dark:bg-emerald-400',
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
    const grid = useMemo(() => {
        const spendMap = new Map<string, DayData>();
        dailySpending.forEach(d => spendMap.set(d.date, d));

        const maxSpend = Math.max(...dailySpending.map(d => d.total), 1);

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
    }, [year, month, dailySpending]);

    return (
        <div className="card-premium rounded-2xl p-6 h-full border border-gray-200 dark:border-white/5 bg-white dark:bg-[#111827]">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Monthly Spending Heatmap</h3>
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
                                    title={day.date ? `${day.date}: ${day.amount} spent` : undefined}
                                    className={`w-[20px] h-[20px] rounded-md transition-colors duration-200
                                        ${day.intensity === -1 ? 'invisible' : INTENSITY_COLORS[day.intensity]}
                                        ${day.isToday ? 'ring-2 ring-primary/50' : ''}
                                        hover:ring-2 hover:ring-primary/50 cursor-pointer`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-400">
                <span>Less</span>
                {INTENSITY_COLORS.map((c, i) => (
                    <div key={i} className={`w-[16px] h-[16px] rounded-md ${c}`} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}
