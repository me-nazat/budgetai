'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface CategoryBenchmark {
  category: string;
  userSpending: number;
  globalAverage: number;
  diffPercent: number;
  status: 'above' | 'below' | 'average';
}

interface BenchmarkData {
  month: string;
  peerCount: number;
  user: {
    income: number;
    expense: number;
    savingsRate: number;
    transactionCount: number;
  };
  benchmarks: {
    savingsPercentile: number;
    globalAvgIncome: number;
    globalAvgExpense: number;
    categoryBenchmarks: CategoryBenchmark[];
  };
  aiInsight: string;
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════ */

function BenchmarkSkeleton() {
  return (
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
      <div className="mb-8 space-y-3">
        <div className="h-5 w-64 rounded-full shimmer-skeleton" />
        <div className="h-3 w-96 max-w-full rounded-full shimmer-skeleton" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="skeleton-panel h-[300px]" />
        <div className="skeleton-panel h-[300px]" />
      </div>
      <div className="mt-6 skeleton-panel h-[400px]" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ARC GAUGE — Reuses Financial Health Score visual style
   ═══════════════════════════════════════════════════════════════ */

function PercentileGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 70;
  const stroke = 10;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * Math.PI; // half circle
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg height={radius + 10} width={radius * 2 + 10} className="overflow-visible">
        {/* Background arc */}
        <path
          d={`M ${stroke / 2 + 5} ${radius + 5} A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 - stroke / 2 + 5} ${radius + 5}`}
          fill="none"
          stroke="currentColor"
          className="text-gray-200 dark:text-white/10"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${stroke / 2 + 5} ${radius + 5} A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 - stroke / 2 + 5} ${radius + 5}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Value text */}
        <text x={radius + 5} y={radius - 5} textAnchor="middle" className="fill-gray-900 dark:fill-white text-2xl font-black">
          {value}
          <tspan className="text-sm" dy="-8">th</tspan>
        </text>
        <text x={radius + 5} y={radius + 15} textAnchor="middle" className="fill-gray-500 dark:fill-text-muted text-[10px] font-bold uppercase tracking-wider">
          percentile
        </text>
      </svg>
      <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-1">{label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OPT-IN PROMPT
   ═══════════════════════════════════════════════════════════════ */

function OptInPrompt() {
  const [enabling, setEnabling] = useState(false);

  const handleOptIn = async () => {
    setEnabling(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benchmarkOptIn: 1 }),
      });
      window.location.reload();
    } catch {
      setEnabling(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[800px] mx-auto page-enter">
      <div className="glass-panel p-8 lg:p-12 text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Peer Benchmarking</h1>
        <p className="text-gray-500 dark:text-text-muted text-sm mb-6 max-w-md mx-auto">
          See how your spending and savings compare to similar users — anonymously. No personally identifying data is shared, only aggregate financial figures.
        </p>
        <button
          onClick={handleOptIn}
          disabled={enabling}
          className="px-8 py-3 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-hover transition-all disabled:opacity-50"
        >
          {enabling ? 'Enabling...' : 'Enable Benchmarking'}
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          You can disable this anytime in Settings → Privacy
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function BenchmarksPage() {
  const { fmt, fmtRaw } = useCurrency();

  // Check opt-in status
  const { data: userData } = useSWR<{ user: { benchmarkOptIn?: number } }>('/api/auth/me');
  const isOptedIn = userData?.user?.benchmarkOptIn === 1;

  // Fetch benchmark data
  const { data, isLoading, error } = useSWR<BenchmarkData>(
    isOptedIn ? '/api/benchmarking' : null
  );

  if (!userData) return <BenchmarkSkeleton />;
  if (!isOptedIn) return <OptInPrompt />;
  if (isLoading) return <BenchmarkSkeleton />;
  if (error || !data) return (
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto">
      <div className="glass-panel p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3 block">error</span>
        <p className="text-gray-400">Failed to load benchmark data. Please try again later.</p>
      </div>
    </div>
  );

  const { user, benchmarks, aiInsight, peerCount } = data;
  const savingsColor = benchmarks.savingsPercentile >= 70 ? '#10b981' : benchmarks.savingsPercentile >= 40 ? '#FFB800' : '#FF2A5F';

  return (
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
            Peer Benchmarking
          </h1>
          <p className="text-gray-500 dark:text-text-muted text-sm mt-1">
            Comparing against {peerCount} anonymous peers · {data.month}
          </p>
        </div>
        <Link
          href="/settings"
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-hover transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px]">settings</span>
          Manage
        </Link>
      </div>

      {/* ── AI Insight Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-4 lg:p-5 mb-6 border-l-[3px] border-l-primary"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-lg">auto_awesome</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">AI Insight</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{aiInsight}</p>
          </div>
        </div>
      </motion.div>

      {/* ── Percentile Gauges ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Savings Rate Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-6 flex flex-col items-center"
        >
          <PercentileGauge value={benchmarks.savingsPercentile} label="Savings Rate" color={savingsColor} />
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500 dark:text-text-muted">
              Your savings rate: <span className="font-bold text-gray-900 dark:text-white">{user.savingsRate}%</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {benchmarks.savingsPercentile >= 50
                ? `You're saving more than ${benchmarks.savingsPercentile}% of peers`
                : `${100 - benchmarks.savingsPercentile}% of peers save more than you`
              }
            </p>
          </div>
        </motion.div>

        {/* Income vs Expense Summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-6"
        >
          <h3 className="text-sm font-bold text-gray-500 dark:text-text-muted uppercase tracking-wider mb-4">Your Month vs. Average</h3>
          <div className="space-y-4">
            <ComparisonRow
              label="Income"
              userValue={user.income}
              avgValue={benchmarks.globalAvgIncome}
              fmt={fmtRaw}
              icon="trending_up"
              color="#10b981"
            />
            <ComparisonRow
              label="Expenses"
              userValue={user.expense}
              avgValue={benchmarks.globalAvgExpense}
              fmt={fmtRaw}
              icon="trending_down"
              color="#FF2A5F"
              invertBetter
            />
          </div>
        </motion.div>
      </div>

      {/* ── Category Benchmarks ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-panel p-4 lg:p-6"
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">category</span>
          Category Comparison
        </h3>
        <p className="text-xs text-gray-500 dark:text-text-muted mb-4">Your top spending categories vs. peer averages</p>

        {benchmarks.categoryBenchmarks.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2 block">bar_chart</span>
            <p className="text-sm text-gray-400">Not enough data yet. Keep tracking your expenses!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {benchmarks.categoryBenchmarks.map((cb, i) => (
              <motion.div
                key={cb.category}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className="p-3 rounded-xl bg-gray-50 dark:bg-surface-dark border border-gray-200/50 dark:border-white/5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{cb.category}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    cb.status === 'below' ? 'bg-accent-emerald/10 text-accent-emerald' :
                    cb.status === 'above' ? 'bg-accent-rose/10 text-accent-rose' :
                    'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                  }`}>
                    {cb.diffPercent > 0 ? '+' : ''}{cb.diffPercent}% vs avg
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <div className="h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.min(100, (cb.userSpending / Math.max(cb.userSpending, cb.globalAverage)) * 100)}%`,
                          backgroundColor: cb.status === 'above' ? '#FF2A5F' : cb.status === 'below' ? '#10b981' : '#FFB800',
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">You: {fmtRaw(cb.userSpending)}</span>
                      <span className="text-xs text-gray-400">Avg: {fmtRaw(cb.globalAverage)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPARISON ROW
   ═══════════════════════════════════════════════════════════════ */

function ComparisonRow({
  label, userValue, avgValue, fmt, icon, color, invertBetter = false,
}: {
  label: string; userValue: number; avgValue: number; fmt: (n: number) => string;
  icon: string; color: string; invertBetter?: boolean;
}) {
  const diff = avgValue > 0 ? ((userValue - avgValue) / avgValue * 100) : 0;
  const isBetter = invertBetter ? diff < 0 : diff > 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
        <span className="material-symbols-outlined text-lg" style={{ color }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white">{label}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{fmt(userValue)}</span>
          <span className="text-gray-300 dark:text-gray-600">vs</span>
          <span className="text-xs text-gray-400">{fmt(avgValue)} avg</span>
        </div>
      </div>
      <span className={`text-xs font-bold ${isBetter ? 'text-accent-emerald' : 'text-accent-rose'}`}>
        {diff > 0 ? '+' : ''}{Math.round(diff)}%
      </span>
    </div>
  );
}
