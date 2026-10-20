'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useCurrency } from '@/hooks/useCurrency';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { simulatePayoff, type DebtSimulationInput } from '@/services/debt.service';

interface WhatIfSimulatorProps {
  initialDebts?: DebtSimulationInput[];
  compact?: boolean;
}

export default function WhatIfSimulator({ initialDebts, compact = false }: WhatIfSimulatorProps) {
  const { fmt, symbol } = useCurrency();
  const { formatAmount } = usePrivacy();

  // Mode: Debt Payoff Acceleration vs. Wealth Accumulator
  const [activeTab, setActiveTab] = useState<'debt' | 'invest'>('debt');

  // Fetch debts if not passed via props
  const { data: debtsData, isLoading } = useSWR<{ debts: DebtSimulationInput[] }>(
    initialDebts ? null : '/api/debts'
  );

  const debtsList = useMemo(() => {
    return initialDebts || debtsData?.debts || [];
  }, [initialDebts, debtsData]);

  // Debt Freedom Simulator Controls
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [extraPayment, setExtraPayment] = useState<number>(5000);

  // Wealth Accumulator Controls (Compound Growth)
  const [monthlyInvest, setMonthlyInvest] = useState<number>(5000);
  const [returnRate, setReturnRate] = useState<number>(8);
  const [investYears, setInvestYears] = useState<number>(10);

  // Active debt metrics
  const activeDebts = useMemo(() => {
    return debtsList.filter((d) => (Number(d.balance) || 0) > 0);
  }, [debtsList]);

  const totalCurrentDebt = useMemo(() => {
    return activeDebts.reduce((sum, d) => sum + (Number(d.balance) || 0), 0);
  }, [activeDebts]);

  const totalMinPayment = useMemo(() => {
    return activeDebts.reduce((sum, d) => sum + (Number(d.minimumPayment) || 0), 0);
  }, [activeDebts]);

  // Run simulation calculations
  const { baseline, accelerated } = useMemo(() => {
    if (activeDebts.length === 0) {
      return {
        baseline: simulatePayoff([], 'baseline', 0),
        accelerated: simulatePayoff([], strategy, extraPayment),
      };
    }
    const base = simulatePayoff(activeDebts, 'baseline', 0);
    const accel = simulatePayoff(activeDebts, strategy, extraPayment);
    return { baseline: base, accelerated: accel };
  }, [activeDebts, strategy, extraPayment]);

  // Prepare combined timeline data for comparison chart
  const debtChartData = useMemo(() => {
    const maxMonths = Math.max(baseline.months, accelerated.months);
    const basePointsMap = new Map<number, number>();
    baseline.points.forEach((p) => basePointsMap.set(p.month, p.balance));

    const accelPointsMap = new Map<number, number>();
    accelerated.points.forEach((p) => accelPointsMap.set(p.month, p.balance));

    const data: Array<{
      month: number;
      label: string;
      baselineBalance: number;
      acceleratedBalance: number;
    }> = [];

    const now = new Date();
    for (let m = 0; m <= maxMonths; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      data.push({
        month: m,
        label,
        baselineBalance: basePointsMap.get(m) ?? 0,
        acceleratedBalance: accelPointsMap.get(m) ?? 0,
      });
    }

    return data;
  }, [baseline, accelerated]);

  // Investment chart data
  const investChartData = useMemo(() => {
    const r = returnRate / 100 / 12;
    const points: Array<{ year: string; balance: number; contributions: number }> = [];

    for (let y = 0; y <= investYears; y++) {
      const n = y * 12;
      const fv = n === 0 ? 0 : monthlyInvest * ((Math.pow(1 + r, n) - 1) / r);
      points.push({
        year: `Yr ${y}`,
        balance: Math.round(fv),
        contributions: Math.round(monthlyInvest * n),
      });
    }
    return points;
  }, [monthlyInvest, returnRate, investYears]);

  const investFinalValue = investChartData[investChartData.length - 1]?.balance || 0;
  const investTotalContributions = monthlyInvest * investYears * 12;
  const investTotalGains = Math.max(0, investFinalValue - investTotalContributions);

  return (
    <div className="card-premium rounded-3xl p-6 lg:p-7 border border-gray-200/80 dark:border-white/5 bg-white dark:bg-surface-dark shadow-sm">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-150 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">
              {activeTab === 'debt' ? 'speed' : 'trending_up'}
            </span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {activeTab === 'debt' ? 'Debt Freedom Accelerator' : 'Compound Wealth Simulator'}
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
            {activeTab === 'debt'
              ? 'Model accelerated principal payoff scenarios with Snowball vs. Avalanche cascades'
              : 'Simulate long-term capital compounding and investment returns over time'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex items-center p-1 rounded-xl bg-gray-150/70 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('debt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'debt'
                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">credit_score</span>
            <span>Debt Freedom</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invest')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'invest'
                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">savings</span>
            <span>Wealth Growth</span>
          </button>
        </div>
      </div>

      {activeTab === 'debt' ? (
        activeDebts.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-3xl">verified</span>
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white">You Are 100% Debt-Free!</h4>
            <p className="text-xs text-gray-500 dark:text-text-muted max-w-sm mx-auto mt-1 mb-4">
              No outstanding liabilities found. Switch to the Wealth Growth tab to simulate investing your monthly cashflow.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('invest')}
              className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-md hover:opacity-90 transition-all inline-flex items-center gap-1.5"
            >
              <span>Explore Wealth Growth</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        ) : (
          <div>
            {/* Strategy & Slider Controls */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-6">
              {/* Extra Payment Slider */}
              <div className="md:col-span-7 bg-gray-50/80 dark:bg-white/[0.02] p-4 rounded-2xl border border-gray-150 dark:border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Monthly Prepayment Acceleration
                  </label>
                  <span className="text-sm font-mono font-bold text-primary tabular-nums">
                    +{formatAmount(extraPayment, fmt(extraPayment))} / mo
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50000}
                  step={500}
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
                  <span>+{formatAmount(0, fmt(0))}</span>
                  <span>+{formatAmount(25000, fmt(25000))}</span>
                  <span>+{formatAmount(50000, fmt(50000))}</span>
                </div>
              </div>

              {/* Strategy Selector */}
              <div className="md:col-span-5 bg-gray-50/80 dark:bg-white/[0.02] p-4 rounded-2xl border border-gray-150 dark:border-white/5 flex flex-col justify-between">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Payoff Strategy
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStrategy('avalanche')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center border ${
                      strategy === 'avalanche'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-primary/50'
                    }`}
                  >
                    <span>Avalanche</span>
                    <span className="block text-[10px] opacity-75 font-normal">Max Interest Saved</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStrategy('snowball')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center border ${
                      strategy === 'snowball'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-primary/50'
                    }`}
                  >
                    <span>Snowball</span>
                    <span className="block text-[10px] opacity-75 font-normal">Fastest Wins</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Impact Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Debt-Free Horizon
                </span>
                <span className="text-base font-bold text-gray-900 dark:text-white block mt-0.5 font-mono">
                  {accelerated.debtFreeDate}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 inline-flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">schedule</span>
                  {accelerated.monthsSaved > 0
                    ? `${accelerated.monthsSaved} mos earlier`
                    : 'Baseline pace'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Interest Savings
                </span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono tabular-nums">
                  {formatAmount(accelerated.interestSaved, fmt(accelerated.interestSaved))}
                </span>
                <span className="text-[10px] text-gray-400 block mt-1">
                  vs. baseline minimums
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Monthly Commitment
                </span>
                <span className="text-base font-bold text-gray-900 dark:text-white block mt-0.5 font-mono tabular-nums">
                  {formatAmount(totalMinPayment + extraPayment, fmt(totalMinPayment + extraPayment))}
                </span>
                <span className="text-[10px] text-gray-400 block mt-1 font-mono">
                  Min: {formatAmount(totalMinPayment, fmt(totalMinPayment))}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Remaining Principal
                </span>
                <span className="text-base font-bold text-gray-900 dark:text-white block mt-0.5 font-mono tabular-nums">
                  {formatAmount(totalCurrentDebt, fmt(totalCurrentDebt))}
                </span>
                <span className="text-[10px] text-gray-400 block mt-1">
                  {activeDebts.length} active {activeDebts.length === 1 ? 'liability' : 'liabilities'}
                </span>
              </div>
            </div>

            {/* Amortization Curve Chart */}
            <div className="h-[260px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={debtChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="accelGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.ceil(debtChartData.length / 8)}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${symbol}${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="rounded-2xl border border-gray-150 dark:border-white/10 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-xl p-3 shadow-xl text-xs font-mono">
                          <p className="font-bold text-gray-900 dark:text-white mb-1.5">{label}</p>
                          <p className="text-primary font-bold">
                            Accelerated: {formatAmount(d.acceleratedBalance, fmt(d.acceleratedBalance))}
                          </p>
                          <p className="text-gray-400 font-medium">
                            Baseline: {formatAmount(d.baselineBalance, fmt(d.baselineBalance))}
                          </p>
                        </div>
                      );
                    }}
                  />
                  {/* Baseline: Slate dashed line */}
                  <Area
                    type="monotone"
                    dataKey="baselineBalance"
                    stroke="#94A3B8"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    fill="none"
                    name="Baseline Pace"
                  />
                  {/* Accelerated: Indigo Solid area */}
                  <Area
                    type="monotone"
                    dataKey="acceleratedBalance"
                    stroke="#4F46E5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#accelGradient)"
                    name="Accelerated Strategy"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Legend & Milestone Hint */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-150 dark:border-white/5 text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-0.5 bg-primary inline-block"></span>
                  <span>Accelerated ({strategy})</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-0.5 bg-slate-400 border-b border-dashed inline-block"></span>
                  <span>Minimums Only</span>
                </span>
              </div>
              {accelerated.milestones.length > 0 && (
                <span className="text-[11px] text-gray-400">
                  Next target:{' '}
                  <strong className="text-gray-700 dark:text-gray-300">
                    {accelerated.milestones[0].debtName}
                  </strong>{' '}
                  (eliminates in {accelerated.milestones[0].month} mo{accelerated.milestones[0].month > 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>
        )
      ) : (
        /* Wealth Accumulator View */
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Monthly Deposit
                </label>
                <span className="text-sm font-bold font-mono text-gray-900 dark:text-white tabular-nums">
                  {formatAmount(monthlyInvest, fmt(monthlyInvest))}
                </span>
              </div>
              <input
                type="range"
                min={500}
                max={100000}
                step={500}
                value={monthlyInvest}
                onChange={(e) => setMonthlyInvest(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Expected Return (CAGR)
                </label>
                <span className="text-sm font-bold font-mono text-gray-900 dark:text-white">
                  {returnRate}%
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={returnRate}
                onChange={(e) => setReturnRate(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Time Horizon
                </label>
                <span className="text-sm font-bold font-mono text-gray-900 dark:text-white">
                  {investYears} Years
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={investYears}
                onChange={(e) => setInvestYears(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>

          {/* Impact Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Projected Portfolio
              </span>
              <span className="text-lg font-bold font-mono text-primary block mt-0.5 tabular-nums">
                {formatAmount(investFinalValue, fmt(investFinalValue))}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Your Contributions
              </span>
              <span className="text-lg font-bold font-mono text-gray-900 dark:text-white block mt-0.5 tabular-nums">
                {formatAmount(investTotalContributions, fmt(investTotalContributions))}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Compound Returns Earned
              </span>
              <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5 tabular-nums">
                +{formatAmount(investTotalGains, fmt(investTotalGains))}
              </span>
            </div>
          </div>

          {/* Compound Growth Area Chart */}
          <div className="h-[240px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={investChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="wealthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${symbol}${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="rounded-2xl border border-gray-150 dark:border-white/10 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-xl p-3 shadow-xl text-xs font-mono">
                        <p className="font-bold text-gray-900 dark:text-white mb-1">{label}</p>
                        <p className="text-emerald-500 font-bold">
                          Total Value: {formatAmount(d.balance, fmt(d.balance))}
                        </p>
                        <p className="text-gray-400">
                          Deposited: {formatAmount(d.contributions, fmt(d.contributions))}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#wealthGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
