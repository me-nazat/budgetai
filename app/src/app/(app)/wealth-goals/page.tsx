'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Toaster, toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface Goal {
  id: number;
  name: string;
  target_amount: number;
  saved_amount: number;
  deadline: string | null;
  linked_account: string | null;
  created_at: string;
  last_milestone_hit?: number;
}

interface Account {
  id: number;
  name: string;
  type: string;
  currentBalance: number;
}

interface RoundUpRuleData {
  id?: string;
  targetGoalId?: string | number;
  multiplier?: number;
  isActive?: boolean;
  sourceAccountId?: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function monthsBetween(deadline: string | null) {
  if (!deadline) return 12;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24 * 30)));
}

function WealthGoalsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') === 'independence' ? 'independence' : 'savings';
  const { fmt } = useCurrency();

  // SWR data queries
  const { data: goalsData, isLoading: goalsLoading, mutate: mutateGoals } = useSWR<{ goals: Goal[] }>(
    '/api/goals',
    fetcher
  );
  const { data: networthData } = useSWR('/api/networth', fetcher);
  const { data: accountsData } = useSWR<{ accounts: Account[] }>('/api/accounts', fetcher);
  const { data: roundUpData, mutate: mutateRoundUp } = useSWR('/api/round-ups', fetcher);

  const goals = useMemo(() => goalsData?.goals || [], [goalsData?.goals]);
  const accounts = useMemo(() => accountsData?.accounts || [], [accountsData?.accounts]);
  const activeRule: RoundUpRuleData | null = roundUpData?.rule || null;
  const roundUpMonthlyStats = roundUpData?.monthlyStats || { totalSaved: 0, count: 0 };

  // Modals & Drawers state
  const [selectedGoalForDrawer, setSelectedGoalForDrawer] = useState<Goal | null>(null);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributeAccountId, setContributeAccountId] = useState<number | ''>('');
  const [isContributing, setIsContributing] = useState(false);

  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalDeadline, setNewGoalDeadline] = useState('');
  const [newGoalAccount, setNewGoalAccount] = useState('');
  const [isCreatingGoal, setIsCreatingGoal] = useState(false);

  // Drawer edit state
  const [drawerTarget, setDrawerTarget] = useState('');
  const [drawerDeadline, setDrawerDeadline] = useState('');
  const [isUpdatingDrawer, setIsUpdatingDrawer] = useState(false);

  // FIRE Calculator state
  const [swrRate, setSwrRate] = useState<number>(4.0); // 4% Rule
  const [expectedReturn, setExpectedReturn] = useState<number>(7.0); // 7% Real Return

  // Synchronize drawer input when a goal is selected
  useEffect(() => {
    if (selectedGoalForDrawer) {
      setDrawerTarget(String(selectedGoalForDrawer.target_amount));
      setDrawerDeadline(selectedGoalForDrawer.deadline || '');
    }
  }, [selectedGoalForDrawer]);

  // Executive Top Metrics calculations
  const totalSaved = useMemo(() => {
    return goals.reduce((sum, g) => sum + (Number(g.saved_amount) || 0), 0);
  }, [goals]);

  const activeGoals = useMemo(() => {
    return goals.filter((g) => (Number(g.saved_amount) || 0) < (Number(g.target_amount) || 0));
  }, [goals]);

  const monthlyRequiredPace = useMemo(() => {
    return activeGoals.reduce((sum, g) => {
      const remaining = Math.max(0, g.target_amount - g.saved_amount);
      return sum + remaining / monthsBetween(g.deadline);
    }, 0);
  }, [activeGoals]);

  const liquidReserves = useMemo(() => {
    const liquidFromAccounts = accounts
      .filter((a) => a.type === 'bank' || a.type === 'cash')
      .reduce((sum, a) => sum + (Number(a.currentBalance) || 0), 0);
    if (liquidFromAccounts > 0) return liquidFromAccounts;
    return Number(networthData?.currentBreakdown?.liquidCash) || totalSaved;
  }, [accounts, networthData, totalSaved]);

  // Emergency runway: monthly essential spend estimate
  const estimatedMonthlyBurn = useMemo(() => {
    const nwLiabilities = Number(networthData?.currentBreakdown?.totalLiabilities) || 0;
    const monthlySpendFromEntries =
      networthData?.entries && networthData.entries.length > 1
        ? Math.abs(networthData.entries[0].amount - networthData.entries[1].amount)
        : 35000;
    return Math.max(20000, monthlySpendFromEntries > 0 ? monthlySpendFromEntries : nwLiabilities / 12 || 35000);
  }, [networthData]);

  const emergencyRunwayMonths = useMemo(() => {
    if (estimatedMonthlyBurn <= 0) return 6;
    return Math.max(0, Math.round((liquidReserves / estimatedMonthlyBurn) * 10) / 10);
  }, [liquidReserves, estimatedMonthlyBurn]);

  // FIRE pre-populated values
  const currentNetWorth = useMemo(() => {
    return Number(networthData?.currentBreakdown?.netWorth ?? networthData?.entries?.[0]?.amount ?? liquidReserves);
  }, [networthData, liquidReserves]);

  const annualSpending = useMemo(() => {
    return estimatedMonthlyBurn * 12;
  }, [estimatedMonthlyBurn]);

  const annualSavings = useMemo(() => {
    return Math.max(0, monthlyRequiredPace * 12);
  }, [monthlyRequiredPace]);

  const fiNumber = useMemo(() => {
    const swrDecimal = swrRate / 100;
    return swrDecimal > 0 ? Math.round(annualSpending / swrDecimal) : 0;
  }, [annualSpending, swrRate]);

  const fiProgressPct = useMemo(() => {
    if (fiNumber <= 0) return 0;
    return Math.min(100, Math.round((currentNetWorth / fiNumber) * 1000) / 10);
  }, [currentNetWorth, fiNumber]);

  // Compound growth timeline for FIRE
  const fireTimeline = useMemo(() => {
    const points: Array<{ year: number; balance: number; fiTarget: number }> = [];
    const r = expectedReturn / 100;
    const currentYear = new Date().getFullYear();
    let balance = currentNetWorth;
    const annualContr = annualSavings > 0 ? annualSavings : estimatedMonthlyBurn * 0.4 * 12;

    for (let yr = 0; yr <= 25; yr++) {
      points.push({
        year: currentYear + yr,
        balance: Math.round(balance),
        fiTarget: fiNumber,
      });
      balance = balance * (1 + r) + annualContr;
    }
    return points;
  }, [currentNetWorth, expectedReturn, annualSavings, estimatedMonthlyBurn, fiNumber]);

  const projectedFreedomYear = useMemo(() => {
    const hit = fireTimeline.find((p) => p.balance >= fiNumber);
    return hit ? hit.year : new Date().getFullYear() + 25;
  }, [fireTimeline, fiNumber]);

  // Actions
  const handleTabChange = (tab: 'savings' | 'independence') => {
    if (tab === 'independence') {
      router.push('/wealth-goals?tab=independence');
    } else {
      router.push('/wealth-goals');
    }
  };

  const handleToggleRoundUp = async (goalId: number, multiplier: number = 1.0) => {
    const isCurrentlyTarget = String(activeRule?.targetGoalId) === String(goalId) && Boolean(activeRule?.isActive);
    const newActiveState = !isCurrentlyTarget;

    try {
      const res = await fetch('/api/round-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: newActiveState,
          targetGoalId: goalId,
          multiplier,
        }),
      });
      if (!res.ok) throw new Error('Failed to update round-up rule');

      await mutateRoundUp();
      toast.success(
        newActiveState
          ? `Auto-Save spare change enabled (${multiplier}x) for this goal!`
          : 'Auto-Save spare change disabled.'
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName || !newGoalTarget || parseFloat(newGoalTarget) <= 0) {
      toast.error('Please enter a goal name and valid target amount');
      return;
    }

    setIsCreatingGoal(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGoalName,
          target_amount: parseFloat(newGoalTarget),
          deadline: newGoalDeadline || null,
          linked_account: newGoalAccount || '',
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to create goal');
      }

      toast.success(`Savings goal "${newGoalName}" created!`);
      setIsNewGoalModalOpen(false);
      setNewGoalName('');
      setNewGoalTarget('');
      setNewGoalDeadline('');
      setNewGoalAccount('');
      await mutateGoals();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreatingGoal(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeGoal) return;
    const amt = parseFloat(contributionAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid contribution amount');
      return;
    }

    setIsContributing(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: contributeGoal.id,
          contribution: amt,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to record contribution');
      }

      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      toast.success(`Contributed ${fmt(amt)} to ${contributeGoal.name}!`);

      setContributeGoal(null);
      setContributionAmount('');
      setContributeAccountId('');
      await mutateGoals();
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/accounts'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsContributing(false);
    }
  };

  const handleUpdateDrawerGoal = async () => {
    if (!selectedGoalForDrawer) return;
    const targetAmt = parseFloat(drawerTarget);
    if (isNaN(targetAmt) || targetAmt <= 0) {
      toast.error('Valid target amount is required');
      return;
    }

    setIsUpdatingDrawer(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedGoalForDrawer.id,
          target_amount: targetAmt,
          deadline: drawerDeadline || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update goal');

      toast.success('Goal updated successfully');
      setSelectedGoalForDrawer(null);
      await mutateGoals();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUpdatingDrawer(false);
    }
  };

  const handleDeleteGoal = async (id: number) => {
    if (!confirm('Are you sure you want to delete this goal permanently?')) return;
    try {
      const res = await fetch('/api/goals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete goal');

      toast.success('Goal deleted');
      setSelectedGoalForDrawer(null);
      await mutateGoals();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-24">
      <Toaster position="top-center" richColors />

      {/* Header and 2-View Segmented Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">
            Wealth & Goals Engine
          </p>
          <h1 className="text-2xl sm:text-4xl font-black text-gray-950 dark:text-white tracking-tight">
            Financial Freedom Studio
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-xl">
            Autonomous wealth accumulation, zero-friction spare change savings, and institutional FIRE forecasting.
          </p>
        </div>

        {/* View Switcher: Savings vs FIRE */}
        <div className="flex items-center gap-3">
          <div className="inline-flex p-1 rounded-2xl bg-gray-100 dark:bg-black/30 border border-gray-200/80 dark:border-white/10 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => handleTabChange('savings')}
              className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeTab === 'savings' ? 'text-emerald-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-gray-200'
              }`}
            >
              {activeTab === 'savings' && (
                <motion.div
                  layoutId="activeWealthTab"
                  className="absolute inset-0 rounded-xl bg-white dark:bg-white/10 border border-gray-200/80 dark:border-emerald-500/40 shadow-sm"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">savings</span>
                Savings & Targets
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('independence')}
              className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeTab === 'independence' ? 'text-sky-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-gray-200'
              }`}
            >
              {activeTab === 'independence' && (
                <motion.div
                  layoutId="activeWealthTab"
                  className="absolute inset-0 rounded-xl bg-white dark:bg-white/10 border border-gray-200/80 dark:border-sky-500/40 shadow-sm"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                Financial Independence (FIRE)
              </span>
            </button>
          </div>

          {activeTab === 'savings' && (
            <button
              type="button"
              onClick={() => setIsNewGoalModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              New Goal
            </button>
          )}
        </div>
      </div>

      {/* Top Executive Summary Bar (3 Metrics Only, tabular-nums) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Total Saved Across Goals */}
        <div className="glass-panel stat-gradient-emerald p-5 rounded-3xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 font-bold mb-2">
            <span>Total Saved Across Goals</span>
            <span className="material-symbols-outlined text-emerald-500 dark:text-emerald-400 text-[18px]">account_balance</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-gray-950 to-gray-600 dark:from-white dark:to-gray-400 tabular-nums tracking-tight">
            {fmt(totalSaved)}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400/90 mt-1.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">check_circle</span>
            Linked to liquid cash & reserve accounts
          </p>
        </div>

        {/* Metric 2: Monthly Auto-Contribution Rate */}
        <div className="glass-panel stat-gradient-blue p-5 rounded-3xl relative overflow-hidden group hover:border-sky-500/30 transition-all">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 font-bold mb-2">
            <span>Monthly Auto-Contribution Rate</span>
            <span className="material-symbols-outlined text-sky-500 dark:text-sky-400 text-[18px]">speed</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-gray-950 to-gray-600 dark:from-white dark:to-gray-400 tabular-nums tracking-tight">
            {fmt(monthlyRequiredPace)}
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1">/mo</span>
          </div>
          <p className="text-[11px] text-sky-600 dark:text-sky-400/90 mt-1.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
            Pacing across {activeGoals.length} active target{activeGoals.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Metric 3: Emergency Runway */}
        <div className="glass-panel stat-gradient-amber p-5 rounded-3xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 font-bold mb-2">
            <span>Emergency Runway</span>
            <span className="material-symbols-outlined text-amber-500 dark:text-amber-400 text-[18px]">shield</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-gray-950 to-gray-600 dark:from-white dark:to-gray-400 tabular-nums tracking-tight flex items-baseline gap-2">
            <span>{emergencyRunwayMonths}</span>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Months</span>
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400/90 mt-1.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">schedule</span>
            {emergencyRunwayMonths >= 6 ? 'Robust reserves (>6 months)' : 'Building to 6-month safety net'}
          </p>
        </div>
      </div>

      {/* VIEW 1: Savings & Targets */}
      {activeTab === 'savings' && (
        <div className="space-y-6">
          {goalsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-56 rounded-3xl bg-white/[0.02] border border-white/5 animate-pulse" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <div className="p-12 text-center rounded-3xl glass-panel space-y-4">
              <span className="material-symbols-outlined text-5xl text-gray-400 dark:text-gray-600">savings</span>
              <h3 className="text-lg font-bold text-gray-950 dark:text-white">No Savings Goals Configured Yet</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Create a targeted goal to accumulate wealth with automatic progress tracking and silent spare change round-ups.
              </p>
              <button
                type="button"
                onClick={() => setIsNewGoalModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white transition-all shadow-lg cursor-pointer"
              >
                Create Your First Goal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {goals.map((g) => {
                const targetAmt = Number(g.target_amount) || 1;
                const savedAmt = Number(g.saved_amount) || 0;
                const pct = Math.min(100, Math.round((savedAmt / targetAmt) * 100));
                const remaining = Math.max(0, targetAmt - savedAmt);
                const monthsLeft = monthsBetween(g.deadline);
                const reqMonthly = remaining / monthsLeft;
                const isRoundUpTarget =
                  String(activeRule?.targetGoalId) === String(g.id) && Boolean(activeRule?.isActive);
                const ruleMult = activeRule?.multiplier || 1.0;

                return (
                  <div
                    key={g.id}
                    className="p-6 rounded-3xl glass-panel relative overflow-hidden hover:border-emerald-500/40 transition-all shadow-xl flex flex-col justify-between group"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
                    <div>
                      {/* Card Header: Goal Name & Icon & Drawer trigger */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div
                          className="flex items-center gap-3 cursor-pointer flex-1"
                          onClick={() => setSelectedGoalForDrawer(g)}
                        >
                          <div className="size-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-xl">savings</span>
                          </div>
                          <div>
                            <h3 className="text-base font-black text-gray-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {g.name}
                            </h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {g.deadline ? `Target: ${g.deadline}` : 'Open-ended Target'}
                            </p>
                          </div>
                        </div>

                        {/* Quick Action: Details Drawer */}
                        <button
                          type="button"
                          onClick={() => setSelectedGoalForDrawer(g)}
                          title="Goal Details"
                          className="size-8 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                        </button>
                      </div>

                      {/* Progress Bar & Amounts */}
                      <div className="space-y-2 mb-5">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="font-mono font-black text-gray-950 dark:text-white text-sm tabular-nums">
                            {fmt(savedAmt)}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 font-bold tabular-nums">
                            of {fmt(targetAmt)} ({pct}%)
                          </span>
                        </div>

                        <div className="h-2 w-full bg-gray-200/80 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-gray-200/80 dark:border-white/5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className={`h-full rounded-full ${
                              pct >= 100
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : 'bg-gradient-to-r from-emerald-500 to-sky-400'
                            }`}
                          />
                        </div>

                        <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
                          <span>{pct >= 100 ? 'Goal Completed!' : `Still needed: ${fmt(remaining)}`}</span>
                          <span>{monthsLeft} mo. left ({fmt(reqMonthly)}/mo)</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section: Silent Round-Up Toggle + Contribute Button */}
                    <div className="space-y-3 pt-3 border-t border-gray-200/80 dark:border-white/5">
                      {/* Embedded Silent Round-Up Control */}
                      <div className="p-3 rounded-2xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleRoundUp(g.id, ruleMult)}
                            className={`size-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                              isRoundUpTarget
                                ? 'bg-emerald-500 text-slate-950'
                                : 'border border-gray-300 dark:border-white/20 text-transparent hover:border-emerald-500'
                            }`}
                            title={isRoundUpTarget ? 'Active Round-Up Target' : 'Enable Spare Change Auto-Save'}
                          >
                            <span className="material-symbols-outlined text-[14px] font-black">check</span>
                          </button>
                          <div>
                            <p className="text-[11px] font-black text-gray-900 dark:text-gray-200">
                              {isRoundUpTarget ? 'Auto-Save Active' : 'Auto-Save Spare Change'}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">
                              {isRoundUpTarget
                                ? `${ruleMult}x multiplier enabled`
                                : 'Silently saves on expenses'}
                            </p>
                          </div>
                        </div>

                        {/* Multiplier Pills when active */}
                        {isRoundUpTarget ? (
                          <div className="flex items-center gap-1 bg-gray-200/70 dark:bg-slate-800/80 p-0.5 rounded-lg border border-gray-300/60 dark:border-white/10">
                            {[1.0, 2.0, 5.0].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => handleToggleRoundUp(g.id, m)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                                  ruleMult === m
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white'
                                }`}
                              >
                                {m}x
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleRoundUp(g.id, 1.0)}
                            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            Enable
                          </button>
                        )}
                      </div>

                      {/* Single-line Monthly Round-Up Badge if active */}
                      {isRoundUpTarget && roundUpMonthlyStats.count > 0 && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400/90 font-mono font-bold flex items-center gap-1 justify-center">
                          <span className="material-symbols-outlined text-[12px]">trending_up</span>
                          +{fmt(roundUpMonthlyStats.totalSaved)} saved automatically from {roundUpMonthlyStats.count} round-ups this month
                        </p>
                      )}

                      {/* Primary Single Contribute Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setContributeGoal(g);
                          setContributionAmount('');
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Contribute Funds
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Financial Independence (FIRE) */}
      {activeTab === 'independence' && (
        <div className="space-y-8 animate-fade-in">
          {/* FIRE Executive Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl glass-panel relative overflow-hidden group hover:border-emerald-500/30 transition-all">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-bold block mb-1">Current Net Worth</span>
              <span className="text-2xl font-black text-gray-950 dark:text-white tabular-nums">{fmt(currentNetWorth)}</span>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Pre-populated from Balance Sheet</p>
            </div>

            <div className="p-5 rounded-3xl glass-panel relative overflow-hidden group hover:border-sky-500/30 transition-all">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/20 to-transparent" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-bold block mb-1">FI Number (25x Spend)</span>
              <span className="text-2xl font-black text-sky-600 dark:text-sky-400 tabular-nums">{fmt(fiNumber)}</span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">At {swrRate.toFixed(1)}% Safe Withdrawal Rate</p>
            </div>

            <div className="p-5 rounded-3xl glass-panel relative overflow-hidden group hover:border-amber-500/30 transition-all">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-bold block mb-1">FI Progress</span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{fiProgressPct}%</span>
              <div className="h-1.5 w-full bg-gray-200/80 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, fiProgressPct)}%` }}
                />
              </div>
            </div>

            <div className="p-5 rounded-3xl glass-panel relative overflow-hidden group hover:border-emerald-500/30 transition-all">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-bold block mb-1">Projected Freedom Year</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{projectedFreedomYear}</span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                {Math.max(0, projectedFreedomYear - new Date().getFullYear())} years to full independence
              </p>
            </div>
          </div>

          {/* Interactive FIRE Sliders (Only 2 Clean Sliders) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl glass-panel relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/20 to-transparent" />
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-300">
                  Target Safe Withdrawal Rate (SWR)
                </label>
                <span className="text-sm font-black font-mono text-sky-600 dark:text-sky-400">{swrRate.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="2.5"
                max="6.0"
                step="0.1"
                value={swrRate}
                onChange={(e) => setSwrRate(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                <span>2.5% (Very Conservative)</span>
                <span>4.0% (Trinity Rule)</span>
                <span>6.0% (Aggressive)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-300">
                  Expected Real Annual Return
                </label>
                <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {expectedReturn.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min="3.0"
                max="12.0"
                step="0.5"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                <span>3.0% (Bonds / Fixed)</span>
                <span>7.0% (Inflation-Adjusted Equities)</span>
                <span>12.0% (High Growth)</span>
              </div>
            </div>
          </div>

          {/* FIRE Compounding Trajectory Chart */}
          <div className="p-6 rounded-3xl glass-panel relative overflow-hidden space-y-4 shadow-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-gray-950 dark:text-white">Compounding Freedom Trajectory</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Compound capital growth vs. your FI target over the next 25 years.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span className="size-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  Portfolio Wealth
                </span>
                <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                  <span className="size-2.5 rounded-full bg-sky-500 dark:bg-sky-400" />
                  FI Number Target
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fireTimeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fireGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`)}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#12182B',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '1rem',
                      fontSize: '12px',
                      color: '#ffffff',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    }}
                    formatter={(val: any) => [fmt(Number(val)), 'Amount']}
                  />
                  <ReferenceLine y={fiNumber} stroke="#0ea5e9" strokeDasharray="4 4" />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#fireGrowthGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Over Detail Drawer for a Goal */}
      <AnimatePresence>
        {selectedGoalForDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedGoalForDrawer(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md h-full bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl border-l border-gray-200/80 dark:border-white/10 p-6 overflow-y-auto space-y-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-200/80 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">tune</span>
                  <h3 className="text-base font-black text-gray-950 dark:text-white">{selectedGoalForDrawer.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedGoalForDrawer(null)}
                  className="size-8 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Automatic Milestones Progress */}
              <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5 space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                  Automatic Milestone Progress
                </span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[25, 50, 75, 100].map((m) => {
                    const isReached =
                      ((selectedGoalForDrawer.saved_amount || 0) / (selectedGoalForDrawer.target_amount || 1)) * 100 >=
                      m;
                    return (
                      <div
                        key={m}
                        className={`p-2 rounded-xl border text-xs font-black transition-all ${
                          isReached
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                            : 'bg-white dark:bg-white/[0.01] border-gray-200/80 dark:border-white/5 text-gray-400'
                        }`}
                      >
                        <div>{m}%</div>
                        <span className="material-symbols-outlined text-[14px] mt-0.5">
                          {isReached ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Edit Target & Deadline */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-300 block mb-1">
                    Target Amount
                  </label>
                  <input
                    type="number"
                    value={drawerTarget}
                    onChange={(e) => setDrawerTarget(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-gray-950 dark:text-white font-mono font-bold text-sm outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-300 block mb-1">
                    Target Deadline
                  </label>
                  <input
                    type="date"
                    value={drawerDeadline}
                    onChange={(e) => setDrawerDeadline(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-gray-950 dark:text-white font-bold text-sm outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Auto-Save Spare Change Toggle */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">Auto-Save Spare Change</span>
                    <button
                      type="button"
                      onClick={() => handleToggleRoundUp(selectedGoalForDrawer.id, activeRule?.multiplier || 1.0)}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        String(activeRule?.targetGoalId) === String(selectedGoalForDrawer.id) && activeRule?.isActive
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-white dark:bg-white/10 text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20'
                      }`}
                    >
                      {String(activeRule?.targetGoalId) === String(selectedGoalForDrawer.id) && activeRule?.isActive
                        ? 'Active Target'
                        : 'Set as Active'}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400">
                    Automatically rounds up every expense and credits difference directly to this goal.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-gray-200/80 dark:border-white/10">
                <button
                  type="button"
                  onClick={handleUpdateDrawerGoal}
                  disabled={isUpdatingDrawer}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isUpdatingDrawer ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteGoal(selectedGoalForDrawer.id)}
                  className="w-full py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer"
                >
                  Delete Goal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: New Goal */}
      <AnimatePresence>
        {isNewGoalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewGoalModalOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md card-glass-elevated overflow-hidden border border-gray-200/80 dark:border-white/10 bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl z-10"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="flex items-center justify-between pb-3 border-b border-gray-200/80 dark:border-white/10 mb-4">
                <h3 className="text-lg font-black text-gray-950 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">add_task</span>
                  Create Savings Goal
                </h3>
                <button
                  type="button"
                  onClick={() => setIsNewGoalModalOpen(false)}
                  className="size-8 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-400 block mb-1">Goal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Emergency Reserve, Japan Vacation, Down Payment"
                    value={newGoalName}
                    onChange={(e) => setNewGoalName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-gray-950 dark:text-white text-xs font-bold outline-none focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-400 block mb-1">Target Amount</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 150000"
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-gray-950 dark:text-white text-xs font-mono font-bold outline-none focus:border-primary transition-all tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-400 block mb-1">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={newGoalDeadline}
                    onChange={(e) => setNewGoalDeadline(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-gray-950 dark:text-white text-xs font-bold outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewGoalModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingGoal}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white shadow-lg cursor-pointer transition-colors"
                  >
                    {isCreatingGoal ? 'Creating...' : 'Create Goal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Quick Contribute */}
      <AnimatePresence>
        {contributeGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setContributeGoal(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm card-glass-elevated overflow-hidden border border-gray-200/80 dark:border-white/10 bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl z-10"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="flex items-center justify-between pb-3 border-b border-gray-200/80 dark:border-white/10 mb-2">
                <h3 className="text-base font-black text-gray-950 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">payments</span>
                  Contribute to {contributeGoal.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setContributeGoal(null)}
                  className="size-8 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Current: {fmt(contributeGoal.saved_amount)} / {fmt(contributeGoal.target_amount)}
              </p>

              <form onSubmit={handleContribute} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-400 block mb-1">Contribution Amount</label>
                  <input
                    type="number"
                    required
                    min="1"
                    autoFocus
                    placeholder="e.g. 5000"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-gray-950 dark:text-white text-sm font-mono font-black outline-none focus:border-primary transition-all tabular-nums"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setContributeGoal(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isContributing}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white shadow-lg cursor-pointer transition-colors"
                  >
                    {isContributing ? 'Recording...' : 'Confirm'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WealthGoalsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading Wealth & Goals Engine...</div>}>
      <WealthGoalsContent />
    </Suspense>
  );
}
