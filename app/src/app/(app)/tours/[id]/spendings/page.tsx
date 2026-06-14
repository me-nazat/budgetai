'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import AnimatedCounter from '@/components/AnimatedCounter';
import TourAddCostModal from '@/components/TourAddCostModal';
import TourTransactionDetailModal from '@/components/TourTransactionDetailModal';
import Skeleton from '@/components/ui/Skeleton';
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
  paidBy?: number;
  paidByParticipantId?: number;
  paidByName?: string | null;
  splitType: string;
  createdAt?: string | null;
}

interface Tour {
  id: number;
  name: string;
  createdAt: string | null;
}

const spring = { type: 'spring' as const, stiffness: 420, damping: 28 };

function TourSpendingsSkeleton() {
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Skeleton width={140} height={18} />
          <Skeleton width={320} height={52} borderRadius="18px" />
          <Skeleton width={220} height={16} />
        </div>
        <Skeleton width={150} height={52} borderRadius="18px" />
      </div>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="glass-panel rounded-[1.5rem] p-4">
            <Skeleton width="45%" height={12} />
            <div className="mt-3" />
            <Skeleton width="70%" height={28} />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="glass-panel flex items-center gap-4 rounded-[1.5rem] p-4">
            <Skeleton width={48} height={48} borderRadius="16px" />
            <div className="flex-1 space-y-2">
              <Skeleton width="50%" height={18} />
              <Skeleton width="34%" height={12} />
            </div>
            <Skeleton width={90} height={28} borderRadius="12px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TourSpendingsPage() {
  const [tour, setTour] = useState<Tour | null>(null);
  const [participants, setParticipants] = useState<TourParticipant[]>([]);
  const [transactions, setTransactions] = useState<TourTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TourTransaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState<{name: string, color: string}[]>([]);

  useEffect(() => {
    fetch('/api/categories?type=expense').then(res => res.json()).then(data => {
      if (data.categories) setCustomCategories(data.categories);
    }).catch(console.error);
  }, []);

  const { fmt } = useCurrency();
  const params = useParams<{ id: string }>();
  const tourId = params.id;

  const fetchTourData = useCallback(async () => {
    if (!tourId) return;
    setError(null);

    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(getApiErrorMessage(data, 'Unable to load tour spendings.'));

      setTour(data.tour);
      setParticipants(data.participants ?? []);
      setTransactions([...(data.transactions ?? [])].sort((a: TourTransaction, b: TourTransaction) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return dateDiff || Number(b.id) - Number(a.id);
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tour spendings.');
    } finally {
      setIsLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    void fetchTourData();
  }, [fetchTourData]);

  const participantMap = useMemo(() => {
    return new Map(participants.map((participant) => [participant.id, participant.name]));
  }, [participants]);

  const summary = useMemo(() => {
    const total = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const average = transactions.length > 0 ? total / transactions.length : 0;
    const perPerson = participants.length > 0 ? total / participants.length : 0;
    return { total, average, perPerson };
  }, [transactions, participants.length]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, TourTransaction[]>();
    transactions.forEach((transaction) => {
      const key = transaction.date || 'Unknown date';
      groups.set(key, [...(groups.get(key) ?? []), transaction]);
    });
    return Array.from(groups.entries());
  }, [transactions]);


  const handleDeleteTransaction = async (tx: TourTransaction) => {
    if (!confirm('Are you sure you want to delete this cost?')) return;
    try {
      const res = await fetch(`/api/bill-splits/tours/${tour?.id}/spendings/${tx.id}`, { method: 'DELETE' });
      if (res.ok) void fetchTourData();
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
          <span className="material-symbols-outlined mb-3 text-5xl text-rose-400">receipt_long</span>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white">Spendings could not load</h1>
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
      <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <Link href={`/tours/${tour.id}`} className="mb-4 inline-flex items-center gap-2 rounded-2xl text-sm font-bold text-gray-500 hover:text-gray-950 dark:hover:text-white">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Dashboard
            </Link>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-primary">Tour Spendings</p>
            <h1 className="text-balance text-4xl font-black tracking-tight text-gray-950 dark:text-white lg:text-5xl">
              {tour.name}
            </h1>
          </motion.div>

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

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.03 }}
          className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <div className="glass-panel rounded-[1.5rem] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Total Logged</p>
            <p className="mt-2 text-2xl font-black text-gray-950 dark:text-white">
              <AnimatedCounter value={Math.round(summary.total)} formatter={fmt} className="tabular-nums" />
            </p>
          </div>
          <div className="glass-panel rounded-[1.5rem] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Per Person</p>
            <p className="mt-2 text-2xl font-black text-gray-950 dark:text-white">{fmt(summary.perPerson)}</p>
          </div>
          <div className="glass-panel rounded-[1.5rem] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Average Cost</p>
            <p className="mt-2 text-2xl font-black text-gray-950 dark:text-white">{fmt(summary.average)}</p>
          </div>
        </motion.section>

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
                          className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white/78 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0d1117]/72"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                                <span className="material-symbols-outlined">
                                  {transaction.category.toLowerCase().includes('food') ? 'restaurant' :
                                    transaction.category.toLowerCase().includes('hotel') ? 'hotel' :
                                      transaction.category.toLowerCase().includes('flight') || transaction.category.toLowerCase().includes('travel') ? 'flight' :
                                        'receipt_long'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <h2 className="truncate text-base font-black text-gray-950 dark:text-white">{transaction.description}</h2>
                                <p className="mt-1 truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                                  Paid by <span className="text-gray-800 dark:text-gray-200">{payerName}</span> · {transaction.category}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xl font-black tabular-nums text-rose-500">-{fmt(transaction.amount)}</p>
                              <span className="mt-1 inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 dark:border-white/10 dark:bg-white/[0.04]">
                                {transaction.splitType}
                              </span>
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

            <TourAddCostModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setSelectedTransaction(null); }}
        participants={participants}
        tourId={tour.id}
        initialTransaction={selectedTransaction}
        onSaveSuccess={() => {
          setIsAddModalOpen(false);
          setSelectedTransaction(null);
          void fetchTourData();
        }}
      />

      <TourTransactionDetailModal
        transaction={selectedTransaction}
        customCategories={customCategories}
        tourId={tour.id}
        onClose={() => { setIsDetailModalOpen(false); setSelectedTransaction(null); }}
        onEdit={(tx) => { setIsDetailModalOpen(false); setSelectedTransaction(tx); setIsAddModalOpen(true); }}
        onDelete={(tx) => { setIsDetailModalOpen(false); void handleDeleteTransaction(tx); }}
      />
    </>
  );
}
