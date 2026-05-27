import { useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import AsyncDayDetailPopup from './AsyncDayDetailPopup';

interface DayData {
    date: string;
    earnings: number;
    expenses: number;
    count: number;
}

const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

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

    const { grid, thresholds } = useMemo(() => {
        const spendMap = new Map<string, DayData>();
        dailySpending.forEach(d => spendMap.set(d.date, d));

        const amounts = dailySpending.map(d => mode === 'earnings' ? d.earnings : d.expenses);
        const calcThresholds = calculateThresholds(amounts);

        const firstDay = new Date(year, month - 1, 1);
        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // 0=Mon
        const daysInMonth = new Date(year, month, 0).getDate();

        // For GitHub style (horizontal), columns are weeks, rows are days of the week (Mon-Sun).
        // 7 rows (Mon to Sun)
        const rows: { date: string; amount: number; count: number; intensity: number; isToday: boolean }[][] = Array.from({ length: 7 }, () => []);
        
        let currentDayOfWeek = startDay;
        let weekIndex = 0;

        // Pad first week with empty days
        for (let r = 0; r < startDay; r++) {
            rows[r].push({ date: '', amount: 0, count: 0, intensity: -1, isToday: false });
        }

        const todayStr = new Date().toISOString().split('T')[0];

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayData = spendMap.get(dateStr);
            const amount = dayData ? (mode === 'earnings' ? dayData.earnings : dayData.expenses) : 0;
            const count = dayData?.count || 0;

            rows[currentDayOfWeek].push({
                date: dateStr,
                amount,
                count,
                intensity: getIntensity(amount, calcThresholds),
                isToday: dateStr === todayStr,
            });

            currentDayOfWeek++;
            if (currentDayOfWeek === 7) {
                currentDayOfWeek = 0;
                weekIndex++;
            }
        }

        // Pad the last week to make all rows have same length
        const maxWeeks = Math.max(...rows.map(r => r.length));
        for (let r = 0; r < 7; r++) {
            while (rows[r].length < maxWeeks) {
                rows[r].push({ date: '', amount: 0, count: 0, intensity: -1, isToday: false });
            }
        }

        return { grid: rows, thresholds: calcThresholds };
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
                <div className="flex gap-1.5 justify-center pb-4 pt-2">
                    <div className="flex flex-col justify-between pr-2 shrink-0 h-full py-[4px]">
                        {DAYS.map((d, i) => (
                            <div key={i} className="text-[11px] text-gray-400 font-medium h-[24px] flex items-center">{d}</div>
                        ))}
                    </div>

                    <div className="flex flex-col justify-between h-full">
                        {grid.map((row, ri) => (
                            <div key={ri} className="flex gap-[6px] h-[24px]">
                                {row.map((day, di) => (
                                    <div
                                        key={di}
                                        className={`w-[24px] h-[24px] rounded-md transition-colors duration-300
                                            ${day.intensity === -1 ? 'invisible' : colors[day.intensity]}
                                            ${day.isToday ? 'ring-2 ring-primary/50' : ''}
                                            hover:ring-2 hover:ring-primary/50 hover:scale-110 relative cursor-pointer z-0 hover:z-10 shadow-sm`}
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
            
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400">
                <span>Less</span>
                {colors.map((c, i) => (
                    <div key={i} className={`w-[16px] h-[16px] rounded-md transition-colors duration-300 shadow-sm ${c}`} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}
