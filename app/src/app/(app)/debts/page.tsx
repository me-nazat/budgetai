'use client';

/**
 * @fileoverview Minimalist Institutional Debt Payoff Command Center.
 *
 * Features:
 * - Unified Capital Workspace switcher (Balance Sheet | Investment Portfolio | Debt Payoff)
 * - Integrated Extra Monthly Payment slider in header (Avalanche vs. Snowball)
 * - Real-time acceleration metrics: Months Saved, Interest Saved, and Projected Debt Freedom
 * - Payoff order cards (#1 Priority, #2 Next, etc.) with Projected Payoff Month
 * - One-click "Record Payment" deducting directly from personal checking account
 * - Strict Purple Ban Compliant
 *
 * @module app/(app)/debts/page
 */

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useInvalidate } from '@/hooks/useInvalidate';
import { simulatePayoff, type DebtSimulationInput } from '@/services/debt.service';
import { CapitalNavSwitcher } from '@/components/CapitalNavSwitcher';
import { Toaster, toast } from 'sonner';

interface Debt {
  id: number;
  name: string;
  debtType: 'credit_card' | 'personal_loan' | 'student_loan' | 'bnpl' | 'other';
  balance: number;
  initialBalance: number;
  interestRateApr: number;
  minimumPayment: number;
  dueDayOfMonth: number | null;
  linkedRecurringTransactionId: number | null;
  createdAt?: string;
}

interface Account {
  id: number;
  name: string;
  type: string;
  currency: string;
  currentBalance: number;
  colorTag: string;
}

const DEBT_TYPE_ICONS: Record<string, string> = {
  credit_card: 'credit_card',
  personal_loan: 'account_balance',
  student_loan: 'school',
  bnpl: 'shopping_bag',
  other: 'receipt_long',
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DebtsPage() {
  const { fmt, symbol } = useCurrency();
  const { formatAmount } = usePrivacy();
  const { invalidate } = useInvalidate();

  // SWR Data Fetching
  const { data: debtsData, isLoading: debtsLoading, mutate: mutateDebts } = useSWR<{ debts: Debt[] }>(
    '/api/debts',
    fetcher
  );
  const { data: accountsData } = useSWR<{ accounts: Account[] }>('/api/accounts', fetcher);

  const debts = useMemo(() => debtsData?.debts || [], [debtsData?.debts]);
  const accounts = useMemo(() => accountsData?.accounts || [], [accountsData?.accounts]);

  // Payoff Strategy & Accelerator Slider State
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [extraPayment, setExtraPayment] = useState<number>(5000);

  // Modals
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentTargetDebt, setPaymentTargetDebt] = useState<Debt | null>(null);
  const [paymentSourceAccountId, setPaymentSourceAccountId] = useState<number | ''>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Form State for Add/Edit Debt
  const [formName, setFormName] = useState('');
  const [formDebtType, setFormDebtType] = useState<Debt['debtType']>('credit_card');
  const [formBalance, setFormBalance] = useState('');
  const [formInitialBalance, setFormInitialBalance] = useState('');
  const [formApr, setFormApr] = useState('');
  const [formMinPayment, setFormMinPayment] = useState('');
  const [formDueDay, setFormDueDay] = useState('');
  const [isSavingDebt, setIsSavingDebt] = useState(false);

  // Active debts (balance > 0)
  const activeDebts = useMemo(() => {
    return debts.filter((d) => (Number(d.balance) || 0) > 0);
  }, [debts]);

  const totalOutstanding = useMemo(() => {
    return activeDebts.reduce((sum, d) => sum + (Number(d.balance) || 0), 0);
  }, [activeDebts]);

  const totalMinPayment = useMemo(() => {
    return activeDebts.reduce((sum, d) => sum + (Number(d.minimumPayment) || 0), 0);
  }, [activeDebts]);

  // Simulation calculations
  const { baseline, accelerated } = useMemo(() => {
    if (activeDebts.length === 0) {
      return {
        baseline: simulatePayoff([], 'baseline', 0),
        accelerated: simulatePayoff([], strategy, extraPayment),
      };
    }
    const base = simulatePayoff(activeDebts, 'baseline', 0);
    const accel = simulatePayoff(activeDebts, strategy, extraPayment);
    return { baseline: base, accelerated: accel };
  }, [activeDebts, strategy, extraPayment]);

  // Priority sorted liabilities based on Strategy
  const sortedDebts = useMemo(() => {
    const list = [...activeDebts];
    if (strategy === 'avalanche') {
      return list.sort((a, b) => (b.interestRateApr || 0) - (a.interestRateApr || 0));
    }
    // Snowball: lowest balance first
    return list.sort((a, b) => (a.balance || 0) - (b.balance || 0));
  }, [activeDebts, strategy]);

  // Milestone mapping to get projected payoff dates per debt
  const payoffDateMap = useMemo(() => {
    const map = new Map<number, string>();
    if (accelerated.milestones) {
      accelerated.milestones.forEach((m) => {
        if (m.debtId !== undefined) {
          map.set(m.debtId, m.date);
        }
      });
    }
    return map;
  }, [accelerated]);

  // Open Record Payment Modal
  const handleOpenPayment = (debt: Debt) => {
    setPaymentTargetDebt(debt);
    setPaymentAmount(String(debt.minimumPayment || 500));
    const defaultAcc = accounts.find((a) => a.type === 'bank' || a.type === 'cash') || accounts[0];
    setPaymentSourceAccountId(defaultAcc ? defaultAcc.id : '');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setIsPaymentModalOpen(true);
  };

  // Submit Payment with Account Deduction
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetDebt) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Valid payment amount required');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await fetch(`/api/debts/${paymentTargetDebt.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          accountId: paymentSourceAccountId || undefined,
          paymentDate,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to record debt payment');
      }

      toast.success(
        `Recorded ${fmt(amt)} payment for ${paymentTargetDebt.name}! Funds deducted from personal account.`
      );
      setIsPaymentModalOpen(false);
      await mutateDebts();
      await invalidate('accounts');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Save/Create Debt
  const handleSaveDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formBalance || !formApr || !formMinPayment) {
      toast.error('Please complete all required fields');
      return;
    }

    setIsSavingDebt(true);
    try {
      const payload = {
        name: formName,
        debtType: formDebtType,
        balance: parseFloat(formBalance),
        initialBalance: formInitialBalance ? parseFloat(formInitialBalance) : parseFloat(formBalance),
        interestRateApr: parseFloat(formApr),
        minimumPayment: parseFloat(formMinPayment),
        dueDayOfMonth: formDueDay ? parseInt(formDueDay, 10) : null,
      };

      const url = editingDebt ? `/api/debts/${editingDebt.id}` : '/api/debts';
      const method = editingDebt ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save liability');
      }

      toast.success(editingDebt ? 'Liability updated!' : 'Liability logged!');
      setIsDebtModalOpen(false);
      await mutateDebts();
      await invalidate('accounts');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingDebt(false);
    }
  };

  const handleDeleteDebt = async (id: number) => {
    if (!confirm('Are you sure you want to delete this liability?')) return;
    try {
      const res = await fetch(`/api/debts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete liability');
      toast.success('Liability deleted');
      await mutateDebts();
      await invalidate('accounts');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-24">
      <Toaster position="top-center" richColors />

      {/* Unified Capital Workspace Navigation Switcher */}
      <CapitalNavSwitcher />

      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-400 mb-1">
            Institutional Debt Payoff Matrix
          </p>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Debt Freedom Command Center
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Mathematical debt elimination via Avalanche & Snowball acceleration algorithms.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingDebt(null);
            setFormName('');
            setFormBalance('');
            setFormInitialBalance('');
            setFormApr('');
            setFormMinPayment('');
            setFormDueDay('');
            setIsDebtModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs sm:text-sm font-black text-white shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition-all active:scale-95 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Add Liability
        </button>
      </div>

      {/* 3 Core KPIs Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Total Outstanding */}
        <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/5 relative overflow-hidden group hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold mb-2">
            <span>Total Outstanding Debt</span>
            <span className="material-symbols-outlined text-rose-400 text-[18px]">credit_score</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-400 tabular-nums tracking-tight">
            {formatAmount(totalOutstanding, fmt(totalOutstanding))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
            <span>{activeDebts.length} Active Liabilit{activeDebts.length === 1 ? 'y' : 'ies'}</span>
            <span>•</span>
            <span>Min. Monthly: {fmt(totalMinPayment)}</span>
          </p>
        </div>

        {/* KPI 2: Debt-Free Acceleration */}
        <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold mb-2">
            <span>Accelerated Debt Freedom</span>
            <span className="material-symbols-outlined text-emerald-400 text-[18px]">event_available</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums tracking-tight">
            {accelerated.debtFreeDate || 'Debt-Free!'}
          </div>
          <p className="text-[11px] text-emerald-400/80 mt-1.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">bolt</span>
            {accelerated.monthsSaved > 0
              ? `${accelerated.monthsSaved} months faster than minimums`
              : 'Minimum payments trajectory'}
          </p>
        </div>

        {/* KPI 3: Interest Saved */}
        <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/5 relative overflow-hidden group hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold mb-2">
            <span>Estimated Interest Saved</span>
            <span className="material-symbols-outlined text-sky-400 text-[18px]">savings</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-400 tabular-nums tracking-tight">
            +{fmt(accelerated.interestSaved || 0)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Through extra principal pre-payments
          </p>
        </div>
      </div>

      {/* Integrated Extra Payment & Strategy Accelerator Box (Minimalist Simulator) */}
      <div className="p-6 rounded-3xl bg-slate-900/70 backdrop-blur-xl border border-white/10 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">tune</span>
              Payoff Strategy Accelerator
            </h2>
            <p className="text-xs text-gray-400">
              Adjust your extra monthly contribution and payoff strategy to watch completion dates shrink in real time.
            </p>
          </div>

          {/* Strategy 2-Option Segmented Pill */}
          <div className="inline-flex p-1 rounded-xl bg-slate-800 border border-white/10 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStrategy('avalanche')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                strategy === 'avalanche'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Avalanche (Lowest Interest)
            </button>
            <button
              type="button"
              onClick={() => setStrategy('snowball')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                strategy === 'snowball'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Snowball (Fastest Wins)
            </button>
          </div>
        </div>

        {/* Clean Extra Payment Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-300 uppercase tracking-wider">
              Extra Monthly Payment Toward Principal
            </span>
            <span className="font-mono font-black text-base text-emerald-400 tabular-nums">
              +{fmt(extraPayment)}
              <span className="text-xs text-gray-400 font-normal">/mo</span>
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="50000"
            step="500"
            value={extraPayment}
            onChange={(e) => setExtraPayment(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />

          <div className="flex justify-between text-[10px] text-gray-400">
            <span>$0/mo (Minimums only)</span>
            <span>$10,000/mo</span>
            <span>$25,000/mo</span>
            <span>$50,000/mo</span>
          </div>
        </div>
      </div>

      {/* Zero-Friction Payoff Order Table & Liability Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-400">format_list_numbered</span>
            Priority Payoff Queue ({strategy === 'avalanche' ? 'Avalanche Order' : 'Snowball Order'})
          </h2>
          <span className="text-xs text-gray-400">{sortedDebts.length} Active Positions</span>
        </div>

        {debtsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : sortedDebts.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-white/5 space-y-3">
            <span className="material-symbols-outlined text-4xl text-emerald-400">verified</span>
            <p className="text-sm font-bold text-white">Zero Active Debts!</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              You are completely debt-free. All previous loans and cards have zero balances.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedDebts.map((d, index) => {
              const priorityNum = index + 1;
              const projectedMonth = payoffDateMap.get(d.id) || 'Analyzing...';
              const icon = DEBT_TYPE_ICONS[d.debtType] || 'receipt_long';

              return (
                <div
                  key={d.id}
                  className="p-5 rounded-2xl bg-slate-900/70 border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  {/* Left: Priority Badge, Icon, Name */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex flex-col items-center justify-center shrink-0">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          priorityNum === 1
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-slate-800 text-gray-400 border border-white/5'
                        }`}
                      >
                        #{priorityNum} {priorityNum === 1 ? 'Priority' : 'Next'}
                      </span>
                    </div>

                    <div className="size-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-white truncate">{d.name}</h3>
                      <p className="text-[11px] text-gray-400">
                        {d.interestRateApr}% APR • Min. {fmt(d.minimumPayment)}/mo
                      </p>
                    </div>
                  </div>

                  {/* Middle: Remaining Balance & Projected Payoff Month */}
                  <div className="flex items-center gap-6 justify-between md:justify-end">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                        Remaining Balance
                      </span>
                      <span className="text-base font-black font-mono text-rose-400 tabular-nums">
                        {formatAmount(d.balance, fmt(d.balance))}
                      </span>
                    </div>

                    <div className="text-left md:text-right">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                        Projected Freedom
                      </span>
                      <span className="text-sm font-black text-emerald-400 tabular-nums">
                        {projectedMonth}
                      </span>
                    </div>

                    {/* Right: Record Payment Button & Options */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenPayment(d)}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[16px]">payments</span>
                        Record Payment
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingDebt(d);
                          setFormName(d.name);
                          setFormDebtType(d.debtType);
                          setFormBalance(String(d.balance));
                          setFormInitialBalance(String(d.initialBalance || d.balance));
                          setFormApr(String(d.interestRateApr));
                          setFormMinPayment(String(d.minimumPayment));
                          setFormDueDay(d.dueDayOfMonth ? String(d.dueDayOfMonth) : '');
                          setIsDebtModalOpen(true);
                        }}
                        className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Edit Liability"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteDebt(d.id)}
                        className="p-2 rounded-xl hover:bg-rose-500/20 text-gray-500 hover:text-rose-400 transition-colors"
                        title="Delete Liability"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Record Payment with Account Deduction */}
      <AnimatePresence>
        {isPaymentModalOpen && paymentTargetDebt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPaymentModalOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-3xl p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-400">payments</span>
                  <h3 className="text-base font-black text-white">Record Debt Payment</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="size-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-xs flex justify-between items-center">
                <span className="text-gray-400">Target Liability:</span>
                <span className="font-bold text-white">
                  {paymentTargetDebt.name} (Balance: {fmt(paymentTargetDebt.balance)})
                </span>
              </div>

              <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Payment Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="1"
                    placeholder="e.g. 5000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white font-mono font-bold text-sm outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-emerald-400 block mb-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px]">account_balance</span>
                    Deduct From Checking / Bank Account
                  </label>
                  <select
                    value={paymentSourceAccountId}
                    onChange={(e) =>
                      setPaymentSourceAccountId(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white font-bold outline-none focus:border-emerald-500"
                  >
                    <option value="">Do not deduct from bank account</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({fmt(acc.currentBalance)}) • {acc.type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-bold outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPayment}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-black text-white shadow-lg"
                  >
                    {isSubmittingPayment ? 'Recording...' : 'Confirm Payment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Add/Edit Liability */}
      <AnimatePresence>
        {isDebtModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDebtModalOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-3xl p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-base font-black text-white">
                  {editingDebt ? 'Edit Liability' : 'Log New Liability'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsDebtModalOpen(false)}
                  className="size-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveDebt} className="space-y-4 text-xs">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Lender / Liability Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard Chartered Platinum, BRAC Bank Loan"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white font-bold outline-none focus:border-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                      Remaining Balance
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 50000"
                      value={formBalance}
                      onChange={(e) => setFormBalance(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-mono font-bold outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                      Annual APR %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="e.g. 18.5"
                      value={formApr}
                      onChange={(e) => setFormApr(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-mono font-bold outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                      Minimum Payment
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 2500"
                      value={formMinPayment}
                      onChange={(e) => setFormMinPayment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-mono font-bold outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                      Due Day (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="e.g. 15"
                      value={formDueDay}
                      onChange={(e) => setFormDueDay(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white font-bold outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDebtModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDebt}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-black text-white shadow-lg"
                  >
                    {isSavingDebt ? 'Saving...' : editingDebt ? 'Save Changes' : 'Create Liability'}
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
