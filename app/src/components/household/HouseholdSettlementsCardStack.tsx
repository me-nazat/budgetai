'use client';

/**
 * @fileoverview Feature 10.2: Household Settlements Card Stack & Workflow.
 * Renders minimal debt settlement plan, one-tap "Settle all", and interactive
 * cards for upcoming payments with personal bank account selection for double-entry settlement.
 *
 * @module components/household/HouseholdSettlementsCardStack
 */

import React, { useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAccounts } from '@/hooks/useApi';

interface Balance {
  userId: number;
  userName: string;
  netBalance: number;
}

interface PaymentPlan {
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  toUserName: string;
  amount: number;
}

interface UpcomingSettlement {
  id: string;
  householdId: number;
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  toUserName: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'confirmed' | 'paid' | 'cancelled';
  createdAt: number;
}

interface Props {
  householdId: number;
  currencySymbol?: string;
  currentUserId?: number;
}

export function HouseholdSettlementsCardStack({ householdId, currencySymbol = '$', currentUserId }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [activeSettlementModal, setActiveSettlementModal] = useState<UpcomingSettlement | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const { accounts } = useAccounts();

  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data, error, isLoading, mutate } = useSWR<{
    balances: Balance[];
    minSettlements: PaymentPlan[];
    upcomingSettlements: UpcomingSettlement[];
    graphMetrics?: {
      rawTransactionsCount: number;
      simplifiedTransfers: number;
      transfersSavedCount: number;
    };
  }>(`/api/households/${householdId}/settlements/preview`, fetcher);

  const balances = data?.balances || [];
  const minSettlements = data?.minSettlements || [];
  const upcoming = data?.upcomingSettlements || [];
  const graphMetrics = data?.graphMetrics;

  const handleSettleAll = async () => {
    if (minSettlements.length === 0) return toast.info('All household accounts are currently balanced!');
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/households/${householdId}/settlements/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error('Failed to generate upcoming settlements');
      toast.success('Generated minimal settlement payments & notified members');
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenConfirmModal = (item: UpcomingSettlement) => {
    setActiveSettlementModal(item);
    if (accounts && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    } else {
      setSelectedAccountId(null);
    }
  };

  const handleConfirmPayment = async () => {
    if (!activeSettlementModal) return;
    const settlementId = activeSettlementModal.id;
    setPayingId(settlementId);

    try {
      const res = await fetch(`/api/households/${householdId}/settlements/${settlementId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
        }),
      });

      if (!res.ok) throw new Error('Failed to confirm settlement');

      toast.success('Settlement confirmed and marked paid!');
      setActiveSettlementModal(null);
      mutate();
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/accounts'));
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPayingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debt Minimization Header */}
      <div className="p-5 rounded-2xl card-glass border border-gray-200/80 dark:border-white/10 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Debt Minimization & Settlements</h3>
            {graphMetrics && graphMetrics.transfersSavedCount > 0 && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                {graphMetrics.transfersSavedCount} transfers saved
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
            Hamilton penny distribution & cash-flow graph reduction minimizes total payments
          </p>
        </div>
        <button
          onClick={handleSettleAll}
          disabled={isGenerating || minSettlements.length === 0}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs transition-all flex items-center gap-2 shadow-md shadow-primary/25 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">currency_exchange</span>
          {isGenerating ? 'Scheduling...' : 'Settle All with Min Payments'}
        </button>
      </div>

      {/* Member Balances Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {balances.map((b) => {
          const isOwed = b.netBalance > 0.01;
          const owes = b.netBalance < -0.01;
          return (
            <div
              key={b.userId}
              className="p-4 rounded-xl bg-white/70 dark:bg-surface-elevated/80 border border-gray-200/80 dark:border-white/10 backdrop-blur-md flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">{b.userName}</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {isOwed ? 'Is owed' : owes ? 'Owes' : 'Settled up'}
                </span>
              </div>
              <div
                className={`text-sm font-black ${
                  isOwed ? 'text-emerald-500 dark:text-emerald-400' : owes ? 'text-rose-500 dark:text-rose-400' : 'text-gray-400'
                }`}
              >
                {b.netBalance >= 0 ? '+' : ''}
                {currencySymbol}
                {b.netBalance.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Suggested Minimal Settlement Plan */}
      {minSettlements.length > 0 && (
        <div className="p-5 rounded-2xl card-glass border border-gray-200/80 dark:border-white/10 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Recommended Minimal Transfers ({minSettlements.length})
            </h4>
            {graphMetrics && (
              <span className="text-[11px] font-mono text-gray-400">
                Reduced {graphMetrics.rawTransactionsCount} debts to {minSettlements.length} transfers
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {minSettlements.map((plan, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-white/60 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-bold text-gray-900 dark:text-white">{plan.fromUserName}</span>
                  <span className="material-symbols-outlined text-gray-400 text-[16px]">arrow_forward</span>
                  <span className="font-bold text-gray-900 dark:text-white">{plan.toUserName}</span>
                </div>
                <div className="text-sm font-black text-emerald-500 dark:text-emerald-400">
                  {currencySymbol}{plan.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Settlements Card Stack */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-content-muted px-1">
          Upcoming Scheduled Settlements ({upcoming.length})
        </h4>

        {upcoming.length === 0 ? (
          <div className="p-8 rounded-2xl card-glass border border-dashed border-gray-200/80 dark:border-white/10 text-center text-xs text-gray-500 dark:text-gray-400">
            No upcoming settlement cards. Click "Settle All with Min Payments" above to schedule.
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((item) => (
              <motion.div
                key={item.id}
                layout
                className={`p-4 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-4 ${
                  item.status === 'paid'
                    ? 'bg-gray-100/60 dark:bg-white/5 border-gray-200/60 dark:border-white/5 opacity-75'
                    : 'card-glass border-gray-200/80 dark:border-white/10 shadow-md'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-content-primary">
                      {item.fromUserName} pays {item.toUserName}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md uppercase font-bold tracking-wider ${
                        item.status === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-content-muted">Due: {item.dueDate}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-base font-black text-content-primary">
                    {currencySymbol}{item.amount.toFixed(2)}
                  </span>
                  {item.status !== 'paid' && (
                    <button
                      onClick={() => handleOpenConfirmModal(item)}
                      disabled={payingId === item.id}
                      className="min-w-[44px] min-h-[44px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      Mark Paid
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Settlement Confirmation Modal with Bank Account Selector */}
      <AnimatePresence>
        {activeSettlementModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveSettlementModal(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-50 w-full max-w-md rounded-3xl card-glass-elevated overflow-hidden border border-white/10 bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl p-6 shadow-2xl"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="flex items-center justify-between mb-4 border-b border-gray-200/80 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[24px] text-emerald-500 dark:text-emerald-400">payments</span>
                  <div>
                    <h3 className="text-base font-black text-gray-950 dark:text-white">Confirm Household Settlement</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Record settlement & update personal bank balance</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSettlementModal(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-black/20 border border-white/10 space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-bold">Transfer:</span>
                  <span className="text-gray-950 dark:text-white font-black">
                    {activeSettlementModal.fromUserName} → {activeSettlementModal.toUserName}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-bold">Settlement Amount:</span>
                  <span className="text-emerald-500 dark:text-emerald-400 font-mono font-black text-base">
                    {currencySymbol}{activeSettlementModal.amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Personal Bank Account Selector */}
              <div className="space-y-2 mb-5">
                <label className="text-xs font-black uppercase tracking-wider text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">account_balance</span>
                  Personal Bank Account
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Select your personal account to log a non-spending settlement transfer:
                </p>
                <select
                  value={selectedAccountId ?? ''}
                  onChange={(e) => setSelectedAccountId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 dark:bg-black/30 px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-primary transition-all"
                >
                  <option value="" className="bg-[#12182B] text-white">Do not sync to personal bank account</option>
                  {accounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id} className="bg-[#12182B] text-white">
                      {acc.name} ({currencySymbol}{acc.currentBalance ?? acc.balance ?? 0}) • {acc.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSettlementModal(null)}
                  className="flex-1 min-h-[44px] rounded-xl border border-white/10 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={payingId === activeSettlementModal.id}
                  className="flex-1 min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {payingId === activeSettlementModal.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      Confirm Paid
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
