'use client';

/**
 * @fileoverview Module 16: AI Duplicate-Reconciliation Card Queue.
 * Reuses the card swipe/motion mechanics from Module 12's TaxReviewQueueModal.
 * Displays parsed statement transaction alongside its best-confidence existing match.
 *
 * Provides 4-way resolution:
 * - 'kept_both': Genuinely two separate transactions (create ledger record)
 * - 'merged': Confirmed duplicate of existing transaction
 * - 'discarded': Parsing error / irrelevant row
 * - 'pending': Left unswiped, revisitable later
 *
 * @module components/bank-import/BankReconciliationCardQueue
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';

export interface ReconciliationQueueItem {
  id: number | string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  type?: string;
  matchConfidence: number;
  possibleMatchTransactionId?: number | null;
  matchedExistingTransaction?: {
    id: number;
    amount: number;
    date: string;
    description: string;
    category?: string;
  } | null;
  resolution: 'pending' | 'kept_both' | 'merged' | 'discarded';
}

interface Props {
  items: ReconciliationQueueItem[];
  batchId?: number | string | null;
  onResolve: (itemId: number | string, resolution: 'pending' | 'kept_both' | 'merged' | 'discarded') => Promise<void> | void;
  onCommit: () => Promise<void> | void;
  committing?: boolean;
}

export function BankReconciliationCardQueue({
  items,
  batchId,
  onResolve,
  onCommit,
  committing = false,
}: Props) {
  const { fmtRaw } = useCurrency();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Track review progress
  const reviewedCount = items.filter((x) => x.resolution !== 'pending').length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;

  const currentItem = items[currentIndex];

  const handleAction = async (resolution: 'pending' | 'kept_both' | 'merged' | 'discarded') => {
    if (!currentItem || isProcessing) return;
    setIsProcessing(true);

    try {
      await onResolve(currentItem.id, resolution);

      if (resolution === 'kept_both') {
        toast.success(`Marked as New Transaction: "${currentItem.description}"`, { icon: '➕' });
      } else if (resolution === 'merged') {
        toast.info(`Merged as duplicate with existing record`, { icon: '🔗' });
      } else if (resolution === 'discarded') {
        toast.warning(`Discarded entry`, { icon: '🗑️' });
      }

      // Advance to next card if not at end
      if (currentIndex < items.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update resolution');
    } finally {
      setIsProcessing(false);
    }
  };

  if (items.length === 0) return null;

  const isHighConfidence = currentItem && currentItem.matchConfidence >= 0.92;
  const isMediumConfidence = currentItem && currentItem.matchConfidence >= 0.7 && currentItem.matchConfidence < 0.92;

  return (
    <div className="w-full space-y-6">
      {/* ── Top Progress Strip ── */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">flaky</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Duplicate-Reconciliation Queue
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {reviewedCount} of {totalCount} reviewed ({progressPct}%)
            </p>
          </div>
        </div>

        {/* Mini progress bar */}
        <div className="w-full sm:w-64 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent-emerald transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-black text-gray-700 dark:text-gray-300 min-w-[36px] text-right">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* ── Card Deck / Active Card (Modelled after Module 12) ── */}
      <div className="min-h-[420px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {currentItem ? (
            <motion.div
              key={currentItem.id}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -12 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl glass-panel p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-white/10 shadow-xl space-y-6 relative overflow-hidden"
            >
              {/* Card Header & Pagination */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-[11px] font-extrabold text-gray-600 dark:text-gray-300">
                    Card {currentIndex + 1} of {totalCount}
                  </span>
                  <span className="text-xs font-semibold text-gray-400">
                    {currentItem.date}
                  </span>
                </div>

                {/* Quick navigator buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors min-h-[36px] min-w-[36px]"
                    aria-label="Previous card"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    disabled={currentIndex === totalCount - 1}
                    onClick={() => setCurrentIndex((prev) => Math.min(totalCount - 1, prev + 1))}
                    className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors min-h-[36px] min-w-[36px]"
                    aria-label="Next card"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>

              {/* Current Parsed Row Details */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md inline-block">
                    {currentItem.category || 'Imported Statement'}
                  </span>
                  <h4 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white truncate">
                    {currentItem.description}
                  </h4>
                  <p className="text-xs text-gray-500">
                    Type: <span className="font-semibold uppercase">{currentItem.type || 'expense'}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white block font-mono">
                    {fmtRaw(currentItem.amount)}
                  </span>
                  <span className="text-[11px] font-bold text-gray-400">Statement Amount</span>
                </div>
              </div>

              {/* AI Duplicate Detection Comparison Banner */}
              {currentItem.matchedExistingTransaction ? (
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isHighConfidence
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : isMediumConfidence
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-500 text-lg">
                        compare_arrows
                      </span>
                      <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Candidate Ledger Match ({Math.round(currentItem.matchConfidence * 100)}% Confidence)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      {isHighConfidence ? 'Likely Duplicate' : 'Possible Match'}
                    </span>
                  </div>

                  {/* Matched row preview */}
                  <div className="p-3 rounded-xl bg-white/60 dark:bg-surface-dark-2/60 border border-amber-500/20 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-3">
                      <p className="font-bold text-gray-900 dark:text-white truncate">
                        {currentItem.matchedExistingTransaction.description}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Recorded on {currentItem.matchedExistingTransaction.date} • Category: {currentItem.matchedExistingTransaction.category || 'General'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-gray-900 dark:text-white font-mono">
                        {fmtRaw(currentItem.matchedExistingTransaction.amount)}
                      </p>
                      <p className="text-[10px] text-gray-400">Ledger TX #{currentItem.matchedExistingTransaction.id}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-xs text-emerald-600 dark:text-emerald-400">
                  <span className="material-symbols-outlined text-xl shrink-0">verified</span>
                  <div>
                    <span className="font-bold block">No Duplicate Found in Ledger</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      This transaction appears to be unique. Recommended action: <b>Keep Both (Create)</b>.
                    </span>
                  </div>
                </div>
              )}

              {/* Resolution Status Pill */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-gray-400 font-semibold">Current Decision:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    currentItem.resolution === 'kept_both'
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : currentItem.resolution === 'merged'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      : currentItem.resolution === 'discarded'
                      ? 'bg-rose-500/15 text-rose-500 border border-rose-500/20'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-400'
                  }`}
                >
                  {currentItem.resolution === 'kept_both'
                    ? 'Keep Both'
                    : currentItem.resolution === 'merged'
                    ? 'Merged'
                    : currentItem.resolution === 'discarded'
                    ? 'Discarded'
                    : 'Pending Review'}
                </span>
              </div>

              {/* ── 4-Way Action Bar (Touch Targets >= 44px) ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                {/* 1. Keep Both */}
                <button
                  type="button"
                  onClick={() => handleAction('kept_both')}
                  disabled={isProcessing}
                  className={`min-h-[48px] px-3 py-2.5 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50 ${
                    currentItem.resolution === 'kept_both'
                      ? 'bg-primary text-white shadow-md shadow-primary/25 border-2 border-primary'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>Keep Both</span>
                </button>

                {/* 2. Merge */}
                <button
                  type="button"
                  onClick={() => handleAction('merged')}
                  disabled={isProcessing}
                  className={`min-h-[48px] px-3 py-2.5 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50 ${
                    currentItem.resolution === 'merged'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 border-2 border-amber-500'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-amber-500/10 hover:text-amber-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">merge</span>
                  <span>Merge</span>
                </button>

                {/* 3. Discard */}
                <button
                  type="button"
                  onClick={() => handleAction('discarded')}
                  disabled={isProcessing}
                  className={`min-h-[48px] px-3 py-2.5 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50 ${
                    currentItem.resolution === 'discarded'
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 border-2 border-rose-500'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-rose-500/10 hover:text-rose-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  <span>Discard</span>
                </button>

                {/* 4. Skip / Pending */}
                <button
                  type="button"
                  onClick={() => handleAction('pending')}
                  disabled={isProcessing}
                  className={`min-h-[48px] px-3 py-2.5 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50 ${
                    currentItem.resolution === 'pending'
                      ? 'bg-gray-200 dark:bg-white/20 text-gray-900 dark:text-white border-2 border-gray-400'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">schedule</span>
                  <span>Pending (Skip)</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="glass-panel p-8 text-center rounded-3xl space-y-4 max-w-md">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">done_all</span>
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                All Cards Reviewed!
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                You have resolved all {totalCount} transactions in this statement batch. Click below to commit these updates to your ledger.
              </p>
              <button
                type="button"
                onClick={() => onCommit()}
                disabled={committing}
                className="min-h-[48px] px-8 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white font-extrabold text-sm shadow-lg shadow-primary/25 transition-all active:scale-95 disabled:opacity-50"
              >
                {committing ? 'Committing...' : 'Commit Batch to Ledger'}
              </button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Sticky Bottom Action Bar with .safe-bottom (Module 16 UX Requirement) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-surface-dark-2/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 shadow-2xl p-4 safe-bottom">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-xl">
              playlist_add_check
            </span>
            <div>
              <p className="text-xs font-extrabold text-gray-900 dark:text-white">
                {reviewedCount} of {totalCount} reviewed
              </p>
              <p className="text-[10px] text-gray-400">
                {items.filter((x) => x.resolution === 'kept_both').length} to add,{' '}
                {items.filter((x) => x.resolution === 'merged').length} merged,{' '}
                {items.filter((x) => x.resolution === 'discarded').length} discarded
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onCommit()}
            disabled={committing || items.length === 0}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-extrabold shadow-md shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {committing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Committing...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                <span>Commit Reconciled Batch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
