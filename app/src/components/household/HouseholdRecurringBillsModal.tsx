'use client';

/**
 * @fileoverview Feature 10.2: Recurring Auto-Split Bills Modal & 3-Tab Split Editor.
 * Supports Equal, Percentage, and Fixed splits with live preview of each member's share
 * and one-click "Pay & Split Now" deducting from personal account and queuing settlements.
 *
 * @module components/household/HouseholdRecurringBillsModal
 */

import React, { useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAccounts } from '@/hooks/useApi';

interface Member {
  userId: number;
  role: string;
  userName: string | null;
  userEmail: string | null;
}

interface SharePreview {
  userId: number;
  name: string | null;
  shareAmount: number;
}

interface SplitRule {
  id: number;
  name: string;
  amount: number;
  category: string;
  splitType: 'equal' | 'percentage' | 'fixed';
  splitShares: string | null;
  frequency: 'monthly' | 'biweekly' | 'weekly';
  dayOfMonth: number;
  nextRunDate: string | null;
  sharesPreview?: SharePreview[];
}

interface Props {
  householdId: number;
  currencySymbol?: string;
}

export function HouseholdRecurringBillsModal({ householdId, currencySymbol = '$' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payingBill, setPayingBill] = useState<SplitRule | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isPayingNow, setIsPayingNow] = useState(false);

  const { accounts } = useAccounts();

  // New bill form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState('Bills & Utilities');
  const [frequency, setFrequency] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [splitType, setSplitType] = useState<'equal' | 'percentage' | 'fixed'>('equal');
  const [customShares, setCustomShares] = useState<Record<string, number>>({});

  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data, error, isLoading, mutate } = useSWR<{ rules: SplitRule[]; members: Member[] }>(
    `/api/households/${householdId}/bills`,
    fetcher
  );

  const members = data?.members || [];
  const rules = data?.rules || [];

  const handleShareChange = (userId: number, val: number) => {
    setCustomShares((prev) => ({ ...prev, [String(userId)]: val }));
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Bill name is required');
    if (!amount || amount <= 0) return toast.error('Valid bill amount is required');

    if (splitType === 'percentage') {
      const sum = Object.values(customShares).reduce((acc, v) => acc + (v || 0), 0);
      if (Math.abs(sum - 100) > 0.5) {
        return toast.error(`Percentage shares must sum to 100% (currently ${sum}%)`);
      }
    } else if (splitType === 'fixed') {
      const sum = Object.values(customShares).reduce((acc, v) => acc + (v || 0), 0);
      if (Math.abs(sum - amount) > 0.05) {
        return toast.error(`Fixed shares must sum to bill amount (${currencySymbol}${amount})`);
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/households/${householdId}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          amount: Number(amount),
          category,
          frequency,
          dayOfMonth,
          splitType,
          splitShares: splitType !== 'equal' ? customShares : undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to create bill');
      }

      toast.success('Recurring bill scheduled successfully');
      setName('');
      setAmount('');
      setSplitType('equal');
      setCustomShares({});
      setIsOpen(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this recurring bill?')) return;
    try {
      const res = await fetch(`/api/households/${householdId}/bills?ruleId=${ruleId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete rule');
      toast.success('Recurring bill removed');
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleOpenPayModal = (rule: SplitRule) => {
    setPayingBill(rule);
    if (accounts && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    } else {
      setSelectedAccountId(null);
    }
  };

  const handleExecutePayAndSplit = async () => {
    if (!payingBill) return;
    setIsPayingNow(true);

    try {
      const res = await fetch(`/api/households/${householdId}/bills/${payingBill.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
        }),
      });

      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) {
        throw new Error(d.error || 'Failed to process bill payment');
      }

      toast.success(
        `Paid ${currencySymbol}${payingBill.amount.toFixed(2)}! Your share: ${currencySymbol}${d.personalShare.toFixed(2)}. ${currencySymbol}${d.owedToUser.toFixed(2)} queued to settlement stack.`
      );

      setPayingBill(null);
      mutate();
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/accounts'));
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
      globalMutate((key) => typeof key === 'string' && key.startsWith(`/api/households/${householdId}/settlements`));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsPayingNow(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between p-5 rounded-2xl card-glass border border-gray-200/80 dark:border-white/10 shadow-lg">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Recurring Shared Bills</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Automated splits for rent, utilities, and subscriptions</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-primary/25"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Bill
        </button>
      </div>

      {/* Rules list */}
      {isLoading ? (
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : rules.length === 0 ? (
        <div className="p-8 rounded-2xl card-glass border border-dashed border-gray-200/80 dark:border-white/10 text-center space-y-2">
          <span className="material-symbols-outlined text-[36px] text-gray-400">receipt_long</span>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">No recurring bills scheduled</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Add rent, internet, or cleaner to auto-split on schedule</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div key={rule.id} className="p-5 rounded-2xl card-glass border border-gray-200/80 dark:border-white/10 shadow-lg space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">{rule.name}</h4>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 capitalize border border-gray-200/80 dark:border-white/10">
                      {rule.frequency} • Day {rule.dayOfMonth}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-gray-900 dark:text-white">
                      {currencySymbol}{rule.amount.toFixed(2)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors mt-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Per-member share preview */}
                {rule.sharesPreview && (
                  <div className="pt-3 border-t border-border-subtle space-y-2 mt-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                      Member Share Breakdown ({rule.splitType})
                    </span>
                    <div className="space-y-1.5">
                      {rule.sharesPreview.map((share) => (
                        <div key={share.userId} className="flex justify-between items-center text-xs text-content-primary">
                          <span className="text-content-muted truncate max-w-[140px]">
                            {share.name || `Member #${share.userId}`}
                          </span>
                          <span className="font-semibold">
                            {currencySymbol}{share.shareAmount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pay & Split Now action button */}
              <button
                type="button"
                onClick={() => handleOpenPayModal(rule)}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">payments</span>
                Pay & Split Now
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pay & Split Now Confirmation Modal */}
      <AnimatePresence>
        {payingBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPayingBill(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-50 w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0f172a] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <span className="material-symbols-outlined text-[22px]">receipt_long</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Pay & Split Recurring Bill</h3>
                    <p className="text-[11px] text-gray-400">Record bill payment and queue member shares</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPayingBill(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-4 py-2">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Bill:</span>
                    <span className="font-bold text-white">{payingBill.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Total Outflow:</span>
                    <span className="font-black text-emerald-400 font-mono">
                      {currencySymbol}{payingBill.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Category:</span>
                    <span className="font-bold text-gray-300">{payingBill.category}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-emerald-400 block mb-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">account_balance</span>
                    Deduct from My Account
                  </label>
                  <select
                    value={selectedAccountId ?? ''}
                    onChange={(e) => setSelectedAccountId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1e293b] border border-white/10 text-xs font-bold text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">Do not link personal account</option>
                    {accounts.map((acc: any) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({currencySymbol}{Number(acc.currentBalance ?? acc.balance ?? 0).toLocaleString()}) • {acc.type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-300 space-y-1">
                  <p>• Deducts {currencySymbol}{payingBill.amount.toFixed(2)} cash from selected account</p>
                  <p>• Only your allocated share counts against your personal budget</p>
                  <p>• Roommates&apos; portions queued into upcoming settlements</p>
                </div>
              </div>

              <div className="mt-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setPayingBill(null)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecutePayAndSplit}
                  disabled={isPayingNow}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
                >
                  {isPayingNow ? (
                    <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">done_all</span>
                      Confirm Payment
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Bill Modal / Bottom Sheet */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full sm:max-w-lg bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 dark:bg-white/10 rounded-full mx-auto mb-4 sm:hidden" />
              <div className="flex items-center justify-between pb-4 border-b border-gray-200/80 dark:border-white/10">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create Recurring Bill</h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateBill} className="py-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-content-muted block mb-1">Bill Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apartment Rent, Netflix, Wifi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-content-muted block mb-1">Total Amount ({currencySymbol})</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-content-muted block mb-1">Billing Day of Month</label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-content-muted block mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Housing & Rent">Housing & Rent</option>
                      <option value="Bills & Utilities">Bills & Utilities</option>
                      <option value="Groceries">Groceries</option>
                      <option value="Broadband & Internet">Broadband & Internet</option>
                      <option value="Cleaner & Domestic">Cleaner & Domestic</option>
                      <option value="Subscriptions">Subscriptions</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-content-muted block mb-1">Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as any)}
                      className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                </div>

                {/* 3-Tab Split Mode */}
                <div className="pt-2">
                  <label className="text-xs font-semibold text-content-muted block mb-2">Split Mode</label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-surface-secondary rounded-xl border border-border-subtle">
                    {(['equal', 'percentage', 'fixed'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSplitType(t)}
                        className={`py-2 text-xs font-bold rounded-lg transition-all capitalize ${
                          splitType === t
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'text-content-muted hover:text-content-primary'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom share inputs if percentage or fixed */}
                {splitType !== 'equal' && members.length > 0 && (
                  <div className="space-y-2 p-3 rounded-xl bg-surface-secondary border border-border-subtle">
                    <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider block">
                      Member Shares ({splitType === 'percentage' ? '%' : currencySymbol})
                    </span>
                    {members.map((m) => (
                      <div key={m.userId} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-content-primary truncate flex-1">{m.userName || `User #${m.userId}`}</span>
                        <div className="relative w-28">
                          <input
                            type="number"
                            min="0"
                            step={splitType === 'percentage' ? '1' : '0.01'}
                            value={customShares[String(m.userId)] ?? ''}
                            onChange={(e) => handleShareChange(m.userId, parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white/80 dark:bg-[#0A0E1B] border border-gray-200/80 dark:border-white/10 text-xs text-right pr-6 font-mono text-gray-900 dark:text-white outline-none focus:border-primary"
                            placeholder="0"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                            {splitType === 'percentage' ? '%' : currencySymbol}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/25 disabled:opacity-50 mt-4"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {isSubmitting ? 'Saving...' : 'Save Recurring Bill'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
