'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { createPortal } from 'react-dom';
import AnimatedCounter from '@/components/AnimatedCounter';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { getApiErrorMessage } from '@/lib/api-errors';
import { useCurrency } from '@/hooks/useCurrency';
import TourAddCostModal from '@/components/TourAddCostModal';
import TourEditCostModal from '@/components/TourEditCostModal';
import TourTransactionDetailModal from '@/components/TourTransactionDetailModal';
import { getCategoryIcon } from '@/lib/categoryUtils';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import TourEditModal from '@/components/TourEditModal';

interface TourParticipant {
  id: number;
  name: string;
  userId: number | null;
  paid?: number;
  balance?: number;
}

interface TourTransaction {
  id: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  paidBy: number;
  paidByParticipantId?: number;
  paidByName?: string | null;
  createdById?: number | null;
  createdByName?: string | null;
  splitType: string;
  createdAt?: string | null;
}

interface Tour {
  id: number;
  name: string;
  createdAt: string | null;
  createdBy: number;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

function TourSpendingsSkeleton() {
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

export default function TourDashboard() {
  const params = useParams<{ id: string }>();
  const tourId = params.id;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: tourData, error: tourError, isLoading: tourLoading, mutate: mutateTour } = useSWR(
    tourId ? `/api/bill-splits/tours/${tourId}` : null,
    { keepPreviousData: true, revalidateOnFocus: false }
  );
  const { data: userData } = useSWR('/api/auth/me');

  const tour = tourData?.tour as Tour | null;
  const rawParticipants = tourData?.participants as TourParticipant[] | undefined;
  const rawTransactions = tourData?.transactions as TourTransaction[] | undefined;

  const participants = useMemo(() => rawParticipants ?? [], [rawParticipants]);
  const transactions = useMemo(() => {
    const list = rawTransactions ?? [];
    return [...list].sort((a: TourTransaction, b: TourTransaction) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dateDiff || Number(b.id) - Number(a.id);
    });
  }, [rawTransactions]);

  const currentUserId = userData?.user?.id as number | undefined;
  const isLoading = tourLoading || (!tourData && !tourError);
  const error = tourError ? (tourError.message || 'Unable to load tour.') : (tourData && !tourData.success ? tourData.error : null);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const { fmt } = useCurrency();
  const router = useRouter();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditCostOpen, setIsEditCostOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TourTransaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { categories: customCategories } = useCustomCategories('expense');

  // Destructure computed metrics out of the API response to save client CPU
  const totalSpent = Number(tourData?.totalSpent || 0);
  const perPerson = Number(tourData?.perPerson || 0);
  const averageCost = Number(tourData?.averageCost || 0);
  const balances = (tourData?.balances ?? []) as TourParticipant[];

  const participantMap = useMemo(() => {
    return new Map(participants.map((participant) => [participant.id, participant.name]));
  }, [participants]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, TourTransaction[]>();
    transactions.forEach((transaction) => {
      const key = transaction.date || 'Unknown date';
      groups.set(key, [...(groups.get(key) ?? []), transaction]);
    });
    return Array.from(groups.entries());
  }, [transactions]);

  const handleShareClick = useCallback(async () => {
    setIsShareModalOpen(true);
    if (inviteUrl) return;

    setIsGeneratingInvite(true);
    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}/invite`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (data?.success && data.inviteUrl) {
        setInviteUrl(data.inviteUrl);
      }
    } catch {
      // Silently fail
    } finally {
      setIsGeneratingInvite(false);
    }
  }, [tourId, inviteUrl]);

  const handleCopyLink = useCallback(async () => {
    if (!inviteUrl) return;
    const fullUrl = `${window.location.origin}${inviteUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = fullUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [inviteUrl]);

  const handleDeleteTransaction = async (tx: TourTransaction) => {
    if (!confirm('Are you sure you want to delete this cost?')) return;

    const updatedTransactions = (rawTransactions ?? []).filter((t) => t.id !== tx.id);
    const expectedData = {
      ...tourData,
      transactions: updatedTransactions,
    };

    try {
      await mutateTour(
        fetch(`/api/bill-splits/tours/${tour?.id}/spendings/${tx.id}`, { method: 'DELETE' })
          .then(async (res) => {
            if (!res.ok) throw new Error('Delete failed');
            return expectedData;
          }),
        {
          optimisticData: expectedData,
          rollbackOnError: true,
          populateCache: true,
          revalidate: true,
        }
      );
      mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
    } catch (e) {
      console.error(e);
    }
  };

  const getParticipantName = useCallback((id?: number) => {
    if (id === undefined) return 'Unknown';
    return participantMap.get(id) ?? 'Unknown';
  }, [participantMap]);

  if (isLoading) return <TourSpendingsSkeleton />;

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
    <>
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

          <div className="flex items-center gap-3">
            {tour.createdBy === currentUserId && (
              <motion.button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/50 px-5 py-3.5 text-sm font-black text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[20px]">edit</span>
                Edit Tour
              </motion.button>
            )}
            <motion.button
              type="button"
              onClick={handleShareClick}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3.5 text-sm font-black text-primary hover:bg-primary/15 dark:border-primary/30"
            >
              <span className="material-symbols-outlined text-[20px]">share</span>
              Share Trip
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.22)] hover:bg-primary-hover"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
              Add Cost
            </motion.button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.03 }}
            className="relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white/80 p-7 shadow-[0_20px_65px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.02] dark:shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:col-span-3"
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

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.09 }}
            className="rounded-[2rem] border border-gray-200 bg-white/80 p-7 shadow-[0_20px_65px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.02] md:col-span-3"
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
                    Paid {fmt(participant.paid || 0)}
                  </p>
                  <p className={`mt-3 text-lg font-black ${(participant.balance || 0) > 0 ? 'text-emerald-500' : (participant.balance || 0) < 0 ? 'text-rose-500' : 'text-gray-500'}`}>
                    {(participant.balance || 0) > 0
                      ? `Gets back ${fmt(participant.balance || 0)}`
                      : (participant.balance || 0) < 0
                        ? `Owes ${fmt(Math.abs(participant.balance || 0))}`
                        : 'Settled'}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>
        </div>

        <div className="mt-10">
          <h2 className="mb-6 text-2xl font-black text-gray-950 dark:text-white">Transactions Ledger</h2>
          <AnimatePresence mode="popLayout">
            {transactions.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={spring}
                className="glass-panel flex min-h-72 flex-col items-center justify-center rounded-[2rem] p-8 text-center"
              >
                <span className="material-symbols-outlined mb-4 text-6xl text-gray-300 dark:text-gray-600">receipt_long</span>
                <h2 className="text-2xl font-black text-gray-950 dark:text-white">No costs logged yet</h2>
                <p className="mt-2 max-w-md text-sm font-medium text-gray-500 dark:text-gray-400">
                  Add the first meal, ride, hotel bill, or shared purchase for this trip.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
                  Add First Cost
                </button>
              </motion.div>
            ) : (
              <motion.div key="feed" layout className="space-y-6">
                {groupedTransactions.map(([date, items], groupIndex) => (
                  <motion.section
                    key={date}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: groupIndex * 0.04 }}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                        {date === 'Unknown date' ? date : new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                    </div>

                    <div className="space-y-3">
                      {items.map((transaction, index) => {
                        const payerId = transaction.paidByParticipantId ?? transaction.paidBy;
                        const payerName = transaction.paidByName ?? getParticipantName(payerId);

                        return (
                          <motion.article
                            layoutId={`tour-transaction-${transaction.id}`}
                            key={transaction.id}
                            onClick={() => { setSelectedTransaction(transaction); setIsDetailModalOpen(true); }}
                            initial={{ opacity: 0, x: -14 }}
                            animate={{ opacity: 1, x: 0 }}
                            whileHover={{ y: -2 }}
                            transition={{ ...spring, delay: index * 0.025 }}
                            className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white/78 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur-2xl transition-all hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex min-w-0 items-center gap-4">
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                                  <span className="material-symbols-outlined">
                                    {getCategoryIcon(transaction.category, customCategories)}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <h2 className="truncate text-base font-black text-gray-950 dark:text-white">{transaction.description}</h2>
                                  <p className="mt-1 truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                                    {transaction.createdByName && transaction.createdByName !== payerName ? (
                                      <>Paid by <span className="text-gray-800 dark:text-gray-200">{payerName}</span> (Added by {transaction.createdByName})</>
                                    ) : (
                                      <>Paid by <span className="text-gray-800 dark:text-gray-200">{payerName}</span></>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-xl font-black tabular-nums text-rose-500">-{fmt(transaction.amount)}</p>
                                  <span className="mt-1 inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 dark:border-white/10 dark:bg-white/[0.04]">
                                    {transaction.splitType}
                                  </span>
                                </div>
                                <div className="hidden sm:flex items-center gap-1 border-l border-gray-200 dark:border-white/10 pl-4">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSelectedTransaction(transaction); setIsEditCostOpen(true); }}
                                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:bg-white/[0.04] dark:hover:bg-white/10 dark:hover:text-white"
                                    title="Edit"
                                  >
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); void handleDeleteTransaction(transaction); }}
                                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-400 transition-colors hover:bg-rose-100 hover:text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20"
                                    title="Delete"
                                  >
                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.article>
                        );
                      })}
                    </div>
                  </motion.section>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <TourAddCostModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setSelectedTransaction(null); }}
        participants={participants}
        tourId={Number(tourId)}
        currentUserId={currentUserId}
        isCreator={tour.createdBy === currentUserId}
        onSaveSuccess={() => {
          setIsAddModalOpen(false);
          setSelectedTransaction(null);
          void mutateTour();
        }}
      />

      <TourEditCostModal
        isOpen={isEditCostOpen}
        onClose={() => { setIsEditCostOpen(false); setSelectedTransaction(null); }}
        participants={participants}
        tourId={Number(tourId)}
        currentUserId={currentUserId}
        isCreator={tour.createdBy === currentUserId}
        transaction={selectedTransaction}
        onSaveSuccess={() => {
          setIsEditCostOpen(false);
          setSelectedTransaction(null);
          void mutateTour();
        }}
      />

      {isDetailModalOpen && (
        <TourTransactionDetailModal
          transaction={selectedTransaction}
          customCategories={customCategories}
          tourId={tour.id}
          onClose={() => { setIsDetailModalOpen(false); setSelectedTransaction(null); }}
          onEdit={(tx) => { 
            setIsDetailModalOpen(false); 
            setSelectedTransaction(tx); 
            setIsEditCostOpen(true); 
          }}
          onDelete={(tx) => { setIsDetailModalOpen(false); void handleDeleteTransaction(tx); }}
        />
      )}

      <TourEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        tourId={Number(tourId)}
        initialName={tour.name}
        initialParticipants={participants.map(p => ({ id: p.id, name: p.name, userId: p.userId }))}
        onSaveSuccess={() => { void mutateTour(); }}
      />

      {/* Share / Invite Modal */}
      {mounted && createPortal(
        <AnimatePresence>
          {isShareModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setIsShareModalOpen(false); setCopied(false); }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg z-40"
              />
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={spring}
                className="relative z-50 w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0d1117]/95 shadow-2xl backdrop-blur-xl p-6 sm:p-8"
              >
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Invite</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Share This Trip</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setIsShareModalOpen(false); setCopied(false); }}
                    className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                {isGeneratingInvite ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  </div>
                ) : inviteUrl ? (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-gray-400">
                      Share this link with your trip members so they can join and track expenses together.
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 truncate rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-mono font-bold text-white">
                        {typeof window !== 'undefined' ? `${window.location.origin}${inviteUrl}` : inviteUrl}
                      </div>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.93 }}
                        transition={spring}
                        onClick={handleCopyLink}
                        className={`flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black text-white transition-colors ${
                          copied ? 'bg-emerald-500' : 'bg-primary hover:bg-primary-hover'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                        {copied ? 'Copied!' : 'Copy'}
                      </motion.button>
                    </div>
                    <p className="text-xs font-medium text-gray-400">
                      Anyone with this link can join by selecting their participant name.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-gray-400">
                      Generate an invite link to share with your trip members.
                    </p>
                    <button
                      type="button"
                      onClick={handleShareClick}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.25)] hover:bg-primary-hover"
                    >
                      <span className="material-symbols-outlined text-[20px]">link</span>
                      Generate Invite Link
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
