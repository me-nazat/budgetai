'use client';

import React from 'react';

export interface DuplicateItem {
  id: string;
  importedDate: string;
  importedDescription: string;
  importedAmount: number;
  existingDate: string;
  existingDescription: string;
  existingAmount: number;
}

interface DuplicateReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateItem[];
  onResolve: (item: DuplicateItem, action: 'merge' | 'keep' | 'discard') => void;
}

export function DuplicateReconciliationModal({
  isOpen,
  onClose,
  duplicates,
  onResolve,
}: DuplicateReconciliationModalProps) {
  if (!isOpen || duplicates.length === 0) return null;

  const current = duplicates[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <span className="material-symbols-outlined text-xl">warning</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Suspected Duplicate Record</h3>
            <p className="text-xs text-slate-400">{duplicates.length} item(s) require review</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {/* Imported Transaction */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Statement Import</span>
            <div className="flex items-center justify-between mt-1">
              <div>
                <p className="text-sm font-semibold text-slate-200">{current.importedDescription}</p>
                <p className="text-xs text-slate-500">{current.importedDate}</p>
              </div>
              <span className="text-sm font-bold text-slate-100">${current.importedAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Existing Transaction */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Existing Database Record</span>
            <div className="flex items-center justify-between mt-1">
              <div>
                <p className="text-sm font-semibold text-slate-200">{current.existingDescription}</p>
                <p className="text-xs text-slate-500">{current.existingDate}</p>
              </div>
              <span className="text-sm font-bold text-slate-100">${current.existingAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onResolve(current, 'merge')}
            className="py-3 px-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Merge
          </button>
          <button
            onClick={() => onResolve(current, 'keep')}
            className="py-3 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Keep Both
          </button>
          <button
            onClick={() => onResolve(current, 'discard')}
            className="py-3 px-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
