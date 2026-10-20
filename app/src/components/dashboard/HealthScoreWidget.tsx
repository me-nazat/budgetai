'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import useSWR from 'swr';

interface PillarScore {
  score: number;
  max: number;
  action: string;
}

interface HealthScoreData {
  score: number;
  grade: string;
  pillars: {
    savingsRate: PillarScore;
    budgetAdherence: PillarScore;
    emergencyRunway: PillarScore;
    debtLoad: PillarScore;
  };
  breakdown?: Record<string, any>;
  history?: { month: string; score: number }[];
  insight?: string;
}

export function HealthScoreWidget({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [displayScore, setDisplayScore] = useState(0);

  const { data, error, isLoading, mutate } = useSWR<HealthScoreData>(
    '/api/health-score',
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  );

  const fetchData = useCallback(() => {
    mutate();
  }, [mutate]);

  useEffect(() => {
    if (isInView && data) {
      const end = data.score;
      const duration = 1000;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        setDisplayScore(Math.round(ease * end));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [isInView, data]);

  if (isLoading) {
    return (
      <div
        className={`w-full ${
          compact ? 'h-48' : 'h-80'
        } bg-[var(--bg-surface)] animate-pulse rounded-2xl border border-[var(--border-subtle)] flex items-center justify-center`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-xs font-medium text-[var(--color-text-muted)]">Calculating 4-pillar financial health...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={`w-full ${
          compact ? 'h-48' : 'h-80'
        } bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] flex flex-col items-center justify-center p-6 text-center`}
      >
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-2xl">error_outline</span>
        </div>
        <p className="text-sm font-semibold text-[var(--color-text-main)] mb-1">Health Score Unavailable</p>
        <p className="text-xs text-[var(--color-text-muted)] mb-4 max-w-[260px]">
          {error?.message || 'Unable to calculate your health score right now.'}
        </p>
        <button
          type="button"
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--color-text-main)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Retry calculation
        </button>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // Emerald
    if (score >= 65) return '#06b6d4'; // Teal
    if (score >= 45) return '#f59e0b'; // Amber
    return '#f43f5e'; // Rose
  };

  const color = getScoreColor(data.score);
  const radius = compact ? 56 : 74;
  const circumference = Math.PI * radius; // 180 degree semi-circle
  const strokeDashoffset = circumference - (data.score / 100) * circumference;

  const pillarsList = [
    {
      id: 'savingsRate',
      label: 'Savings Rate',
      score: data.pillars?.savingsRate?.score ?? 20,
      max: 25,
      action: data.pillars?.savingsRate?.action ?? 'Save 20% of monthly income to earn maximum points',
    },
    {
      id: 'budgetAdherence',
      label: 'Budget Adherence',
      score: data.pillars?.budgetAdherence?.score ?? 20,
      max: 25,
      action: data.pillars?.budgetAdherence?.action ?? 'Keep category spending within envelopes',
    },
    {
      id: 'emergencyRunway',
      label: 'Emergency Runway',
      score: data.pillars?.emergencyRunway?.score ?? 20,
      max: 25,
      action: data.pillars?.emergencyRunway?.action ?? 'Maintain 6 months of liquid cash reserves',
    },
    {
      id: 'debtLoad',
      label: 'Debt & Utilization',
      score: data.pillars?.debtLoad?.score ?? 20,
      max: 25,
      action: data.pillars?.debtLoad?.action ?? 'Keep credit utilization under 10%',
    },
  ];

  return (
    <div
      ref={ref}
      className={`w-full bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] overflow-hidden flex ${
        compact ? 'flex-col' : 'flex-col lg:flex-row'
      } relative`}
    >
      {/* ── Gauge & Composite Score Section ── */}
      <div
        className={`p-6 flex flex-col items-center justify-center ${
          compact ? '' : 'border-b lg:border-b-0 lg:border-r'
        } border-[var(--border-subtle)] w-full ${compact ? '' : 'lg:w-[35%]'} relative`}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-[18px] text-emerald-500">health_and_safety</span>
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] tracking-wider uppercase">
            Financial Health Score
          </h3>
        </div>

        <div className={`relative ${compact ? 'w-36 h-20' : 'w-44 h-24'} flex items-end justify-center overflow-hidden`}>
          {/* Background Arc */}
          <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 200 100">
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              strokeLinecap="round"
              className="text-[var(--border-subtle)]"
            />
          </svg>
          {/* Animated Arc */}
          <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 200 100">
            <motion.path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={isInView ? { strokeDashoffset } : {}}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="flex flex-col items-center z-10 -mb-2">
            <span
              className={`${compact ? 'text-3xl' : 'text-4xl'} font-bold tabular-nums font-mono`}
              style={{ color }}
            >
              {displayScore}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] uppercase font-semibold tracking-wider">
              {data.grade || (data.score >= 80 ? 'Excellent' : data.score >= 65 ? 'Good' : data.score >= 45 ? 'Fair' : 'Needs Work')}
            </span>
          </div>
        </div>

        {/* Sparkline History */}
        {!compact && data.history && data.history.length > 0 && (
          <div className="w-full h-10 mt-5 px-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.history}>
                <defs>
                  <linearGradient id="colorHealthScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={color}
                  fillOpacity={1}
                  fill="url(#colorHealthScore)"
                  strokeWidth={2}
                  isAnimationActive={isInView}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── 4 Transparent Pillars Section (25 pts each) ── */}
      <div className={`p-6 w-full ${compact ? '' : 'lg:w-[65%]'} flex flex-col justify-between space-y-4`}>
        <div className="space-y-3.5">
          {pillarsList.map((p) => {
            const pct = (p.score / p.max) * 100;
            return (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--color-text-main)]">{p.label}</span>
                  <span className="font-mono tabular-nums text-[var(--color-text-dim)] font-semibold">
                    {p.score} / {p.max} pts
                  </span>
                </div>
                {/* Horizontal Progress Bar */}
                <div className="w-full h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      pct >= 80
                        ? 'bg-emerald-500'
                        : pct >= 50
                          ? 'bg-teal-500'
                          : pct >= 30
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={isInView ? { width: `${pct}%` } : {}}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                {/* Concrete action to gain points */}
                <p className="text-[11px] text-[var(--color-text-muted)] truncate" title={p.action}>
                  {p.action}
                </p>
              </div>
            );
          })}
        </div>

        {/* Global Actionable Callout */}
        {data.insight && (
          <div className="mt-3 p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex gap-2.5 items-start">
            <span className="material-symbols-outlined text-[18px] text-emerald-500 shrink-0 mt-0.5">
              lightbulb
            </span>
            <p className="text-xs text-[var(--color-text-main)] leading-relaxed font-medium">
              {data.insight}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default HealthScoreWidget;
