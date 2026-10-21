'use client';

import React, { useState, useRef, useEffect } from 'react';
import { TiltCard } from '@/components/ui/TiltCard';
import { DashboardData } from '@/hooks/useApi';
import { usePrivacy } from '@/contexts/PrivacyContext';

interface DashboardStatCardsProps {
    data: DashboardData;
    fmt: (val: number) => string;
}

export const DashboardStatCards: React.FC<DashboardStatCardsProps> = ({ data, fmt }) => {
    const { formatAmount } = usePrivacy();
    const [showFormulaPopover, setShowFormulaPopover] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close formula popover on outside click
    useEffect(() => {
        if (!showFormulaPopover) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setShowFormulaPopover(false);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [showFormulaPopover]);

    // ────────────────────────────────────────────────────────────
    // 1. Safe-to-Spend & Daily Allowance
    // ────────────────────────────────────────────────────────────
    const safeToSpend = data.safeToSpend || {
        safeToSpendTotal: Math.max(0, data.balance - data.expenses.current),
        dailySafeAllowance: Math.round(Math.max(0, data.balance - data.expenses.current) / 15),
        daysRemaining: 15,
        liquidCash: data.balance,
        upcomingCommittedBills: 0,
        remainingBudgetReservations: 0,
        creditCardCurrentBalance: 0,
    };

    // ────────────────────────────────────────────────────────────
    // 2. Net Worth & Liquid Ratio
    // ────────────────────────────────────────────────────────────
    const totalNetWorth = (data.accountsSummary?.netWorth !== undefined && data.accountsSummary?.netWorth !== 0)
        ? data.accountsSummary.netWorth
        : (data.netWorth || data.balance || 0);
    const liquidRatio = data.accountsSummary?.liquidRatio ?? 100;
    const netSavingsDelta = data.netSavings;
    const prevEstimatedNetWorth = totalNetWorth - netSavingsDelta;
    const netWorthMoMPercent = prevEstimatedNetWorth !== 0
        ? (netSavingsDelta / Math.abs(prevEstimatedNetWorth)) * 100
        : 0;

    // ────────────────────────────────────────────────────────────
    // 3. Monthly Spending & Pacing Velocity
    // ────────────────────────────────────────────────────────────
    const monthlyExpenses = data.expenses.current;
    const paceMetrics = data.spendingPace || {
        currentMonthSpendToDate: monthlyExpenses,
        previousMonthSpendSameDay: monthlyExpenses,
        paceDeltaPercent: data.expenses.change,
        projectedMonthEndSpend: monthlyExpenses,
        dayOfMonth: 1,
        daysInMonth: 30,
    };
    // Spending lower than last month's pace is positive for financial health
    const isPaceFavorable = paceMetrics.paceDeltaPercent <= 0;

    // ────────────────────────────────────────────────────────────
    // 4. Net Cashflow & Savings Rate
    // ────────────────────────────────────────────────────────────
    const netCashflow = data.netSavings;
    const totalIncome = data.earnings.current;
    const savingsRate = totalIncome > 0 ? (netCashflow / totalIncome) * 100 : 0;
    const savingsProgressPct = Math.max(0, Math.min(100, (savingsRate / 20) * 100));

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-8 stagger-children">
            {/* ── CARD 1: Safe-to-Spend & Daily Allowance ── */}
            <TiltCard
                className="glass-panel stat-gradient-emerald p-5 lg:p-6 rounded-3xl relative overflow-visible flex flex-col justify-between group breathe border border-gray-100 dark:border-white/5 hover:border-emerald-500/40 transition-all duration-300"
            >
                {/* Hairline top-edge light reflection */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent dark:via-emerald-400/25" />
                
                {/* Subtle corner jewel glow */}
                <div className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full bg-emerald-500/10 blur-2xl dark:bg-emerald-500/15" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                            <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                                Safe-to-Spend
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowFormulaPopover(!showFormulaPopover)}
                                className="w-4 h-4 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white inline-flex items-center justify-center transition-colors focus-visible:outline-none"
                                title="Click to view Safe-to-Spend calculation formula"
                                aria-label="Safe-to-Spend breakdown"
                            >
                                <span className="material-symbols-outlined text-[14px]">info</span>
                            </button>
                        </div>
                        <span className="material-symbols-outlined text-[20px] text-emerald-500 opacity-80 group-hover:scale-110 transition-transform duration-300">verified_user</span>
                    </div>

                    <h3
                        className="text-transparent bg-clip-text bg-gradient-to-br from-gray-950 via-gray-800 to-gray-600 dark:from-white dark:via-gray-100 dark:to-gray-400 text-2xl lg:text-[1.875rem] font-black tracking-tight tabular-nums font-mono my-1 number-appear"
                        data-numeric="true"
                    >
                        {formatAmount(safeToSpend.safeToSpendTotal, fmt(safeToSpend.safeToSpendTotal))}
                    </h3>
                </div>

                <div className="relative z-10 flex items-center justify-between gap-2 mt-2 pt-2.5 border-t border-gray-100 dark:border-white/10">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 tabular-nums font-mono border border-emerald-500/20">
                            {formatAmount(safeToSpend.dailySafeAllowance, fmt(safeToSpend.dailySafeAllowance))}/day
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">
                            {safeToSpend.daysRemaining} days left
                        </span>
                    </div>
                </div>

                {/* Interactive Formula Popover */}
                {showFormulaPopover && (
                    <div
                        ref={popoverRef}
                        className="glass-card-elevated absolute top-[calc(100%+8px)] left-0 w-72 p-4 rounded-2xl z-40 text-xs space-y-2.5 backdrop-blur-2xl border border-gray-200 dark:border-white/10 shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-2">
                            <span className="font-bold text-gray-900 dark:text-white">Safe-to-Spend Formula</span>
                            <button
                                type="button"
                                onClick={() => setShowFormulaPopover(false)}
                                className="text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>
                        <div className="space-y-1.5 tabular-nums font-mono">
                            <div className="flex justify-between text-emerald-500 font-semibold">
                                <span className="text-gray-500 dark:text-gray-400 font-sans">Liquid Cash:</span>
                                <span>+{formatAmount(safeToSpend.liquidCash, fmt(safeToSpend.liquidCash))}</span>
                            </div>
                            <div className="flex justify-between text-rose-500 font-semibold">
                                <span className="text-gray-500 dark:text-gray-400 font-sans">Upcoming Bills:</span>
                                <span>-{formatAmount(safeToSpend.upcomingCommittedBills, fmt(safeToSpend.upcomingCommittedBills))}</span>
                            </div>
                            <div className="flex justify-between text-amber-500 font-semibold">
                                <span className="text-gray-500 dark:text-gray-400 font-sans">Budget & Goals:</span>
                                <span>-{formatAmount(safeToSpend.remainingBudgetReservations, fmt(safeToSpend.remainingBudgetReservations))}</span>
                            </div>
                            <div className="flex justify-between text-rose-500 font-semibold">
                                <span className="text-gray-500 dark:text-gray-400 font-sans">Card Balances:</span>
                                <span>-{formatAmount(safeToSpend.creditCardCurrentBalance, fmt(safeToSpend.creditCardCurrentBalance))}</span>
                            </div>
                            <div className="border-t border-gray-100 dark:border-white/10 pt-1.5 flex justify-between font-bold text-gray-900 dark:text-white">
                                <span className="font-sans">Free Cashflow:</span>
                                <span>{formatAmount(safeToSpend.safeToSpendTotal, fmt(safeToSpend.safeToSpendTotal))}</span>
                            </div>
                        </div>
                    </div>
                )}
            </TiltCard>

            {/* ── CARD 2: Net Worth & Liquid Ratio ── */}
            <TiltCard
                className="glass-panel stat-gradient-blue p-5 lg:p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between group breathe border border-gray-100 dark:border-white/5 hover:border-primary/40 transition-all duration-300"
            >
                {/* Hairline top-edge light reflection */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent dark:via-primary/25" />
                
                {/* Subtle corner jewel glow */}
                <div className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full bg-primary/10 blur-2xl dark:bg-primary/15" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                            Net Worth
                        </span>
                        <span className="material-symbols-outlined text-[20px] text-primary opacity-80 group-hover:scale-110 transition-transform duration-300">account_balance</span>
                    </div>

                    <h3
                        className="text-transparent bg-clip-text bg-gradient-to-br from-gray-950 via-gray-800 to-gray-600 dark:from-white dark:via-gray-100 dark:to-gray-400 text-2xl lg:text-[1.875rem] font-black tracking-tight tabular-nums font-mono my-1 number-appear"
                        data-numeric="true"
                    >
                        {formatAmount(totalNetWorth, fmt(totalNetWorth))}
                    </h3>
                </div>

                <div className="relative z-10 flex items-center justify-between gap-1.5 mt-2 pt-2.5 border-t border-gray-100 dark:border-white/10">
                    <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 tabular-nums font-mono border ${
                            netSavingsDelta >= 0
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        }`}
                        data-numeric="true"
                    >
                        <span className="material-symbols-outlined text-[14px]">
                            {netSavingsDelta >= 0 ? 'trending_up' : 'trending_down'}
                        </span>
                        {netWorthMoMPercent >= 0 ? '+' : ''}{netWorthMoMPercent.toFixed(1)}%
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs font-medium tabular-nums font-mono">
                        {liquidRatio}% liquid
                    </span>
                </div>
            </TiltCard>

            {/* ── CARD 3: Monthly Spending & Pacing Velocity ── */}
            <TiltCard
                className="glass-panel stat-gradient-orange p-5 lg:p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between group breathe border border-gray-100 dark:border-white/5 hover:border-amber-500/40 transition-all duration-300"
            >
                {/* Hairline top-edge light reflection */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent dark:via-amber-400/25" />
                
                {/* Subtle corner jewel glow */}
                <div className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full bg-amber-500/10 blur-2xl dark:bg-amber-500/15" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                            Monthly Spending
                        </span>
                        <span className="material-symbols-outlined text-[20px] text-amber-500 opacity-80 group-hover:scale-110 transition-transform duration-300">shopping_bag</span>
                    </div>

                    <h3
                        className="text-transparent bg-clip-text bg-gradient-to-br from-gray-950 via-gray-800 to-gray-600 dark:from-white dark:via-gray-100 dark:to-gray-400 text-2xl lg:text-[1.875rem] font-black tracking-tight tabular-nums font-mono my-1 number-appear"
                        data-numeric="true"
                    >
                        {formatAmount(monthlyExpenses, fmt(monthlyExpenses))}
                    </h3>
                </div>

                <div className="relative z-10 flex items-center justify-between gap-1.5 mt-2 pt-2.5 border-t border-gray-100 dark:border-white/10">
                    <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 tabular-nums font-mono border ${
                            isPaceFavorable
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        }`}
                        data-numeric="true"
                    >
                        <span className="material-symbols-outlined text-[14px]">
                            {isPaceFavorable ? 'speed' : 'trending_up'}
                        </span>
                        {paceMetrics.paceDeltaPercent >= 0 ? '+' : ''}{paceMetrics.paceDeltaPercent.toFixed(1)}% pace
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs font-medium tabular-nums font-mono truncate max-w-[110px]" title={`Projected: ${fmt(paceMetrics.projectedMonthEndSpend)}`}>
                        proj {formatAmount(paceMetrics.projectedMonthEndSpend, fmt(paceMetrics.projectedMonthEndSpend))}
                    </span>
                </div>
            </TiltCard>

            {/* ── CARD 4: Net Cashflow & Savings Rate ── */}
            <TiltCard
                className="glass-panel stat-gradient-emerald p-5 lg:p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between group breathe border border-gray-100 dark:border-white/5 hover:border-teal-500/40 transition-all duration-300"
            >
                {/* Hairline top-edge light reflection */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/40 to-transparent dark:via-teal-400/25" />
                
                {/* Subtle corner jewel glow */}
                <div className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full bg-teal-500/10 blur-2xl dark:bg-teal-500/15" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                            Net Cashflow
                        </span>
                        <span className="material-symbols-outlined text-[20px] text-teal-500 opacity-80 group-hover:scale-110 transition-transform duration-300">savings</span>
                    </div>

                    <h3
                        className={`text-transparent bg-clip-text ${
                            netCashflow >= 0
                                ? 'bg-gradient-to-br from-gray-950 via-gray-800 to-gray-600 dark:from-white dark:via-gray-100 dark:to-gray-400'
                                : 'bg-gradient-to-br from-rose-600 to-rose-400'
                        } text-2xl lg:text-[1.875rem] font-black tracking-tight tabular-nums font-mono my-1 number-appear`}
                        data-numeric="true"
                    >
                        {formatAmount(netCashflow, fmt(netCashflow))}
                    </h3>
                </div>

                <div className="relative z-10 space-y-1.5 mt-2 pt-2.5 border-t border-gray-100 dark:border-white/10">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-600 dark:text-teal-400 tabular-nums font-mono border border-teal-500/20">
                            {savingsRate.toFixed(1)}% saved
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">
                            Target: 20%
                        </span>
                    </div>
                    {/* Micro Benchmark Progress Bar */}
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 rounded-full ${
                                savingsRate >= 20 ? 'bg-emerald-500' : 'bg-primary'
                            }`}
                            style={{ width: `${savingsProgressPct}%` }}
                        />
                    </div>
                </div>
            </TiltCard>
        </div>
    );
};
