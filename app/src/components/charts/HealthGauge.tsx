'use client';

import { useMemo } from 'react';

interface HealthGaugeProps {
  score: number; // 0–100
  label?: string;
  size?: number;
}

export default function HealthGauge({
  score,
  label = 'Financial Health',
  size = 160,
}: HealthGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  const { color, bgClass, status } = useMemo(() => {
    if (clampedScore >= 80) {
      return {
        color: '#10b981',
        bgClass: 'border-emerald-500/20 bg-emerald-500/5',
        status: 'Excellent',
      };
    }
    if (clampedScore >= 65) {
      return {
        color: '#06b6d4',
        bgClass: 'border-cyan-500/20 bg-cyan-500/5',
        status: 'Good',
      };
    }
    if (clampedScore >= 45) {
      return {
        color: '#f59e0b',
        bgClass: 'border-amber-500/20 bg-amber-500/5',
        status: 'Fair',
      };
    }
    return {
      color: '#f43f5e',
      bgClass: 'border-rose-500/20 bg-rose-500/5',
      status: 'Needs Work',
    };
  }, [clampedScore]);

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degree arc
  const dashOffset = arcLength - (arcLength * clampedScore) / 100;

  return (
    <div
      className={`flex flex-col items-center gap-2.5 rounded-2xl p-5 border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] transition-all`}
    >
      <div className="relative" style={{ width: size, height: size * 0.72 }}>
        <svg viewBox="0 0 100 70" className="w-full h-full overflow-visible">
          {/* Background arc */}
          <circle
            cx="50"
            cy="55"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-[var(--border-subtle)]"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            transform="rotate(135 50 55)"
          />
          {/* Filled arc */}
          <circle
            cx="50"
            cy="55"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform="rotate(135 50 55)"
            className="transition-all duration-1000 ease-out"
          />
          {/* Score text */}
          <text
            x="50"
            y="52"
            textAnchor="middle"
            className="fill-[var(--color-text-main)] font-mono tabular-nums"
            fontSize="18"
            fontWeight="700"
          >
            {clampedScore}
          </text>
          <text
            x="50"
            y="64"
            textAnchor="middle"
            className="fill-[var(--color-text-muted)]"
            fontSize="6"
            fontWeight="600"
          >
            {status}
          </text>
        </svg>
      </div>
      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}
