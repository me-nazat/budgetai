'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import AnimatedCounter from '@/components/AnimatedCounter';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { TiltCard } from '@/components/ui/TiltCard';
import { getApiErrorMessage } from '@/lib/api-errors';
import { useCurrency } from '@/hooks/useCurrency';

interface TourParticipant {
  id: number;
  name: string;
  userId: number | null;
}

interface TourTransaction {
  id: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  paidBy: number;
  paidByParticipantId?: number;
  splitType: string;
}

interface Tour {
  id: number;
  name: string;
  createdAt: string | null;
}

const spring = { type: 'spring' as const, stiffness: 420, damping: 28 };

export default function TourDashboard() {
  const [tour, setTour] = useState<Tour | null>(null);
  const [participants, setParticipants] = useState<TourParticipant[]>([]);
  const [transactions, setTransactions] = useState<TourTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { fmt } = useCurrency();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tourId = params.id;

  useEffect(() => {
    if (!tourId) return;
    let isMounted = true;

    fetch(`/api/bill-splits/tours/${tourId}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(getApiErrorMessage(data, 'Unable to load tour.'));
        return data;
      })
      .then((data) => {
        if (!isMounted) return;
        setTour(data.tour);
        setParticipants(data.participants ?? []);
        setTransactions(data.transactions ?? []);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load tour.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [tourId]);

  const { totalSpent, perPerson, balances, averageCost } = useMemo(() => {
    const total = transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const perHead = participants.length > 0 ? total / participants.length : 0;
    const avg = transactions.length > 0 ? total / transactions.length : 0;

    const settlement = participants.map((participant) => {
      const paid = transactions
        .filter((tx) => (tx.paidByParticipantId ?? tx.paidBy) === participant.id)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      return { ...participant, paid, balance: paid - perHead };
    });

    return { totalSpent: total, perPerson: perHead, averageCost: avg, balances: settlement };
  }, [transactions, participants]);

  if (isLoading) {
    return (
      <div className="mx-auto min-h-dvh max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 h-28 max-w-3xl rounded-[2rem] shimmer-skeleton" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <SkeletonCard className="h-72 rounded-[2rem] md:col-span-2" />
          <SkeletonCard className="h-72 rounded-[2rem]" />
          <SkeletonCard className="h-72 rounded-[2rem] md:col-span-3" />
        </div>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-3xl items-center px-4 py-8 sm:px-6">
        <div className="glass-panel w-full rounded-[2rem] p-8 text-center">
          <span className="material-symbols-outlined mb-3 text-5xl text-rose-400">travel_explore</span>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white">Tour could not load</h1>
          <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">{error ?? 'Tour not found.'}</p>
          <Link href="/tours" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Tours
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          <Link href="/tours" className="mb-4 inline-flex items-center gap-2 rounded-2xl text-sm font-bold text-gray-500 hover:text-gray-950 dark:hover:text-white">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Tours
          </Link>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-primary">Tour Dashboard</p>
          <h1 className="max-w-4xl text-balance text-4xl font-black tracking-tight text-gray-950 dark:text-white lg:text-6xl">
            {tour.name}
          </h1>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.03 }}
          className="relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white/80 p-7 shadow-[0_20px_65px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0d1117]/72 dark:shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:col-span-2"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Total Trip Expenses</p>
          <h2 className="mt-4 text-5xl font-black tracking-tight text-gray-950 dark:text-white lg:text-7xl">
            <AnimatedCounter value={Math.round(totalSpent)} formatter={fmt} className="tabular-nums" />
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Per Person</p>
              <p className="mt-2 text-xl font-black text-gray-950 dark:text-white">{fmt(perPerson)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Transactions</p>
              <p className="mt-2 text-xl font-black text-gray-950 dark:text-white">{transactions.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Avg Cost</p>
              <p className="mt-2 text-xl font-black text-gray-950 dark:text-white">{fmt(averageCost)}</p>
            </div>
          </div>
        </motion.section>

        <TiltCard tiltIntensity={8} className="min-h-72">
          <motion.button
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            transition={{ ...spring, delay: 0.06 }}
            onClick={() => router.push(`/tours/${tour.id}/spendings`)}
            className="group relative flex h-full min-h-72 w-full flex-col justify-between overflow-hidden rounded-[2rem] border border-primary/20 bg-[#0d1b2a] p-7 text-left text-white shadow-[0_24px_75px_rgba(13,27,42,0.34)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(135deg,rgba(19,109,236,0.28),transparent_55%)]" />
            <div className="relative z-10 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <span className="material-symbols-outlined text-3xl">receipt_long</span>
            </div>
            <div className="relative z-10">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-blue-200/80">Spendings</p>
              <h2 className="text-3xl font-black tracking-tight">Open trip ledger</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-blue-100/75">
                Add costs, view the feed, and keep payer details attached to this tour only.
              </p>
            </div>
          </motion.button>
        </TiltCard>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.09 }}
          className="rounded-[2rem] border border-gray-200 bg-white/80 p-7 shadow-[0_20px_65px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0d1117]/72 md:col-span-3"
        >
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-gray-950 dark:text-white">Balances</h2>
              <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">Who paid what and how the equal split currently settles.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((participant) => (
              <div key={participant.id} className="rounded-2xl border border-gray-200 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <h3 className="truncate text-lg font-black text-gray-950 dark:text-white">{participant.name}</h3>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                  Paid {fmt(participant.paid)}
                </p>
                <p className={`mt-3 text-lg font-black ${participant.balance > 0 ? 'text-emerald-500' : participant.balance < 0 ? 'text-rose-500' : 'text-gray-500'}`}>
                  {participant.balance > 0
                    ? `Gets back ${fmt(participant.balance)}`
                    : participant.balance < 0
                      ? `Owes ${fmt(Math.abs(participant.balance))}`
                      : 'Settled'}
                </p>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
