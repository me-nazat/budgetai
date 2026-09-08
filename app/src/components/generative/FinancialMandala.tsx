'use client';

import React, { useMemo, useId, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CATEGORY_HEX_COLORS } from '@/lib/categoryUtils';

export interface CategorySpendingItem {
  category: string;
  total: number;
}

export type GenerativePalette = 'gold' | 'emerald' | 'sapphire' | 'solar';

export interface FinancialMandalaProps {
  categorySpending?: CategorySpendingItem[];
  balance?: number;
  savingsRate?: number; // 0 to 1
  size?: number;
  className?: string;
  ambient?: boolean; // When true, optimized for background ambient glow
  interactive?: boolean; // When true, allows hover inspection of petals
  palette?: GenerativePalette;
  complexity?: number; // 1 to 5
  symmetry?: number; // 4, 6, 8, 12, etc. (Default: auto or 8)
  rotationSpeed?: number; // Duration in seconds for full 360 rotation. 0 to disable
  onSelectCategory?: (category: string) => void;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

// ────────────────────────────────────────────────────────────
// Palette definitions (Strictly compliant with Purple Ban)
// ────────────────────────────────────────────────────────────
const PALETTES: Record<GenerativePalette, { primary: string; secondary: string; highlight: string; glow: string; dark: string }> = {
  gold: {
    primary: '#f59e0b', // Amber 500
    secondary: '#d97706', // Amber 600
    highlight: '#fef08a', // Yellow 200
    glow: '#fbbf24', // Amber 400
    dark: '#78350f', // Amber 900
  },
  emerald: {
    primary: '#10b981', // Emerald 500
    secondary: '#059669', // Emerald 600
    highlight: '#a7f3d0', // Emerald 200
    glow: '#34d399', // Emerald 400
    dark: '#064e3b', // Emerald 900
  },
  sapphire: {
    primary: '#0ea5e9', // Sky 500
    secondary: '#0284c7', // Sky 600
    highlight: '#bae6fd', // Sky 200
    glow: '#38bdf8', // Sky 400
    dark: '#0c4a6e', // Sky 900
  },
  solar: {
    primary: '#f97316', // Orange 500
    secondary: '#ea580c', // Orange 600
    highlight: '#fed7aa', // Orange 200
    glow: '#fb923c', // Orange 400
    dark: '#7c2d12', // Orange 900
  },
};

export const FinancialMandala: React.FC<FinancialMandalaProps> = ({
  categorySpending = [],
  balance = 0,
  savingsRate = 0.25,
  size = 500,
  className = '',
  ambient = false,
  interactive = false,
  palette = 'gold',
  complexity = 3,
  symmetry: customSymmetry,
  rotationSpeed = 80,
  onSelectCategory,
  svgRef,
}) => {
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  const activePalette = PALETTES[palette] || PALETTES.gold;

  // Process category telemetry
  const { categories, totalSpending, foldCount } = useMemo(() => {
    const valid = categorySpending.filter((c) => c && typeof c.total === 'number' && c.total > 0);
    const sum = valid.reduce((acc, c) => acc + c.total, 0);
    const sorted = [...valid].sort((a, b) => b.total - a.total).slice(0, 12);
    
    // Choose symmetry fold: user custom, or derived from categories count, clamped between 4 and 16
    let folds = customSymmetry || (sorted.length > 2 ? sorted.length : 8);
    if (folds < 4) folds = 6;
    if (folds % 2 !== 0 && !customSymmetry) folds += 1;

    return {
      categories: sorted,
      totalSpending: sum,
      foldCount: folds,
    };
  }, [categorySpending, customSymmetry]);

  // Center & base radius in a 600x600 coordinate plane
  const CX = 300;
  const CY = 300;
  const MAX_R = 260;

  // Generate geometric paths & nodes
  const geometry = useMemo(() => {
    const isZeroData = categories.length === 0 || totalSpending === 0;
    const clampedComplexity = Math.max(1, Math.min(5, complexity));

    // 1. Core Center Ring (Savings Rate)
    const coreRadius = Math.max(30, Math.min(75, 45 + (savingsRate || 0) * 35));

    // 2. Concentric Orbital Harmonics
    const rings: Array<{ r: number; dash: string; opacity: number; strokeWidth: number }> = [];
    const ringCount = 3 + clampedComplexity;
    for (let i = 1; i <= ringCount; i++) {
      const stepR = coreRadius + ((MAX_R - coreRadius) / (ringCount + 1)) * i;
      rings.push({
        r: stepR,
        dash: i % 2 === 0 ? '4 8 12 8' : i % 3 === 0 ? '1 6' : 'none',
        opacity: 0.15 + (i / ringCount) * 0.25,
        strokeWidth: i === ringCount ? 1.5 : 1,
      });
    }

    // 3. Petal Waveforms & Polygon Nodes
    interface PetalPath {
      id: string;
      category: string;
      d: string;
      color: string;
      fillOpacity: number;
      strokeOpacity: number;
      nodes: Array<{ x: number; y: number; r: number }>;
    }

    const petals: PetalPath[] = [];
    const rays: Array<{ x1: number; y1: number; x2: number; y2: number; opacity: number }> = [];

    if (isZeroData) {
      // Golden Ratio Flower of Life / Concentric Sacred Polygons
      const folds = foldCount;
      const angleStep = (Math.PI * 2) / folds;

      for (let tier = 1; tier <= clampedComplexity; tier++) {
        const tierR = coreRadius + (tier / clampedComplexity) * (MAX_R - coreRadius);
        const points: Array<{ x: number; y: number }> = [];
        const nodes: Array<{ x: number; y: number; r: number }> = [];

        for (let i = 0; i < folds; i++) {
          const theta = i * angleStep;
          const x = CX + tierR * Math.cos(theta);
          const y = CY + tierR * Math.sin(theta);
          points.push({ x, y });
          nodes.push({ x, y, r: 2.5 + tier * 0.6 });

          if (tier === clampedComplexity) {
            rays.push({
              x1: CX + coreRadius * Math.cos(theta),
              y1: CY + coreRadius * Math.sin(theta),
              x2: x,
              y2: y,
              opacity: 0.2,
            });
          }
        }

        // Build closed polygon spline
        if (points.length > 0) {
          let d = `M ${points[0].x} ${points[0].y}`;
          for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const midX = (prev.x + curr.x) / 2;
            const midY = (prev.y + curr.y) / 2;
            d += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`;
          }
          d += ' Z';

          petals.push({
            id: `seed-tier-${tier}`,
            category: 'Geometric Baseline',
            d,
            color: tier % 2 === 0 ? activePalette.primary : activePalette.secondary,
            fillOpacity: 0.04 * tier,
            strokeOpacity: 0.35 + tier * 0.1,
            nodes,
          });
        }
      }
    } else {
      // Data-Driven Topologies
      const totalP = categories.reduce((s, c) => s + c.total, 0);

      categories.forEach((cat, index) => {
        const share = cat.total / totalP;
        const catColor = CATEGORY_HEX_COLORS[cat.category] || activePalette.primary;
        const amplitude = 25 + share * 110 * (clampedComplexity * 0.6);
        const baseR = coreRadius + ((MAX_R - coreRadius - amplitude) / categories.length) * index;
        const nodes: Array<{ x: number; y: number; r: number }> = [];

        // Sample points around 360 degrees using sinusoidal petal formulation
        const numSamples = foldCount * 8;
        const step = (Math.PI * 2) / numSamples;
        const points: Array<{ x: number; y: number }> = [];

        for (let s = 0; s <= numSamples; s++) {
          const theta = s * step;
          // Harmonic modulation: r = baseR + amplitude * cos(foldCount * theta + phase)
          const harmonicR = baseR + amplitude * Math.cos(foldCount * theta + index * (Math.PI / 4));
          const px = CX + harmonicR * Math.cos(theta);
          const py = CY + harmonicR * Math.sin(theta);
          points.push({ x: px, y: py });

          // Satellite nodes at crests
          if (s % 8 === 0 && s < numSamples) {
            nodes.push({
              x: px,
              y: py,
              r: Math.max(2, Math.min(6, 2 + share * 12)),
            });
            if (index === 0) {
              rays.push({
                x1: CX + (coreRadius * 0.8) * Math.cos(theta),
                y1: CY + (coreRadius * 0.8) * Math.sin(theta),
                x2: px,
                y2: py,
                opacity: 0.15,
              });
            }
          }
        }

        if (points.length > 0) {
          let d = `M ${points[0].x} ${points[0].y}`;
          for (let p = 1; p < points.length; p++) {
            d += ` L ${points[p].x} ${points[p].y}`;
          }
          d += ' Z';

          petals.push({
            id: `cat-${index}-${cat.category}`,
            category: cat.category,
            d,
            color: catColor,
            fillOpacity: 0.05 + share * 0.25,
            strokeOpacity: 0.4 + share * 0.5,
            nodes,
          });
        }
      });
    }

    return {
      coreRadius,
      rings,
      petals,
      rays,
      isZeroData,
    };
  }, [categories, totalSpending, foldCount, savingsRate, complexity, activePalette]);

  const rotationDuration = prefersReducedMotion || rotationSpeed <= 0 ? 0 : rotationSpeed;

  return (
    <div
      className={`relative select-none flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 600 600"
        width="100%"
        height="100%"
        className="overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Radial Core Glow */}
          <radialGradient id={`mandala-core-${instanceId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={activePalette.highlight} stopOpacity={ambient ? 0.35 : 0.8} />
            <stop offset="40%" stopColor={activePalette.primary} stopOpacity={ambient ? 0.2 : 0.4} />
            <stop offset="100%" stopColor={activePalette.dark} stopOpacity="0" />
          </radialGradient>

          {/* Ambient Outer Halo */}
          <radialGradient id={`mandala-halo-${instanceId}`} cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor={activePalette.glow} stopOpacity={ambient ? 0.08 : 0.15} />
            <stop offset="100%" stopColor={activePalette.primary} stopOpacity="0" />
          </radialGradient>

          {/* Glowing Filter (Strictly subtle, avoiding neon bloat) */}
          <filter id={`mandala-glow-${instanceId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={ambient ? 4 : 2.5} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient Halo Backdrop */}
        <circle cx={CX} cy={CY} r={MAX_R + 30} fill={`url(#mandala-halo-${instanceId})`} />

        {/* Rotating Geometric Container */}
        <motion.g
          animate={rotationDuration > 0 ? { rotate: 360 } : undefined}
          transition={
            rotationDuration > 0
              ? { repeat: Infinity, duration: rotationDuration, ease: 'linear' }
              : undefined
          }
          style={{ transformOrigin: '300px 300px' }}
        >
          {/* Radial Structural Rays */}
          <g className="structural-rays">
            {geometry.rays.map((ray, idx) => (
              <line
                key={`ray-${idx}`}
                x1={ray.x1}
                y1={ray.y1}
                x2={ray.x2}
                y2={ray.y2}
                stroke={activePalette.highlight}
                strokeWidth={0.75}
                strokeOpacity={ray.opacity}
              />
            ))}
          </g>

          {/* Concentric Orbital Rings */}
          <g className="orbital-rings">
            {geometry.rings.map((ring, idx) => (
              <circle
                key={`ring-${idx}`}
                cx={CX}
                cy={CY}
                r={ring.r}
                fill="none"
                stroke={activePalette.primary}
                strokeWidth={ring.strokeWidth}
                strokeDasharray={ring.dash}
                strokeOpacity={ring.opacity}
              />
            ))}
          </g>

          {/* Dynamic Petals & Harmonic Waveforms */}
          <g className="mandala-petals">
            {geometry.petals.map((petal) => {
              const isHovered = hoveredCategory === petal.category;
              return (
                <path
                  key={petal.id}
                  d={petal.d}
                  fill={petal.color}
                  fillOpacity={isHovered ? 0.35 : petal.fillOpacity}
                  stroke={isHovered ? activePalette.highlight : petal.color}
                  strokeWidth={isHovered ? 2.5 : 1.25}
                  strokeOpacity={isHovered ? 1 : petal.strokeOpacity}
                  className={interactive ? 'cursor-pointer transition-all duration-300' : ''}
                  filter={`url(#mandala-glow-${instanceId})`}
                  onMouseEnter={() => {
                    if (interactive) setHoveredCategory(petal.category);
                  }}
                  onMouseLeave={() => {
                    if (interactive) setHoveredCategory(null);
                  }}
                  onClick={() => {
                    if (interactive && onSelectCategory) onSelectCategory(petal.category);
                  }}
                />
              );
            })}
          </g>

          {/* Satellite Constellation Nodes */}
          <g className="constellation-nodes">
            {geometry.petals.map((petal) =>
              petal.nodes.map((node, nIdx) => (
                <circle
                  key={`node-${petal.id}-${nIdx}`}
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={petal.color}
                  stroke={activePalette.highlight}
                  strokeWidth={0.75}
                  opacity={0.85}
                />
              ))
            )}
          </g>
        </motion.g>

        {/* Pulsing Core (Net Worth / Savings Rate Heartbeat) */}
        <g className="central-core" style={{ transformOrigin: '300px 300px' }}>
          <circle
            cx={CX}
            cy={CY}
            r={geometry.coreRadius}
            fill={`url(#mandala-core-${instanceId})`}
          />
          <circle
            cx={CX}
            cy={CY}
            r={geometry.coreRadius * 0.65}
            fill="none"
            stroke={activePalette.highlight}
            strokeWidth={1.5}
            strokeDasharray="3 6"
            strokeOpacity={0.7}
          />
          <circle
            cx={CX}
            cy={CY}
            r={geometry.coreRadius * 0.25}
            fill={activePalette.highlight}
            opacity={0.9}
          />
        </g>
      </svg>

      {/* Interactive Tooltip / Legend Pill (Only when interactive) */}
      {interactive && hoveredCategory && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gray-900/90 dark:bg-black/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide border border-white/20 shadow-xl pointer-events-none animate-fadeIn flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor:
                CATEGORY_HEX_COLORS[hoveredCategory] || activePalette.primary,
            }}
          />
          <span>{hoveredCategory}</span>
        </div>
      )}
    </div>
  );
};

export default FinancialMandala;
