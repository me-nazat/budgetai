'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface FlowDataPoint {
  date: string;
  expenses: number;
  earnings: number;
}

interface DataRiverChartProps {
  data: FlowDataPoint[];
  width?: number;
  height?: number;
  className?: string;
}

export default function DataRiverChart({ data, width = 800, height = 400, className = '' }: DataRiverChartProps) {
  const { earningsPath, expensesPath, points } = useMemo(() => {
    if (!data || data.length === 0) {
      return { earningsPath: '', expensesPath: '', points: [] };
    }

    const paddingX = 40;
    const paddingY = 40;
    const drawWidth = width - paddingX * 2;
    const drawHeight = height - paddingY * 2;

    const maxVal = Math.max(
      ...data.map(d => Math.max(d.expenses, d.earnings)),
      1 // avoid div by zero
    );

    const stepX = drawWidth / Math.max(1, data.length - 1);
    
    // Y center axis
    const cy = paddingY + drawHeight / 2;
    const maxAmplitude = drawHeight / 2;

    const computedPoints = data.map((d, i) => {
      const x = paddingX + i * stepX;
      // Earnings go up (subtract from cy)
      const yEarning = cy - (d.earnings / maxVal) * maxAmplitude;
      // Expenses go down (add to cy)
      const yExpense = cy + (d.expenses / maxVal) * maxAmplitude;
      
      return { x, yEarning, yExpense, date: d.date, earnings: d.earnings, expenses: d.expenses };
    });

    // Generate smooth bezier curve path
    const createSmoothPath = (pts: typeof computedPoints, key: 'yEarning' | 'yExpense', isTop: boolean) => {
      if (pts.length === 0) return '';
      
      let path = `M ${pts[0].x} ${pts[0][key]}`;
      
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        
        // Control points for horizontal smoothness
        const cp1x = p0.x + stepX / 2;
        const cp1y = p0[key];
        const cp2x = p1.x - stepX / 2;
        const cp2y = p1[key];
        
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1[key]}`;
      }
      
      // Close path to center axis to fill it
      path += ` L ${pts[pts.length - 1].x} ${cy} L ${pts[0].x} ${cy} Z`;
      return path;
    };

    return {
      earningsPath: createSmoothPath(computedPoints, 'yEarning', true),
      expensesPath: createSmoothPath(computedPoints, 'yExpense', false),
      points: computedPoints
    };
  }, [data, width, height]);

  if (!data || data.length === 0) {
    return <div className={`flex items-center justify-center opacity-50 ${className}`} style={{ width, height }}>No flow data</div>;
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-full drop-shadow-xl">
        <defs>
          <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="expGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.1} />
          </linearGradient>
          <filter id="riverGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Center Axis */}
        <line x1={0} y1={height/2} x2={width} y2={height/2} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="4 4" />

        {/* Earnings River */}
        <motion.path
          d={earningsPath}
          fill="url(#earnGrad)"
          filter="url(#riverGlow)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        {/* Expenses River */}
        <motion.path
          d={expensesPath}
          fill="url(#expGrad)"
          filter="url(#riverGlow)"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
        />
        
        {/* Render highlight nodes on peaks */}
        {points.map((p, i) => {
          if (p.earnings > 0 && (i % Math.ceil(points.length / 5) === 0)) {
            return (
              <motion.circle
                key={`earn-node-${i}`}
                cx={p.x}
                cy={p.yEarning}
                r={4}
                fill="#fff"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1 + i * 0.05 }}
              />
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}
