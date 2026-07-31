'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import confetti from 'canvas-confetti';
import { useCurrency } from '@/hooks/useCurrency';
import { getCategoryIcon, getCategoryHex } from '@/lib/categoryUtils';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import dynamic from 'next/dynamic';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend, ArcElement } from 'chart.js';

const Bar = dynamic(() => import('react-chartjs-2').then(mod => mod.Bar), { ssr: false });
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ArcElement);

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

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

interface SettlementPlan {
  from: string;
  to: string;
  fromId: number;
  toId: number;
  amount: number;
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════ */

function HouseholdSkeleton() {
  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="h-5 w-56 rounded-full shimmer-skeleton" />
          <div className="h-3 w-72 max-w-full rounded-full shimmer-skeleton" />
        </div>
        <div className="hidden h-10 w-40 rounded-xl shimmer-skeleton sm:block" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-panel p-5 h-32" />
        ))}
      </div>
      <div className="mt-6 skeleton-panel h-[500px]" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function HouseholdPage() {
  const { fmtRaw } = useCurrency();
  const { categories: customCategories } = useCustomCategories();
  const { data, isLoading } = useSWR<{ households: Household[] }>('/api/households');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSetCapModal, setShowSetCapModal] = useState(false);
  const [selectedCapCategory, setSelectedCapCategory] = useState<string | null>(null);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'ledger' | 'analytics' | 'settlements' | 'caps'>('ledger');

  const households = data?.households || [];
  const hh = useMemo(() => {
    if (!households.length) return null;
    if (selectedHouseholdId) {
      const found = households.find(h => h.id === selectedHouseholdId);
      if (found) return found;
    }
    return households[0];
  }, [households, selectedHouseholdId]);

  if (isLoading) return <HouseholdSkeleton />;

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter pb-24">
      <Toaster position="top-center" richColors />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>family_restroom</span>
            Household Finance Command Center
          </h1>
          <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Shared budgeting, category caps & automated settlements for families & roommates</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-hover transition-all flex items-center gap-2 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Join
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-hover transition-all flex items-center gap-2 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create Household
          </button>
        </div>
      </div>

      {/* ── No Household State ── */}
      {households.length === 0 ? (
        <EmptyState onCreateClick={() => setShowCreateModal(true)} onJoinClick={() => setShowJoinModal(true)} />
      ) : (
        <>
          {/* ── Household Selector (if multiple) ── */}
          {households.length > 1 && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
              {households.map(h => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHouseholdId(h.id)}
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
                    hh?.id === h.id
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-gray-50 dark:bg-surface-dark text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-surface-hover'
                  }`}
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}

          {hh && (
            <>
              {/* ── Summary Cards ── */}
              <SummaryCards household={hh} fmt={fmtRaw} />

              {/* ── Members Strip ── */}
              <MembersStrip household={hh} />

              {/* ── Tabs Segmented Control ── */}
              <div className="flex gap-1 mt-6 mb-6 bg-gray-100 dark:bg-surface-dark rounded-xl p-1 border border-gray-200/50 dark:border-white/5">
                {(['ledger', 'analytics', 'settlements', 'caps'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all min-h-[44px] flex items-center justify-center gap-1.5 ${
                      activeTab === tab
                        ? 'bg-white dark:bg-surface-dark-2 text-primary shadow-sm border border-gray-200/50 dark:border-white/10'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {tab === 'ledger' ? 'receipt_long' : tab === 'analytics' ? 'bar_chart' : tab === 'settlements' ? 'account_balance' : 'pie_chart'}
                    </span>
                    <span className="capitalize">
                      {tab === 'settlements' ? 'Balances' : tab === 'caps' ? 'Category Caps' : tab}
                    </span>
                  </button>
                ))}
              </div>

              {/* ── Tab Content ── */}
              <AnimatePresence mode="wait">
                {activeTab === 'ledger' && (
                  <motion.div key="ledger" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <ExpenseLedger
                      household={hh}
                      fmt={fmtRaw}
                      customCategories={customCategories}
                      onAddClick={() => setShowAddExpense(true)}
                    />
                  </motion.div>
                )}
                {activeTab === 'analytics' && (
                  <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <SpendByMemberChart household={hh} fmt={fmtRaw} />
                  </motion.div>
                )}
                {activeTab === 'settlements' && (
                  <motion.div key="settlements" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <SettlementsPanel household={hh} fmt={fmtRaw} />
                  </motion.div>
                )}
                {activeTab === 'caps' && (
                  <motion.div key="caps" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <CategoryCapsPanel
                      household={hh}
                      fmt={fmtRaw}
                      customCategories={customCategories}
                      onAddCapClick={(category) => {
                        setSelectedCapCategory(category || null);
                        setShowSetCapModal(true);
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </>
      )}

      {/* ── Modals ── */}
      <CreateHouseholdModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
      <JoinHouseholdModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} />
      {hh && <AddExpenseModal isOpen={showAddExpense} onClose={() => setShowAddExpense(false)} household={hh} />}
      {hh && (
        <SetCapModal
          isOpen={showSetCapModal}
          onClose={() => {
            setShowSetCapModal(false);
            setSelectedCapCategory(null);
          }}
          household={hh}
          initialCategory={selectedCapCategory || undefined}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════ */

function EmptyState({ onCreateClick, onJoinClick }: { onCreateClick: () => void; onJoinClick: () => void }) {
  return (
    <div className="glass-panel p-8 lg:p-16 text-center">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>family_restroom</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Households Yet</h2>
      <p className="text-gray-500 dark:text-text-muted text-sm mb-8 max-w-md mx-auto">
        Create a shared space for your family, partner, or roommates to track expenses together with category spending caps and automatic settlement calculations.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={onCreateClick} className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 min-h-[44px]">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create Household
        </button>
        <button onClick={onJoinClick} className="px-6 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-surface-hover transition-all flex items-center justify-center gap-2 min-h-[44px]">
          <span className="material-symbols-outlined text-[18px]">link</span>
          Join with Code
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUMMARY CARDS
   ═══════════════════════════════════════════════════════════════ */

function SummaryCards({ household, fmt }: { household: Household; fmt: (n: number) => string }) {
  const totalExpenses = household.recentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const thisMonthExpenses = household.recentExpenses.filter(e => {
    const d = new Date(e.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="glass-panel p-4 lg:p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">group</span>
          </div>
          <span className="text-xs font-bold text-gray-500 dark:text-text-muted uppercase tracking-wider">Members</span>
        </div>
        <p className="text-2xl font-black text-gray-900 dark:text-white">{household.members.length}</p>
      </div>
      <div className="glass-panel p-4 lg:p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-accent-amber text-xl">calendar_month</span>
          </div>
          <span className="text-xs font-bold text-gray-500 dark:text-text-muted uppercase tracking-wider">This Month</span>
        </div>
        <p className="text-2xl font-black text-gray-900 dark:text-white">{fmt(thisMonthExpenses)}</p>
      </div>
      <div className="glass-panel p-4 lg:p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-accent-emerald/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-accent-emerald text-xl">receipt_long</span>
          </div>
          <span className="text-xs font-bold text-gray-500 dark:text-text-muted uppercase tracking-wider">Total Logged</span>
        </div>
        <p className="text-2xl font-black text-gray-900 dark:text-white">{fmt(totalExpenses)}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MEMBERS STRIP
   ═══════════════════════════════════════════════════════════════ */

function MembersStrip({ household }: { household: Household }) {
  const [copied, setCopied] = useState(false);

  const copyInviteCode = () => {
    navigator.clipboard.writeText(household.inviteCode);
    setCopied(true);
    toast.success('Invite code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">group</span>
          Members
        </h3>
        <button
          onClick={copyInviteCode}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5 min-h-[44px]"
        >
          <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
          {copied ? 'Copied!' : household.inviteCode}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {household.members.map(m => (
          <div key={m.userId} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-surface-dark border border-gray-200/50 dark:border-white/5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary to-cyan-600 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{m.name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{m.name}</span>
            {m.role === 'owner' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-accent-amber/10 text-accent-amber">Owner</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXPENSE LEDGER
   ═══════════════════════════════════════════════════════════════ */

function ExpenseLedger({
  household,
  fmt,
  customCategories,
  onAddClick,
}: {
  household: Household;
  fmt: (n: number) => string;
  customCategories: Array<{ name: string; icon: string; color: string }>;
  onAddClick: () => void;
}) {
  const expenses = household.recentExpenses;
  const memberMap = useMemo(() => new Map(household.members.map(m => [m.userId, m.name])), [household.members]);

  const deleteExpense = async (id: number) => {
    try {
      await fetch(`/api/households/expenses?id=${id}`, { method: 'DELETE' });
      await mutate('/api/households');
      toast.success('Expense deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Shared Expenses</h3>
        <button
          onClick={onAddClick}
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-hover transition-all flex items-center gap-2 min-h-[44px]"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Add Expense
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3 block">receipt_long</span>
          <p className="text-gray-400 text-sm">No shared expenses yet. Add one to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map(expense => {
            const paidByName = memberMap.get(expense.userId) || 'Unknown';
            const catIcon = getCategoryIcon(expense.category, customCategories);
            const catColor = getCategoryHex(expense.category, customCategories);

            return (
              <motion.div
                key={expense.id}
                layout
                className="glass-panel p-3 lg:p-4 flex items-center gap-3 group hover:-translate-y-0.5 transition-all relative overflow-hidden"
              >
                {/* Category Icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${catColor}15` }}>
                  <span className="material-symbols-outlined text-lg" style={{ color: catColor }}>{catIcon}</span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{expense.description}</p>
                  <p className="text-xs text-gray-500 dark:text-text-muted">
                    Paid by <span className="font-semibold">{paidByName}</span> · {expense.splitBetween === 'all' ? 'Split equally' : 'Custom split'}
                  </p>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-gray-900 dark:text-white">{fmt(expense.amount)}</p>
                  <p className="text-xs text-gray-400">{new Date(expense.createdAt).toLocaleDateString()}</p>
                </div>

                {/* Delete action */}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteExpense(expense.id); }}
                  className="ml-1 p-2.5 rounded-lg text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Delete expense"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SPEND BY MEMBER CHART
   ═══════════════════════════════════════════════════════════════ */

function SpendByMemberChart({ household, fmt }: { household: Household; fmt: (n: number) => string }) {
  const memberMap = useMemo(() => new Map(household.members.map(m => [m.userId, m.name])), [household.members]);

  const chartData = useMemo(() => {
    const spending = new Map<number, number>();
    household.recentExpenses.forEach(e => {
      spending.set(e.userId, (spending.get(e.userId) || 0) + e.amount);
    });

    const labels = Array.from(spending.keys()).map(id => memberMap.get(id) || 'Unknown');
    const data = Array.from(spending.values());
    const colors = ['#136dec', '#10b981', '#FFB800', '#FF2A5F', '#059669', '#06B6D4'];

    return {
      labels,
      datasets: [{
        label: 'Total Spending',
        data,
        backgroundColor: labels.map((_, i) => colors[i % colors.length]),
        borderRadius: 8,
        borderSkipped: false as const,
      }],
    };
  }, [household.recentExpenses, memberMap]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { raw: unknown }) => fmt(ctx.raw as number),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#8E8E93', font: { weight: 'bold' as const, size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: {
          color: '#8E8E93',
          callback: (v: string | number) => fmt(Number(v)),
        },
      },
    },
  };

  return (
    <div className="glass-panel p-4 lg:p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">bar_chart</span>
        Spending by Member
      </h3>
      <div className="h-[260px] sm:h-[320px]">
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SETTLEMENTS PANEL — Persists payments with confetti trigger
   ═══════════════════════════════════════════════════════════════ */

function SettlementsPanel({ household, fmt }: { household: Household; fmt: (n: number) => string }) {
  const memberMap = useMemo(() => new Map(household.members.map(m => [m.userId, m.name])), [household.members]);
  const [settling, setSettling] = useState<string | null>(null);

  const { balances, settlementPlan } = useMemo(() => {
    const paid = new Map<number, number>();
    const owed = new Map<number, number>();
    const memberIds = household.members.map(m => m.userId);

    memberIds.forEach(id => {
      paid.set(id, 0);
      owed.set(id, 0);
    });

    household.recentExpenses.forEach(expense => {
      paid.set(expense.userId, (paid.get(expense.userId) || 0) + expense.amount);

      let splitIds: number[];
      if (expense.splitBetween === 'all') {
        splitIds = memberIds;
      } else {
        try {
          splitIds = JSON.parse(expense.splitBetween);
        } catch {
          splitIds = memberIds;
        }
      }

      const perPerson = expense.amount / (splitIds.length || 1);
      splitIds.forEach(id => {
        owed.set(id, (owed.get(id) || 0) + perPerson);
      });
    });

    const balanceList = memberIds.map(id => ({
      userId: id,
      name: memberMap.get(id) || 'Unknown',
      paid: paid.get(id) || 0,
      owed: owed.get(id) || 0,
      balance: (paid.get(id) || 0) - (owed.get(id) || 0),
    }));

    const debtors = balanceList
      .filter(b => b.balance < -0.01)
      .map(b => ({ ...b }))
      .sort((a, b) => a.balance - b.balance);

    const creditors = balanceList
      .filter(b => b.balance > 0.01)
      .map(b => ({ ...b }))
      .sort((a, b) => b.balance - a.balance);

    const plans: SettlementPlan[] = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];

      const oweAmount = -debtor.balance;
      const creditAmount = creditor.balance;
      const transfer = Math.min(oweAmount, creditAmount);

      plans.push({
        from: debtor.name,
        to: creditor.name,
        fromId: debtor.userId,
        toId: creditor.userId,
        amount: transfer,
      });

      debtor.balance += transfer;
      creditor.balance -= transfer;

      if (Math.abs(debtor.balance) < 0.01) dIdx++;
      if (Math.abs(creditor.balance) < 0.01) cIdx++;
    }

    return { balances: balanceList, settlementPlan: plans };
  }, [household, memberMap]);

  const markAsPaid = async (plan: SettlementPlan) => {
    const key = `${plan.fromId}-${plan.toId}`;
    setSettling(key);
    try {
      const res = await fetch('/api/households/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: household.id,
          payeeId: plan.toId,
          amount: plan.amount,
        }),
      });

      if (!res.ok) throw new Error('Failed to record settlement');
      
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      toast.success(`Recorded payment of ${fmt(plan.amount)} from ${plan.from} to ${plan.to}! 🎉`);
      await mutate('/api/households');
    } catch {
      toast.error('Failed to mark as paid');
    } finally {
      setSettling(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Per-member balances */}
      <div className="glass-panel p-4 lg:p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">account_balance</span>
          Member Balances
        </h3>
        <div className="space-y-3">
          {balances.map(b => (
            <div key={b.userId} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-surface-dark border border-gray-200/50 dark:border-white/5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-cyan-600 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white">{b.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{b.name}</p>
                <p className="text-xs text-gray-500 dark:text-text-muted">
                  Paid {fmt(b.paid)} · Fair share {fmt(b.owed)}
                </p>
              </div>
              <div className={`text-sm font-black ${b.balance >= 0 ? 'text-accent-emerald' : 'text-accent-rose'}`}>
                {b.balance >= 0 ? '+' : ''}{fmt(Math.abs(b.balance))}
                <span className="block text-[10px] font-medium text-gray-400 text-right">{b.balance >= 0 ? 'owed to them' : 'owes'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settlement plan */}
      <div className="glass-panel p-4 lg:p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-accent-emerald">handshake</span>
          Automated Settlement Plan
        </h3>
        <p className="text-xs text-gray-500 dark:text-text-muted mb-4">Minimum debt-minimization transfers to settle all household balances</p>

        {settlementPlan.length === 0 ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-4xl text-accent-emerald mb-2 block">check_circle</span>
            <p className="text-sm text-gray-500">All balances are completely settled!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {settlementPlan.map((plan, i) => {
              const isPending = settling === `${plan.fromId}-${plan.toId}`;
              return (
                <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-accent-emerald/5 border border-accent-emerald/15">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-accent-rose/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-accent-rose">{plan.from.charAt(0)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{plan.from}</span>
                      <span className="material-symbols-outlined text-[16px] text-gray-400">arrow_forward</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{plan.to}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-base font-black text-accent-emerald">{fmt(plan.amount)}</span>
                    <button
                      onClick={() => markAsPaid(plan)}
                      disabled={isPending}
                      className="px-3.5 py-2 rounded-xl bg-accent-emerald text-white text-xs font-bold shadow-sm hover:bg-emerald-600 transition-all flex items-center gap-1.5 min-h-[44px] shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      {isPending ? 'Saving...' : 'Mark as Paid'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CATEGORY CAPS PANEL — Visual limits with thresholds
   ═══════════════════════════════════════════════════════════════ */

function CategoryCapsPanel({
  household,
  fmt,
  customCategories,
  onAddCapClick,
}: {
  household: Household;
  fmt: (n: number) => string;
  customCategories: Array<{ name: string; icon: string; color: string }>;
  onAddCapClick: (category?: string) => void;
}) {
  const { data } = useSWR<{ caps: HouseholdCategoryCap[] }>('/api/households/caps');
  const caps = data?.caps || [];

  const categorySpending = useMemo(() => {
    const map = new Map<string, number>();
    household.recentExpenses.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return map;
  }, [household.recentExpenses]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">pie_chart</span>
            Category Spending Caps
          </h3>
          <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">Enforce monthly category budgets across all household members</p>
        </div>
        <button
          onClick={() => onAddCapClick()}
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-hover transition-all flex items-center gap-2 min-h-[44px]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Cap
        </button>
      </div>

      {caps.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3 block">pie_chart</span>
          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1">No Category Caps Configured</h4>
          <p className="text-gray-400 text-xs mb-4 max-w-sm mx-auto">Set category limits to prevent household overspending on Groceries, Utilities, or Dining out.</p>
          <button
            onClick={() => onAddCapClick()}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-hover transition-all min-h-[44px]"
          >
            Configure First Cap
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {caps.map(cap => {
            const spent = categorySpending.get(cap.category) || 0;
            const pct = cap.capAmount > 0 ? Math.min(100, Math.round((spent / cap.capAmount) * 100)) : 0;
            const remaining = cap.capAmount - spent;
            const catIcon = getCategoryIcon(cap.category, customCategories);
            const catColor = getCategoryHex(cap.category, customCategories);

            let barColor = 'bg-accent-emerald';
            let badgeBg = 'bg-accent-emerald/10 text-accent-emerald';
            const isExceeded = spent > cap.capAmount;

            if (pct > 85 && !isExceeded) {
              barColor = 'bg-accent-amber';
              badgeBg = 'bg-accent-amber/10 text-accent-amber';
            } else if (isExceeded) {
              barColor = 'bg-accent-rose animate-pulse';
              badgeBg = 'bg-accent-rose/10 text-accent-rose font-bold';
            }

            return (
              <div
                key={cap.id}
                className={`glass-panel p-5 hover:-translate-y-0.5 transition-all relative overflow-hidden ${
                  isExceeded ? 'border-l-[4px] border-l-accent-rose' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${catColor}15` }}>
                      <span className="material-symbols-outlined text-lg" style={{ color: catColor }}>{catIcon}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">{cap.category}</h4>
                      <p className="text-xs text-gray-400">{pct}% utilized</p>
                    </div>
                  </div>

                  <button
                    onClick={() => onAddCapClick(cap.category)}
                    className="p-2 rounded-lg text-gray-400 hover:text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Edit Cap"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>

                {/* Amount Row */}
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xl font-black text-gray-900 dark:text-white tabular-nums">{fmt(spent)}</span>
                  <span className="text-xs font-semibold text-gray-400">Cap: {fmt(cap.capAmount)}</span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>

                {/* Remaining Badge */}
                <div className="flex items-center justify-between text-xs">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${badgeBg}`}>
                    {isExceeded ? `Over cap by ${fmt(spent - cap.capAmount)}` : `${fmt(remaining)} remaining`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SET CAP MODAL
   ═══════════════════════════════════════════════════════════════ */

function SetCapModal({
  isOpen,
  onClose,
  household,
  initialCategory,
}: {
  isOpen: boolean;
  onClose: () => void;
  household: Household;
  initialCategory?: string;
}) {
  const [category, setCategory] = useState(initialCategory || 'Groceries');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = ['Food', 'Groceries', 'Utilities', 'Rent', 'Transport', 'Entertainment', 'Shopping', 'Other'];

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/households/caps', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: household.id,
          category,
          capAmount: parseFloat(amount),
        }),
      });

      if (!res.ok) throw new Error('Failed to update cap');
      await mutate('/api/households/caps');
      toast.success(`Set ${category} cap to ${amount}!`);
      setAmount('');
      onClose();
    } catch {
      toast.error('Failed to set category cap');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:flex lg:items-center lg:justify-center" onClick={onClose}>
      <div
        className="fixed bottom-0 left-0 right-0 lg:static lg:w-full lg:max-w-md rounded-t-[2rem] lg:rounded-2xl bg-white dark:bg-surface-dark-2 p-6 shadow-2xl z-50 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-4 lg:hidden" />

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Configure Category Cap</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                    category === cat
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-surface-dark text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-hover'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Monthly Cap Amount</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 15000"
              min="1"
              step="1"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              style={{ fontSize: '16px' }}
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold transition-colors hover:bg-gray-50 dark:hover:bg-surface-hover min-h-[44px]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!category || !amount || loading}
              className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-hover transition-all disabled:opacity-50 min-h-[44px]"
            >
              {loading ? 'Saving...' : 'Save Cap'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CREATE HOUSEHOLD MODAL
   ═══════════════════════════════════════════════════════════════ */

function CreateHouseholdModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      await mutate('/api/households');
      toast.success('Household created!');
      setName('');
      onClose();
    } catch {
      toast.error('Failed to create household');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:flex lg:items-center lg:justify-center" onClick={onClose}>
      <div
        className="fixed bottom-0 left-0 right-0 lg:static lg:w-full lg:max-w-md rounded-t-[2rem] lg:rounded-2xl bg-white dark:bg-surface-dark-2 p-6 shadow-2xl z-50 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-4 lg:hidden" />

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Create Household</h2>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Household Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Smith Family, Apartment 4B"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            autoFocus
            maxLength={100}
            style={{ fontSize: '16px' }}
          />
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold transition-colors hover:bg-gray-50 dark:hover:bg-surface-hover min-h-[44px]">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || loading} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-hover transition-all disabled:opacity-50 min-h-[44px]">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   JOIN HOUSEHOLD MODAL
   ═══════════════════════════════════════════════════════════════ */

function JoinHouseholdModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/households/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      await mutate('/api/households');
      toast.success(`Joined "${data.householdName}"!`);
      setCode('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to join household');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:flex lg:items-center lg:justify-center" onClick={onClose}>
      <div
        className="fixed bottom-0 left-0 right-0 lg:static lg:w-full lg:max-w-md rounded-t-[2rem] lg:rounded-2xl bg-white dark:bg-surface-dark-2 p-6 shadow-2xl z-50 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-4 lg:hidden" />

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Join Household</h2>
        <p className="text-sm text-gray-500 dark:text-text-muted mb-4">Enter the invite code shared by the household owner.</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB12CD34"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            autoFocus
            maxLength={20}
            style={{ fontSize: '16px' }}
          />
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold transition-colors hover:bg-gray-50 dark:hover:bg-surface-hover min-h-[44px]">
              Cancel
            </button>
            <button type="submit" disabled={!code.trim() || loading} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-hover transition-all disabled:opacity-50 min-h-[44px]">
              {loading ? 'Joining...' : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD EXPENSE MODAL — Bottom sheet on mobile, centered on desktop
   ═══════════════════════════════════════════════════════════════ */

function AddExpenseModal({ isOpen, onClose, household }: { isOpen: boolean; onClose: () => void; household: Household }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [splitMode, setSplitMode] = useState<'all' | 'custom'>('all');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const categories = ['Food', 'Groceries', 'Utilities', 'Rent', 'Transport', 'Entertainment', 'Shopping', 'Other'];

  const toggleMember = (id: number) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;
    setLoading(true);
    try {
      const res = await fetch('/api/households/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: household.id,
          description: description.trim(),
          amount: parseFloat(amount),
          category,
          splitBetween: splitMode === 'all' ? 'all' : selectedMembers,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      await mutate('/api/households');
      toast.success('Expense added!');
      setDescription('');
      setAmount('');
      setCategory('Other');
      setSplitMode('all');
      setSelectedMembers([]);
      onClose();
    } catch {
      toast.error('Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:flex lg:items-center lg:justify-center" onClick={onClose}>
      <div
        className="fixed bottom-0 left-0 right-0 lg:static lg:w-full lg:max-w-lg rounded-t-[2rem] lg:rounded-2xl bg-white dark:bg-surface-dark-2 p-6 shadow-2xl z-50 max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-4 lg:hidden" />

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Shared Expense</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Groceries, Electricity bill"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              style={{ fontSize: '16px' }}
              autoFocus
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-surface-dark text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all min-h-[44px] ${
                    category === cat
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-surface-dark text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-hover'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Split */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Split Between</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSplitMode('all')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
                  splitMode === 'all' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-gray-50 dark:bg-surface-dark text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10'
                }`}
              >
                Everyone
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('custom')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
                  splitMode === 'custom' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-gray-50 dark:bg-surface-dark text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10'
                }`}
              >
                Select Members
              </button>
            </div>

            {splitMode === 'custom' && (
              <div className="space-y-2">
                {household.members.map(m => (
                  <label key={m.userId} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-surface-dark border border-gray-200/50 dark:border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(m.userId)}
                      onChange={() => toggleMember(m.userId)}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary/30"
                    />
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary to-cyan-600 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{m.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{m.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold transition-colors hover:bg-gray-50 dark:hover:bg-surface-hover min-h-[44px]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!description.trim() || !amount || loading || (splitMode === 'custom' && selectedMembers.length === 0)}
              className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-hover transition-all disabled:opacity-50 min-h-[44px]"
            >
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
