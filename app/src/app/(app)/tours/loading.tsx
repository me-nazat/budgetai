import React from 'react';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function ToursLoading() {
  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Tours Header Skeleton */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between pb-4 border-b border-[var(--border-subtle)]">
        <div className="space-y-2">
          <Skeleton width="240px" height="32px" rounded="rounded-xl" />
          <Skeleton width="360px" height="14px" rounded="rounded" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton width="130px" height="42px" rounded="rounded-xl" />
          <Skeleton width="150px" height="42px" rounded="rounded-xl" />
        </div>
      </div>

      {/* Tours 3-Column Card Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <SkeletonCard key={item} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
