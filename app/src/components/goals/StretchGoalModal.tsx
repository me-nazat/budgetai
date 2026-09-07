'use client';

/**
 * @fileoverview Stretch Goal Celebration & Creation Modal (Module 15).
 * Triggers when a savings goal crosses 100%, offering a 1-tap 1.5x extension.
 *
 * @module components/goals/StretchGoalModal
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface StretchGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalName: string;
  originalTarget: number;
  currencySymbol?: string;
  suggestionId?: string;
}

export function StretchGoalModal({
  isOpen,
  onClose,
  goalName,
  originalTarget,
  currencySymbol = '$',
  suggestionId,
}: StretchGoalModalProps) {
  const [target, setTarget] = useState(Math.round(originalTarget * 1.5));
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      if (suggestionId) {
        await fetch('/api/goals/stretch-suggestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suggestionId, action: 'accept' }),
        });
      }
      toast.success('🎉 Stretch Goal Activated! Keep the savings momentum going.');
      onClose();
    } catch {
      toast.error('Failed to create stretch goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    if (suggestionId) {
      fetch('/api/goals/stretch-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, action: 'dismiss' }),
      });
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center p-0 lg:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 50 }}
          className="w-full lg:max-w-md bg-white dark:bg-surface-dark-2 rounded-t-[2.5rem] lg:rounded-3xl p-6 lg:p-8 shadow-2xl border border-white/10 text-center"
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/25">
            <span className="material-symbols-outlined text-3xl">trophy</span>
          </div>

          <h2 className="text-xl font-black text-gray-900 dark:text-white mb-1">
            Goal 100% Funded!
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
            You successfully funded <strong>{goalName}</strong>! Don't lose your savings streak.
          </p>

          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 mb-6 text-left space-y-3">
            <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block">
              Suggested 1.5× Stretch Goal
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">New Target</span>
              <strong className="text-lg font-black text-gray-900 dark:text-white">
                {currencySymbol}{target.toLocaleString()}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Target Timeline</span>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                +6 Months
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleAccept}
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-hover transition-all min-h-[44px] shadow-lg shadow-primary/20"
            >
              {submitting ? 'Activating...' : 'Accept Stretch Goal'}
            </button>
            <button
              onClick={handleDismiss}
              className="w-full py-3 rounded-xl text-gray-400 hover:text-white text-xs font-semibold transition-all min-h-[44px]"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
