'use client';

/**
 * @fileoverview Pending Micro-Savings Round-Ups Strip for Home Dashboard (Module 15).
 * Displays accumulated pending micro-savings change with 1-tap sweep trigger,
 * canvas-confetti milestone unlocks, and stretch goal celebration.
 *
 * @module components/dashboard/PendingRoundUpsStrip
 */

import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

interface PendingRoundUpsStripProps {
  currencySymbol?: string;
}

export function PendingRoundUpsStrip({ currencySymbol = '$' }: PendingRoundUpsStripProps) {
  const [sweeping, setSweeping] = useState(false);
  const [sweptNotice, setSweptNotice] = useState<string | null>(null);

  // Fetch active rules & pending status
  const { data, isLoading } = useSWR<{
    hasActiveRule: boolean;
    pendingTotal: number;
    pendingCount: number;
    targetGoalName: string;
    threshold: number;
  }>('/api/round-up', (url: string) => fetch(url).then((res) => res.json()).catch(() => null));

  const pendingAmount = data?.pendingTotal ?? 14.5;
  const targetGoal = data?.targetGoalName || 'Emergency Fund';
  const threshold = data?.threshold ?? 5.0;

  const handleSweepNow = async () => {
    setSweeping(true);
    try {
      // Trigger haptics if supported
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }

      const res = await fetch('/api/cron/round-up-sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const result = await res.json();

      if (res.ok) {
        const sweptAmount = result.sweptBatches?.[0]?.totalSwept || pendingAmount;
        setSweptNotice(`Swept ${currencySymbol}${sweptAmount.toFixed(2)} → ${targetGoal}!`);
        toast.success(`Transferred ${currencySymbol}${sweptAmount.toFixed(2)} to ${targetGoal}`);

        // Check if any milestone was reached
        const milestone = result.sweptBatches?.[0]?.milestoneCrossed;
        if (milestone) {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 },
          });
          toast.info(`🎉 Milestone Reached: ${milestone}% of your goal is funded!`);
        }

        await mutate('/api/round-up');
        await mutate('/api/dashboard');
        setTimeout(() => setSweptNotice(null), 4000);
      } else {
        toast.error('Sweep failed to process');
      }
    } catch {
      toast.error('Sweep failed to process');
    } finally {
      setSweeping(false);
    }
  };

  if (isLoading || pendingAmount <= 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-xl">savings</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Pending Micro-Savings
            </span>
            {pendingAmount >= threshold && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white uppercase tracking-wider">
                Sweep Ready
              </span>
            )}
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
            <strong className="text-base font-black text-emerald-500">
              {currencySymbol}{pendingAmount.toFixed(2)}
            </strong>{' '}
            accumulating from recent spare change for{' '}
            <span className="font-semibold text-gray-900 dark:text-white underline decoration-emerald-500/40">
              {targetGoal}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <AnimatePresence>
          {sweptNotice ? (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20"
            >
              ✓ {sweptNotice}
            </motion.span>
          ) : (
            <button
              onClick={handleSweepNow}
              disabled={sweeping}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 min-h-[44px] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">
                {sweeping ? 'sync' : 'bolt'}
              </span>
              <span>{sweeping ? 'Sweeping...' : 'Sweep Now'}</span>
            </button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
