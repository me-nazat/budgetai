import { SkeletonCard } from '@/components/ui/Skeleton';

export default function ToursLoading() {
  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="h-16 w-64 rounded-2xl bg-gray-200/50 dark:bg-white/5 shimmer-skeleton" />
        <div className="flex items-center gap-3">
          <div className="h-12 w-32 rounded-2xl bg-gray-200/50 dark:bg-white/5 shimmer-skeleton" />
          <div className="h-12 w-32 rounded-2xl bg-gray-200/50 dark:bg-white/5 shimmer-skeleton" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard className="h-48 rounded-[2rem]" />
        <SkeletonCard className="h-48 rounded-[2rem]" />
        <SkeletonCard className="h-48 rounded-[2rem]" />
      </div>
    </div>
  );
}
