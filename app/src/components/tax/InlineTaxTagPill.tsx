'use client';

/**
 * @fileoverview Feature 12.1: Inline Tax Tagging + Receipt Auto-Linking Pill.
 * Compact 44px touch target pill for transaction rows with bottom sheet category selection.
 *
 * @module components/tax/InlineTaxTagPill
 */

import React, { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface TaxCategory {
  id: string;
  code: string;
  name: string;
  deductiblePercentage: number;
  description: string | null;
}

interface Props {
  transactionId: number;
  amount: number;
  category?: string;
  isTagged?: boolean;
  onTagged?: () => void;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function InlineTaxTagPill({
  transactionId,
  amount,
  category,
  isTagged = false,
  onTagged,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [taggedState, setTaggedState] = useState(isTagged);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data } = useSWR<{ categories: TaxCategory[] }>(
    isOpen ? `/api/tax/categories?txnCategory=${encodeURIComponent(category || '')}` : null,
    fetcher
  );

  const handleSelectCategory = async (cat: TaxCategory) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tax/deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          taxCategoryId: cat.id,
          eligibleAmount: amount,
          notes: `Tagged as ${cat.name}`,
        }),
      });

      if (!res.ok) throw new Error('Failed to tag deduction');
      setTaggedState(true);
      toast.success(`Tagged as ${cat.code} (${Math.round(cat.deductiblePercentage * 100)}% deductible)`);
      if (onTagged) onTagged();
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Tax tagging failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        title={taggedState ? 'Tax Deductible Tagged' : 'Tag as Tax Deductible'}
        className={`min-w-[44px] min-h-[44px] px-2.5 rounded-xl border flex items-center justify-center gap-1 text-xs font-bold transition-all ${
          taggedState
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
            : 'bg-surface-secondary/50 border-border-subtle text-content-muted hover:text-content-primary'
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">
          {taggedState ? 'sell' : 'local_offer'}
        </span>
        <span className="hidden sm:inline text-[10px]">
          {taggedState ? 'Deductible' : 'Tax Tag'}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full sm:max-w-md bg-surface-primary border border-border-subtle rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-border-strong rounded-full mx-auto sm:hidden" />
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div>
                  <h3 className="text-base font-bold text-content-primary">Tag as Tax Write-Off</h3>
                  <p className="text-xs text-content-muted">Assign deduction category for ${amount.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-surface-secondary text-content-muted"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-2 py-2">
                {data?.categories?.map((cat) => (
                  <button
                    key={cat.id}
                    disabled={isSubmitting}
                    onClick={() => handleSelectCategory(cat)}
                    className="w-full min-h-[44px] p-3 text-left rounded-xl bg-surface-secondary hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-border-subtle transition-all flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-content-primary block">{cat.name}</span>
                      <span className="text-[11px] text-content-muted">{cat.description || cat.code}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">
                      {Math.round(cat.deductiblePercentage * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
