'use client';

/**
 * @fileoverview Investment Portfolio Tracker page.
 *
 * Features:
 * - Portfolio summary (total value, gain/loss, diversification)
 * - Holdings table with live prices
 * - Add/edit holding modal
 * - Asset allocation donut chart (CSS)
 *
 * @module app/(app)/investments/page
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { useCurrency } from '@/contexts/CurrencyContext';

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

const ASSET_TYPES = [
  { value: 'stock', label: 'Stock', icon: 'trending_up', color: '#3b82f6' },
  { value: 'etf', label: 'ETF', icon: 'auto_graph', color: '#22c55e' },
  { value: 'crypto', label: 'Crypto', icon: 'currency_bitcoin', color: '#f59e0b' },
  { value: 'bond', label: 'Bond', icon: 'account_balance', color: '#06b6d4' },
  { value: 'mutual_fund', label: 'Mutual Fund', icon: 'pie_chart', color: '#06b6d4' },
  { value: 'other', label: 'Other', icon: 'category', color: '#6b7280' },
] as const;

const fetcher = (url: string) => fetch(url).then(res => res.json());

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

export default function InvestmentsPage() {
  const { fmt } = useCurrency();
  const { data, isLoading } = useSWR<PortfolioResponse>('/api/investments', fetcher, { refreshInterval: 60000 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const holdings = data?.holdings || [];
  const summary = data?.summary || { totalInvested: 0, totalCurrentValue: 0, totalGainLoss: 0, totalGainLossPercent: 0, holdingCount: 0 };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch('/api/investments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      mutate('/api/investments');
    } finally {
      setDeletingId(null);
    }
  };

  const getAssetType = (type: string) => ASSET_TYPES.find(a => a.value === type) || ASSET_TYPES[5];

  // Calculate allocation percentages for chart
  const allocationByType = ASSET_TYPES.map(type => {
    const value = holdings
      .filter(h => h.assetType === type.value)
      .reduce((sum, h) => sum + (h.currentValue || h.costBasis), 0);
    return { ...type, value, pct: summary.totalCurrentValue > 0 ? (value / summary.totalCurrentValue) * 100 : 0 };
  }).filter(a => a.value > 0);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="px-4 lg:px-12 py-6 lg:py-10 max-w-7xl mx-auto space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight">
            Investments
          </h1>
          <p className="text-sm text-gray-500 dark:text-text-muted mt-1">
            Track your portfolio in real-time
          </p>
        </div>
        <button
          onClick={() => { setEditingHolding(null); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 active:scale-[0.97] transition-all shadow-lg shadow-primary/25"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Holding
        </button>
      </motion.div>

      {/* Portfolio Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <SummaryCard
          label="Total Value"
          value={fmt(summary.totalCurrentValue)}
          icon="account_balance_wallet"
          color="from-blue-500/20 to-indigo-500/20"
          iconColor="text-blue-500"
        />
        <SummaryCard
          label="Total Invested"
          value={fmt(summary.totalInvested)}
          icon="savings"
          color="from-emerald-500/20 to-green-500/20"
          iconColor="text-emerald-500"
        />
        <SummaryCard
          label="Total Gain/Loss"
          value={`${summary.totalGainLoss >= 0 ? '+' : ''}${fmt(summary.totalGainLoss)}`}
          subValue={`${summary.totalGainLossPercent >= 0 ? '+' : ''}${summary.totalGainLossPercent.toFixed(2)}%`}
          icon={summary.totalGainLoss >= 0 ? 'trending_up' : 'trending_down'}
          color={summary.totalGainLoss >= 0 ? 'from-emerald-500/20 to-green-500/20' : 'from-rose-500/20 to-red-500/20'}
          iconColor={summary.totalGainLoss >= 0 ? 'text-emerald-500' : 'text-rose-500'}
        />
        <SummaryCard
          label="Holdings"
          value={String(summary.holdingCount)}
          icon="pie_chart"
          color="from-amber-500/20 to-orange-500/20"
          iconColor="text-amber-500"
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Holdings Table */}
        <motion.div variants={itemVariants} className="lg:col-span-8 glass-panel rounded-2xl lg:rounded-3xl overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-gray-100 dark:border-white/5">
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">list_alt</span>
              Your Holdings
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-gray-400 mt-3">Loading portfolio...</p>
            </div>
          ) : holdings.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600">inventory_2</span>
              <p className="text-sm text-gray-400 mt-3">No holdings yet. Add your first investment to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {holdings.map((h) => {
                const assetType = getAssetType(h.assetType);
                const isPositive = (h.gainLossPercent ?? 0) >= 0;
                return (
                  <div
                    key={h.id}
                    className="px-4 lg:px-6 py-3.5 flex items-center gap-3 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${assetType.color}15` }}
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ color: assetType.color }}>
                        {assetType.icon}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{h.ticker}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 uppercase">
                          {assetType.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">{h.name} · {h.quantity} units @ {fmt(h.avgCostBasis)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                        {h.currentValue !== null ? fmt(h.currentValue) : fmt(h.costBasis)}
                      </p>
                      {h.gainLossPercent !== null && (
                        <p className={`text-[11px] font-bold tabular-nums ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isPositive ? '+' : ''}{h.gainLossPercent.toFixed(2)}%
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingHolding(h); setShowAddModal(true); }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(h.id)}
                        disabled={deletingId === h.id}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-gray-400 hover:text-rose-500 transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Allocation Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-4 glass-panel rounded-2xl lg:rounded-3xl p-4 lg:p-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary">donut_large</span>
            Allocation
          </h2>

          {allocationByType.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Add holdings to see allocation</p>
          ) : (
            <div className="space-y-3">
              {/* CSS Donut Chart */}
              <div className="relative w-40 h-40 mx-auto">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  {(() => {
                    let offset = 0;
                    return allocationByType.map((a, i) => {
                      const dash = a.pct;
                      const gap = 100 - dash;
                      const el = (
                        <circle
                          key={a.value}
                          r="15.915"
                          cx="18"
                          cy="18"
                          fill="transparent"
                          stroke={a.color}
                          strokeWidth="3.5"
                          strokeDasharray={`${dash} ${gap}`}
                          strokeDashoffset={`${-offset}`}
                          className="transition-all duration-500"
                        />
                      );
                      offset += dash;
                      return el;
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black text-gray-900 dark:text-white">{allocationByType.length}</span>
                  <span className="text-[9px] text-gray-400 font-semibold">asset types</span>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-2">
                {allocationByType.map((a) => (
                  <div key={a.value} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{a.label}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 tabular-nums">{a.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <HoldingModal
            holding={editingHolding}
            onClose={() => { setShowAddModal(false); setEditingHolding(null); }}
            fmt={fmt}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SummaryCard({ label, value, subValue, icon, color, iconColor }: {
  label: string; value: string; subValue?: string; icon: string; color: string; iconColor: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-4 relative overflow-hidden group">
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br ${color} blur-2xl opacity-60 group-hover:opacity-80 transition-opacity`} />
      <div className="relative z-10">
        <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
        <p className="text-lg lg:text-xl font-black text-gray-900 dark:text-white mt-1.5 tabular-nums">{value}</p>
        {subValue && (
          <p className={`text-xs font-bold mt-0.5 ${subValue.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
            {subValue}
          </p>
        )}
        <p className="text-[10px] font-semibold text-gray-400 dark:text-text-muted mt-1 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function HoldingModal({ holding, onClose, fmt }: {
  holding: Holding | null;
  onClose: () => void;
  fmt: (n: number) => string;
}) {
  const isEdit = !!holding;
  const [form, setForm] = useState({
    assetType: holding?.assetType || 'stock',
    ticker: holding?.ticker || '',
    name: holding?.name || '',
    quantity: holding?.quantity?.toString() || '',
    avgCostBasis: holding?.avgCostBasis?.toString() || '',
    currency: holding?.currency || 'USD',
    notes: holding?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...(isEdit ? { id: holding!.id } : {}),
        assetType: form.assetType,
        ticker: form.ticker,
        name: form.name,
        quantity: parseFloat(form.quantity),
        avgCostBasis: parseFloat(form.avgCostBasis),
        currency: form.currency,
        notes: form.notes || undefined,
      };

      const res = await fetch('/api/investments', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      mutate('/api/investments');
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel rounded-3xl w-full max-w-md p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Holding' : 'Add Holding'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset Type */}
          <div className="grid grid-cols-3 gap-2">
            {ASSET_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, assetType: t.value }))}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all text-center ${
                  form.assetType === t.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 dark:border-white/10 text-gray-500 hover:border-primary/50'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                <span className="text-[10px] font-bold">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ticker</label>
              <input
                type="text"
                value={form.ticker}
                onChange={(e) => setForm(f => ({ ...f, ticker: e.target.value }))}
                placeholder="AAPL"
                required
                className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Apple Inc."
                required
                className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</label>
              <input
                type="number"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="10"
                required
                className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all tabular-nums"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Cost</label>
              <input
                type="number"
                step="any"
                value={form.avgCostBasis}
                onChange={(e) => setForm(f => ({ ...f, avgCostBasis: e.target.value }))}
                placeholder="150.00"
                required
                className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Long-term hold"
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-500 font-semibold">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">{isEdit ? 'save' : 'add'}</span>
                {isEdit ? 'Save Changes' : 'Add Holding'}
              </>
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
