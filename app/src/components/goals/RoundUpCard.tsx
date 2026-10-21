'use client';

import React, { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import confetti from 'canvas-confetti';
import { useCurrency } from '@/hooks/useCurrency';
import { calculateRoundUp } from '@/lib/finance/roundUpEngine';

interface RoundUpSettingsData {
  settings: {
    id: number;
    userId: number;
    enabled: number;
    roundingTier: number;
    multiplier: number;
    targetGoalId: number | null;
  };
}

interface SavingsGoalItem {
  id: number;
  name: string;
  targetAmount: number;
  savedAmount: number;
}

export interface RoundUpCardProps {
  initialMultiplier?: number;
  onMultiplierChange?: (multiplier: number) => void;
}

export function RoundUpCard({ initialMultiplier = 1.0, onMultiplierChange }: RoundUpCardProps) {
  const { fmt, symbol } = useCurrency();
  const { data, isLoading } = useSWR<RoundUpSettingsData>('/api/round-ups');
  const { data: goalsData } = useSWR<{ goals: SavingsGoalItem[] }>('/api/goals');
  const [showConfig, setShowConfig] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [localMultiplier, setLocalMultiplier] = useState(initialMultiplier);

  const settings = data?.settings;
  const active = settings ? settings.enabled === 1 : true;
  const currentMultiplier = settings ? settings.multiplier : localMultiplier;
  const currentTier = settings ? settings.roundingTier : 10;

  const samplePurchase = 47.25;
  const { rawDelta, multipliedAmount } = calculateRoundUp(samplePurchase, currentMultiplier);

  const toggleActive = async () => {
    if (!settings) return;
    setUpdating(true);
    try {
      await fetch('/api/round-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          enabled: !active,
        }),
      });
      await mutate('/api/round-ups');

      if (!active) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      }
    } catch {
      // ignore
    } finally {
      setUpdating(false);
    }
  };

  const handleMultiplierSelect = async (m: number) => {
    setLocalMultiplier(m);
    onMultiplierChange?.(m);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([10, 30, 15]);
    }
    if (settings) {
      try {
        await fetch('/api/round-ups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...settings,
            multiplier: m,
          }),
        });
        await mutate('/api/round-ups');
      } catch {
        // ignore
      }
    }
  };

  if (isLoading && !settings) {
    return (
      <div className="card-glass p-5 animate-pulse rounded-2xl border border-white/5">
        <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded-full mb-3" />
        <div className="h-8 w-40 bg-gray-200 dark:bg-white/10 rounded-full" />
      </div>
    );
  }

  return (
    <>
      <div className="card-glass relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-white/[0.08] shadow-xl group">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
              <span className="material-symbols-outlined text-[20px]">savings</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Micro-Savings Auto-Roundups</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Nearest {symbol}{currentTier} · {currentMultiplier}× multiplier</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(true)}
              className="p-2 rounded-xl text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Configure Round-Up Settings"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </button>
            <button
              onClick={toggleActive}
              disabled={updating || !settings}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all min-h-[44px] ${
                active
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {active ? 'Active' : 'Enable'}
            </button>
          </div>
        </div>

        {/* Interactive Multiplier Selector */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Roundup Multiplier</label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 5].map((m) => (
              <button
                key={m}
                onClick={() => handleMultiplierSelect(m)}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentMultiplier === m
                    ? 'bg-primary text-white shadow-md shadow-primary/25 border border-primary/30'
                    : 'bg-black/20 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-white/10 border border-white/5'
                }`}
              >
                {m}×
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        <div className="p-3.5 rounded-xl bg-black/20 dark:bg-black/30 border border-white/[0.08] flex items-center justify-between text-xs">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Sample {symbol}47 Purchase</span>
            <p className="text-gray-900 dark:text-gray-200 font-medium">Raw Spare Change: {fmt(rawDelta)}</p>
          </div>
          <div className="text-right">
            <span className="text-gray-500 dark:text-gray-400">Swept to Vault</span>
            <p className="text-emerald-500 dark:text-emerald-400 font-bold font-mono text-sm">+{fmt(multipliedAmount)}</p>
          </div>
        </div>
      </div>

      {showConfig && settings && (
        <ConfigureModal
          settings={settings}
          goals={goalsData?.goals || []}
          symbol={symbol}
          onClose={() => setShowConfig(false)}
        />
      )}
    </>
  );
}

export default RoundUpCard;

function ConfigureModal({
  settings,
  goals,
  symbol,
  onClose,
}: {
  settings: RoundUpSettingsData['settings'];
  goals: SavingsGoalItem[];
  symbol: string;
  onClose: () => void;
}) {
  const [tier, setTier] = useState<number>(settings.roundingTier || 10);
  const [multiplier, setMultiplier] = useState<number>(settings.multiplier || 1);
  const [goalId, setGoalId] = useState<number | null>(settings.targetGoalId);
  const [saving, setSaving] = useState(false);

  const previewSavings = useMemo(() => {
    const previewAmount = 47;
    const rounded = Math.ceil(previewAmount / tier) * tier;
    return (rounded - previewAmount) * multiplier;
  }, [tier, multiplier]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/round-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          roundingTier: tier,
          multiplier,
          targetGoalId: goalId,
        }),
      });
      await mutate('/api/round-ups');
      onClose();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl card-glass-elevated relative overflow-hidden bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl border border-white/10 p-6 shadow-2xl z-50 max-h-[85vh] overflow-y-auto space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        <div className="flex items-center justify-between border-b border-gray-200/80 dark:border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">settings</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Micro-Savings Configuration</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Automate your savings on every debit</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="space-y-4">
          {/* Rounding Tier */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Rounding Tier</label>
            <div className="flex gap-2">
              {[1, 5, 10, 50].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`flex-1 py-2.5 rounded-xl font-mono font-bold text-xs min-h-[44px] transition-all ${
                    tier === t
                      ? 'bg-primary text-white shadow-md shadow-primary/25 border border-primary/30'
                      : 'bg-black/20 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  {symbol}{t}
                </button>
              ))}
            </div>
          </div>

          {/* Multiplier */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Multiplier</label>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMultiplier(m)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs min-h-[44px] transition-all ${
                    multiplier === m
                      ? 'bg-primary text-white shadow-md shadow-primary/25 border border-primary/30'
                      : 'bg-black/20 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  {m}×
                </button>
              ))}
            </div>
          </div>

          {/* Target Goal */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Target Goal</label>
            <select
              value={goalId || ''}
              onChange={e => setGoalId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-black/20 dark:bg-[#12182B] text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:border-primary transition-all min-h-[44px]"
            >
              <option value="" className="bg-[#12182B] text-white">No goal selected (general savings)</option>
              {goals.map(g => (
                <option key={g.id} value={g.id} className="bg-[#12182B] text-white">
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-xl bg-black/20 dark:bg-black/30 border border-white/[0.08] text-xs text-gray-300 flex items-start gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-[18px] shrink-0 mt-0.5">trending_up</span>
            <div>
              <strong className="text-white">Estimated Impact:</strong> A {symbol}47 purchase at {multiplier}× rounding to nearest {symbol}{tier} directs <strong className="text-emerald-400 font-mono">{symbol}{previewSavings.toFixed(2)}</strong> to your vault.
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white font-bold text-xs min-h-[44px] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs min-h-[44px] transition-all shadow-md shadow-primary/25 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
