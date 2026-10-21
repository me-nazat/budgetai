'use client';

/**
 * @fileoverview Module 10: Advanced Multi-Member Household Budgeting & Automated Split Settlements Workspace.
 * Deep-linked command center at /household/[id] offering:
 * - Top Executive Header & 4 KPI Cards (Monthly Shared Spend, My Household Share, Paid Out of Pocket, Net Settlement Position)
 * - "Log Shared Expense" Modal with Personal Account Deduction & Live Ledger Preview Pill
 * - Tab 1: Allocations (HouseholdAllocationWheel with 3 split strategies: Equal, Income-Proportional, Manual Sliders)
 * - Tab 2: Recurring Bills (HouseholdRecurringBillsModal with "Pay & Split Now" button)
 * - Tab 3: Settlements (HouseholdSettlementsCardStack with minimal debt flow & account settlement)
 * - Tab 4: Category Caps & Rules (Category caps progress bars <80% green, 80-99% amber, >=100% rose)
 *
 * @module app/(app)/household/[id]/page
 */

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR, { mutate as globalMutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'sonner';
import confetti from 'canvas-confetti';
import { useCurrency } from '@/hooks/useCurrency';
import { useAccounts } from '@/hooks/useApi';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { getCategoryIcon, getCategoryHex } from '@/lib/categoryUtils';
import { TiltCard } from '@/components/ui/TiltCard';
import CollaborativeNavSwitcher from '@/components/CollaborativeNavSwitcher';
import { HouseholdAllocationWheel } from '@/components/household/HouseholdAllocationWheel';
import { HouseholdRecurringBillsModal } from '@/components/household/HouseholdRecurringBillsModal';
import { HouseholdSettlementsCardStack } from '@/components/household/HouseholdSettlementsCardStack';

interface HouseholdMember {
  userId: number;
  role: 'owner' | 'member';
  joinedAt: string;
  name: string;
  email: string;
}

interface HouseholdExpense {
  id: number;
  householdId: number;
  userId: number;
  description: string;
  amount: number;
  category: string;
  splitBetween: string;
  createdAt: string;
}

interface HouseholdCategoryCap {
  id: number;
  householdId: number;
  category: string;
  capAmount: number;
  allocatedByUserId: number;
  createdAt?: string;
}

interface Household {
  id: number;
  name: string;
  inviteCode: string;
  role: 'owner' | 'member';
  createdAt: string;
  members: HouseholdMember[];
  recentExpenses: HouseholdExpense[];
}

interface Balance {
  userId: number;
  userName: string;
  netBalance: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function HouseholdWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { symbol = '$', fmtRaw } = useCurrency();
  const { accounts = [] } = useAccounts();
  const { categories: customCategories } = useCustomCategories('expense');
  const idStr = Array.isArray(params.id) ? params.id[0] : params.id;
  const householdId = parseInt(idStr || '0', 10);

  const [activeTab, setActiveTab] = useState<'allocations' | 'bills' | 'settlements' | 'caps'>('allocations');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Expense modal states
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Groceries');
  const [expensePaidBy, setExpensePaidBy] = useState<number | null>(null);
  const [expenseAccountId, setExpenseAccountId] = useState<number | null>(null);
  const [expenseSplitMode, setExpenseSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<number, number>>({});
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Cap configuration modal state
  const [showCapModal, setShowCapModal] = useState(false);
  const [capCategory, setCapCategory] = useState('Groceries');
  const [capAmount, setCapAmount] = useState('');
  const [isSubmittingCap, setIsSubmittingCap] = useState(false);

  const fmt = (n: number) => {
    if (fmtRaw) return fmtRaw(n);
    return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const { data: authData } = useSWR<{ user?: { id: number; name: string } }>('/api/auth/me', fetcher);
  const currentUserId = authData?.user?.id;

  const { data: hhData, isLoading: isHhLoading, mutate: mutateHh } = useSWR<{ households: Household[] }>(
    '/api/households',
    fetcher
  );

  const { data: settlementsData, mutate: mutateSettlements } = useSWR<{
    balances: Balance[];
  }>(householdId ? `/api/households/${householdId}/settlements/preview` : null, fetcher);

  const { data: capsData, mutate: mutateCaps } = useSWR<{ caps: HouseholdCategoryCap[] }>(
    householdId ? `/api/households/caps?householdId=${householdId}` : null,
    fetcher
  );

  const currentHousehold = useMemo(() => {
    return hhData?.households?.find((h) => h.id === householdId);
  }, [hhData?.households, householdId]);

  const members = useMemo(() => currentHousehold?.members || [], [currentHousehold?.members]);
  const expenses = useMemo(() => currentHousehold?.recentExpenses || [], [currentHousehold?.recentExpenses]);
  const caps = useMemo(() => capsData?.caps || [], [capsData?.caps]);
  const balances = useMemo(() => settlementsData?.balances || [], [settlementsData?.balances]);

  // Executive Metrics
  const totalMonthlySpend = useMemo(() => {
    return expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const myPaid = useMemo(() => {
    if (!currentUserId) return 0;
    return expenses
      .filter((e) => e.userId === currentUserId)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses, currentUserId]);

  const currentUserBalanceObj = useMemo(() => {
    return balances.find((b) => b.userId === currentUserId);
  }, [balances, currentUserId]);

  const netBalance = currentUserBalanceObj?.netBalance ?? 0;
  const myHouseholdShare = Math.max(0, myPaid - netBalance);

  // Category spending aggregation
  const categorySpending = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      map.set(e.category, (map.get(e.category) || 0) + Number(e.amount || 0));
    });
    return map;
  }, [expenses]);

  // Handle open expense modal
  const handleOpenExpenseModal = () => {
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseCategory(customCategories?.[0]?.name || 'Groceries');
    setExpensePaidBy(currentUserId || (members[0]?.userId ?? null));
    setExpenseAccountId(accounts.length > 0 ? accounts[0].id : null);
    setExpenseSplitMode('equal');

    const defaultCustom: Record<number, number> = {};
    const equalShare = members.length > 0 ? 100 / members.length : 100;
    members.forEach((m) => {
      defaultCustom[m.userId] = parseFloat(equalShare.toFixed(1));
    });
    setCustomSplits(defaultCustom);

    setShowAddExpenseModal(true);
  };

  // Submit expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseAmount);
    if (!expenseDescription.trim() || isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid description and amount greater than 0');
      return;
    }

    setIsSubmittingExpense(true);
    try {
      const res = await fetch('/api/households/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId,
          amount: amountNum,
          description: expenseDescription.trim(),
          category: expenseCategory,
          paidByUserId: expensePaidBy,
          fundingAccountId: expenseAccountId,
          splitMode: expenseSplitMode,
          customRatios: expenseSplitMode === 'custom' ? customSplits : undefined,
          date: new Date().toISOString().split('T')[0],
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || result.error || 'Failed to save household expense');
      }

      toast.success(
        result.data?.capWarning
          ? `Expense logged! (Warning: ${result.data.capDetails?.category} cap exceeded)`
          : 'Household expense logged & synced to ledger!'
      );
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });

      setShowAddExpenseModal(false);
      void mutateHh();
      void mutateSettlements();
      void mutateCaps();
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/accounts'));
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
    } catch (err: any) {
      toast.error(err.message || 'Error recording expense');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Save Cap
  const handleSaveCap = async (e: React.FormEvent) => {
    e.preventDefault();
    const capNum = parseFloat(capAmount);
    if (isNaN(capNum) || capNum < 0) {
      toast.error('Please enter a valid cap amount');
      return;
    }

    setIsSubmittingCap(true);
    try {
      const res = await fetch('/api/households/caps', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId,
          category: capCategory,
          capAmount: capNum,
        }),
      });

      if (!res.ok) throw new Error('Failed to update category spending cap');

      toast.success(`Cap for ${capCategory} set to ${fmt(capNum)}`);
      setShowCapModal(false);
      void mutateCaps();
    } catch (err: any) {
      toast.error(err.message || 'Error updating cap');
    } finally {
      setIsSubmittingCap(false);
    }
  };

  if (isHhLoading) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!currentHousehold) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <span className="material-symbols-outlined text-rose-400 text-5xl mb-3">family_restroom</span>
        <h2 className="text-2xl font-black text-content-primary">Household Not Found</h2>
        <p className="text-sm text-content-muted mt-1">You may not be a member of this household, or it has been removed.</p>
        <Link
          href="/household"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Return to Households
        </Link>
      </div>
    );
  }

  const parsedAmount = parseFloat(expenseAmount) || 0;
  const payerIsMe = (expensePaidBy ?? currentUserId) === currentUserId;
  const myRatio =
    expenseSplitMode === 'equal'
      ? members.length > 0
        ? 1 / members.length
        : 1
      : ((customSplits[currentUserId || 0] || 0) / 100);
  const calculatedMyShare = parsedAmount * myRatio;
  const calculatedOthersShare = parsedAmount - calculatedMyShare;
  const selectedAccountName = accounts.find((a) => a.id === expenseAccountId)?.name;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 pb-24">
      <Toaster position="top-center" richColors />

      {/* Unified Collaborative Navigation Switcher */}
      <CollaborativeNavSwitcher />

      {/* Top Breadcrumb & Executive Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-content-muted mb-1.5">
            <Link href="/household" className="hover:text-content-primary transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              Households
            </Link>
            <span>/</span>
            <span className="text-emerald-400 font-bold">{currentHousehold.name}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-content-primary tracking-tight">
              {currentHousehold.name}
            </h1>

            {/* Invite code badge with copy button */}
            {currentHousehold.inviteCode && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentHousehold.inviteCode);
                  setCopiedInvite(true);
                  setTimeout(() => setCopiedInvite(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-mono font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                title="Copy household invite code"
              >
                <span className="material-symbols-outlined text-[13px]">key</span>
                <span>{currentHousehold.inviteCode}</span>
                <span className="material-symbols-outlined text-[13px]">{copiedInvite ? 'check' : 'content_copy'}</span>
              </button>
            )}

            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 px-2.5 py-1 text-xs font-bold text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined text-[14px]">group</span>
              {members.length} member{members.length === 1 ? '' : 's'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
            Automated expense splitting, visual category spending caps & minimal debt cash-flow settlements
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            type="button"
            onClick={handleOpenExpenseModal}
            className="min-h-[44px] px-5 py-2.5 text-xs font-bold rounded-2xl bg-primary hover:bg-primary-hover text-white transition-all flex items-center gap-2 shadow-md shadow-primary/25"
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            Log Shared Expense
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Monthly Shared Spend */}
        <TiltCard className="glass-panel stat-gradient-blue rounded-3xl relative overflow-hidden group breathe p-4 lg:p-5">
          <div className="flex flex-col gap-1 relative z-10">
            <div className="flex items-center justify-between">
              <p className="whitespace-nowrap text-content-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
                Monthly Shared Spend
              </p>
              <span className="text-[10px] font-bold text-sky-400 font-mono">
                {expenses.length} expense{expenses.length === 1 ? '' : 's'}
              </span>
            </div>
            <h3 className="truncate whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight tabular-nums">
              {fmt(totalMonthlySpend)}
            </h3>
            <p className="text-[10px] text-content-muted font-medium">Collective household outflow</p>
          </div>
        </TiltCard>

        {/* Card 2: My Household Share */}
        <TiltCard className="glass-panel stat-gradient-orange rounded-3xl relative overflow-hidden group breathe p-4 lg:p-5">
          <div className="flex flex-col gap-1 relative z-10">
            <div className="flex items-center justify-between">
              <p className="whitespace-nowrap text-content-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
                My Household Share
              </p>
              <span className="text-[10px] font-bold text-amber-400 font-mono">
                {totalMonthlySpend > 0 ? Math.round((myHouseholdShare / totalMonthlySpend) * 100) : 0}% of total
              </span>
            </div>
            <h3 className="truncate whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight tabular-nums">
              {fmt(myHouseholdShare)}
            </h3>
            <p className="text-[10px] text-content-muted font-medium">Your personal budget liability</p>
          </div>
        </TiltCard>

        {/* Card 3: Paid Out of Pocket */}
        <TiltCard className="glass-panel stat-gradient-blue rounded-3xl relative overflow-hidden group breathe p-4 lg:p-5">
          <div className="flex flex-col gap-1 relative z-10">
            <div className="flex items-center justify-between">
              <p className="whitespace-nowrap text-content-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
                Paid Out of Pocket
              </p>
              <span className="text-[10px] font-bold text-sky-400 font-mono">You paid</span>
            </div>
            <h3 className="truncate whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight tabular-nums">
              {fmt(myPaid)}
            </h3>
            <p className="text-[10px] text-content-muted font-medium">From your bank & cash accounts</p>
          </div>
        </TiltCard>

        {/* Card 4: Net Settlement Position */}
        <TiltCard
          className={`glass-panel ${
            netBalance > 0 ? 'stat-gradient-emerald' : netBalance < 0 ? 'stat-gradient-rose' : 'stat-gradient-blue'
          } rounded-3xl relative overflow-hidden group breathe p-4 lg:p-5`}
        >
          <div className="flex flex-col gap-1 relative z-10">
            <div className="flex items-center justify-between">
              <p className="whitespace-nowrap text-content-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
                Net Settlement Position
              </p>
              <span
                className={`h-2 w-2 rounded-full ${
                  netBalance > 0 ? 'bg-emerald-400' : netBalance < 0 ? 'bg-rose-400' : 'bg-gray-400'
                }`}
              />
            </div>
            <h3
              className={`truncate whitespace-nowrap text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight tabular-nums ${
                netBalance > 0 ? 'text-emerald-400' : netBalance < 0 ? 'text-rose-400' : 'text-content-primary'
              }`}
            >
              {netBalance > 0 ? '+' : netBalance < 0 ? '-' : ''}
              {fmt(Math.abs(netBalance))}
            </h3>
            <p className="text-[10px] text-content-muted font-medium">
              {netBalance > 0
                ? 'House members owe you back'
                : netBalance < 0
                ? 'You owe house members'
                : 'All accounts balanced'}
            </p>
          </div>
        </TiltCard>
      </div>

      {/* 4 Premium Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl card-glass border border-gray-200/80 dark:border-white/10 max-w-xl overflow-x-auto hide-scrollbar">
        {(
          [
            { id: 'allocations', label: 'Allocations', icon: 'pie_chart' },
            { id: 'bills', label: 'Recurring Bills', icon: 'autorenew' },
            { id: 'settlements', label: 'Settlements', icon: 'handshake' },
            { id: 'caps', label: 'Category Caps', icon: 'shield' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-md shadow-primary/25'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab View */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="space-y-6"
        >
          {activeTab === 'allocations' && (
            <HouseholdAllocationWheel householdId={householdId} currencySymbol={symbol} />
          )}

          {activeTab === 'bills' && (
            <HouseholdRecurringBillsModal householdId={householdId} currencySymbol={symbol} />
          )}

          {activeTab === 'settlements' && (
            <HouseholdSettlementsCardStack
              householdId={householdId}
              currencySymbol={symbol}
              currentUserId={currentUserId}
            />
          )}

          {activeTab === 'caps' && (
            <div className="space-y-6">
              {/* Category Caps Header */}
              <div className="p-5 rounded-2xl card-glass border border-gray-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Category Spending Caps & Split Overrides</h3>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      {caps.length} configured
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                    Live visual threshold bars: &lt;80% green, 80-99% amber, &ge;100% rose alert with auto-enforcement
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCapCategory(customCategories?.[0]?.name || 'Groceries');
                    setCapAmount('500');
                    setShowCapModal(true);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-primary/25"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Set Category Cap
                </button>
              </div>

              {/* Caps Grid */}
              {caps.length === 0 ? (
                <div className="glass-panel p-10 text-center rounded-3xl">
                  <span className="material-symbols-outlined text-5xl text-content-muted mb-3 block">shield</span>
                  <h4 className="text-base font-bold text-content-primary mb-1">No Category Caps Configured</h4>
                  <p className="text-content-muted text-xs mb-4 max-w-sm mx-auto">
                    Set spending limits for Groceries, Utilities, Rent, or Dining to prevent collective household overspend.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCapCategory('Groceries');
                      setCapAmount('500');
                      setShowCapModal(true);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition-colors"
                  >
                    Configure First Cap
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {caps.map((cap) => {
                    const spent = categorySpending.get(cap.category) || 0;
                    const pct = cap.capAmount > 0 ? Math.min(100, Math.round((spent / cap.capAmount) * 100)) : 0;
                    const remaining = cap.capAmount - spent;
                    const catIcon = getCategoryIcon(cap.category, customCategories);
                    const catColor = getCategoryHex(cap.category, customCategories);

                    let barColor = 'bg-emerald-500';
                    let badgeBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                    const isExceeded = spent >= cap.capAmount;

                    if (pct >= 80 && pct < 100 && !isExceeded) {
                      barColor = 'bg-amber-400';
                      badgeBg = 'bg-amber-400/10 text-amber-400 border-amber-400/20';
                    } else if (isExceeded) {
                      barColor = 'bg-rose-500 animate-pulse';
                      badgeBg = 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold';
                    }

                    return (
                      <div
                        key={cap.id}
                        className={`card-glass p-5 rounded-2xl relative overflow-hidden transition-all border ${
                          isExceeded ? 'border-rose-500/40' : 'border-gray-200/80 dark:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="size-10 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: `${catColor}15` }}
                            >
                              <span className="material-symbols-outlined text-lg" style={{ color: catColor }}>
                                {catIcon}
                              </span>
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-content-primary">{cap.category}</h4>
                              <p className="text-xs text-content-muted">{pct}% utilized</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setCapCategory(cap.category);
                              setCapAmount(String(cap.capAmount));
                              setShowCapModal(true);
                            }}
                            className="p-2 rounded-lg text-content-muted hover:text-content-primary transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Edit Cap"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="font-mono text-content-primary font-bold">
                              {fmt(spent)}{' '}
                              <span className="text-[10px] text-content-muted font-normal">/ {fmt(cap.capAmount)}</span>
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeBg}`}>
                              {remaining >= 0 ? `${fmt(remaining)} left` : `${fmt(Math.abs(remaining))} over`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Shared Expense Logging Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-lg rounded-3xl bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-gray-200/80 dark:border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
                  Log Shared Household Expense
                </h3>
                <p className="text-xs text-gray-400">Recorded with double-entry personal account sync</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Expense Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Costco Grocery Restock, High-Speed WiFi"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Total Bill Amount ({symbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2.5 text-sm font-mono font-bold text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Category</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    {customCategories.length > 0 ? (
                      customCategories.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Groceries">Groceries</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Rent">Rent</option>
                        <option value="Dining">Dining</option>
                        <option value="Home & Supplies">Home & Supplies</option>
                        <option value="Other">Other</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Paid By</label>
                  <select
                    value={expensePaidBy ?? ''}
                    onChange={(e) => setExpensePaidBy(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name || m.email} {m.userId === currentUserId ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Funding Account {payerIsMe ? '(Deduction)' : ''}
                  </label>
                  <select
                    value={expenseAccountId ?? ''}
                    onChange={(e) => setExpenseAccountId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">No bank deduction (cash/external)</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({fmt(a.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Split Mode Selector */}
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1.5">Split Allocation Strategy</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseSplitMode('equal')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      expenseSplitMode === 'equal'
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-slate-950 text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    Equal ({members.length} members)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseSplitMode('custom')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      expenseSplitMode === 'custom'
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-slate-950 text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    Custom % Ratios
                  </button>
                </div>
              </div>

              {/* Custom Split Inputs */}
              {expenseSplitMode === 'custom' && (
                <div className="space-y-2 p-3 rounded-xl bg-slate-950 border border-white/5">
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Member Share Percentages (Total must = 100%)
                  </p>
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-300 truncate font-medium">
                        {m.name || m.email} {m.userId === currentUserId ? '(You)' : ''}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={customSplits[m.userId] ?? 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setCustomSplits((prev) => ({ ...prev, [m.userId]: val }));
                          }}
                          className="w-16 rounded-lg bg-slate-900 border border-white/10 px-2 py-1 text-right text-xs font-mono font-bold text-white outline-none"
                        />
                        <span className="text-gray-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Live Double-Entry Accounting Preview Pill */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <span className="material-symbols-outlined text-[16px]">account_balance</span>
                  <span>Live Personal Ledger Accounting Preview</span>
                </div>
                {payerIsMe ? (
                  <p className="text-[11px] text-gray-300">
                    {expenseAccountId && selectedAccountName
                      ? `1. Outflow: ${fmt(parsedAmount)} will be deducted from your "${selectedAccountName}" account.`
                      : `1. Outflow: ${fmt(parsedAmount)} logged without direct bank balance debit.`}
                    <br />
                    2. Monthly Personal P&amp;L: only your personal share of{' '}
                    <span className="font-bold text-white font-mono">{fmt(calculatedMyShare)}</span> will count as personal
                    expense.
                    <br />
                    3. Settlement: the remaining{' '}
                    <span className="font-bold text-emerald-300 font-mono">{fmt(calculatedOthersShare)}</span> will be tracked
                    as receivables from roommates.
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-300">
                    Paid by roommate. Your personal budget will record an expense liability of{' '}
                    <span className="font-bold text-rose-300 font-mono">{fmt(calculatedMyShare)}</span> to be settled.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                >
                  {isSubmittingExpense ? 'Logging...' : 'Save & Sync Ledger'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Set Cap Modal */}
      {showCapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-sm rounded-3xl bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-200/80 dark:border-white/10 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">shield</span>
                Set Monthly Spending Cap
              </h3>
              <button
                type="button"
                onClick={() => setShowCapModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveCap} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Category</label>
                <select
                  value={capCategory}
                  onChange={(e) => setCapCategory(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                >
                  {customCategories.length > 0 ? (
                    customCategories.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Groceries">Groceries</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Rent">Rent</option>
                      <option value="Dining">Dining</option>
                      <option value="Home & Supplies">Home & Supplies</option>
                      <option value="Other">Other</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Monthly Limit ({symbol})</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="500"
                  value={capAmount}
                  onChange={(e) => setCapAmount(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-sm font-mono font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCapModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-white/10 text-xs font-bold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCap}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                >
                  {isSubmittingCap ? 'Saving...' : 'Save Cap'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
