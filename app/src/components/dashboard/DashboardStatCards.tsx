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
    const totalNetWorth = data.accountsSummary?.netWorth ?? data.netWorth;
    const liquidRatio = data.accountsSummary?.liquidRatio ?? 0;
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-8">
            {/* ── CARD 1: Safe-to-Spend & Daily Allowance ── */}
            <TiltCard
                className="p-5 lg:p-6 rounded-2xl relative overflow-visible border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] flex flex-col justify-between"
            >
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[var(--color-text-muted)] text-xs font-semibold tracking-wider uppercase">
                                Safe-to-Spend
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowFormulaPopover(!showFormulaPopover)}
                                className="w-4 h-4 rounded-full text-[var(--color-text-dim)] hover:text-[var(--color-text-main)] hover:bg-[var(--bg-hover)] inline-flex items-center justify-center transition-colors focus-visible:outline-none"
                                title="Click to view Safe-to-Spend calculation formula"
                                aria-label="Safe-to-Spend breakdown"
                            >
                                <span className="material-symbols-outlined text-[14px]">info</span>
                            </button>
                        </div>
                        <span className="material-symbols-outlined text-[20px] text-emerald-500 opacity-90">
                            verified_user
                        </span>
                    </div>

                    <h3
                        className="text-[var(--color-text-main)] text-2xl lg:text-[1.875rem] font-semibold tracking-tight tabular-nums font-mono my-1"
                        data-numeric="true"
                    >
                        {formatAmount(safeToSpend.safeToSpendTotal, fmt(safeToSpend.safeToSpendTotal))}
                    </h3>
                </div>

                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
                            {formatAmount(safeToSpend.dailySafeAllowance, fmt(safeToSpend.dailySafeAllowance))}/day
                        </span>
                        <span className="text-[var(--color-text-muted)] text-[11px] font-medium">
                            {safeToSpend.daysRemaining} days left
                        </span>
                    </div>
                </div>

                {/* Interactive Formula Popover */}
                {showFormulaPopover && (
                    <div
                        ref={popoverRef}
                        className="absolute top-[calc(100%+6px)] left-0 w-72 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl z-40 text-xs space-y-2.5 backdrop-blur-md"
                    >
                        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                            <span className="font-semibold text-[var(--color-text-main)]">Safe-to-Spend Formula</span>
                            <button
                                type="button"
                                onClick={() => setShowFormulaPopover(false)}
                                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>
                        <div className="space-y-1.5 tabular-nums font-mono">
                            <div className="flex justify-between text-emerald-500">
                                <span className="text-[var(--color-text-muted)] font-sans">Liquid Cash:</span>
                                <span>+{formatAmount(safeToSpend.liquidCash, fmt(safeToSpend.liquidCash))}</span>
                            </div>
                            <div className="flex justify-between text-rose-500">
                                <span className="text-[var(--color-text-muted)] font-sans">Upcoming Bills:</span>
                                <span>-{formatAmount(safeToSpend.upcomingCommittedBills, fmt(safeToSpend.upcomingCommittedBills))}</span>
                            </div>
                            <div className="flex justify-between text-amber-500">
                                <span className="text-[var(--color-text-muted)] font-sans">Budget & Goals:</span>
                                <span>-{formatAmount(safeToSpend.remainingBudgetReservations, fmt(safeToSpend.remainingBudgetReservations))}</span>
                            </div>
                            <div className="flex justify-between text-rose-500">
                                <span className="text-[var(--color-text-muted)] font-sans">Card Balances:</span>
                                <span>-{formatAmount(safeToSpend.creditCardCurrentBalance, fmt(safeToSpend.creditCardCurrentBalance))}</span>
                            </div>
                            <div className="border-t border-[var(--border-subtle)] pt-1.5 flex justify-between font-bold text-[var(--color-text-main)]">
                                <span className="font-sans">Free Cashflow:</span>
                                <span>{formatAmount(safeToSpend.safeToSpendTotal, fmt(safeToSpend.safeToSpendTotal))}</span>
                            </div>
                        </div>
                    </div>
                )}
            </TiltCard>

            {/* ── CARD 2: Net Worth & Liquid Ratio ── */}
            <TiltCard
                className="p-5 lg:p-6 rounded-2xl relative overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] flex flex-col justify-between"
            >
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[var(--color-text-muted)] text-xs font-semibold tracking-wider uppercase">
                            Net Worth
                        </span>
                        <span className="material-symbols-outlined text-[20px] text-blue-500 opacity-90">
                            account_balance
                        </span>
                    </div>

                    <h3
                        className="text-[var(--color-text-main)] text-2xl lg:text-[1.875rem] font-semibold tracking-tight tabular-nums font-mono my-1"
                        data-numeric="true"
                    >
                        {formatAmount(totalNetWorth, fmt(totalNetWorth))}
                    </h3>
                </div>

                <div className="flex items-center justify-between gap-1.5 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                    <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-md flex items-center gap-0.5 tabular-nums font-mono ${
                            netSavingsDelta >= 0
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                        data-numeric="true"
                    >
                        <span className="material-symbols-outlined text-[13px]">
                            {netSavingsDelta >= 0 ? 'trending_up' : 'trending_down'}
                        </span>
                        {netWorthMoMPercent >= 0 ? '+' : ''}{netWorthMoMPercent.toFixed(1)}%
                    </span>
                    <span className="text-[var(--color-text-muted)] text-[11px] font-medium tabular-nums font-mono">
                        {liquidRatio}% liquid
                    </span>
                </div>
            </TiltCard>

            {/* ── CARD 3: Monthly Spending & Pacing Velocity ── */}
            <TiltCard
                className="p-5 lg:p-6 rounded-2xl relative overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] flex flex-col justify-between"
            >
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[var(--color-text-muted)] text-xs font-semibold tracking-wider uppercase">
                            Monthly Spending
                        </span>
                        <span className="material-symbols-outlined text-[20px] text-amber-500 opacity-90">
                            shopping_bag
                        </span>
                    </div>

                    <h3
                        className="text-[var(--color-text-main)] text-2xl lg:text-[1.875rem] font-semibold tracking-tight tabular-nums font-mono my-1"
                        data-numeric="true"
                    >
                        {formatAmount(monthlyExpenses, fmt(monthlyExpenses))}
                    </h3>
                </div>

                <div className="flex items-center justify-between gap-1.5 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                    <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-md flex items-center gap-0.5 tabular-nums font-mono ${
                            isPaceFavorable
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                        data-numeric="true"
                    >
                        <span className="material-symbols-outlined text-[13px]">
                            {isPaceFavorable ? 'speed' : 'trending_up'}
                        </span>
                        {paceMetrics.paceDeltaPercent >= 0 ? '+' : ''}{paceMetrics.paceDeltaPercent.toFixed(1)}% pace
                    </span>
                    <span className="text-[var(--color-text-muted)] text-[11px] font-medium tabular-nums font-mono truncate max-w-[110px]" title={`Projected: ${fmt(paceMetrics.projectedMonthEndSpend)}`}>
                        proj {formatAmount(paceMetrics.projectedMonthEndSpend, fmt(paceMetrics.projectedMonthEndSpend))}
                    </span>
                </div>
            </TiltCard>

            {/* ── CARD 4: Net Cashflow & Savings Rate ── */}
            <TiltCard
                className="p-5 lg:p-6 rounded-2xl relative overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] flex flex-col justify-between"
            >
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[var(--color-text-muted)] text-xs font-semibold tracking-wider uppercase">
                            Net Cashflow
                        </span>
                        <span className="material-symbols-outlined text-[20px] text-teal-500 opacity-90">
                            savings
                        </span>
                    </div>

                    <h3
                        className={`text-2xl lg:text-[1.875rem] font-semibold tracking-tight tabular-nums font-mono my-1 ${
                            netCashflow >= 0 ? 'text-[var(--color-text-main)]' : 'text-rose-600 dark:text-rose-400'
                        }`}
                        data-numeric="true"
                    >
                        {formatAmount(netCashflow, fmt(netCashflow))}
                    </h3>
                </div>

                <div className="space-y-1.5 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 tabular-nums font-mono">
                            {savingsRate.toFixed(1)}% saved
                        </span>
                        <span className="text-[var(--color-text-muted)] text-[11px] font-medium">
                            Target: 20%
                        </span>
                    </div>
                    {/* Micro Benchmark Progress Bar */}
                    <div className="w-full h-1 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 rounded-full ${
                                savingsRate >= 20 ? 'bg-emerald-500' : 'bg-teal-500'
                            }`}
                            style={{ width: `${savingsProgressPct}%` }}
                        />
                    </div>
                </div>
            </TiltCard>
        </div>
    );
};
