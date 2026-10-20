import React from 'react';
import {
  StatCardSkeleton,
  ChartCardSkeleton,
  TableRowSkeleton,
  Skeleton,
} from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto min-h-[80vh] space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[var(--border-subtle)]">
        <div className="space-y-2">
          <Skeleton width="220px" height="28px" rounded="rounded-lg" />
          <Skeleton width="340px" height="14px" rounded="rounded" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton width="110px" height="36px" rounded="rounded-lg" />
          <Skeleton width="110px" height="36px" rounded="rounded-lg" />
        </div>
      </div>

      {/* 4-Card KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* 2-Column Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>

      {/* 6-Row Transaction/Account List */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)]">
        <div className="flex items-center justify-between pb-4 mb-2 border-b border-[var(--border-subtle)]">
          <div>
            <Skeleton width="160px" height="16px" rounded="rounded" className="mb-1.5" />
            <Skeleton width="220px" height="12px" rounded="rounded" />
          </div>
          <Skeleton width="80px" height="28px" rounded="rounded-lg" />
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      </div>
    </div>
  );
}
