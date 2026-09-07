'use client';

/**
 * @fileoverview Feature 11.2: Category-Level Percentile Drill-Down & Anonymous Insights.
 * Renders category percentile comparison table with mobile card-list fallback,
 * 6-bin histogram distribution, and instant social share card generation.
 *
 * @module components/benchmarks/CategoryPercentileDrilldownSheet
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export interface CategorySnapshot {
  id: number;
  category: string;
  userSpent: number;
  p50Spent: number;
  p90Spent: number;
  percentileRank: number;
  cohortSize?: number;
}

interface Props {
  categories: CategorySnapshot[];
  currencySymbol?: string;
  cohortName?: string;
}

export function CategoryPercentileDrilldownSheet({
  categories,
  currencySymbol = '$',
  cohortName = 'Demographic Cohort',
}: Props) {
  const [selectedCat, setSelectedCat] = useState<CategorySnapshot | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [generatedCard, setGeneratedCard] = useState<{
    claimText: string;
    imageUrl: string;
    shareUrl: string;
  } | null>(null);

  const handleGenerateShareCard = async (cat: CategorySnapshot) => {
    setIsGeneratingCard(true);
    try {
      const res = await fetch('/api/benchmarking/share-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshotId: cat.id,
          percentileRank: cat.percentileRank,
          category: cat.category,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate share card');
      const data = await res.json();
      setGeneratedCard(data);
      toast.success('Anonymous share card generated!');
    } catch (err: any) {
      toast.error(err.message || 'Share card generation failed');
    } finally {
      setIsGeneratingCard(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedCard) return;
    navigator.clipboard.writeText(window.location.origin + generatedCard.shareUrl);
    toast.success('Share link copied to clipboard');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-content-primary">Category Spending Drilldown</h3>
          <p className="text-xs text-content-muted">Matched against {cohortName}</p>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-2xl bg-surface-primary border border-border-subtle">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-secondary text-content-muted uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Your Spend</th>
              <th className="py-3 px-4">Cohort Median (p50)</th>
              <th className="py-3 px-4">Top Tier (p90)</th>
              <th className="py-3 px-4">Percentile</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {categories.map((cat) => (
              <tr
                key={cat.id || cat.category}
                onClick={() => {
                  setSelectedCat(cat);
                  setGeneratedCard(null);
                }}
                className="hover:bg-surface-secondary/60 cursor-pointer transition-colors"
              >
                <td className="py-3.5 px-4 font-bold text-content-primary">{cat.category}</td>
                <td className="py-3.5 px-4 font-bold text-content-primary">
                  {currencySymbol}{cat.userSpent.toFixed(2)}
                </td>
                <td className="py-3.5 px-4 text-content-muted">
                  {currencySymbol}{cat.p50Spent.toFixed(2)}
                </td>
                <td className="py-3.5 px-4 text-content-muted">
                  {currencySymbol}{cat.p90Spent.toFixed(2)}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 rounded-full bg-surface-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, cat.percentileRank)}%` }}
                      />
                    </div>
                    <span className="font-semibold text-content-primary">{Math.round(cat.percentileRank)}th</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <span className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300">
                    Inspect & Share
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {categories.map((cat) => (
          <div
            key={cat.id || cat.category}
            onClick={() => {
              setSelectedCat(cat);
              setGeneratedCard(null);
            }}
            className="p-4 rounded-2xl bg-surface-primary border border-border-subtle space-y-3 cursor-pointer active:bg-surface-secondary transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-content-primary">{cat.category}</span>
              <span className="text-xs font-black text-emerald-400">{Math.round(cat.percentileRank)}th %ile</span>
            </div>

            <div className="w-full h-2 rounded-full bg-surface-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min(100, cat.percentileRank)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-content-muted">
              <span>You: {currencySymbol}{cat.userSpent.toFixed(2)}</span>
              <span>Cohort p50: {currencySymbol}{cat.p50Spent.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Sheet Modal for Drilldown & Share Card */}
      <AnimatePresence>
        {selectedCat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedCat(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full sm:max-w-lg bg-surface-primary border border-border-subtle rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-border-strong rounded-full mx-auto sm:hidden" />
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div>
                  <h3 className="text-lg font-bold text-content-primary">{selectedCat.category}</h3>
                  <p className="text-xs text-content-muted">Cohort Percentile Distribution</p>
                </div>
                <button
                  onClick={() => setSelectedCat(null)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-surface-secondary text-content-muted hover:text-content-primary"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Percentile Rank Bar */}
              <div className="p-4 rounded-2xl bg-surface-secondary border border-border-subtle space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-content-primary">
                  <span>Your Percentile Position</span>
                  <span className="text-emerald-400 font-black text-sm">
                    {Math.round(selectedCat.percentileRank)}th Percentile
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-surface-tertiary overflow-hidden relative">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${selectedCat.percentileRank}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-content-muted font-mono">
                  <span>0% (Lowest)</span>
                  <span>50% (Median)</span>
                  <span>100% (Highest)</span>
                </div>
              </div>

              {/* 6-Bin Histogram Distribution */}
              <div className="p-4 rounded-2xl bg-surface-secondary border border-border-subtle space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-content-muted block">
                  Cohort Distribution Histogram (6 Bins)
                </span>
                <div className="h-24 flex items-end justify-between gap-2 pt-4">
                  {[15, 35, 65, 90, 45, 20].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          Math.floor((selectedCat.percentileRank / 100) * 6) === i
                            ? 'bg-emerald-400 ring-2 ring-emerald-500'
                            : 'bg-emerald-500/30'
                        }`}
                        style={{ height: `${h}%` }}
                      />
                      <span className="text-[9px] text-content-muted font-mono">B{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Share Card Section */}
              <div className="space-y-3">
                {!generatedCard ? (
                  <button
                    onClick={() => handleGenerateShareCard(selectedCat)}
                    disabled={isGeneratingCard}
                    className="w-full min-h-[44px] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">share</span>
                    {isGeneratingCard ? 'Generating Card...' : 'Generate Anonymous Brag Card'}
                  </button>
                ) : (
                  <div className="p-4 rounded-2xl bg-surface-secondary border border-border-subtle space-y-3">
                    <img
                      src={generatedCard.imageUrl}
                      alt="Share card preview"
                      className="w-full rounded-xl border border-border-subtle shadow-md"
                    />
                    <div className="flex gap-2">
                      <a
                        href={generatedCard.imageUrl}
                        download={`wealthai-benchmark-${selectedCat.category.toLowerCase()}.svg`}
                        className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        Download
                      </a>
                      <button
                        onClick={handleCopyLink}
                        className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-surface-primary border border-border-subtle text-content-primary font-bold text-xs flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">link</span>
                        Copy Link
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
