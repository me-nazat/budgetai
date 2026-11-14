/**
 * @fileoverview Skeleton loading component with shimmer animation.
 *
 * Provides layout-stable placeholder UI for async content.
 * Prevents Cumulative Layout Shift (CLS) during data loading.
 *
 * @module components/ui/Skeleton
 */

'use client';

import { motion } from 'framer-motion';

/**
 * Props for the Skeleton component.
 */
interface SkeletonProps {
  /** Width (CSS value or number for px). Default: '100%'. */
  width?: string | number;
  /** Height (CSS value or number for px). Default: '20px'. */
  height?: string | number;
  /** Border radius (CSS value). Default: '8px'. */
  borderRadius?: string;
  /** Additional CSS class names. */
  className?: string;
  /** Number of skeleton lines to render. Default: 1. */
  count?: number;
  /** Gap between multiple skeletons. Default: '8px'. */
  gap?: string;
  /** Whether to render as a circle. Default: false. */
  circle?: boolean;
}

/**
 * Skeleton — shimmer loading placeholder.
 */
export default function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius = '8px',
  className = '',
  count = 1,
  gap = '8px',
  circle = false,
}: SkeletonProps) {
  const w = typeof width === 'number' ? `${width}px` : width;
  const h = typeof height === 'number' ? `${height}px` : height;
  const radius = circle ? '50%' : borderRadius;

  const renderShimmerBlock = (itemWidth: string | number, key?: number) => (
    <div
      key={key}
      className={`relative overflow-hidden bg-gray-200/50 dark:bg-white/5 ${className}`}
      style={{ width: itemWidth, height: h, borderRadius: radius }}
      aria-hidden="true"
      role="presentation"
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
      />
    </div>
  );

  if (count === 1) {
    return renderShimmerBlock(w);
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap }}
      aria-hidden="true"
      role="presentation"
    >
      {Array.from({ length: count }, (_, i) => (
        renderShimmerBlock(i === count - 1 ? '70%' : w, i)
      ))}
    </div>
  );
}

/**
 * SkeletonCard — pre-built skeleton for card layouts.
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`glass-panel p-5 rounded-2xl ${className}`}
      aria-hidden="true"
    >
      <Skeleton width="60%" height="16px" />
      <div style={{ height: '16px' }} />
      <Skeleton width="40%" height="36px" />
      <div style={{ height: '24px' }} />
      <Skeleton count={2} height="12px" gap="12px" />
    </div>
  );
}

/**
 * SkeletonChart — pre-built skeleton for chart areas.
 */
export function SkeletonChart({
  height = '200px',
  className = '',
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div className={`w-full relative overflow-hidden rounded-2xl bg-gray-200/50 dark:bg-white/5 ${className}`} style={{ height }}>
       <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
      />
    </div>
  );
}

/**
 * SkeletonTable — pre-built skeleton for table rows.
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = '',
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: rows }, (_, rowIdx) => (
        <div
          key={rowIdx}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '12px',
            padding: '16px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {Array.from({ length: columns }, (_, colIdx) => (
            <Skeleton
              key={colIdx}
              height="14px"
              width={colIdx === 0 ? '80%' : '60%'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
