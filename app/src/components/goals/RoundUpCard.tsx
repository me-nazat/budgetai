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
  const { fmtRaw } = useCurrency();
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
      <div className="glass-panel p-5 animate-pulse rounded-2xl">
        <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded-full mb-3" />
        <div className="h-8 w-40 bg-gray-200 dark:bg-white/10 rounded-full" />
      </div>
    );
  }

  return (
    <>
      <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Micro-Savings Auto-Roundups</h3>
              <p className="text-xs text-slate-400">Nearest ৳{currentTier} · {currentMultiplier}× multiplier</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                  : 'bg-slate-800 text-slate-500 border border-slate-700'
              }`}
            >
              {active ? 'Active' : 'Enable'}
            </button>
          </div>
        </div>

        {/* Interactive Multiplier Selector */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 mb-2">Roundup Multiplier</label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 5].map((m) => (
              <button
                key={m}
                onClick={() => handleMultiplierSelect(m)}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentMultiplier === m
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {m}×
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500">Sample ৳47 Purchase</span>
            <p className="text-slate-300 font-medium">Raw Spare Change: ৳{rawDelta.toFixed(0)}</p>
          </div>
          <div className="text-right">
            <span className="text-slate-500">Swept to Vault</span>
            <p className="text-emerald-400 font-bold text-sm">+৳{multipliedAmount.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {showConfig && settings && (
        <ConfigureModal
          settings={settings}
          goals={goalsData?.goals || []}
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
  onClose,
}: {
  settings: RoundUpSettingsData['settings'];
  goals: SavingsGoalItem[];
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl z-50 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">settings</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Micro-Savings Configuration</h2>
            <p className="text-xs text-slate-400">Automate your savings on every purchase</p>
          </div>
        </div>

        <div className="space-y-5 mb-6">
          {/* Rounding Tier */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Rounding Tier</label>
            <div className="flex gap-2">
              {[1, 5, 10, 50].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs min-h-[44px] transition-all ${
                    tier === t
                      ? 'bg-emerald-500 text-slate-950 shadow-lg'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  ৳{t}
                </button>
              ))}
            </div>
          </div>

          {/* Multiplier */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Multiplier</label>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMultiplier(m)}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs min-h-[44px] transition-all ${
                    multiplier === m
                      ? 'bg-emerald-500 text-slate-950 shadow-lg'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {m}×
                </button>
              ))}
            </div>
          </div>

          {/* Target Goal */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Target Goal</label>
            <select
              value={goalId || ''}
              onChange={e => setGoalId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-h-[44px]"
            >
              <option value="">No goal selected (general savings)</option>
              {goals.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-slate-300">
            💡 <strong>Preview:</strong> A ৳47 coffee at {multiplier}× rounding to ৳{tier} saves <strong>৳{previewSavings}</strong> per transaction.
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm min-h-[44px] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm min-h-[44px] transition-all shadow-lg shadow-emerald-500/20"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
