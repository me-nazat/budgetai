'use client';

import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface RadarDataPoint {
  pillar: string;
  userScore: number;
  cohortMedian: number;
  topPerformers: number;
}

export function CohortRadarChart({ data }: { data: RadarDataPoint[] }) {
  return (
    <div className="w-full h-[360px] bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-2">
        5-Pillar Financial Health vs Peers
      </h3>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis dataKey="pillar" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" />
          <Radar name="You" dataKey="userScore" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
          <Radar name="Cohort Median" dataKey="cohortMedian" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} />
          <Radar name="Top 10%" dataKey="topPerformers" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.05} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
            itemStyle={{ fontSize: '12px' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
