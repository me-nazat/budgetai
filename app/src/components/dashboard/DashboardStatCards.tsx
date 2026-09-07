'use client';

import React from 'react';
import { TiltCard } from '@/components/ui/TiltCard';
import { DashboardData } from '@/hooks/useApi';

interface DashboardStatCardsProps {
    data: DashboardData;
    fmt: (val: number) => string;
}

export const DashboardStatCards: React.FC<DashboardStatCardsProps> = ({ data, fmt }) => {
    const stats = [
        {
            label: 'Total Balance',
            value: data.balance,
            change: data.earnings?.change ?? 0,
            icon: 'account_balance',
            color: 'text-primary',
            gradient: 'stat-gradient-blue',
            invertTrend: false,
        },
        {
            label: 'Monthly Earnings',
            value: data.earnings?.current ?? 0,
            change: data.earnings?.change ?? 0,
            icon: 'payments',
            color: 'text-emerald-500',
            gradient: 'stat-gradient-emerald',
            invertTrend: false,
        },
        {
            label: 'Monthly Expenses',
            value: data.expenses?.current ?? 0,
            change: data.expenses?.change ?? 0,
            icon: 'shopping_cart',
            color: 'text-orange-500',
            gradient: 'stat-gradient-orange',
            invertTrend: true,
        },
        {
            label: 'Net Savings',
            value: data.netSavings,
            change: data.netSavings > 0 ? 8.1 : -5.0,
            icon: 'savings',
            color: 'text-blue-500',
            gradient: 'stat-gradient-blue',
            invertTrend: false,
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-8 stagger-children">
            {stats.map((s, i) => {
                const isPositive = s.invertTrend ? s.change <= 0 : s.change >= 0;
                return (
                    <TiltCard
                        key={s.label}
                        className={`glass-panel ${s.gradient} p-5 lg:p-6 rounded-3xl relative overflow-hidden group breathe border border-gray-100 dark:border-white/5`}
                        style={{
                            animationDelay: `${i * 0.08}s`,
                            animation: `slideUp 0.5s ease-out ${i * 0.08}s both`,
                        }}
                    >
                        <div className="flex flex-col gap-1 relative z-10">
                            <div className="flex items-center justify-between">
                                <p className="text-gray-500 dark:text-text-muted text-xs font-semibold uppercase tracking-wider">
                                    {s.label}
                                </p>
                                <span className={`material-symbols-outlined text-[20px] ${s.color} opacity-80 group-hover:scale-110 transition-transform duration-300`}>
                                    {s.icon}
                                </span>
                            </div>

                            <h3 className="text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-2xl lg:text-3xl font-black tracking-tight number-appear my-1">
                                {fmt(s.value)}
                            </h3>

                            <div className="flex items-center gap-1.5 mt-1.5">
                                <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 ${
                                        isPositive
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[14px]">
                                        {isPositive ? 'trending_up' : 'trending_down'}
                                    </span>
                                    {s.change >= 0 ? '+' : ''}{s.change.toFixed(1)}%
                                </span>
                                <span className="text-gray-400 dark:text-text-muted text-xs font-medium">
                                    vs prev period
                                </span>
                            </div>
                        </div>
                    </TiltCard>
                );
            })}
        </div>
    );
};
