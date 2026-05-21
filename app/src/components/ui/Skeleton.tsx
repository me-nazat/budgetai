/**
 * @fileoverview Skeleton loading component with shimmer animation.
 *
 * Provides layout-stable placeholder UI for async content.
 * Prevents Cumulative Layout Shift (CLS) during data loading.
 *
 * @module components/ui/Skeleton
 */

'use client';

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
 *
 * @example
 * ```tsx
 * // Single line
 * <Skeleton width="200px" height="16px" />
 *
 * // Multiple lines
 * <Skeleton count={3} height="14px" />
 *
 * // Avatar circle
 * <Skeleton circle width={48} height={48} />
 * ```
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

  if (count === 1) {
    return (
      <div
        className={`skeleton-shimmer ${className}`}
        style={{ width: w, height: h, borderRadius: radius }}
        aria-hidden="true"
        role="presentation"
      />
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap }}
      aria-hidden="true"
      role="presentation"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`skeleton-shimmer ${className}`}
          style={{
            width: i === count - 1 ? '70%' : w,
            height: h,
            borderRadius: radius,
          }}
        />
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
      className={`skeleton-card ${className}`}
      style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
      aria-hidden="true"
    >
      <Skeleton width="60%" height="16px" />
      <div style={{ height: '12px' }} />
      <Skeleton width="40%" height="32px" />
      <div style={{ height: '16px' }} />
      <Skeleton count={2} height="12px" />
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
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width: '100%',
        height,
        borderRadius: '16px',
      }}
      aria-hidden="true"
    />
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
            padding: '12px 0',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
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
