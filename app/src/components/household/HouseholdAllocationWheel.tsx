'use client';

/**
 * @fileoverview Feature 10.1: Household Budget Caps & Per-Category Allocation Wheel.
 * Supports:
 * 1. Equal Split (100% / N)
 * 2. Income-Proportional Split (Member Income / Total Income * 100)
 * 3. Manual Percentage Sliders with lock toggle and auto-rebalance to 100.0%
 * 4. Optimistic saving to PUT /api/households/[id]/allocations.
 *
 * @module components/household/HouseholdAllocationWheel
 */

import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface HouseholdCap {
  id: number;
  category: string;
  capAmount: number;
  rolloverPolicy: 'none' | 'next_month' | 'pool';
}

interface Member {
  userId: number;
  role: string;
  userName: string | null;
  userEmail: string | null;
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
  members?: Member[];
}

interface Props {
  householdId: number;
  currencySymbol?: string;
  currentUserId?: number;
}

type SplitStrategy = 'equal' | 'income' | 'manual';

const CATEGORY_COLORS: Record<string, string> = {
  'Housing & Rent': '#3b82f6',
  'Groceries': '#10b981',
  'Bills & Utilities': '#f59e0b',
  'Dining & Food': '#ec4899',
  'Entertainment': '#0ea5e9',
  'Transportation': '#06b6d4',
  'Cleaner & Domestic': '#14b8a6',
  'Broadband & Internet': '#136dec',
  'Other': '#6b7280',
};

const MEMBER_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16'];

export function HouseholdAllocationWheel({ householdId, currencySymbol = '$', currentUserId }: Props) {
  const currentMonth = useMemo(() => new Date().toISOString().substring(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'categories' | 'members'>('categories');
  const [splitStrategy, setSplitStrategy] = useState<SplitStrategy>('equal');

  // Split calculations state
  const [memberIncomes, setMemberIncomes] = useState<Record<number, number>>({});
  const [manualPercentages, setManualPercentages] = useState<Record<number, number>>({});
  const [lockedMembers, setLockedMembers] = useState<Record<number, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRebalancing, setIsRebalancing] = useState(false);

  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data, error, isLoading, mutate } = useSWR<AllocationData>(
    `/api/households/${householdId}/allocations?yearMonth=${selectedMonth}`,
    fetcher
  );

  const members = useMemo(() => data?.members || [], [data?.members]);
  const caps = useMemo(() => data?.caps || [], [data?.caps]);
  const totalCap = useMemo(
    () => caps.reduce((sum, c) => sum + c.capAmount, 0) || data?.cycle?.totalCap || 0,
    [caps, data]
  );

  const totalSpent = useMemo(() => {
    if (!data?.memberSpending) return 0;
    return Object.values(data.memberSpending).reduce((sum, m) => sum + m.totalSpent, 0);
  }, [data]);

  // Initialize member percentages when members load
  useEffect(() => {
    if (members.length > 0 && Object.keys(manualPercentages).length === 0) {
      const equalShare = Math.round((100 / members.length) * 10) / 10;
      const initialManual: Record<number, number> = {};
      const initialIncomes: Record<number, number> = {};
      members.forEach((m, idx) => {
        initialManual[m.userId] = idx === members.length - 1 ? 100 - equalShare * (members.length - 1) : equalShare;
        initialIncomes[m.userId] = 50000;
      });
      setManualPercentages(initialManual);
      setMemberIncomes(initialIncomes);
    }
  }, [members, manualPercentages]);

  // Compute member percentages based on selected strategy
  const computedMemberPercentages = useMemo<Record<number, number>>(() => {
    if (members.length === 0) return {};

    if (splitStrategy === 'equal') {
      const share = 100 / members.length;
      const res: Record<number, number> = {};
      members.forEach((m) => {
        res[m.userId] = Math.round(share * 10) / 10;
      });
      return res;
    }

    if (splitStrategy === 'income') {
      const totalIncome = members.reduce((sum, m) => sum + (memberIncomes[m.userId] || 0), 0);
      const res: Record<number, number> = {};
      if (totalIncome <= 0) {
        members.forEach((m) => (res[m.userId] = Math.round((100 / members.length) * 10) / 10));
      } else {
        members.forEach((m) => {
          const inc = memberIncomes[m.userId] || 0;
          res[m.userId] = Math.round((inc / totalIncome) * 1000) / 10;
        });
      }
      return res;
    }

    // Manual mode
    return manualPercentages;
  }, [members, splitStrategy, memberIncomes, manualPercentages]);

  // Handle manual slider adjustment with automatic rebalancing of unlocked members
  const handleManualSliderChange = (targetUserId: number, newVal: number) => {
    if (lockedMembers[targetUserId]) return;

    const clampedVal = Math.max(0, Math.min(100, newVal));
    const otherMembers = members.filter((m) => m.userId !== targetUserId);
    const lockedSum = otherMembers
      .filter((m) => lockedMembers[m.userId])
      .reduce((sum, m) => sum + (manualPercentages[m.userId] || 0), 0);

    const maxAllowed = 100 - lockedSum;
    const finalVal = Math.min(clampedVal, maxAllowed);

    const unlockedOthers = otherMembers.filter((m) => !lockedMembers[m.userId]);
    const remainingToDistribute = Math.max(0, 100 - lockedSum - finalVal);

    const currentUnlockedSum = unlockedOthers.reduce(
      (sum, m) => sum + (manualPercentages[m.userId] || 0),
      0
    );

    const nextPercentages = { ...manualPercentages, [targetUserId]: Math.round(finalVal * 10) / 10 };

    if (unlockedOthers.length > 0) {
      if (currentUnlockedSum > 0) {
        unlockedOthers.forEach((m) => {
          const ratio = (manualPercentages[m.userId] || 0) / currentUnlockedSum;
          nextPercentages[m.userId] = Math.round(remainingToDistribute * ratio * 10) / 10;
        });
      } else {
        const perMember = remainingToDistribute / unlockedOthers.length;
        unlockedOthers.forEach((m) => {
          nextPercentages[m.userId] = Math.round(perMember * 10) / 10;
        });
      }
    }

    setManualPercentages(nextPercentages);
  };

  const handleToggleLock = (userId: number) => {
    setLockedMembers((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Rebalance Caps using largest remainder method
  const handleRebalance = async () => {
    if (caps.length === 0 || totalCap === 0) return;
    setIsRebalancing(true);
    try {
      const targetTotal = totalCap;
      const rawCaps = caps.map((c) => ({
        ...c,
        exact: (c.capAmount / totalCap) * targetTotal,
        floor: Math.floor((c.capAmount / totalCap) * targetTotal),
        remainder: ((c.capAmount / totalCap) * targetTotal) % 1,
      }));

      const allocated = rawCaps.reduce((acc, c) => acc + c.floor, 0);
      const diff = Math.round(targetTotal - allocated);

      rawCaps.sort((a, b) => b.remainder - a.remainder);
      for (let i = 0; i < diff; i++) {
        rawCaps[i % rawCaps.length].floor += 1;
      }

      const updatedCaps = rawCaps.map((c) => ({
        category: c.category,
        capAmount: c.floor,
        rolloverPolicy: c.rolloverPolicy,
      }));

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

  // Save full allocation configuration
  const handleSaveAllocation = async () => {
    setIsSaving(true);
    try {
      // Build per-member target contributions across categories
      const formattedAllocations = members.map((m) => {
        const pct = computedMemberPercentages[m.userId] || 0;
        const targetAmount = Math.round(((totalCap * pct) / 100) * 100) / 100;
        return {
          category: 'All Categories',
          capAmount: targetAmount,
          contributedByUserId: m.userId,
        };
      });

      const res = await fetch(`/api/households/${householdId}/allocations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearMonth: selectedMonth,
          totalCap,
          caps: caps.map((c) => ({
            category: c.category,
            capAmount: c.capAmount,
            rolloverPolicy: c.rolloverPolicy,
          })),
          allocations: formattedAllocations,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save allocations');
      }

      toast.success('Household allocation saved & updated!');
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
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
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center text-sm text-rose-400">
        Failed to load household budget allocations.
      </div>
    );
  }

  // Wheel slices calculation based on active view mode
  let accumulatedAngle = 0;
  const wheelSlices = viewMode === 'categories'
    ? caps.map((cap) => {
        const percentage = totalCap > 0 ? (cap.capAmount / totalCap) * 100 : 100 / Math.max(1, caps.length);
        const angle = (percentage / 100) * 360;
        const startAngle = accumulatedAngle;
        accumulatedAngle += angle;

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

        return {
          title: cap.category,
          amount: cap.capAmount,
          percentage,
          path,
          color: CATEGORY_COLORS[cap.category] || '#10b981',
        };
      })
    : members.map((m, idx) => {
        const percentage = computedMemberPercentages[m.userId] || (100 / Math.max(1, members.length));
        const angle = (percentage / 100) * 360;
        const startAngle = accumulatedAngle;
        accumulatedAngle += angle;

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

        return {
          title: m.userName || `Member #${m.userId}`,
          amount: (totalCap * percentage) / 100,
          percentage,
          path,
          color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
        };
      });

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl card-glass border border-gray-200/80 dark:border-white/10 shadow-lg">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Household Allocation Hub</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Monthly Cap: {currencySymbol}{totalCap.toLocaleString()} • Spent: {currencySymbol}{totalSpent.toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Wheel View Mode Toggle */}
          <div className="flex p-1 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200/80 dark:border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('categories')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'categories'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Categories
            </button>
            <button
              type="button"
              onClick={() => setViewMode('members')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'members'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Members
            </button>
          </div>

          <input
            id="allocation-month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/80 dark:bg-[#0A0E1B] border border-gray-200/80 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
          />

          <button
            type="button"
            onClick={handleRebalance}
            disabled={isRebalancing || caps.length === 0}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-primary/10 hover:bg-primary/20 text-primary dark:text-sky-400 border border-primary/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">balance</span>
            {isRebalancing ? 'Rebalancing...' : 'Rebalance Caps'}
          </button>
        </div>
      </div>

      {/* Main Wheel View & Strategy Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SVG Circular Wheel */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-3xl card-glass border border-gray-200/80 dark:border-white/10 shadow-xl relative min-h-[340px]">
          <svg viewBox="0 0 300 300" className="w-[260px] h-[260px] filter drop-shadow-md">
            {wheelSlices.map((slice, i) => (
              <path
                key={i}
                d={slice.path}
                fill={slice.color}
                className="transition-transform duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98]"
                onClick={() => setSelectedCategory(slice.title)}
              />
            ))}
          </svg>

          {/* Inner Wheel Summary */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-content-muted">
              {viewMode === 'categories' ? 'Total Cap' : 'Fair Shared Pool'}
            </span>
            <span className="text-xl font-black text-content-primary font-mono tabular-nums">
              {currencySymbol}{totalCap.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-400 font-bold mt-0.5">
              {viewMode === 'categories' ? `${caps.length} Categories` : `${members.length} Members`}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {wheelSlices.map((slice, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px] text-content-muted">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="truncate max-w-[90px]">{slice.title}</span>
                <span className="font-mono font-bold text-content-primary">{slice.percentage.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Member Split Strategy Configuration */}
        <div className="lg:col-span-7 p-6 rounded-3xl card-glass border border-gray-200/80 dark:border-white/10 shadow-xl space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-black text-gray-900 dark:text-white">Member Allocation Strategy</h4>
              <span className="text-xs font-mono font-bold text-emerald-500 dark:text-emerald-400">
                Sum: {Object.values(computedMemberPercentages).reduce((a, b) => a + b, 0).toFixed(1)}%
              </span>
            </div>

            {/* 3-Way Strategy Segmented Toggle */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200/80 dark:border-white/10">
              <button
                type="button"
                onClick={() => setSplitStrategy('equal')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  splitStrategy === 'equal'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                1. Equal Split
              </button>

              <button
                type="button"
                onClick={() => setSplitStrategy('income')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  splitStrategy === 'income'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                2. Income-Proportional
              </button>

              <button
                type="button"
                onClick={() => setSplitStrategy('manual')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  splitStrategy === 'manual'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                3. Manual Sliders
              </button>
            </div>
          </div>

          {/* Explanation banner */}
          <div className="p-3.5 rounded-xl bg-blue-500/5 dark:bg-primary/10 border border-blue-500/20 text-xs text-gray-600 dark:text-gray-300 font-medium">
            {splitStrategy === 'equal' && 'Each member contributes an equal percentage (100% / N).'}
            {splitStrategy === 'income' && 'Shares automatically scale according to each member’s monthly net income.'}
            {splitStrategy === 'manual' && 'Adjust individual sliders with lock toggles; unlocked members rebalance to 100% automatically.'}
          </div>

          {/* Member Rows List */}
          <div className="space-y-3">
            {members.map((m, idx) => {
              const pct = computedMemberPercentages[m.userId] || 0;
              const shareAmount = (totalCap * pct) / 100;
              const isLocked = !!lockedMembers[m.userId];

              return (
                <div
                  key={m.userId}
                  className="p-3.5 rounded-2xl bg-surface-secondary border border-border-subtle space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: MEMBER_COLORS[idx % MEMBER_COLORS.length] }}
                      />
                      <span className="text-xs font-bold text-content-primary truncate">
                        {m.userName || `Member #${m.userId}`} {m.userId === currentUserId ? '(You)' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-content-primary">
                        {currencySymbol}{shareAmount.toFixed(0)} ({pct.toFixed(1)}%)
                      </span>

                      {splitStrategy === 'manual' && (
                        <button
                          type="button"
                          onClick={() => handleToggleLock(m.userId)}
                          className={`p-1 rounded-lg border transition-colors ${
                            isLocked
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                          }`}
                          title={isLocked ? 'Locked' : 'Unlocked'}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {isLocked ? 'lock' : 'lock_open'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Income-Proportional Input */}
                  {splitStrategy === 'income' && (
                    <div className="flex items-center gap-2 pt-1">
                      <label className="text-[11px] text-content-muted shrink-0">Monthly Net Income:</label>
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted text-xs">
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={memberIncomes[m.userId] ?? ''}
                          onChange={(e) =>
                            setMemberIncomes((prev) => ({
                              ...prev,
                              [m.userId]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-full pl-6 pr-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#0A0E1B] border border-gray-200/80 dark:border-white/10 text-xs font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  )}

                  {/* Manual Slider */}
                  {splitStrategy === 'manual' && (
                    <div className="pt-1 flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.5"
                        disabled={isLocked}
                        value={manualPercentages[m.userId] ?? pct}
                        onChange={(e) => handleManualSliderChange(m.userId, parseFloat(e.target.value))}
                        className="flex-1 accent-emerald-500 disabled:opacity-40"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save Allocation Button */}
          <button
            type="button"
            onClick={handleSaveAllocation}
            disabled={isSaving}
            className="w-full min-h-[44px] py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {isSaving ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">save</span>
                Save Allocation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
