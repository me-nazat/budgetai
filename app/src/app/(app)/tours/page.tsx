'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { getApiErrorMessage } from '@/lib/api-errors';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useCurrency } from '@/hooks/useCurrency';
import JoinTourModal from '@/components/JoinTourModal';

interface Tour {
  id: number;
  name: string;
  participants: { id: number; name: string }[];
  createdAt: string | null;
  totalSpent?: number;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

const TOUR_GRADIENTS = [
  'from-[#081C15] via-[#1B4332] to-[#000000]', // Forest Emerald
  'from-[#020C1B] via-[#0A192F] to-[#010813]', // Midnight Ocean Blue
  'from-[#0F0505] via-[#3A0C0C] to-[#000000]', // Velvet Crimson Red
  'from-[#001D3D] via-[#003566] to-[#000814]', // Classic Deep Navy
  'from-[#051C1C] via-[#0E3A3A] to-[#000F0F]', // Dark Teal/Cyan
  'from-[#0F140F] via-[#1B3A1B] to-[#020A02]', // Deep Pine Green
  'from-[#1F1403] via-[#3D2606] to-[#0C0801]', // Dark Amber/Bronze
  'from-[#051F20] via-[#0B2527] to-[#010B0C]', // Deep Cyan-Gray
  'from-[#0C1E1A] via-[#15352F] to-[#030E0C]', // Rich Sage Green
  'from-[#1A0C00] via-[#2E1600] to-[#0A0500]', // Deep Chocolate/Burnt Orange
];

const TOUR_ICONS = [
  'map', 'flight', 'directions_car', 'sailing', 'hiking',
  'landscape', 'explore', 'public', 'luggage', 'train'
];

export default function ToursPage() {
  const router = useRouter();
  const { fmt } = useCurrency();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const { data: responseData, error: swrError, isLoading: swrLoading, mutate } = useSWR('/api/bill-splits/tours', {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const tours = (responseData?.tours as Tour[]) || [];
  const isLoading = swrLoading || (!responseData && !swrError);
  const error = swrError
    ? (swrError.message || 'Unable to load tours.')
    : (responseData && !responseData.success ? getApiErrorMessage(responseData, 'Unable to load tours.') : null);

  const deleteTour = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this tour? This cannot be undone.')) return;
    
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/bill-splits/tours/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete tour');
      await mutate();
    } catch (err) {
      console.error(err);
      alert('Unable to delete tour at this time.');
    } finally {
      setIsDeleting(null);
    }
  };

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

        <motion.div className="flex items-center gap-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}>
          <motion.button
            onClick={() => setIsJoinModalOpen(true)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/50 px-5 py-3.5 text-sm font-black text-gray-700 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[20px]">group_add</span>
            Join Tour Plan
          </motion.button>
          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/tours/new"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.22)] hover:bg-primary-hover"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Create New Tour
            </Link>
          </motion.div>
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
              onMouseMove={handleMouseMove}
              className="group relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white/78 p-6 text-left shadow-[0_18px_55px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0A0E1A]/70 dark:shadow-[0_18px_70px_rgba(0,0,0,0.25)] group-hover:saturate-[1.35] group-hover:brightness-[1.35] transition-all duration-500"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${TOUR_GRADIENTS[index % TOUR_GRADIENTS.length]} opacity-70 dark:opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
              <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(400px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(255,255,255,0.06), transparent 80%)`,
                }}
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/20" />
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-white/40 bg-white/60 dark:border-white/10 dark:bg-white/5 backdrop-blur-md shadow-sm">
                  <span className="material-symbols-outlined text-gray-700 dark:text-gray-300">
                    {TOUR_ICONS[index % TOUR_ICONS.length]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-black text-gray-500 dark:border-white/10 dark:bg-white/[0.04]">
                    {tour.createdAt ? new Date(tour.createdAt).toLocaleDateString() : 'New'}
                  </span>
                  <button
                    onClick={(e) => deleteTour(e, tour.id)}
                    disabled={isDeleting === tour.id}
                    className="p-1.5 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isDeleting === tour.id ? 'hourglass_empty' : 'delete'}
                    </span>
                  </button>
                </div>
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

      <JoinTourModal isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} />
    </div>
  );
}
