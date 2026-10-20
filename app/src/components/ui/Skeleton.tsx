/**
 * @fileoverview Composable, geometry-accurate skeleton primitives.
 *
 * Provides zero-layout-shift (CLS) placeholders using institutional surface tokens
 * (--bg-surface, --bg-elevated, --border-subtle) and hardware-accelerated opacity pulsing.
 *
 * @module components/ui/Skeleton
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps {
  /** Width (CSS string or number for px). Default: '100%'. */
  width?: string | number;
  /** Height (CSS string or number for px). Default: '20px'. */
  height?: string | number;
  /** Border radius class or style. Default: 'rounded-md'. */
  rounded?: string;
  /** Border radius alias for backwards compatibility. */
  borderRadius?: string;
  /** Additional CSS classes. */
  className?: string;
  /** Number of skeleton lines to render. Default: 1. */
  count?: number;
  /** Gap between multiple skeletons. Default: '8px'. */
  gap?: string;
  /** Whether to render as a circle. Default: false. */
  circle?: boolean;
}

/**
 * Base skeleton primitive with hardware-accelerated opacity pulse.
 * Uses institutional --bg-elevated surface token and respects prefers-reduced-motion.
 */
export function Skeleton({
  width = '100%',
  height = '20px',
  rounded = 'rounded-md',
  borderRadius,
  className = '',
  count = 1,
  gap = '8px',
  circle = false,
}: SkeletonProps) {
  const w = typeof width === 'number' ? `${width}px` : width;
  const h = typeof height === 'number' ? `${height}px` : height;
  const customRadius = circle ? '50%' : borderRadius;

  const renderBlock = (itemWidth: string | number, key?: number) => (
    <div
      key={key}
      className={cn(
        'bg-[var(--bg-elevated,#161922)] animate-pulse motion-reduce:animate-none',
        !borderRadius && (circle ? 'rounded-full' : rounded),
        className
      )}
      style={{
        width: itemWidth,
        height: h,
        borderRadius: customRadius,
      }}
      aria-hidden="true"
      role="presentation"
    />
  );

  if (count === 1) {
    return renderBlock(w);
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap }}
      aria-hidden="true"
      role="presentation"
    >
      {Array.from({ length: count }, (_, i) =>
        renderBlock(i === count - 1 ? '75%' : w, i)
      )}
    </div>
  );
}

export default Skeleton;

/**
 * StatCardSkeleton — matches exact height (h-[116px]), padding, and internal layout of DashboardStatCards.tsx.
 */
export function StatCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-[116px] p-5 lg:p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)]',
        className
      )}
      aria-hidden="true"
      role="presentation"
    >
      <div className="flex items-center justify-between">
        <Skeleton width="40%" height="12px" rounded="rounded" />
        <Skeleton width="20px" height="20px" rounded="rounded" />
      </div>
      <div>
        <Skeleton width="60%" height="24px" rounded="rounded" className="mb-2" />
        <div className="flex items-center gap-2">
          <Skeleton width="28%" height="12px" rounded="rounded" />
          <Skeleton width="35%" height="10px" rounded="rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * TableRowSkeleton — matches exact row height (h-[52px]), avatar circle, text bars, and right-aligned amount.
 */
export function TableRowSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-[52px] px-4 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]',
        className
      )}
      aria-hidden="true"
      role="presentation"
    >
      <div className="flex items-center gap-3">
        <Skeleton width="28px" height="28px" circle />
        <div>
          <Skeleton width="120px" height="12px" rounded="rounded" className="mb-1" />
          <Skeleton width="70px" height="10px" rounded="rounded" />
        </div>
      </div>
      <div className="flex flex-col items-end">
        <Skeleton width="80px" height="14px" rounded="rounded" className="mb-1" />
        <Skeleton width="50px" height="10px" rounded="rounded" />
      </div>
    </div>
  );
}

/**
 * ChartCardSkeleton — matches header and canvas dimensions (h-[320px]) of SpendingChart.tsx and PredictiveCashflow.tsx.
 */
export function ChartCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-[320px] p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)]',
        className
      )}
      aria-hidden="true"
      role="presentation"
    >
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <Skeleton width="140px" height="14px" rounded="rounded" className="mb-1.5" />
          <Skeleton width="90px" height="11px" rounded="rounded" />
        </div>
        <Skeleton width="80px" height="28px" rounded="rounded-lg" />
      </div>
      <div className="flex-1 mt-4 rounded-xl bg-[var(--bg-elevated)]/40 p-4 flex items-end gap-3">
        <Skeleton width="10%" height="45%" rounded="rounded-t" />
        <Skeleton width="10%" height="70%" rounded="rounded-t" />
        <Skeleton width="10%" height="35%" rounded="rounded-t" />
        <Skeleton width="10%" height="85%" rounded="rounded-t" />
        <Skeleton width="10%" height="60%" rounded="rounded-t" />
        <Skeleton width="10%" height="95%" rounded="rounded-t" />
        <Skeleton width="10%" height="50%" rounded="rounded-t" />
        <Skeleton width="10%" height="75%" rounded="rounded-t" />
        <Skeleton width="10%" height="40%" rounded="rounded-t" />
        <Skeleton width="10%" height="65%" rounded="rounded-t" />
      </div>
    </div>
  );
}

/**
 * SkeletonCard — pre-built surface card skeleton.
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)]',
        className
      )}
      aria-hidden="true"
      role="presentation"
    >
      <Skeleton width="50%" height="14px" className="mb-4" />
      <Skeleton width="75%" height="28px" className="mb-4" />
      <Skeleton count={2} height="12px" gap="8px" />
    </div>
  );
}

/**
 * SkeletonChart — pre-built skeleton for chart areas.
 */
export function SkeletonChart({
  height = '320px',
  className = '',
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'w-full relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6',
        className
      )}
      style={{ height }}
      aria-hidden="true"
      role="presentation"
    >
      <ChartCardSkeleton className="border-0 shadow-none p-0 h-full" />
    </div>
  );
}

/**
 * SkeletonTable — pre-built skeleton for multi-row tables.
 */
export function SkeletonTable({
  rows = 5,
  className = '',
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-xl border border-[var(--border-subtle)] overflow-hidden', className)}
      aria-hidden="true"
      role="presentation"
    >
      {Array.from({ length: rows }, (_, rowIdx) => (
        <TableRowSkeleton key={rowIdx} />
      ))}
    </div>
  );
}
