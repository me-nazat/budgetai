'use client';

/**
 * @fileoverview Master Institutional Balance Sheet & Capital Workspace Hub.
 *
 * Features:
 * - Unified Capital Workspace switcher (Balance Sheet | Investment Portfolio | Debt Payoff)
 * - Top Hero Chart: Tri-color area chart (Assets in emerald, Liabilities in rose, Net Worth line in sky)
 * - Time Horizon selector: 3M | 6M | 1Y | All
 * - Two-Column Master Institutional Balance Sheet:
 *     - Left Column (Total Assets): Liquid Cash & Bank Accounts, Investments & Holdings, Receivables Owed to You
 *     - Right Column (Total Liabilities): Credit Card Balances, Loans & Mortgages, Payables You Owe
 * - Strict Purple Ban Compliant
 *
 * @module app/(app)/networth/page
 */

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { useCurrency } from '@/hooks/useCurrency';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useInvalidate } from '@/hooks/useInvalidate';
import { CapitalNavSwitcher } from '@/components/CapitalNavSwitcher';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { NetWorthComprehensiveResponse } from '@/services/networth.service';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NetWorthPage() {
  const { fmt } = useCurrency();
  const { formatAmount } = usePrivacy();
  const { invalidate } = useInvalidate();

  const { data, isLoading, mutate } = useSWR<NetWorthComprehensiveResponse>(
    '/api/networth',
    fetcher
  );

  const [timeHorizon, setTimeHorizon] = useState<'3M' | '6M' | '1Y' | 'All'>('1Y');
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotAmount, setSnapshotAmount] = useState('');
  const [snapshotNote, setSnapshotNote] = useState('');
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);

  const breakdown = data?.currentBreakdown;
  const history = data?.history;

  // Chart Series based on horizon
  const chartSeries = useMemo(() => {
    if (!history) return [];
    const base = history.oneYear || [];
    if (timeHorizon === 'All') return history.fiveYear || base;
    if (timeHorizon === '3M') return base.slice(-3);
    if (timeHorizon === '6M') return base.slice(-6);
    return base;
  }, [history, timeHorizon]);

  // Delta calculations
  const horizonDelta = useMemo(() => {
    if (chartSeries.length < 2) return { amount: 0, percent: 0 };
    const first = chartSeries[0].netWorth;
    const last = chartSeries[chartSeries.length - 1].netWorth;
    const diff = last - first;
    const pct = first > 0 ? (diff / first) * 100 : 0;
    return { amount: diff, percent: pct };
  }, [chartSeries]);

  const totalAssets = breakdown?.totalAssets || 0;
  const totalLiabilities = breakdown?.totalLiabilities || 0;
  const netWorthVal = breakdown?.netWorth || totalAssets - totalLiabilities;
  const debtRatio = breakdown?.debtToAssetRatio || (totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0);

  // Asset Categories
  const liquidCash = breakdown?.liquidCash || 0;
  const investments = breakdown?.investments || 0;
  const realEstate = breakdown?.realEstate || 0;
  const collaborativeReceivables = breakdown?.netCollaborativeReceivables || 0;

  // Liability Categories
  const creditCards = breakdown?.creditCards || 0;
  const loans = breakdown?.loans || 0;
  const mortgages = breakdown?.mortgages || 0;
  const collaborativePayables = breakdown?.netCollaborativePayables || 0;

  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(snapshotAmount);
    if (isNaN(amt)) {
      toast.error('Please enter a valid snapshot amount');
      return;
    }

    setIsSavingSnapshot(true);
    try {
      const res = await fetch('/api/networth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          note: snapshotNote || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to record balance sheet snapshot');

      toast.success('Balance sheet snapshot recorded!');
      setIsSnapshotModalOpen(false);
      setSnapshotAmount('');
      setSnapshotNote('');
      await mutate();
      await invalidate('all');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-24">
      <Toaster position="top-center" richColors />

      {/* Unified Capital Workspace Navigation Switcher */}
      <CapitalNavSwitcher />

      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">
            Master Balance Sheet
          </p>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Institutional Capital Workspace
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Comprehensive audit of all global assets, debts, and collaborative receivables.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSnapshotAmount(String(netWorthVal > 0 ? netWorthVal : ''));
            setIsSnapshotModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-bold text-gray-200 border border-white/10 flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">camera</span>
          Record Snapshot
        </button>
      </div>

      {/* 3 Master Balance Sheet KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Net Worth */}
        <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/5 relative overflow-hidden group hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold mb-2">
            <span>Net Worth (Equity)</span>
            <span className="material-symbols-outlined text-sky-400 text-[18px]">account_balance</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight">
            {formatAmount(netWorthVal, fmt(netWorthVal))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
            <span className={horizonDelta.amount >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {horizonDelta.amount >= 0 ? '+' : ''}
              {fmt(horizonDelta.amount)} ({horizonDelta.percent.toFixed(1)}%)
            </span>
            <span>in selected horizon</span>
          </p>
        </div>

        {/* KPI 2: Total Assets */}
        <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold mb-2">
            <span>Total Capital Assets</span>
            <span className="material-symbols-outlined text-emerald-400 text-[18px]">trending_up</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums tracking-tight">
            {formatAmount(totalAssets, fmt(totalAssets))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Cash, holdings & receivables
          </p>
        </div>

        {/* KPI 3: Total Liabilities */}
        <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/5 relative overflow-hidden group hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold mb-2">
            <span>Total Liabilities</span>
            <span className="material-symbols-outlined text-rose-400 text-[18px]">credit_card</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-400 tabular-nums tracking-tight">
            {formatAmount(totalLiabilities, fmt(totalLiabilities))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Debt-to-Asset Ratio: <span className="font-mono font-bold text-gray-300">{debtRatio.toFixed(1)}%</span>
          </p>
        </div>
      </div>

      {/* Top Hero Chart: Tri-Color Area Chart (Assets in emerald, Liabilities in rose, Net Worth line in sky) */}
      <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 space-y-4 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">stacked_line_chart</span>
              Capital Trajectory Audit
            </h2>
            <p className="text-xs text-gray-400">Historical asset accumulation vs. liability retirement.</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Chart Legend */}
            <div className="hidden md:flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="size-2.5 rounded-full bg-emerald-400" />
                Assets
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="size-2.5 rounded-full bg-rose-400" />
                Liabilities
              </span>
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="size-2.5 rounded-full bg-sky-400" />
                Net Worth
              </span>
            </div>

            {/* Period Pills: 3M | 6M | 1Y | All */}
            <div className="inline-flex p-1 rounded-xl bg-slate-800 border border-white/10">
              {(['3M', '6M', '1Y', 'All'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setTimeHorizon(period)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                    timeHorizon === period
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          {isLoading ? (
            <div className="h-full w-full flex items-center justify-center text-gray-500 text-xs">
              Loading financial trajectory...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="assetGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="liabilityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`
                  }
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '1rem',
                    fontSize: '12px',
                  }}
                  formatter={(val: any, name: any) => [
                    fmt(Number(val)),
                    name === 'assets' ? 'Total Assets' : name === 'liabilities' ? 'Total Liabilities' : 'Net Worth',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="assets"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#assetGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="liabilities"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#liabilityGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  dot={{ fill: '#0ea5e9', r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Two-Column Master Institutional Balance Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Total Assets */}
        <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 space-y-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">account_balance_wallet</span>
              <h2 className="text-base font-black text-white">Assets (What You Own)</h2>
            </div>
            <span className="font-mono font-black text-lg text-emerald-400 tabular-nums">
              {formatAmount(totalAssets, fmt(totalAssets))}
            </span>
          </div>

          <div className="space-y-4">
            {/* Liquid Cash & Bank Accounts */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Liquid Cash & Bank Accounts</h3>
                  <p className="text-[11px] text-gray-400">Checking, savings & cash-in-hand</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-sm text-white tabular-nums">
                  {fmt(liquidCash)}
                </span>
                <Link
                  href="/accounts"
                  className="size-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
                  title="View Accounts"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Investments & Portfolio */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">show_chart</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Investments & Market Holdings</h3>
                  <p className="text-[11px] text-gray-400">Equities, bonds, mutual funds & crypto</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-sm text-white tabular-nums">
                  {fmt(investments)}
                </span>
                <Link
                  href="/investments"
                  className="size-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
                  title="View Investments"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Real Estate & Physical Holdings */}
            {realEstate > 0 && (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">domain</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Real Estate & Fixed Capital</h3>
                    <p className="text-[11px] text-gray-400">Properties, bullion, land</p>
                  </div>
                </div>
                <span className="font-mono font-black text-sm text-white tabular-nums">
                  {fmt(realEstate)}
                </span>
              </div>
            )}

            {/* Collaborative Receivables */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">group</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Receivables Owed to You</h3>
                  <p className="text-[11px] text-gray-400">Trips, shared bills & roommate splits</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-sm text-emerald-400 tabular-nums">
                  +{fmt(collaborativeReceivables)}
                </span>
                <Link
                  href="/household"
                  className="size-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
                  title="View Household"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Total Liabilities */}
        <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 space-y-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-400">credit_card</span>
              <h2 className="text-base font-black text-white">Liabilities (What You Owe)</h2>
            </div>
            <span className="font-mono font-black text-lg text-rose-400 tabular-nums">
              {formatAmount(totalLiabilities, fmt(totalLiabilities))}
            </span>
          </div>

          <div className="space-y-4">
            {/* Credit Card Balances */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-rose-500/30 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">credit_card</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Credit Card Balances</h3>
                  <p className="text-[11px] text-gray-400">Revolving credit card limits drawn</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-sm text-rose-400 tabular-nums">
                  {fmt(creditCards)}
                </span>
                <Link
                  href="/accounts"
                  className="size-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
                  title="View Cards"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Loans & Mortgages */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-rose-500/30 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">account_balance</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Term Loans & Mortgages</h3>
                  <p className="text-[11px] text-gray-400">Personal loans, auto loans, education</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-sm text-rose-400 tabular-nums">
                  {fmt(loans + mortgages)}
                </span>
                <Link
                  href="/debts"
                  className="size-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
                  title="View Debts"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Payables You Owe */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-rose-500/30 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">group_remove</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Payables You Owe</h3>
                  <p className="text-[11px] text-gray-400">Shared group debts & pending bill IOUs</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-sm text-amber-400 tabular-nums">
                  {fmt(collaborativePayables)}
                </span>
                <Link
                  href="/household"
                  className="size-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
                  title="View Household"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot Modal */}
      <AnimatePresence>
        {isSnapshotModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSnapshotModalOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#0f172a] border border-white/10 rounded-3xl p-6 shadow-2xl z-10 space-y-4"
            >
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">camera</span>
                Record Balance Sheet Snapshot
              </h3>
              <p className="text-xs text-gray-400">
                Freeze current net worth state to audit capital progression over time.
              </p>

              <form onSubmit={handleSaveSnapshot} className="space-y-4 text-xs">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Net Worth Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={snapshotAmount}
                    onChange={(e) => setSnapshotAmount(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white font-mono font-bold text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Audit Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. End of Q3 Rebalance, Bonus credited"
                    value={snapshotNote}
                    onChange={(e) => setSnapshotNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-bold outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSnapshotModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSnapshot}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white shadow-lg"
                  >
                    {isSavingSnapshot ? 'Recording...' : 'Save Snapshot'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
