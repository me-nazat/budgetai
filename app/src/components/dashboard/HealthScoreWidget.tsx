'use client';

import React, { useEffect, useState } from 'react';
import { motion, useAnimation, useInView } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { SparklesIcon } from '@heroicons/react/24/outline';

interface HealthScoreData {
  score: number;
  breakdown: {
    savingsRate: { score: number; max: number };
    budgetAdherence: { score: number; max: number };
    netWorth: { score: number; max: number };
    emergencyFund: { score: number; max: number };
    consistency: { score: number; max: number };
  };
  history: { month: string; score: number }[];
  insight: string;
}

export function HealthScoreWidget({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    fetch('/api/health-score')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isInView && data) {
      let start = 0;
      const end = data.score;
      if (start === end) return;
      const duration = 1500;
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutQuart
        const ease = 1 - Math.pow(1 - progress, 4);
        setDisplayScore(Math.round(ease * end));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [isInView, data]);

  if (loading) {
    return (
      <div className={`w-full ${compact ? 'h-48' : 'h-80'} bg-surface/50 dark:bg-surface-dark/50 animate-pulse rounded-2xl border border-gray-200 dark:border-[#30363d]`} />
    );
  }

  if (!data) return null;

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#10b981'; // Emerald
    if (score >= 40) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const getScoreGradient = (score: number) => {
    if (score >= 70) return 'from-emerald-500/20 to-emerald-500/5';
    if (score >= 40) return 'from-amber-500/20 to-amber-500/5';
    return 'from-red-500/20 to-red-500/5';
  };

  const color = getScoreColor(data.score);
  const radius = compact ? 60 : 80;
  const circumference = Math.PI * radius; // Half circle
  const strokeDashoffset = circumference - (data.score / 100) * circumference;

  return (
    <div 
      ref={ref}
      className={`w-full bg-surface dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-[#30363d] overflow-hidden flex ${compact ? 'flex-col' : 'flex-col md:flex-row'} relative`}
    >
      {/* Gauge Section */}
      <div className={`p-6 flex flex-col items-center justify-center ${compact ? '' : 'border-b md:border-b-0 md:border-r'} border-gray-200 dark:border-[#30363d] w-full ${compact ? '' : 'md:w-1/3'} bg-gradient-to-b ${getScoreGradient(data.score)} relative`}>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 tracking-wider uppercase">Financial Health</h3>
        
        <div className={`relative ${compact ? 'w-36 h-20' : 'w-48 h-28'} flex items-end justify-center overflow-hidden`}>
          {/* Background Arc */}
          <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 200 100">
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              strokeLinecap="round"
              className="text-gray-200 dark:text-[#30363d]"
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
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>
          <div className="flex flex-col items-center z-10 -mb-2">
            <span className={`${compact ? 'text-4xl' : 'text-5xl'} font-bold tabular-nums`} style={{ color }}>{displayScore}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase font-semibold tracking-wider">
              {data.score >= 70 ? 'Excellent' : data.score >= 40 ? 'Fair' : 'Needs Work'}
            </span>
          </div>
        </div>

        {/* Sparkline History - hide on compact */}
        {!compact && (
          <div className="w-full h-12 mt-6 px-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.history}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke={color} 
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  strokeWidth={2}
                  isAnimationActive={isInView}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Breakdown Section */}
      <div className={`p-6 w-full ${compact ? '' : 'md:w-2/3'} flex flex-col justify-between`}>
        {!compact && (
          <div className="space-y-4">
            <ScoreRow label="Savings Rate" score={data.breakdown.savingsRate.score} max={data.breakdown.savingsRate.max} />
            <ScoreRow label="Budget Adherence" score={data.breakdown.budgetAdherence.score} max={data.breakdown.budgetAdherence.max} />
            <ScoreRow label="Net Worth Trend" score={data.breakdown.netWorth.score} max={data.breakdown.netWorth.max} />
            <ScoreRow label="Emergency Fund" score={data.breakdown.emergencyFund.score} max={data.breakdown.emergencyFund.max} />
            <ScoreRow label="Expense Consistency" score={data.breakdown.consistency.score} max={data.breakdown.consistency.max} />
          </div>
        )}

        <div className={`${compact ? 'mt-0' : 'mt-6'} p-4 rounded-xl bg-primary/10 border border-primary/20 flex gap-3 items-start`}>
          <SparklesIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
            {data.insight}
          </p>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, score, max }: { label: string, score: number, max: number }) {
  const percentage = (score / max) * 100;
  
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600 dark:text-gray-300 font-medium">{label}</span>
        <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{score}/{max}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 dark:bg-surface-hover rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-gray-400 dark:bg-gray-500 rounded-full"
          initial={{ width: 0 }}
          whileInView={{ width: `${percentage}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </div>
    </div>
  );
}
