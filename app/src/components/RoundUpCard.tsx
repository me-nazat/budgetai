'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import confetti from 'canvas-confetti';
import { useCurrency } from '@/hooks/useCurrency';

interface RoundUpData {
  config: { roundUpUnit?: number; round_up_unit?: number; goalId?: number; active: number };
  stats: { totalSaved: number; totalCount: number };
}

export default function RoundUpCard() {
  const { fmtRaw } = useCurrency();
  const { data, isLoading } = useSWR<RoundUpData>('/api/round-up');
  const [updating, setUpdating] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="glass-panel p-5 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded-full mb-3" />
        <div className="h-8 w-40 bg-gray-200 dark:bg-white/10 rounded-full" />
      </div>
    );
  }

  const active = data.config.active === 1;
  const unit = data.config.roundUpUnit || data.config.round_up_unit || 10;
  const totalSaved = data.stats.totalSaved;

  const toggleActive = async () => {
    setUpdating(true);
    try {
      await fetch('/api/round-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundUpUnit: unit,
          active: active ? 0 : 1,
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
    <div className="glass-panel p-5 relative overflow-hidden group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-accent-emerald/10 text-accent-emerald flex items-center justify-center">
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Round-Up Savings</h3>
            <p className="text-xs text-gray-400">Nearest {unit} round-ups</p>
          </div>
        </div>
        <button
          onClick={toggleActive}
          disabled={updating}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            active
              ? 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20'
              : 'bg-gray-100 dark:bg-white/10 text-gray-400'
          }`}
        >
          {active ? 'Active' : 'Enable'}
        </button>
      </div>

      <div className="mt-2">
        <p className="text-2xl font-black text-gray-900 dark:text-white">{fmtRaw(totalSaved)}</p>
        <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
          {data.stats.totalCount} transaction{data.stats.totalCount === 1 ? '' : 's'} rounded up 🎉
        </p>
      </div>
    </div>
  );
}
