'use client';

import React, { useMemo, useId, useState } from 'react';
import { motion } from 'framer-motion';
import { GenerativePalette } from './FinancialMandala';

export interface DailySpendingPoint {
  date: string;
  expenses: number;
  earnings: number;
  balance?: number;
}

export interface DataRiverChartProps {
  dailySpending?: DailySpendingPoint[];
  palette?: GenerativePalette;
  height?: number;
  className?: string;
  showMilestones?: boolean;
  interactive?: boolean;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

const RIVER_PALETTES: Record<
  GenerativePalette,
  {
    upperGradientStart: string;
    upperGradientEnd: string;
    lowerGradientStart: string;
    lowerGradientEnd: string;
    crestGlow: string;
    filament: string;
    milestoneBg: string;
    milestoneBorder: string;
  }
> = {
  gold: {
    upperGradientStart: '#fef08a', // Pale gold
    upperGradientEnd: '#f59e0b', // Amber 500
    lowerGradientStart: '#b45309', // Amber 700
    lowerGradientEnd: '#78350f', // Amber 900
    crestGlow: '#fbbf24',
    filament: '#fde047',
    milestoneBg: '#1c1917',
    milestoneBorder: '#f59e0b',
  },
  emerald: {
    upperGradientStart: '#a7f3d0', // Pale emerald
    upperGradientEnd: '#10b981', // Emerald 500
    lowerGradientStart: '#047857', // Emerald 700
    lowerGradientEnd: '#064e3b', // Emerald 900
    crestGlow: '#34d399',
    filament: '#6ee7b7',
    milestoneBg: '#06281e',
    milestoneBorder: '#10b981',
  },
  sapphire: {
    upperGradientStart: '#bae6fd', // Pale sky
    upperGradientEnd: '#0ea5e9', // Sky 500
    lowerGradientStart: '#0369a1', // Sky 700
    lowerGradientEnd: '#082f49', // Sky 950
    crestGlow: '#38bdf8',
    filament: '#7dd3fc',
    milestoneBg: '#081c2e',
    milestoneBorder: '#0ea5e9',
  },
  solar: {
    upperGradientStart: '#fed7aa', // Pale orange
    upperGradientEnd: '#f97316', // Orange 500
    lowerGradientStart: '#c2410c', // Orange 700
    lowerGradientEnd: '#7c2d12', // Orange 900
    crestGlow: '#fb923c',
    filament: '#fdba74',
    milestoneBg: '#231008',
    milestoneBorder: '#f97316',
  },
};

/**
 * Calculates a smooth cubic Bezier path string through a series of 2D points.
 */
function buildSmoothSpline(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

export const DataRiverChart: React.FC<DataRiverChartProps> = ({
  dailySpending = [],
  palette = 'emerald',
  height = 360,
  className = '',
  showMilestones = true,
  interactive = true,
  svgRef,
}) => {
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [activeMilestone, setActiveMilestone] = useState<{
    label: string;
    date: string;
    amount: string;
    x: number;
    y: number;
  } | null>(null);

  const colors = RIVER_PALETTES[palette] || RIVER_PALETTES.emerald;

  // Generate or normalize timeline points
  const timelineData = useMemo(() => {
    if (dailySpending && dailySpending.length >= 3) {
      return dailySpending;
    }
    // Harmonious synthetic baseline flow for sparse / empty states
    const synthetic: DailySpendingPoint[] = [];
    const days = 14;
    for (let i = 0; i < days; i++) {
      const theta = (i / days) * Math.PI * 2;
      const earnings = 300 + Math.sin(theta * 1.5) * 180 + Math.cos(theta * 3) * 60;
      const expenses = 180 + Math.cos(theta * 1.8) * 120 + Math.sin(theta * 2) * 50;
      synthetic.push({
        date: `Day ${i + 1}`,
        earnings: Math.max(50, earnings),
        expenses: Math.max(30, expenses),
        balance: 1000 + (earnings - expenses) * 5,
      });
    }
    return synthetic;
  }, [dailySpending]);

  // Coordinate computation in 900x420 plane
  const VIEW_WIDTH = 900;
  const VIEW_HEIGHT = 420;
  const MARGIN_LEFT = 40;
  const MARGIN_RIGHT = 860;
  const MIDLINE_Y = 210;

  const riverGeometry = useMemo(() => {
    const pointsCount = timelineData.length;
    if (pointsCount === 0) return null;

    const maxVal = Math.max(
      ...timelineData.map((d) => Math.max(d.earnings || 0, d.expenses || 0, 100)),
      1
    );

    const stepX = (MARGIN_RIGHT - MARGIN_LEFT) / (pointsCount - 1);
    const upperPoints: Array<{ x: number; y: number; data: DailySpendingPoint }> = [];
    const lowerPoints: Array<{ x: number; y: number; data: DailySpendingPoint }> = [];
    const filamentPoints: Array<{ x: number; y: number }> = [];

    // Detect milestones
    let peakEarningsIdx = 0;
    let peakExpenseIdx = 0;
    let peakSavingsDeltaIdx = 0;
    let maxSavingsDelta = -Infinity;

    timelineData.forEach((pt, i) => {
      const x = MARGIN_LEFT + i * stepX;
      // Amplitude scaled to max 140px above and below centerline
      const earnAmp = ((pt.earnings || 0) / maxVal) * 135;
      const expAmp = ((pt.expenses || 0) / maxVal) * 135;

      const upperY = Math.max(45, MIDLINE_Y - earnAmp - 25);
      const lowerY = Math.min(375, MIDLINE_Y + expAmp + 25);
      const filY = (upperY + lowerY) / 2;

      upperPoints.push({ x, y: upperY, data: pt });
      lowerPoints.push({ x, y: lowerY, data: pt });
      filamentPoints.push({ x, y: filY });

      if (pt.earnings > timelineData[peakEarningsIdx].earnings) peakEarningsIdx = i;
      if (pt.expenses > timelineData[peakExpenseIdx].expenses) peakExpenseIdx = i;
      const delta = (pt.earnings || 0) - (pt.expenses || 0);
      if (delta > maxSavingsDelta) {
        maxSavingsDelta = delta;
        peakSavingsDeltaIdx = i;
      }
    });

    // Splines
    const upperSpline = buildSmoothSpline(upperPoints);
    const lowerSpline = buildSmoothSpline(lowerPoints);
    const filamentSpline = buildSmoothSpline(filamentPoints);

    // Build closed ribbon path: Upper forward, line to lower end, Lower backward, close
    const reversedLower = [...lowerPoints].reverse();
    const reverseLowerSpline = buildSmoothSpline(reversedLower).replace(/^M\s*[\d.]+\s*[\d.]+/, '');
    const ribbonPath = `${upperSpline} L ${reversedLower[0].x} ${reversedLower[0].y} ${reverseLowerSpline} Z`;

    // Milestones definitions
    const milestones = [
      {
        id: 'peak-earnings',
        label: 'Peak Inflow',
        date: timelineData[peakEarningsIdx].date,
        amount: `+$${timelineData[peakEarningsIdx].earnings.toLocaleString()}`,
        x: upperPoints[peakEarningsIdx].x,
        y: upperPoints[peakEarningsIdx].y,
        color: colors.crestGlow,
      },
      {
        id: 'peak-savings',
        label: 'Max Surplus',
        date: timelineData[peakSavingsDeltaIdx].date,
        amount: `+$${maxSavingsDelta.toLocaleString()}`,
        x: filamentPoints[peakSavingsDeltaIdx].x,
        y: filamentPoints[peakSavingsDeltaIdx].y,
        color: colors.filament,
      },
      {
        id: 'peak-expense',
        label: 'Expense Peak',
        date: timelineData[peakExpenseIdx].date,
        amount: `-$${timelineData[peakExpenseIdx].expenses.toLocaleString()}`,
        x: lowerPoints[peakExpenseIdx].x,
        y: lowerPoints[peakExpenseIdx].y,
        color: colors.lowerGradientStart,
      },
    ];

    return {
      upperSpline,
      lowerSpline,
      filamentSpline,
      ribbonPath,
      milestones,
    };
  }, [timelineData, colors]);

  if (!riverGeometry) return null;

  return (
    <div className={`relative w-full overflow-hidden select-none ${className}`} style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          {/* Vertical River Ribbon Gradient */}
          <linearGradient id={`river-gradient-${instanceId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.upperGradientStart} stopOpacity={0.7} />
            <stop offset="35%" stopColor={colors.upperGradientEnd} stopOpacity={0.85} />
            <stop offset="50%" stopColor={colors.crestGlow} stopOpacity={0.9} />
            <stop offset="65%" stopColor={colors.lowerGradientStart} stopOpacity={0.85} />
            <stop offset="100%" stopColor={colors.lowerGradientEnd} stopOpacity={0.65} />
          </linearGradient>

          {/* Glowing Filter */}
          <filter id={`river-glow-${instanceId}`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient Horizontal Grid Guides */}
        <line
          x1={MARGIN_LEFT}
          y1={MIDLINE_Y}
          x2={MARGIN_RIGHT}
          y2={MIDLINE_Y}
          stroke={colors.filament}
          strokeDasharray="4 8"
          strokeOpacity={0.2}
          strokeWidth={1}
        />

        {/* Main Flow Ribbon */}
        <motion.path
          d={riverGeometry.ribbonPath}
          fill={`url(#river-gradient-${instanceId})`}
          initial={{ opacity: 0, scaleY: 0.8 }}
          animate={{ opacity: 0.85, scaleY: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ transformOrigin: '50% 50%' }}
        />

        {/* Upper Bank Contour (Inflow Wave) */}
        <motion.path
          d={riverGeometry.upperSpline}
          fill="none"
          stroke={colors.upperGradientStart}
          strokeWidth={2.5}
          filter={`url(#river-glow-${instanceId})`}
          strokeOpacity={0.9}
        />

        {/* Lower Bank Contour (Outflow Wave) */}
        <motion.path
          d={riverGeometry.lowerSpline}
          fill="none"
          stroke={colors.lowerGradientStart}
          strokeWidth={2}
          strokeOpacity={0.8}
        />

        {/* Center Net Savings Filament */}
        <motion.path
          d={riverGeometry.filamentSpline}
          fill="none"
          stroke={colors.filament}
          strokeWidth={1.75}
          strokeDasharray="6 4"
          filter={`url(#river-glow-${instanceId})`}
          strokeOpacity={0.95}
        />

        {/* Milestone Badges */}
        {showMilestones &&
          riverGeometry.milestones.map((m) => (
            <g
              key={m.id}
              className={interactive ? 'cursor-pointer' : ''}
              onMouseEnter={() => {
                if (interactive) {
                  setActiveMilestone({
                    label: m.label,
                    date: m.date,
                    amount: m.amount,
                    x: m.x,
                    y: m.y,
                  });
                }
              }}
              onMouseLeave={() => {
                if (interactive) setActiveMilestone(null);
              }}
            >
              {/* Outer pulsing beacon ring */}
              <circle
                cx={m.x}
                cy={m.y}
                r={12}
                fill="none"
                stroke={m.color}
                strokeWidth={1.5}
                strokeOpacity={0.5}
                className="animate-ping"
                style={{ transformOrigin: `${m.x}px ${m.y}px`, animationDuration: '3s' }}
              />
              {/* Central node */}
              <circle
                cx={m.x}
                cy={m.y}
                r={5.5}
                fill={m.color}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </g>
          ))}
      </svg>

      {/* Floating Milestone Tooltip */}
      {interactive && activeMilestone && (
        <div
          className="absolute z-20 pointer-events-none px-3 py-1.5 rounded-xl bg-gray-950/90 text-white border border-white/20 shadow-2xl backdrop-blur-md text-xs -translate-x-1/2 -translate-y-full mb-2 animate-fadeIn"
          style={{
            left: `${(activeMilestone.x / VIEW_WIDTH) * 100}%`,
            top: `${(activeMilestone.y / VIEW_HEIGHT) * 100}%`,
          }}
        >
          <div className="font-bold tracking-tight text-white flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.crestGlow }} />
            {activeMilestone.label}: {activeMilestone.amount}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">{activeMilestone.date}</div>
        </div>
      )}
    </div>
  );
};

export default DataRiverChart;
