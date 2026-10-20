import React from 'react';
import { Skeleton, TableRowSkeleton } from '@/components/ui/Skeleton';

export default function TourSpendingsLoading() {
  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Tour Header Banner */}
      <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton width="280px" height="28px" rounded="rounded-xl" />
          <div className="flex items-center gap-2">
            <Skeleton width="28px" height="28px" circle />
            <Skeleton width="28px" height="28px" circle />
            <Skeleton width="28px" height="28px" circle />
            <Skeleton width="120px" height="12px" rounded="rounded" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton width="110px" height="40px" rounded="rounded-xl" />
          <Skeleton width="140px" height="40px" rounded="rounded-xl" />
        </div>
      </div>

      {/* Split Ledger & Summary Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Ledger Slices */}
        <div className="md:col-span-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)]">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-subtle)]">
            <Skeleton width="160px" height="16px" rounded="rounded" />
            <Skeleton width="80px" height="24px" rounded="rounded-lg" />
          </div>
          <div className="space-y-3">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        </div>

        {/* Member Settlement Summary */}
        <div className="md:col-span-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] flex flex-col justify-between">
          <div>
            <Skeleton width="130px" height="16px" rounded="rounded" className="mb-4" />
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center">
                <Skeleton width="90px" height="12px" rounded="rounded" />
                <Skeleton width="60px" height="14px" rounded="rounded" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton width="80px" height="12px" rounded="rounded" />
                <Skeleton width="70px" height="14px" rounded="rounded" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton width="100px" height="12px" rounded="rounded" />
                <Skeleton width="55px" height="14px" rounded="rounded" />
              </div>
            </div>
          </div>
          <Skeleton width="100%" height="40px" rounded="rounded-xl" />
        </div>

        {/* Tour Spendings Table */}
        <div className="md:col-span-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)]">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-subtle)]">
            <div>
              <Skeleton width="180px" height="16px" rounded="rounded" className="mb-1" />
              <Skeleton width="120px" height="12px" rounded="rounded" />
            </div>
            <Skeleton width="90px" height="32px" rounded="rounded-xl" />
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
