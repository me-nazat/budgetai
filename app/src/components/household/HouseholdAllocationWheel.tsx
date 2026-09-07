'use client';

/**
 * @fileoverview Feature 10.1: Household Budget Caps & Per-Category Allocation Wheel.
 * Displays an interactive circular budget allocation wheel on desktop and a vertical
 * stacked bar on mobile with 56px touch targets, member contribution breakdown,
 * and bottom sheet transaction inspection with largest-remainder rebalancing.
 *
 * @module components/household/HouseholdAllocationWheel
 */

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface HouseholdCap {
  id: number;
  category: string;
  capAmount: number;
  rolloverPolicy: 'none' | 'next_month' | 'pool';
}

interface Allocation {
  id: string;
  category: string;
  capAmount: number;
  contributedByUserId: number;
  contributorName?: string;
}

interface AllocationData {
  cycle: {
    id: string;
    householdId: number;
    yearMonth: string;
    totalCap: number;
    status: string;
  };
  caps: HouseholdCap[];
  allocations: Allocation[];
  memberSpending: Record<number, { totalSpent: number; byCategory: Record<string, number> }>;
}

interface Props {
  householdId: number;
  currencySymbol?: string;
  currentUserId?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Housing & Rent': '#3b82f6',
  'Groceries': '#10b981',
  'Utilities': '#f59e0b',
  'Dining & Food': '#ec4899',
  'Entertainment': '#8b5cf6',
  'Transportation': '#06b6d4',
  'Health': '#ef4444',
  'Other': '#6b7280',
};

export function HouseholdAllocationWheel({ householdId, currencySymbol = '$', currentUserId }: Props) {
  const currentMonth = useMemo(() => new Date().toISOString().substring(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isRebalancing, setIsRebalancing] = useState(false);

  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data, error, isLoading, mutate } = useSWR<AllocationData>(
    `/api/households/${householdId}/allocations?yearMonth=${selectedMonth}`,
    fetcher
  );

  const caps = useMemo(() => data?.caps || [], [data]);
  const totalCap = useMemo(
    () => caps.reduce((sum, c) => sum + c.capAmount, 0) || data?.cycle?.totalCap || 0,
    [caps, data]
  );

  // Total household spent this cycle
  const totalSpent = useMemo(() => {
    if (!data?.memberSpending) return 0;
    return Object.values(data.memberSpending).reduce((sum, m) => sum + m.totalSpent, 0);
  }, [data]);

  // Largest remainder method rebalancer
  const handleRebalance = async () => {
    if (caps.length === 0 || totalCap === 0) return;
    setIsRebalancing(true);
    try {
      // Rebalance proportionally based on current cap weights
      const targetTotal = totalCap;
      const rawCaps = caps.map((c) => ({
        ...c,
        exact: (c.capAmount / totalCap) * targetTotal,
        floor: Math.floor((c.capAmount / totalCap) * targetTotal),
        remainder: ((c.capAmount / totalCap) * targetTotal) % 1,
      }));

      const allocated = rawCaps.reduce((acc, c) => acc + c.floor, 0);
      let diff = Math.round(targetTotal - allocated);

      // Sort descending by remainder
      rawCaps.sort((a, b) => b.remainder - a.remainder);
      for (let i = 0; i < diff; i++) {
        rawCaps[i % rawCaps.length].floor += 1;
      }

      const updatedCaps = rawCaps.map((c) => ({
        category: c.category,
        capAmount: c.floor,
        rolloverPolicy: c.rolloverPolicy,
      }));

      // Optimistic update
      await mutate(
        {
          ...data!,
          caps: updatedCaps.map((c, i) => ({ ...c, id: caps[i]?.id || i })),
        },
        false
      );

      const res = await fetch(`/api/households/${householdId}/allocations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearMonth: selectedMonth,
          totalCap,
          caps: updatedCaps,
        }),
      });

      if (!res.ok) throw new Error('Rebalance failed');
      toast.success('Category caps rebalanced using largest-remainder method');
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to rebalance');
    } finally {
      setIsRebalancing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center text-sm text-red-400">
        Failed to load household budget allocations.
      </div>
    );
  }

  // Calculate wheel SVG arcs
  let accumulatedAngle = 0;
  const wheelSlices = caps.map((cap) => {
    const percentage = totalCap > 0 ? (cap.capAmount / totalCap) * 100 : 100 / caps.length;
    const angle = (percentage / 100) * 360;
    const startAngle = accumulatedAngle;
    accumulatedAngle += angle;

    // SVG arc coordinates (center at 150, 150, radius 110, inner radius 75)
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((startAngle + angle - 90) * Math.PI) / 180;
    const rOuter = 115;
    const rInner = 80;

    const x1 = 150 + rOuter * Math.cos(startRad);
    const y1 = 150 + rOuter * Math.sin(startRad);
    const x2 = 150 + rOuter * Math.cos(endRad);
    const y2 = 150 + rOuter * Math.sin(endRad);
    const x3 = 150 + rInner * Math.cos(endRad);
    const y3 = 150 + rInner * Math.sin(endRad);
    const x4 = 150 + rInner * Math.cos(startRad);
    const y4 = 150 + rInner * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;
    const path = `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    const color = CATEGORY_COLORS[cap.category] || '#10b981';

    return {
      category: cap.category,
      capAmount: cap.capAmount,
      rolloverPolicy: cap.rolloverPolicy,
      percentage,
      path,
      color,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface-primary border border-border-subtle">
        <div>
          <h3 className="text-lg font-bold text-content-primary">Household Budget Allocation</h3>
          <p className="text-xs text-content-muted">
            Cycle Cap: {currencySymbol}{totalCap.toLocaleString()} • Spent: {currencySymbol}{totalSpent.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-surface-secondary border border-border-subtle text-content-primary focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleRebalance}
            disabled={isRebalancing || caps.length === 0}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">balance</span>
            {isRebalancing ? 'Rebalancing...' : 'Rebalance Caps'}
          </button>
        </div>
      </div>

      {/* Main Wheel View (Desktop) & Stacked Bars (Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Desktop Circular Wheel */}
        <div className="hidden md:flex lg:col-span-6 flex-col items-center justify-center p-6 rounded-3xl bg-surface-primary border border-border-subtle relative min-h-[360px]">
          <svg viewBox="0 0 300 300" className="w-[280px] h-[280px] filter drop-shadow-md">
            {wheelSlices.map((slice) => (
              <path
                key={slice.category}
                d={slice.path}
                fill={slice.color}
                className="transition-transform duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98]"
                onClick={() => setSelectedCategory(slice.category)}
              />
            ))}
          </svg>
          {/* Inner Wheel Summary */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-xs font-medium uppercase tracking-wider text-content-muted">Monthly Cap</span>
            <span className="text-2xl font-black text-content-primary">
              {currencySymbol}{totalCap.toLocaleString()}
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold mt-0.5">
              {Math.min(100, Math.round((totalSpent / (totalCap || 1)) * 100))}% used
            </span>
          </div>
        </div>

        {/* Mobile Vertical Stacked Bar with 56px Grab Handles */}
        <div className="md:hidden col-span-1 p-5 rounded-2xl bg-surface-primary border border-border-subtle space-y-4">
          <div className="flex justify-between items-center text-xs font-semibold text-content-muted mb-1">
            <span>Category Caps (Vertical Stack)</span>
            <span>Tap to Inspect</span>
          </div>
          <div className="space-y-3">
            {wheelSlices.map((slice) => (
              <div
                key={slice.category}
                onClick={() => setSelectedCategory(slice.category)}
                className="p-3 rounded-xl border border-border-subtle bg-surface-secondary flex items-center justify-between cursor-pointer active:bg-surface-tertiary transition-colors"
                style={{ borderLeft: `6px solid ${slice.color}` }}
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs font-bold text-content-primary">
                    <span>{slice.category}</span>
                    <span>{currencySymbol}{slice.capAmount.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-surface-tertiary rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, slice.percentage)}%`,
                        backgroundColor: slice.color,
                      }}
                    />
                  </div>
                </div>
                {/* 56px touch target grabber */}
                <div className="min-w-[56px] min-h-[56px] flex items-center justify-center text-content-muted ml-2">
                  <span className="material-symbols-outlined text-[24px]">drag_handle</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category List & Rollover Policy Legend */}
        <div className="lg:col-span-6 space-y-3">
          <div className="p-4 rounded-2xl bg-surface-primary border border-border-subtle space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-content-muted">
              Active Category Caps
            </h4>
            <div className="space-y-2">
              {wheelSlices.map((slice) => (
                <div
                  key={slice.category}
                  onClick={() => setSelectedCategory(slice.category)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedCategory === slice.category
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-border-subtle bg-surface-secondary hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: slice.color }} />
                    <div>
                      <div className="text-xs font-bold text-content-primary">{slice.category}</div>
                      <div className="text-[10px] text-content-muted">
                        Rollover: <span className="font-semibold capitalize">{slice.rolloverPolicy}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-content-primary">
                      {currencySymbol}{slice.capAmount.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-content-muted">
                      {Math.round(slice.percentage)}% of total
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Member Contributions Breakdown */}
      {data.memberSpending && Object.keys(data.memberSpending).length > 0 && (
        <div className="p-5 rounded-2xl bg-surface-primary border border-border-subtle space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-content-muted">
            Member Monthly Contributions
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(data.memberSpending).map(([memberId, spending]) => (
              <div key={memberId} className="p-3.5 rounded-xl bg-surface-secondary border border-border-subtle">
                <div className="text-xs font-semibold text-content-muted">Member #{memberId}</div>
                <div className="text-base font-bold text-content-primary mt-1">
                  {currencySymbol}{spending.totalSpent.toLocaleString()}
                </div>
                <div className="text-[11px] text-content-muted mt-1">
                  {Object.keys(spending.byCategory).length} categories active
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Bottom Sheet Detail */}
      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedCategory(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full sm:max-w-lg bg-surface-primary border border-border-subtle rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-border-strong rounded-full mx-auto mb-4 sm:hidden" />
              <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
                <div>
                  <h3 className="text-lg font-bold text-content-primary">{selectedCategory}</h3>
                  <p className="text-xs text-content-muted">Category Allocation Details</p>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-surface-secondary text-content-muted hover:text-content-primary"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="py-5 space-y-4">
                <div className="flex justify-between items-center p-4 rounded-xl bg-surface-secondary border border-border-subtle">
                  <span className="text-xs font-semibold text-content-muted">Assigned Monthly Cap</span>
                  <span className="text-sm font-bold text-content-primary">
                    {currencySymbol}
                    {caps.find((c) => c.category === selectedCategory)?.capAmount.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-xl bg-surface-secondary border border-border-subtle">
                  <span className="text-xs font-semibold text-content-muted">Rollover Strategy</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    {caps.find((c) => c.category === selectedCategory)?.rolloverPolicy || 'None'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedCategory(null)}
                className="w-full min-h-[44px] py-3 rounded-xl bg-emerald-500 font-bold text-white text-xs hover:bg-emerald-600 transition-colors"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
