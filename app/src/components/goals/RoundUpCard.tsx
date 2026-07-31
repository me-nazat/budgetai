'use client';

import React, { useState } from 'react';
import { calculateRoundUp } from '@/lib/finance/roundUpEngine';

interface RoundUpCardProps {
  initialMultiplier?: number;
  onMultiplierChange?: (multiplier: number) => void;
}

export function RoundUpCard({ initialMultiplier = 1.0, onMultiplierChange }: RoundUpCardProps) {
  const [multiplier, setMultiplier] = useState(initialMultiplier);

  const samplePurchase = 4.25;
  const { rawDelta, multipliedAmount } = calculateRoundUp(samplePurchase, multiplier);

  const handleSelect = (m: number) => {
    setMultiplier(m);
    onMultiplierChange?.(m);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([10, 30, 15]);
    }
  };

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <span className="material-symbols-outlined text-xl">savings</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">Micro-Savings Auto-Roundups</h3>
            <p className="text-xs text-slate-400">Sweep purchase spare change to goal vaults</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Active
        </span>
      </div>

      {/* Interactive Multiplier Selector */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-400 mb-2">Roundup Multiplier</label>
        <div className="grid grid-cols-4 gap-2">
          {[1.0, 2.0, 3.0, 5.0].map((m) => (
            <button
              key={m}
              onClick={() => handleSelect(m)}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                multiplier === m
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-lg'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {m}x
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span className="text-slate-500">Sample $4.25 Purchase</span>
          <p className="text-slate-300 font-medium">Raw Spare Change: ${rawDelta.toFixed(2)}</p>
        </div>
        <div className="text-right">
          <span className="text-slate-500">Swept to Vault</span>
          <p className="text-emerald-400 font-bold text-sm">+${multipliedAmount.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
