'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';

interface Goal {
  id: number;
  name: string;
  target_amount: number;
  saved_amount: number;
  deadline: string | null;
  linked_account: string | null;
}

interface Account {
  id: number;
  name: string;
  type: string;
  balance?: number;
}

interface AutoRoundUpPanelProps {
  goal: Goal | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function AutoRoundUpPanel({ goal, isOpen, onClose, onSaved }: AutoRoundUpPanelProps) {
  const { fmt } = useCurrency();
  const [enabled, setEnabled] = useState(true);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [threshold, setThreshold] = useState<string>('5.0');
  const [sourceAccountId, setSourceAccountId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [projectedMonthlySweep, setProjectedMonthlySweep] = useState<number>(0);
  const [expenseCount, setExpenseCount] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  // Load existing rule & accounts when panel opens
  useEffect(() => {
    if (!isOpen || !goal) return;

    let isMounted = true;

    async function loadData() {
      try {
        const [ruleRes, accRes] = await Promise.all([
          fetch('/api/round-up'),
          fetch('/api/accounts'),
        ]);

        if (ruleRes.ok) {
          const ruleData = await ruleRes.json();
          if (isMounted) {
            if (ruleData.rule) {
              const rule = ruleData.rule;
              setEnabled(Boolean(rule.isActive));
              setMultiplier(rule.multiplier || 1.0);
              setThreshold(String(rule.minimumSweepThreshold ?? '5.0'));
              setSourceAccountId(rule.sourceAccountId || null);
            }
            if (ruleData.preview) {
              setProjectedMonthlySweep(ruleData.preview.projectedMonthlySweep || 0);
              setExpenseCount(ruleData.preview.expenseCount || 0);
            }
          }
        }

        if (accRes.ok) {
          const accData = await accRes.json();
          if (isMounted && Array.isArray(accData.accounts)) {
            setAccounts(accData.accounts);
            setSourceAccountId((prev) => prev || (accData.accounts.length > 0 ? accData.accounts[0].id : null));
          }
        }
      } catch (err) {
        console.error('Failed to load round-up details:', err);
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, goal]);

  // Update live preview whenever multiplier changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function updatePreview() {
      setLoadingPreview(true);
      try {
        const res = await fetch(`/api/round-up?multiplier=${multiplier}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.preview) {
            setProjectedMonthlySweep(data.preview.projectedMonthlySweep || 0);
            setExpenseCount(data.preview.expenseCount || 0);
          }
        }
      } catch (err) {
        console.error('Failed to update preview:', err);
      } finally {
        if (isMounted) setLoadingPreview(false);
      }
    }

    const timer = setTimeout(() => {
      void updatePreview();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [multiplier, isOpen]);

  if (!isOpen || !goal) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/round-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          multiplier,
          targetGoalId: goal.id,
          sourceAccountId: sourceAccountId || undefined,
          minimumSweepThreshold: parseFloat(threshold) || 5.0,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save round-up rule');
      }

      toast.success(
        enabled
          ? `Auto Round-Up active for "${goal.name}"!`
          : `Auto Round-Up paused for "${goal.name}".`
      );
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error('Could not save round-up configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="roundup-panel-title"
    >
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-surface-dark-2 rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-white/10 max-h-[90vh] overflow-y-auto safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-700 mx-auto mb-4 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-accent-emerald/10 border border-accent-emerald/20 text-accent-emerald flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">savings</span>
            </div>
            <div>
              <h2 id="roundup-panel-title" className="text-lg font-black text-gray-900 dark:text-white leading-tight">
                Auto Round-Up Rules
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Target: <span className="font-bold text-gray-800 dark:text-gray-200">{goal.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
            aria-label="Close panel"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Enable / Pause Toggle */}
        <div className="mb-5 p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-gray-900 dark:text-white block">
              Enable Round-Ups
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Spare change from expenses is swept to this goal
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none min-h-[44px] flex items-center ${
              enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Multiplier Selection: 1x, 2x, 5x */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Roundup Multiplier
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {[1.0, 2.0, 5.0].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMultiplier(m)}
                className={`py-3 px-4 rounded-2xl font-black text-sm min-h-[44px] flex items-center justify-center transition-all ${
                  multiplier === m
                    ? 'bg-primary text-white shadow-lg shadow-primary/25 border-2 border-primary scale-[1.02]'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-300 dark:hover:border-white/20'
                }`}
              >
                {m}×
              </button>
            ))}
          </div>
        </div>

        {/* Source Account Selection */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Source Account
          </label>
          {accounts.length > 0 ? (
            <select
              value={sourceAccountId || ''}
              onChange={(e) => setSourceAccountId(Number(e.target.value))}
              className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-primary min-h-[44px]"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="dark:bg-surface-dark-2">
                  {acc.name} ({acc.type})
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 rounded-xl bg-gray-100 dark:bg-white/5 text-xs text-gray-500">
              Primary checking / cash account will be used automatically.
            </div>
          )}
        </div>

        {/* Minimum Sweep Threshold */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Minimum Sweep Threshold
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.5"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-primary min-h-[44px]"
              placeholder="5.00"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
              Sweep when accumulated
            </span>
          </div>
        </div>

        {/* Live Spending 30-Day Preview */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg">
              query_stats
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              30-Day Spending Preview
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {loadingPreview ? '...' : fmt(projectedMonthlySweep)}
                <span className="text-xs font-semibold text-gray-400 ml-1">/ month</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Based on your last 30 days of spending ({expenseCount} transactions)
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {multiplier}× boost
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 min-h-[44px]"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
