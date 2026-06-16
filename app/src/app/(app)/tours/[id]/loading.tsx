import { SkeletonCard } from '@/components/ui/Skeleton';

export default function TourSpendingsLoading() {
  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 h-28 max-w-3xl rounded-[2rem] bg-gray-200/50 dark:bg-white/5 shimmer-skeleton" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <SkeletonCard className="h-72 rounded-[2rem] md:col-span-2" />
        <SkeletonCard className="h-72 rounded-[2rem]" />
        <SkeletonCard className="h-72 rounded-[2rem] md:col-span-3" />
      </div>
    </div>
  );
}
