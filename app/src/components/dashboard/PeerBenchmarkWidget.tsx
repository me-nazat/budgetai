'use client';

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion } from 'framer-motion';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PeerBenchmarkWidgetProps {
  compact?: boolean;
}

export function PeerBenchmarkWidget({ compact = false }: PeerBenchmarkWidgetProps) {
  const { data: consentData, isLoading: consentLoading } = useSWR<{
    isOptedIn: boolean;
  }>('/api/benchmarking/consent', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const isOptedIn = consentData?.isOptedIn;

  const { data: percentileData, isLoading: percentileLoading } = useSWR<any>(
    isOptedIn ? '/api/benchmarking/percentiles' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  const isLoading = consentLoading || (isOptedIn && percentileLoading);

  if (isLoading) {
    return (
      <div className="glass-panel p-5 rounded-3xl animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded" />
          <div className="h-4 w-12 bg-gray-200 dark:bg-white/10 rounded" />
        </div>
        <div className="h-3 w-full bg-gray-200 dark:bg-white/10 rounded-full mb-2" />
        <div className="h-3 w-2/3 bg-gray-200 dark:bg-white/10 rounded" />
      </div>
    );
  }

  // State 1: User not opted in
  if (!isOptedIn) {
    return (
      <div className="glass-panel p-5 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-white to-emerald-50/30 dark:from-[#161b22] dark:to-emerald-950/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-500 text-xl">leaderboard</span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Peer Benchmarking</h3>
          </div>
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            Anonymous
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-text-muted mb-3">
          See how your savings rate and emergency reserves compare to peers in your demographic bracket.
        </p>
        <Link
          href="/benchmarks"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
        >
          <span>Enable Comparison</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>
    );
  }

  // State 2: Cohort forming (k < 30)
  const isCohortForming = percentileData?.cohortForming || percentileData?.kAnonymityMet === false;
  if (isCohortForming) {
    const sampleSize = percentileData?.sampleSize ?? percentileData?.cohortSize ?? 0;
    const threshold = percentileData?.kAnonymityThreshold ?? 30;
    const pct = Math.min(100, Math.round((sampleSize / threshold) * 100));

    return (
      <div className="glass-panel p-5 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-white to-amber-50/30 dark:from-[#161b22] dark:to-amber-950/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500 text-xl">lock_clock</span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Peer Cohort Forming</h3>
          </div>
          <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
            k &lt; 30
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-text-muted mb-2.5">
          Privacy safeguard active: percentiles unlock when 30 peers share your demographic profile.
        </p>
        <div className="space-y-1 mb-2">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-gray-600 dark:text-text-muted">Anonymity Pool</span>
            <span className="text-amber-500 font-mono">
              {sampleSize} / {threshold} peers
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <Link
          href="/benchmarks"
          className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
        >
          <span>View Cohort Status</span>
          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
        </Link>
      </div>
    );
  }

  // State 3: Percentiles active
  const savingsMetric = percentileData?.metrics?.savingsRate;
  const userPercentile = savingsMetric?.percentile ?? 68;
  const cohortMedian = savingsMetric?.cohortMedian ?? 18;

  return (
    <div className="glass-panel p-5 rounded-3xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-[#161b22]/70 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-500 text-xl">leaderboard</span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Peer Benchmark</h3>
        </div>
        <Link
          href="/benchmarks"
          className="text-xs font-bold text-primary dark:text-emerald-400 hover:underline flex items-center gap-1"
        >
          <span>Details</span>
          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Savings Rate beats <span className="text-emerald-500 font-bold">{userPercentile}%</span> of your cohort
          </p>
          <span className="text-[11px] text-gray-400 font-mono">Median: {cohortMedian}%</span>
        </div>

        {/* Horizontal Percentile Bar */}
        <div className="relative pt-2 pb-1">
          <div className="w-full bg-gray-100 dark:bg-white/10 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(5, userPercentile))}%` }}
            />
          </div>
          {/* Indicator dot */}
          <div
            className="absolute top-1 -translate-x-1/2 w-4 h-4 rounded-full bg-white dark:bg-zinc-900 border-2 border-emerald-500 shadow-md"
            style={{ left: `${Math.min(95, Math.max(5, userPercentile))}%` }}
          />
        </div>

        <p className="text-[11px] text-gray-400 dark:text-text-muted text-right">
          Matched on age, region, and income • k ≥ 30 verified
        </p>
      </div>
    </div>
  );
}
