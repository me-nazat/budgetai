'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
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
  const { fmt, fmtRaw } = useCurrency();
  const { customCategories } = useCustomCategories();
  const { data, isLoading, error } = useSWR<{ households: Household[] }>('/api/households');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [activeTab, setActiveTab] = useState<'ledger' | 'analytics' | 'settlements'>('ledger');

  // Auto-select first household
  useEffect(() => {
    if (data?.households?.length && !selectedHousehold) {
      setSelectedHousehold(data.households[0]);
    }
  }, [data, selectedHousehold]);

  // Re-sync selected household when data refreshes
  useEffect(() => {
    if (selectedHousehold && data?.households) {
      const updated = data.households.find(h => h.id === selectedHousehold.id);
      if (updated) setSelectedHousehold(updated);
    }
  }, [data, selectedHousehold?.id]);

  if (isLoading) return <HouseholdSkeleton />;

  const households = data?.households || [];
  const hh = selectedHousehold;

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
      <Toaster position="top-center" richColors />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>family_restroom</span>
            Household Finance
          </h1>
          <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Shared budgeting for families, couples & roommates</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-hover transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Join
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-hover transition-all flex items-center gap-2"
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
                  onClick={() => setSelectedHousehold(h)}
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    selectedHousehold?.id === h.id
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

              {/* ── Tabs ── */}
              <div className="flex gap-1 mt-6 mb-4 bg-gray-100 dark:bg-surface-dark rounded-xl p-1">
                {(['ledger', 'analytics', 'settlements'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all capitalize ${
                      activeTab === tab
                        ? 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab === 'settlements' ? 'Balances' : tab}
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
              </AnimatePresence>
            </>
          )}
        </>
      )}

      {/* ── Modals ── */}
      <CreateHouseholdModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
      <JoinHouseholdModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} />
      {hh && <AddExpenseModal isOpen={showAddExpense} onClose={() => setShowAddExpense(false)} household={hh} />}
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
        Create a shared space for your family, partner, or roommates to track expenses together with automatic settlement calculations.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={onCreateClick} className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create Household
        </button>
        <button onClick={onJoinClick} className="px-6 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-surface-hover transition-all flex items-center justify-center gap-2">
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
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
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
  customCategories: Array<{ name: string; type: string }>;
  onAddClick: () => void;
}) {
  const expenses = household.recentExpenses;
  const memberMap = useMemo(() => new Map(household.members.map(m => [m.userId, m.name])), [household.members]);

  const [swipedId, setSwipedId] = useState<number | null>(null);

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
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-hover transition-all flex items-center gap-2"
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
                className="glass-panel p-3 lg:p-4 flex items-center gap-3 group cursor-pointer hover:-translate-y-0.5 transition-all relative overflow-hidden"
                onClick={() => setSwipedId(swipedId === expense.id ? null : expense.id)}
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

                {/* Delete action (mobile swipe / desktop hover) */}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteExpense(expense.id); }}
                  className="ml-1 p-2 rounded-lg text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors opacity-0 group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
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
    const colors = ['#136dec', '#10b981', '#FFB800', '#FF2A5F', '#8B5CF6', '#06B6D4'];

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
   SETTLEMENTS PANEL — Reuses Tour Manager's debt-minimization algorithm
   ═══════════════════════════════════════════════════════════════ */

function SettlementsPanel({ household, fmt }: { household: Household; fmt: (n: number) => string }) {
  const memberMap = useMemo(() => new Map(household.members.map(m => [m.userId, m.name])), [household.members]);

  const { balances, settlementPlan } = useMemo(() => {
    // Calculate per-member balances
    const paid = new Map<number, number>();
    const owed = new Map<number, number>();
    const memberIds = household.members.map(m => m.userId);

    // Initialize
    memberIds.forEach(id => {
      paid.set(id, 0);
      owed.set(id, 0);
    });

    household.recentExpenses.forEach(expense => {
      // Add to payer's paid total
      paid.set(expense.userId, (paid.get(expense.userId) || 0) + expense.amount);

      // Determine who owes
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

      const perPerson = expense.amount / splitIds.length;
      splitIds.forEach(id => {
        owed.set(id, (owed.get(id) || 0) + perPerson);
      });
    });

    // Balance = paid - owed (positive = others owe you)
    const balanceList = memberIds.map(id => ({
      userId: id,
      name: memberMap.get(id) || 'Unknown',
      paid: paid.get(id) || 0,
      owed: owed.get(id) || 0,
      balance: (paid.get(id) || 0) - (owed.get(id) || 0),
    }));

    // Debt minimization algorithm (same as Tour Manager)
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
        amount: transfer,
      });

      debtor.balance += transfer;
      creditor.balance -= transfer;

      if (Math.abs(debtor.balance) < 0.01) dIdx++;
      if (Math.abs(creditor.balance) < 0.01) cIdx++;
    }

    return { balances: balanceList, settlementPlan: plans };
  }, [household, memberMap]);

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
                <span className="block text-[10px] font-medium text-gray-400">{b.balance >= 0 ? 'owed to them' : 'owes'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settlement plan */}
      <div className="glass-panel p-4 lg:p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-accent-emerald">handshake</span>
          Settlement Plan
        </h3>
        <p className="text-xs text-gray-500 dark:text-text-muted mb-4">Minimum transfers to settle all debts</p>

        {settlementPlan.length === 0 ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-4xl text-accent-emerald mb-2 block">check_circle</span>
            <p className="text-sm text-gray-500">All settled! No payments needed.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {settlementPlan.map((plan, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-accent-emerald/5 border border-accent-emerald/10">
                <div className="w-8 h-8 rounded-full bg-accent-rose/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-accent-rose">{plan.from.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{plan.from}</span>
                  <span className="material-symbols-outlined text-[16px] text-gray-400">arrow_forward</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{plan.to}</span>
                </div>
                <span className="text-sm font-black text-accent-emerald shrink-0">{fmt(plan.amount)}</span>
              </div>
            ))}
          </div>
        )}
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
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:flex lg:items-center lg:justify-center" onClick={onClose}>
        <div
          className="fixed bottom-0 left-0 right-0 lg:static lg:w-full lg:max-w-md rounded-t-[2rem] lg:rounded-2xl bg-white dark:bg-surface-dark-2 p-6 shadow-2xl z-50 max-h-[85vh] overflow-y-auto"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle (mobile) */}
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
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold transition-colors hover:bg-gray-50 dark:hover:bg-surface-hover">
                Cancel
              </button>
              <button type="submit" disabled={!name.trim() || loading} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-hover transition-all disabled:opacity-50">
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
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
    <>
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
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold transition-colors hover:bg-gray-50 dark:hover:bg-surface-hover">
                Cancel
              </button>
              <button type="submit" disabled={!code.trim() || loading} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-hover transition-all disabled:opacity-50">
                {loading ? 'Joining...' : 'Join'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
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
    <>
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
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
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
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    splitMode === 'all' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-gray-50 dark:bg-surface-dark text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10'
                  }`}
                >
                  Everyone
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('custom')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
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
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold transition-colors hover:bg-gray-50 dark:hover:bg-surface-hover">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!description.trim() || !amount || loading || (splitMode === 'custom' && selectedMembers.length === 0)}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-hover transition-all disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Expense'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
