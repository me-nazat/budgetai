'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from '@/lib/api-errors';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useCurrency } from '@/hooks/useCurrency';

interface Tour {
  id: number;
  name: string;
  participants: { id: number; name: string }[];
  createdAt: string | null;
  totalSpent?: number;
}

const spring = { type: 'spring' as const, stiffness: 420, damping: 28 };

export default function ToursPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { fmt } = useCurrency();

  useEffect(() => {
    let isMounted = true;

    fetch('/api/bill-splits/tours', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(getApiErrorMessage(data, 'Unable to load tours.'));
        return data.tours as Tour[];
      })
      .then((nextTours) => {
        if (!isMounted) return;
        setTours(nextTours);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load tours.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-primary">Shared Expenses</p>
          <h1 className="max-w-3xl text-balance text-4xl font-black tracking-tight text-gray-950 dark:text-white lg:text-6xl">
            Tour Budget Manager
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm font-medium leading-6 text-gray-500 dark:text-gray-400">
            Create trips, add friends, log costs, and see settlement balances without spreadsheet friction.
          </p>
        </motion.div>

        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} transition={spring}>
          <Link
            href="/tours/new"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.22)] hover:bg-primary-hover"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create New Tour
          </Link>
        </motion.div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <SkeletonCard key={item} className="h-56 rounded-[2rem]" />
          ))}
        </div>
      ) : error ? (
        <div className="glass-panel rounded-[2rem] p-8 text-center">
          <span className="material-symbols-outlined mb-3 text-5xl text-rose-400">error</span>
          <h2 className="text-xl font-black text-gray-950 dark:text-white">Tours could not load</h2>
          <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      ) : tours.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="glass-panel flex min-h-72 flex-col items-center justify-center rounded-[2rem] border-dashed p-8 text-center"
        >
          <span className="material-symbols-outlined mb-4 text-6xl text-gray-300 dark:text-gray-600">flight_takeoff</span>
          <h2 className="text-2xl font-black text-gray-950 dark:text-white">No tours yet</h2>
          <p className="mt-2 max-w-md text-sm font-medium text-gray-500 dark:text-gray-400">
            Start with the tour name and participant list, then add costs as they happen.
          </p>
          <Link
            href="/tours/new"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.18)]"
          >
            <span className="material-symbols-outlined text-[20px]">route</span>
            Create Tour Budget
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tours.map((tour, index) => (
            <motion.button
              key={tour.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ ...spring, delay: index * 0.04 }}
              onClick={() => router.push(`/tours/${tour.id}`)}
              className="group relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white/78 p-6 text-left shadow-[0_18px_55px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0d1117]/70 dark:shadow-[0_18px_70px_rgba(0,0,0,0.25)]"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                  <span className="material-symbols-outlined">map</span>
                </div>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-black text-gray-500 dark:border-white/10 dark:bg-white/[0.04]">
                  {tour.createdAt ? new Date(tour.createdAt).toLocaleDateString() : 'New'}
                </span>
              </div>

              <h2 className="relative z-10 mt-7 line-clamp-2 min-h-16 text-2xl font-black tracking-tight text-gray-950 dark:text-white">
                {tour.name}
              </h2>

              <div className="relative z-10 mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">People</p>
                  <p className="mt-1 text-lg font-black text-gray-950 dark:text-white">{tour.participants.length}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Spent</p>
                  <p className="mt-1 truncate text-lg font-black text-gray-950 dark:text-white">
                    {fmt(tour.totalSpent ?? 0)}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
