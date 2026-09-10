'use client';

/**
 * @fileoverview Module 12: AI-Assisted Deduction Review Queue Modal.
 * Renders swipeable card stack (swipe right = verify, swipe left = reject)
 * with AI category suggestions and deductible amount calculations.
 *
 * @module components/tax/TaxReviewQueueModal
 */

import React, { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';

interface QueueItem {
  id: number;
  transactionId: number;
  description: string;
  amount: number;
  date: string;
  originalCategory: string;
  suggestedTaxCategoryId: string;
  suggestedTaxCategoryName: string;
  deductiblePercentage: number;
  estimatedDeductibleAmount: number;
  aiReason: string;
}

interface TaxCategory {
  id: string;
  name: string;
  deductiblePercentage: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onItemProcessed?: () => void;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function TaxReviewQueueModal({ isOpen, onClose, onItemProcessed }: Props) {
  const { fmtRaw } = useCurrency();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verifiedTotal, setVerifiedTotal] = useState(0);

  const { data, mutate, isLoading } = useSWR<{
    data: {
      items: QueueItem[];
      totalCandidates: number;
      categories: TaxCategory[];
    };
  }>(isOpen ? '/api/tax/review-queue' : null, fetcher, {
    revalidateOnFocus: false,
  });

  const items = data?.data?.items || [];
  const categories = data?.data?.categories || [];
  const currentItem = items[currentIndex];

  const handleAction = async (action: 'verify' | 'reject') => {
    if (!currentItem || isProcessing) return;
    setIsProcessing(true);

    const catId = selectedCatId || currentItem.suggestedTaxCategoryId;
    try {
      const res = await fetch('/api/tax/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: currentItem.transactionId,
          action,
          taxCategoryId: catId,
          eligibleAmount: currentItem.amount,
        }),
      });

      if (!res.ok) throw new Error('Failed to process deduction item');

      if (action === 'verify') {
        const cat = categories.find((c) => c.id === catId);
        const pct = cat?.deductiblePercentage ?? currentItem.deductiblePercentage;
        const ded = Math.round(currentItem.amount * pct * 100) / 100;
        setVerifiedTotal((prev) => prev + ded);
        toast.success(`Verified ${fmtRaw(ded)} tax deduction!`, {
          icon: '✅',
        });
      } else {
        toast.info('Transaction excluded from tax deductions');
      }

      onItemProcessed?.();
      setSelectedCatId(null);
      setCurrentIndex((prev) => prev + 1);
    } catch (err: any) {
      toast.error(err.message || 'Error processing item');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full sm:max-w-lg bg-surface-primary border border-border-subtle rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] flex flex-col justify-between overflow-hidden"
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1 bg-border-strong rounded-full mx-auto sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-content-primary">AI Tax Review Queue</h3>
              <p className="text-xs text-content-muted">Swipe right to claim deduction, left to skip</p>
            </div>
          </div>
          <button
            onClick={() => {
              mutate();
              onClose();
            }}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-surface-secondary text-content-muted hover:text-content-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Verified Session Summary Pill */}
        {verifiedTotal > 0 && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs font-semibold shrink-0">
            <span className="text-content-muted">Verified This Session</span>
            <span className="text-emerald-400 font-bold font-mono">+{fmtRaw(verifiedTotal)}</span>
          </div>
        )}

        {/* Body / Card Stack */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
          {isLoading ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-content-muted font-medium">Analyzing transactions with Gemini AI...</p>
            </div>
          ) : !currentItem || currentIndex >= items.length ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">task_alt</span>
              </div>
              <h4 className="text-base font-bold text-content-primary">Review Queue Complete!</h4>
              <p className="text-xs text-content-muted max-w-xs mx-auto leading-relaxed">
                All potential write-offs have been reviewed. Verified deductions are available in your annual export.
              </p>
              <button
                onClick={() => {
                  mutate();
                  onClose();
                }}
                className="mt-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs font-bold text-content-primary hover:bg-surface-tertiary"
              >
                Return to Tax Center
              </button>
            </div>
          ) : (
            <div className="w-full space-y-4">
              {/* Counter */}
              <div className="flex items-center justify-between text-xs text-content-muted">
                <span>Card {currentIndex + 1} of {items.length}</span>
                <span className="font-mono text-[11px]">{currentItem.date}</span>
              </div>

              {/* Active Card */}
              <motion.div
                key={currentItem.id}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                className="p-5 rounded-2xl bg-surface-secondary border border-border-subtle shadow-md space-y-4 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted bg-surface-tertiary px-2 py-0.5 rounded-md">
                      {currentItem.originalCategory}
                    </span>
                    <h4 className="text-base font-bold text-content-primary mt-1.5 line-clamp-2">
                      {currentItem.description}
                    </h4>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-content-primary">
                      {fmtRaw(currentItem.amount)}
                    </p>
                  </div>
                </div>

                {/* AI Classification Banner */}
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <span className="material-symbols-outlined text-[16px]">sparkles</span>
                    <span>AI Recommendation</span>
                  </div>
                  <p className="text-xs text-content-primary font-medium">
                    {currentItem.suggestedTaxCategoryName} ({(currentItem.deductiblePercentage * 100).toFixed(0)}% Deductible)
                  </p>
                  <p className="text-[11px] text-content-muted leading-relaxed">
                    {currentItem.aiReason}
                  </p>
                  <div className="pt-1 flex items-center justify-between border-t border-emerald-500/20 text-xs">
                    <span className="text-content-muted">Estimated Tax Write-Off:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {fmtRaw(currentItem.estimatedDeductibleAmount)}
                    </span>
                  </div>
                </div>

                {/* Optional category override selector */}
                <div>
                  <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                    Override Category (Optional)
                  </label>
                  <select
                    value={selectedCatId || currentItem.suggestedTaxCategoryId}
                    onChange={(e) => setSelectedCatId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-primary border border-border-subtle text-xs text-content-primary font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({(c.deductiblePercentage * 100).toFixed(0)}%)
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {currentItem && currentIndex < items.length && (
          <div className="grid grid-cols-2 gap-3 pt-2 shrink-0">
            <button
              onClick={() => handleAction('reject')}
              disabled={isProcessing}
              className="min-h-[48px] px-4 py-3 rounded-2xl bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle text-content-muted hover:text-content-primary font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              <span>Reject / Skip (←)</span>
            </button>

            <button
              onClick={() => handleAction('verify')}
              disabled={isProcessing}
              className="min-h-[48px] px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Claim Write-Off (→)</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
