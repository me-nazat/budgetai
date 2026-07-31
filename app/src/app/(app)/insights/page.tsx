'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';

interface InsightItem {
  id: number;
  insightType: 'budget_alert' | 'benchmark' | 'roundup' | 'tax' | 'subscription' | 'spending_anomaly' | 'goal_progress';
  title: string;
  description: string;
  actionPayload?: string | null;
  isDismissed: number;
  createdAt: string;
}

const TYPE_CONFIG: Record<
  InsightItem['insightType'],
  { label: string; icon: string; border: string; bg: string; text: string }
> = {
  budget_alert: { label: 'Budget Alert', icon: 'warning', border: 'border-l-accent-rose', bg: 'bg-rose-500/10', text: 'text-rose-500' },
  benchmark: { label: 'Benchmark', icon: 'monitoring', border: 'border-l-indigo-500', bg: 'bg-indigo-500/10', text: 'text-indigo-500' },
  roundup: { label: 'Roundup', icon: 'savings', border: 'border-l-accent-emerald', bg: 'bg-accent-emerald/10', text: 'text-accent-emerald' },
  tax: { label: 'Tax Insight', icon: 'account_balance', border: 'border-l-accent-amber', bg: 'bg-accent-amber/10', text: 'text-accent-amber' },
  subscription: { label: 'Subscription', icon: 'event_repeat', border: 'border-l-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
  spending_anomaly: { label: 'Anomaly', icon: 'trending_up', border: 'border-l-accent-rose', bg: 'bg-rose-500/10', text: 'text-rose-500' },
  goal_progress: { label: 'Goal Milestone', icon: 'flag', border: 'border-l-accent-emerald', bg: 'bg-accent-emerald/10', text: 'text-accent-emerald' },
};

export default function InsightsHubPage() {
  const { fmtRaw } = useCurrency();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const { data, isLoading } = useSWR<{ insights: InsightItem[]; weeklyDigest?: string }>('/api/coach/insights');

  const handleDismiss = async (id: number) => {
    try {
      await fetch('/api/insights/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId: id }),
      });
      await mutate('/api/coach/insights');
      toast.success('Insight dismissed');
    } catch {
      toast.error('Failed to dismiss insight');
    }
  };

  const rawInsights = data?.insights || [];
  const filtered = rawInsights.filter(i => {
    if (i.isDismissed === 1) return false;
    if (activeFilter === 'all') return true;
    return i.insightType === activeFilter;
  });

  return (
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter pb-24">
      <Toaster position="top-center" richColors />

      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
          Unified AI Insights Hub
        </h1>
        <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Smart observations across budgets, taxes, goals, benchmarks & subscriptions</p>
      </div>

      {/* ── Weekly Digest Banner ── */}
      <div className="glass-panel p-6 mb-6 bg-gradient-to-r from-primary/10 via-cyan-500/5 to-accent-emerald/10 border border-primary/20 relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">auto_awesome</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Weekly Financial Executive Summary</h2>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {data?.weeklyDigest ||
                "Your overall spending is tracking 8% lower than last month. Savings rate improved to 28%. Keep auto-roundups enabled to reach your Emergency Fund milestone 2 weeks early!"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filter Chips ── */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
        {[
          { id: 'all', label: 'All Insights' },
          { id: 'budget_alert', label: 'Budgets' },
          { id: 'tax', label: 'Tax' },
          { id: 'goal_progress', label: 'Goals' },
          { id: 'subscription', label: 'Subscriptions' },
          { id: 'benchmark', label: 'Benchmarks' },
        ].map(chip => (
          <button
            key={chip.id}
            onClick={() => setActiveFilter(chip.id)}
            className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              activeFilter === chip.id
                ? 'bg-primary text-white shadow-md'
                : 'bg-gray-100 dark:bg-surface-dark text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-hover'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* ── Insights List ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="glass-panel h-24 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3 block">check_circle</span>
          <p className="text-gray-400 font-medium">All clear! No active insights in this category.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filtered.map(item => {
              const cfg = TYPE_CONFIG[item.insightType] || TYPE_CONFIG.budget_alert;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`glass-panel p-5 relative border-l-4 ${cfg.border} flex items-start justify-between gap-4`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} ${cfg.text} flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined text-xl">{cfg.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{item.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{item.description}</p>
                      <p className="text-[10px] text-gray-400 mt-2">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDismiss(item.id)}
                    className="p-2 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                    aria-label="Dismiss insight"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
