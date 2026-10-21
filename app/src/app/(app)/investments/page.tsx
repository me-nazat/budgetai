'use client';

/**
 * @fileoverview Minimalist Institutional Investment Portfolio Tracker.
 *
 * Features:
 * - Unified Capital Workspace switcher (Balance Sheet | Investment Portfolio | Debt Payoff)
 * - 3 Core KPIs with tabular-nums: Total Portfolio Value, Total Cost Basis, All-Time Unrealized Return
 * - Horizontal Asset Class Allocation Bar (Equities, Fixed/Bonds, Real Estate/Gold, Crypto, Cash)
 * - Scannable Holdings Table with inline Update Value / Log Buy-Sell
 * - Strict Purple Ban Compliant
 *
 * @module app/(app)/investments/page
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { useCurrency } from '@/hooks/useCurrency';
import { CapitalNavSwitcher } from '@/components/CapitalNavSwitcher';
import { Toaster, toast } from 'sonner';

interface Holding {
  id: number;
  assetType: string;
  ticker: string;
  name: string;
  quantity: number;
  avgCostBasis: number;
  currency: string;
  notes: string | null;
  livePrice: number | null;
  costBasis: number;
  currentValue: number | null;
  gainLoss: number | null;
  gainLossPercent: number | null;
}

interface PortfolioSummary {
  totalInvested: number;
  totalCurrentValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdingCount: number;
}

interface PortfolioResponse {
  holdings: Holding[];
  summary: PortfolioSummary;
}

const ASSET_CLASSES = [
  { value: 'stock', label: 'Equities / Stocks', icon: 'trending_up', color: '#10b981' },
  { value: 'bond', label: 'Fixed / Bonds / Sanchayapatra', icon: 'account_balance', color: '#0ea5e9' },
  { value: 'real_estate', label: 'Real Estate / Gold', icon: 'domain', color: '#f59e0b' },
  { value: 'crypto', label: 'Crypto', icon: 'currency_bitcoin', color: '#0284c7' },
  { value: 'cash', label: 'Cash & Cash-Equivalents', icon: 'payments', color: '#64748b' },
  { value: 'etf', label: 'ETFs & Mutual Funds', icon: 'pie_chart', color: '#38bdf8' },
  { value: 'other', label: 'Alternative Assets', icon: 'category', color: '#94a3b8' },
] as const;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function InvestmentsPage() {
  const { fmt } = useCurrency();
  const { data, isLoading } = useSWR<PortfolioResponse>('/api/investments', fetcher);

  const [showModal, setShowModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const holdings = useMemo(() => data?.holdings || [], [data?.holdings]);
  const summary = useMemo(
    () =>
      data?.summary || {
        totalInvested: 0,
        totalCurrentValue: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        holdingCount: 0,
      },
    [data?.summary]
  );

  const getAssetClass = (type: string) => {
    return ASSET_CLASSES.find((a) => a.value === type) || ASSET_CLASSES[0];
  };

  // Compute exact allocation breakdown
  const allocationBreakdown = useMemo(() => {
    const totalVal = summary.totalCurrentValue || summary.totalInvested || 1;
    return ASSET_CLASSES.map((ac) => {
      const classHoldings = holdings.filter(
        (h) => h.assetType === ac.value || (ac.value === 'stock' && h.assetType === 'etf')
      );
      const val = classHoldings.reduce((sum, h) => sum + (h.currentValue ?? h.costBasis ?? 0), 0);
      const pct = (val / totalVal) * 100;
      return {
        ...ac,
        value: val,
        percentage: Math.round(pct * 10) / 10,
        count: classHoldings.length,
      };
    }).filter((a) => a.value > 0);
  }, [holdings, summary]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this holding?')) return;
    setDeletingId(id);
    try {
      const res = await fetch('/api/investments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete holding');
      toast.success('Holding removed');
      mutate('/api/investments');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
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
            Institutional Capital Workspace
          </p>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Investment Portfolio
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Real asset allocation, cost basis tracking, and true all-time unrealized gains.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingHolding(null);
            setShowModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Log Holding
        </button>
      </div>

      {/* 3 Core KPIs (tabular-nums) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Total Portfolio Value */}
        <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold mb-2">
            <span>Total Portfolio Value</span>
            <span className="material-symbols-outlined text-emerald-400 text-[18px]">account_balance_wallet</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight">
            {fmt(summary.totalCurrentValue || summary.totalInvested)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
            <span>{summary.holdingCount} Active Assets</span>
            <span>•</span>
            <span>Live Valuations</span>
          </p>
        </div>

        {/* KPI 2: Total Cost Basis */}
        <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/5 relative overflow-hidden group hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold mb-2">
            <span>Total Cost Basis</span>
            <span className="material-symbols-outlined text-sky-400 text-[18px]">savings</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight">
            {fmt(summary.totalInvested)}
          </div>
          <p className="text-[11px] text-sky-400/80 mt-1.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">paid</span>
            Cumulative capital deployed
          </p>
        </div>

        {/* KPI 3: All-Time Unrealized Return ($ and %) */}
        <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/5 relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold mb-2">
            <span>All-Time Unrealized Return</span>
            <span
              className={`material-symbols-outlined text-[18px] ${
                summary.totalGainLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.totalGainLoss >= 0 ? 'trending_up' : 'trending_down'}
            </span>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight flex items-baseline gap-2 ${
              summary.totalGainLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            <span>
              {summary.totalGainLoss >= 0 ? '+' : ''}
              {fmt(summary.totalGainLoss)}
            </span>
            <span className="text-sm font-bold opacity-80">
              ({summary.totalGainLossPercent >= 0 ? '+' : ''}
              {summary.totalGainLossPercent.toFixed(2)}%)
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">Net capital appreciation</p>
        </div>
      </div>

      {/* Asset Class Allocation Bar */}
      <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">pie_chart</span>
              Asset Class Allocation Weight
            </h2>
            <p className="text-xs text-gray-400">Institutional exposure distribution across asset classes.</p>
          </div>
        </div>

        {allocationBreakdown.length === 0 ? (
          <div className="h-6 w-full bg-slate-800 rounded-full flex items-center justify-center text-[10px] text-gray-500">
            No holdings logged yet
          </div>
        ) : (
          <div className="space-y-3">
            {/* Horizontal Stacked Bar */}
            <div className="h-4 w-full rounded-full bg-slate-800 overflow-hidden flex">
              {allocationBreakdown.map((ac) => (
                <div
                  key={ac.value}
                  style={{
                    width: `${ac.percentage}%`,
                    backgroundColor: ac.color,
                  }}
                  className="h-full transition-all duration-500 hover:opacity-80"
                  title={`${ac.label}: ${ac.percentage}% (${fmt(ac.value)})`}
                />
              ))}
            </div>

            {/* Chips Legend */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {allocationBreakdown.map((ac) => (
                <div
                  key={ac.value}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs"
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: ac.color }} />
                  <span className="font-bold text-gray-300">{ac.label}</span>
                  <span className="font-mono font-black text-white tabular-nums">{ac.percentage}%</span>
                  <span className="text-[11px] text-gray-500">({fmt(ac.value)})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clean Holdings Table */}
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-400">list_alt</span>
            Holdings & Position Ledger
          </h2>
          <span className="text-xs font-bold text-gray-400">{holdings.length} Assets</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400">
            <span className="size-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block mb-2" />
            <p className="text-xs">Loading portfolio holdings...</p>
          </div>
        ) : holdings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-gray-600">inventory_2</span>
            <p className="text-sm font-bold text-white">No Investment Positions Logged</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Add your stocks, fixed deposits, bonds, or bullion holdings to track portfolio performance.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingHolding(null);
                setShowModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white shadow-lg inline-block"
            >
              Add First Position
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/50 text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-white/5">
                <tr>
                  <th className="py-3.5 px-4">Asset / Ticker</th>
                  <th className="py-3.5 px-4">Asset Class</th>
                  <th className="py-3.5 px-4 text-right">Units</th>
                  <th className="py-3.5 px-4 text-right">Avg Cost</th>
                  <th className="py-3.5 px-4 text-right">Current Value</th>
                  <th className="py-3.5 px-4 text-right">Total Return</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {holdings.map((h) => {
                  const ac = getAssetClass(h.assetType);
                  const isPositive = (h.gainLossPercent ?? 0) >= 0;
                  const currentVal = h.currentValue !== null ? h.currentValue : h.costBasis;

                  return (
                    <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="size-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${ac.color}15`, color: ac.color }}
                          >
                            <span className="material-symbols-outlined text-[16px]">{ac.icon}</span>
                          </div>
                          <div>
                            <span className="font-black text-white text-sm block">{h.ticker}</span>
                            <span className="text-[11px] text-gray-400 truncate max-w-[150px] block">
                              {h.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider"
                          style={{ backgroundColor: `${ac.color}15`, color: ac.color }}
                        >
                          {ac.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-300 tabular-nums">
                        {h.quantity}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-300 tabular-nums">
                        {fmt(h.avgCostBasis)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-black text-white tabular-nums">
                        {fmt(currentVal)}
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums">
                        <span
                          className={`font-mono font-black text-xs block ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {fmt(h.gainLoss ?? 0)}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            isPositive ? 'text-emerald-400/80' : 'text-rose-400/80'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {(h.gainLossPercent ?? 0).toFixed(2)}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingHolding(h);
                              setShowModal(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-600/20 text-gray-300 hover:text-emerald-300 transition-colors text-[11px] font-bold"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(h.id)}
                            disabled={deletingId === h.id}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-gray-500 hover:text-rose-400 transition-colors"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log/Update Holding Modal */}
      <AnimatePresence>
        {showModal && (
          <HoldingModal
            holding={editingHolding}
            onClose={() => {
              setShowModal(false);
              setEditingHolding(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function HoldingModal({ holding, onClose }: { holding: Holding | null; onClose: () => void }) {
  const isEdit = !!holding;
  const [assetType, setAssetType] = useState(holding?.assetType || 'stock');
  const [ticker, setTicker] = useState(holding?.ticker || '');
  const [name, setName] = useState(holding?.name || '');
  const [quantity, setQuantity] = useState(holding?.quantity?.toString() || '');
  const [avgCostBasis, setAvgCostBasis] = useState(holding?.avgCostBasis?.toString() || '');
  const [currency, setCurrency] = useState(holding?.currency || 'BDT');
  const [notes, setNotes] = useState(holding?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !quantity || !avgCostBasis) {
      toast.error('Please enter ticker, quantity, and cost basis');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...(isEdit ? { id: holding!.id } : {}),
        assetType,
        ticker: ticker.toUpperCase(),
        name: name || ticker.toUpperCase(),
        quantity: parseFloat(quantity),
        avgCostBasis: parseFloat(avgCostBasis),
        currency,
        notes: notes || undefined,
      };

      const res = await fetch('/api/investments', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save position');
      }

      toast.success(isEdit ? 'Position updated!' : 'Position logged!');
      mutate('/api/investments');
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-3xl p-6 shadow-2xl z-10 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h3 className="text-base font-black text-white">
            {isEdit ? 'Update Investment Position' : 'Log New Investment Position'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">
              Asset Class
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ASSET_CLASSES.slice(0, 4).map((ac) => (
                <button
                  key={ac.value}
                  type="button"
                  onClick={() => setAssetType(ac.value)}
                  className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
                    assetType === ac.value
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/[0.02] border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{ac.icon}</span>
                  <span className="font-bold truncate">{ac.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                Ticker / Symbol
              </label>
              <input
                type="text"
                required
                placeholder="e.g. GP, BATS, AAPL, GOLD"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-mono font-bold outline-none focus:border-emerald-500 uppercase"
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                Asset Name
              </label>
              <input
                type="text"
                placeholder="e.g. Grameenphone Ltd."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-bold outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                Units / Quantity
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-mono font-bold outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                Avg Cost Basis (per Unit)
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="250"
                value={avgCostBasis}
                onChange={(e) => setAvgCostBasis(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-mono font-bold outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white shadow-lg"
            >
              {isSaving ? 'Saving...' : isEdit ? 'Update Position' : 'Log Position'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
