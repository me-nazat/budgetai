'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface DailySpend {
    date: string;
    expenses: number;
    earnings: number;
}

interface PredictiveCashflowProps {
    dailySpending: DailySpend[];
    monthlyIncome: number;
}

export default function PredictiveCashflow({ dailySpending, monthlyIncome }: PredictiveCashflowProps) {
    const {
        daysInMonth,
        currentDay,
        dailyAverage,
        projectedSpend,
        projectedBalance,
        status,
        safeDailySpend
    } = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const currentDay = now.getDate();

        const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const totalSpent = dailySpending
            .filter(d => d.date.startsWith(currentMonthPrefix))
            .reduce((sum, d) => sum + d.expenses, 0);

        const dailyAverage = currentDay > 1 ? totalSpent / currentDay : totalSpent;
        const projectedSpend = totalSpent + (dailyAverage * (daysInMonth - currentDay));
        const projectedBalance = monthlyIncome - projectedSpend;
        
        const remainingDays = daysInMonth - currentDay;
        const remainingBudget = monthlyIncome - totalSpent;
        const safeDailySpend = remainingDays > 0 ? Math.max(0, remainingBudget / remainingDays) : 0;

        let status = 'good';
        if (projectedBalance < 0) status = 'danger';
        else if (projectedBalance < monthlyIncome * 0.2) status = 'warning';

        return {
            daysInMonth,
            currentDay,
            dailyAverage,
            projectedSpend,
            projectedBalance,
            status,
            safeDailySpend
        };
    }, [dailySpending, monthlyIncome]);

    if (dailySpending.length === 0 || monthlyIncome <= 0) return null;

    const colors = {
        good: 'text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
        warning: 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
        danger: 'text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'
    };

    const icons = {
        good: 'trending_up',
        warning: 'warning',
        danger: 'trending_down'
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-5 transition-colors ${colors[status as keyof typeof colors]}`}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {icons[status as keyof typeof icons]}
                    </span>
                    AI Cashflow Prediction
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                    Day {currentDay} of {daysInMonth}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-xs font-semibold opacity-70 mb-1">Current Burn Rate</p>
                    <p className="text-lg font-black">{dailyAverage.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day</p>
                </div>
                <div>
                    <p className="text-xs font-semibold opacity-70 mb-1">Safe to Spend</p>
                    <p className="text-lg font-black">{safeDailySpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day</p>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-current/10 flex items-center justify-between">
                <span className="text-xs font-semibold opacity-80">Projected EOM Balance:</span>
                <span className="text-xl font-black">
                    {projectedBalance >= 0 ? '+' : ''}{projectedBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
            </div>
        </motion.div>
    );
}
