'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ReconciliationItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'expense' | 'earning';
  matchConfidence: number;
  isDuplicate: boolean;
  matchedExistingTransactionId?: number | null;
  matchedExistingTransaction?: {
    id: number;
    date: string;
    description: string;
    amount: number;
    category: string;
    type?: string;
  } | null;
  resolution: 'merged' | 'kept_both' | 'discarded' | 'pending';
}

interface StatementReconciliationReviewSheetProps {
  isOpen: boolean;
  item: ReconciliationItem | null;
  currencySymbol?: string;
  onClose: () => void;
  onSelectResolution: (itemId: string, resolution: 'merged' | 'kept_both' | 'discarded' | 'pending') => void;
}

/**
 * Module 16.2: Side-by-Side Statement Reconciliation Review Sheet.
 * Displays parsed bank entry alongside matching database transaction
 * with visual diff highlights and touch-friendly (>=44px) action selectors.
 */
export function StatementReconciliationReviewSheet({
  isOpen,
  item,
  currencySymbol = '$',
  onClose,
  onSelectResolution,
}: StatementReconciliationReviewSheetProps) {
  if (!isOpen || !item) return null;

  const matched = item.matchedExistingTransaction;
  const isExactAmount = matched ? Math.abs(item.amount - matched.amount) < 0.01 : false;
  const isExactDate = matched ? item.date === matched.date : false;

  const getConfidenceBadge = (confidence: number) => {
    const percent = Math.round(confidence * 100);
    if (confidence >= 0.92) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">verified</span>
          {percent}% Match (High Confidence)
        </span>
      );
    }
    if (confidence >= 0.7) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">help</span>
          {percent}% Match (Needs Review)
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">add_circle</span>
        {percent}% Match (New Record)
      </span>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">compare</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Reconciliation Side-by-Side Review
                </h3>
                <div className="mt-1">{getConfidenceBadge(item.matchConfidence)}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Comparison Body: 2 columns on desktop, stacked on mobile */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Parsed Statement Entry */}
              <div className="rounded-2xl p-4 sm:p-5 bg-primary/5 dark:bg-primary/10 border border-primary/20 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-primary/10">
                  <span className="text-[11px] font-black uppercase tracking-wider text-primary">
                    Statement Extracted Entry
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                    Incoming
                  </span>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">
                    Description
                  </label>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                    {item.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">
                      Amount
                    </label>
                    <p className="text-base font-black text-gray-900 dark:text-white mt-0.5">
                      {currencySymbol}
                      {item.amount.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">
                      Date
                    </label>
                    <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mt-1">
                      {item.date}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">
                    Suggested Category
                  </label>
                  <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mt-0.5">
                    {item.category || 'General Expense'}
                  </p>
                </div>
              </div>

              {/* Right Column: Existing Database Transaction */}
              <div
                className={`rounded-2xl p-4 sm:p-5 border space-y-3 ${
                  matched
                    ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20'
                    : 'bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-slate-700">
                  <span
                    className={`text-[11px] font-black uppercase tracking-wider ${
                      matched ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'
                    }`}
                  >
                    Existing Ledger Record
                  </span>
                  {matched ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                      ID #{matched.id}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">No match found</span>
                  )}
                </div>

                {matched ? (
                  <>
                    <div>
                      <label className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">
                        Description
                      </label>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                        {matched.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">
                          Amount
                        </label>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-base font-black text-gray-900 dark:text-white">
                            {currencySymbol}
                            {matched.amount.toFixed(2)}
                          </p>
                          {isExactAmount ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                              ✓ Exact
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 font-bold">
                              Δ {currencySymbol}
                              {Math.abs(item.amount - matched.amount).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">
                          Date
                        </label>
                        <div className="flex items-center gap-1 mt-1">
                          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                            {matched.date}
                          </p>
                          {isExactDate && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                              ✓ Same
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">
                        Category
                      </label>
                      <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mt-0.5">
                        {matched.category || 'Uncategorized'}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    <span className="material-symbols-outlined text-3xl mb-1 block">
                      playlist_add
                    </span>
                    No existing transaction in this account matches this statement entry.
                  </div>
                )}
              </div>
            </div>

            {/* Resolution Explanation Card */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 text-xs text-gray-600 dark:text-slate-300">
              <span className="font-bold text-gray-900 dark:text-white">Current Selection: </span>
              {item.resolution === 'merged' &&
                'Merge (Duplicate) — Skip inserting a new row, link to existing transaction.'}
              {item.resolution === 'kept_both' &&
                'Create New — Insert a fresh transaction into your account ledger.'}
              {item.resolution === 'discarded' &&
                'Skip — Discard this row from the statement entirely.'}
            </div>
          </div>

          {/* Action Selector Bar (Standard 56px action height, >=44px touch targets) */}
          <div className="p-4 sm:p-6 bg-gray-50 dark:bg-slate-900/90 border-t border-gray-100 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  onSelectResolution(item.id, 'merged');
                  onClose();
                }}
                className={`min-h-[48px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  item.resolution === 'merged'
                    ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                    : 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-amber-500/20'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">merge</span>
                <span>Merge Duplicate</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectResolution(item.id, 'kept_both');
                  onClose();
                }}
                className={`min-h-[48px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  item.resolution === 'kept_both'
                    ? 'bg-primary text-white shadow-md ring-2 ring-primary/40'
                    : 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-primary/20'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Create New</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectResolution(item.id, 'discarded');
                  onClose();
                }}
                className={`min-h-[48px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  item.resolution === 'discarded'
                    ? 'bg-rose-500 text-white shadow-md ring-2 ring-rose-400'
                    : 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-rose-500/20'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                <span>Skip</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
