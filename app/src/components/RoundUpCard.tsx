'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import confetti from 'canvas-confetti';
import { useCurrency } from '@/hooks/useCurrency';

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

export default function RoundUpCard() {
  const { fmtRaw } = useCurrency();
  const { data, isLoading } = useSWR<RoundUpSettingsData>('/api/round-up');
  const { data: goalsData } = useSWR<{ goals: SavingsGoalItem[] }>('/api/goals');
  const [showConfig, setShowConfig] = useState(false);
  const [updating, setUpdating] = useState(false);

  if (isLoading || !data?.settings) {
    return (
      <div className="glass-panel p-5 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded-full mb-3" />
        <div className="h-8 w-40 bg-gray-200 dark:bg-white/10 rounded-full" />
      </div>
    );
  }

  const settings = data.settings;
  const active = settings.enabled === 1;

  const toggleActive = async () => {
    setUpdating(true);
    try {
      await fetch('/api/round-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          enabled: !active,
        }),
      });
      await mutate('/api/round-up');

      if (!active) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      }
    } catch {
      // ignore
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <div className="glass-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent-emerald/10 text-accent-emerald flex items-center justify-center">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Micro-Savings Roundups</h3>
              <p className="text-xs text-gray-400">Nearest ৳{settings.roundingTier} · {settings.multiplier}× multiplier</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(true)}
              className="p-2 rounded-xl text-gray-500 hover:text-primary hover:bg-primary/5 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Configure Round-Up Settings"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </button>
            <button
              onClick={toggleActive}
              disabled={updating}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all min-h-[44px] ${
                active
                  ? 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-400'
              }`}
            >
              {active ? 'Active' : 'Enable'}
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <div>
            <p className="text-xs text-gray-400">Roundup Tier</p>
            <p className="text-lg font-black text-gray-900 dark:text-white">৳{settings.roundingTier}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Multiplier</p>
            <p className="text-lg font-black text-accent-emerald">{settings.multiplier}×</p>
          </div>
        </div>
      </div>

      {showConfig && (
        <ConfigureModal
          settings={settings}
          goals={goalsData?.goals || []}
          onClose={() => setShowConfig(false)}
        />
      )}
    </>
  );
}

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
      await fetch('/api/round-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          roundingTier: tier,
          multiplier,
          targetGoalId: goalId,
        }),
      });
      await mutate('/api/round-up');
      onClose();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:flex lg:items-center lg:justify-center" onClick={onClose}>
      <div
        className="fixed bottom-0 left-0 right-0 lg:static lg:w-full lg:max-w-md rounded-t-[2rem] lg:rounded-2xl bg-white dark:bg-surface-dark-2 p-6 shadow-2xl z-50 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-4 lg:hidden" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-emerald/10 text-accent-emerald flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">settings</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Micro-Savings Configuration</h2>
            <p className="text-xs text-gray-400">Automate your savings on every purchase</p>
          </div>
        </div>

        <div className="space-y-5 mb-6">
          {/* Rounding Tier */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Rounding Tier</label>
            <div className="flex gap-2">
              {[1, 5, 10, 50].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs min-h-[44px] transition-all ${
                    tier === t
                      ? 'bg-primary text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  ৳{t}
                </button>
              ))}
            </div>
          </div>

          {/* Multiplier */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Multiplier</label>
            <div className="flex gap-2">
              {[1, 2, 5].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMultiplier(m)}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs min-h-[44px] transition-all ${
                    multiplier === m
                      ? 'bg-accent-emerald text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {m}×
                </button>
              ))}
            </div>
          </div>

          {/* Target Goal */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Target Goal</label>
            <select
              value={goalId || ''}
              onChange={e => setGoalId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[44px]"
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
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/10 text-xs text-gray-700 dark:text-gray-300">
            💡 <strong>Preview:</strong> A ৳47 coffee at {multiplier}× rounding to ৳{tier} saves <strong>৳{previewSavings}</strong> per transaction.
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-bold text-sm min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-hover transition-all min-h-[44px]"
          >
            {saving ? 'Saving...' : 'Save Config'}
          </button>
        </div>
      </div>
    </div>
  );
}
