'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ResponsiveContainer,
} from 'recharts';
import { useCurrency } from '@/hooks/useCurrency';
import { usePrivacy } from '@/contexts/PrivacyContext';

interface DailySpend {
    date: string;
    expenses: number;
    earnings: number;
}

interface RecurringItem {
    id: number;
    name: string;
    type: 'expense' | 'earning' | string;
    amount: number;
    category: string;
    frequency: string;
    next_date: string;
    active: number;
}

interface PredictiveCashflowProps {
    dailySpending?: DailySpend[];
    monthlyIncome?: number;
    liquidCash?: number;
}

interface TooltipProps {
    active?: boolean;
    payload?: Array<{ payload: any; value: number }>;
    label?: string;
    fmt: (v: number) => string;
    formatAmount: (amount: number, formatted: string) => string;
}

function CashflowTooltip({ active, payload, label, fmt, formatAmount }: TooltipProps) {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    const isNegative = data.balance < 0;

    return (
        <div className="rounded-2xl border border-gray-200/80 bg-white/95 dark:border-white/10 dark:bg-[#161b22]/95 backdrop-blur-xl p-3 shadow-2xl text-xs min-w-[190px]">
            <p className="font-bold text-gray-900 dark:text-white mb-1.5">{data.formattedDate} ({data.date})</p>
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500 dark:text-text-muted">Projected Cash:</span>
                    <span className={`font-mono font-bold tabular-nums ${isNegative ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {formatAmount(data.balance, fmt(data.balance))}
                    </span>
                </div>
                {data.scheduledIncome > 0 && (
                    <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                        <span>Scheduled Income:</span>
                        <span className="font-mono font-bold tabular-nums">+{formatAmount(data.scheduledIncome, fmt(data.scheduledIncome))}</span>
                    </div>
                )}
                {data.scheduledBills > 0 && (
                    <div className="flex items-center justify-between gap-4 text-rose-600 dark:text-rose-400">
                        <span>Committed Bills:</span>
                        <span className="font-mono font-bold tabular-nums">−{formatAmount(data.scheduledBills, fmt(data.scheduledBills))}</span>
                    </div>
                )}
                {data.variableBurn > 0 && (
                    <div className="flex items-center justify-between gap-4 text-gray-500 dark:text-text-muted">
                        <span>Variable Burn:</span>
                        <span className="font-mono font-bold tabular-nums">−{formatAmount(data.variableBurn, fmt(data.variableBurn))}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PredictiveCashflow({
    dailySpending = [],
    monthlyIncome = 0,
    liquidCash: propLiquidCash,
}: PredictiveCashflowProps) {
    const { fmt } = useCurrency();
    const { formatAmount } = usePrivacy();

    // Toggle for variable daily burn vs scheduled bills only
    const [includeVariableSpend, setIncludeVariableSpend] = useState<boolean>(true);
    const [safetyBuffer] = useState<number>(0);

    // Fetch recurring items to project exact upcoming scheduled dates
    const { data: recurringData } = useSWR<{ items: RecurringItem[] }>('/api/recurring');
    // Fetch dashboard fallback if liquidCash is not passed as prop
    const { data: dashData } = useSWR<any>('/api/dashboard', { dedupingInterval: 15000 });

    const recurringItems = useMemo(() => recurringData?.items || [], [recurringData?.items]);
    const startingCash = propLiquidCash !== undefined 
        ? propLiquidCash 
        : (dashData?.safeToSpend?.liquidCash ?? dashData?.balance ?? 0);

    // Calculate trailing variable burn rate per day
    const { dailyVariableBurn, projection, shortfallDay, totals } = useMemo(() => {
        const now = new Date();
        const currentDayOfMonth = Math.max(1, now.getDate());

        // Sum variable spend in active month
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthExpenses = dailySpending
            .filter(d => d.date.startsWith(currentMonthPrefix))
            .reduce((sum, d) => sum + d.expenses, 0);

        const burn = currentDayOfMonth > 0 ? Math.round(currentMonthExpenses / currentDayOfMonth) : 0;

        // Build 30-day projection forward from today
        const points = [];
        let runningBalance = startingCash;
        let firstShortfall: { date: string; amount: number; formattedDate: string } | null = null;
        let totalScheduledIn = 0;
        let totalScheduledOut = 0;

        for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + dayOffset);
            const dateStr = targetDate.toISOString().split('T')[0];
            const dayLabel = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            let scheduledIncome = 0;
            let scheduledBills = 0;

            recurringItems.forEach(item => {
                if (!item.active) return;
                const itemDateStr = item.next_date ? item.next_date.split('T')[0] : '';
                
                // Match exact date or weekly cycle
                const isExact = itemDateStr === dateStr;
                const isWeekly = item.frequency === 'weekly' && new Date(itemDateStr).getDay() === targetDate.getDay();
                
                if (isExact || isWeekly) {
                    if (item.type === 'earning') {
                        scheduledIncome += item.amount;
                    } else {
                        scheduledBills += item.amount;
                    }
                }
            });

            totalScheduledIn += scheduledIncome;
            totalScheduledOut += scheduledBills;

            const burnAmount = includeVariableSpend ? burn : 0;
            runningBalance = runningBalance + scheduledIncome - scheduledBills - burnAmount;

            if (runningBalance < 0 && !firstShortfall) {
                firstShortfall = {
                    date: dateStr,
                    amount: Math.abs(runningBalance),
                    formattedDate: dayLabel,
                };
            }

            points.push({
                date: dateStr,
                formattedDate: dayLabel,
                balance: Math.round(runningBalance),
                scheduledIncome,
                scheduledBills,
                variableBurn: burnAmount,
            });
        }

        return {
            dailyVariableBurn: burn,
            projection: points,
            shortfallDay: firstShortfall,
            totals: {
                inflows: totalScheduledIn,
                outflows: totalScheduledOut,
                endingCash: runningBalance,
            },
        };
    }, [dailySpending, startingCash, recurringItems, includeVariableSpend]);

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const isDipDanger = shortfallDay !== null;

    return (
        <div className="glass-panel p-6 rounded-3xl border border-gray-200 dark:border-white/5 bg-white dark:bg-surface-dark shadow-sm">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">trending_up</span>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">30-Day Liquidity Forecast</h3>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                        Deterministic forward projection based on liquid reserves, recurring bills, and burn pace
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Shortfall Alert Badge */}
                    {isDipDanger ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                            <span>Shortfall on {shortfallDay.formattedDate}: −{formatAmount(shortfallDay.amount, fmt(shortfallDay.amount))}</span>
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Runway Solvent</span>
                        </div>
                    )}

                    {/* Variable Spend Toggle */}
                    <button
                        onClick={() => setIncludeVariableSpend(!includeVariableSpend)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                            includeVariableSpend
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300'
                        }`}
                        title="Toggle inclusion of trailing 30-day daily variable expenses"
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {includeVariableSpend ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                        <span>Variable Spend ({formatAmount(dailyVariableBurn, fmt(dailyVariableBurn))}/d)</span>
                    </button>
                </div>
            </div>

            {/* 30-Day Projection Chart */}
            <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projection} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="liquidityGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="shortfallGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.25} />
                                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                        <XAxis
                            dataKey="formattedDate"
                            tick={{ fontSize: 10, fill: isDark ? '#8b949e' : '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                            interval={4}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: isDark ? '#8b949e' : '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val: number) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val))}
                        />
                        <Tooltip
                            content={
                                <CashflowTooltip
                                    fmt={fmt}
                                    formatAmount={formatAmount}
                                />
                            }
                        />
                        {/* Reference Line at 0 (Rose) */}
                        <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Zero Balance', position: 'insideBottomRight', fill: '#f43f5e', fontSize: 10 }} />
                        {safetyBuffer > 0 && (
                            <ReferenceLine y={safetyBuffer} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'Safety Buffer', position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }} />
                        )}
                        <Area
                            type="monotone"
                            dataKey="balance"
                            stroke={isDipDanger ? '#f43f5e' : '#10b981'}
                            strokeWidth={2.5}
                            fill={isDipDanger ? 'url(#shortfallGradient)' : 'url(#liquidityGradient)'}
                            animationDuration={600}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Projection Summary Metric Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-150 dark:border-white/5">
                <div className="p-3 rounded-2xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-text-muted uppercase tracking-wider mb-0.5">Starting Cash</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums font-mono">
                        {formatAmount(startingCash, fmt(startingCash))}
                    </p>
                </div>
                <div className="p-3 rounded-2xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-0.5">Scheduled Inflows</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
                        +{formatAmount(totals.inflows, fmt(totals.inflows))}
                    </p>
                </div>
                <div className="p-3 rounded-2xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
                    <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-0.5">Scheduled Outflows</p>
                    <p className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums font-mono">
                        −{formatAmount(totals.outflows, fmt(totals.outflows))}
                    </p>
                </div>
                <div className="p-3 rounded-2xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">30-Day Ending Cash</p>
                    <p className={`text-sm font-bold tabular-nums font-mono ${totals.endingCash < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
                        {formatAmount(totals.endingCash, fmt(totals.endingCash))}
                    </p>
                </div>
            </div>
        </div>
    );
}
