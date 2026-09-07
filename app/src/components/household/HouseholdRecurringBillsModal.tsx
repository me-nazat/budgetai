'use client';

/**
 * @fileoverview Feature 10.2: Recurring Auto-Split Bills Modal & 3-Tab Split Editor.
 * Supports Equal, Percentage, and Fixed splits with live preview of each member's share.
 *
 * @module components/household/HouseholdRecurringBillsModal
 */

import React, { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

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
        return toast.error(`Fixed shares must sum to bill amount ($${amount})`);
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
          splitShares: splitType === 'equal' ? undefined : customShares,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save recurring bill');
      }

      toast.success('Recurring bill created');
      mutate();
      setIsOpen(false);
      setName('');
      setAmount('');
      setCustomShares({});
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
      if (!res.ok) throw new Error('Failed to delete bill');
      toast.success('Recurring bill deleted');
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with + New Bill Button */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-primary border border-border-subtle">
        <div>
          <h3 className="text-lg font-bold text-content-primary">Recurring Auto-Split Bills</h3>
          <p className="text-xs text-content-muted">Automate rent, subscriptions, and utilities</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          + New Bill
        </button>
      </div>

      {/* Rules list */}
      {isLoading ? (
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : rules.length === 0 ? (
        <div className="p-8 rounded-2xl bg-surface-primary border border-dashed border-border-subtle text-center space-y-2">
          <span className="material-symbols-outlined text-[36px] text-content-muted">receipt_long</span>
          <p className="text-sm font-semibold text-content-primary">No recurring bills scheduled</p>
          <p className="text-xs text-content-muted">Add rent, internet, or Netflix to auto-split on schedule</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div key={rule.id} className="p-5 rounded-2xl bg-surface-primary border border-border-subtle space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-content-primary">{rule.name}</h4>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-secondary text-content-muted capitalize border border-border-subtle">
                    {rule.frequency} • Day {rule.dayOfMonth}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-content-primary">
                    {currencySymbol}{rule.amount.toFixed(2)}
                  </div>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-[11px] text-red-400 hover:text-red-300 transition-colors mt-1"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Per-member share preview */}
              {rule.sharesPreview && (
                <div className="pt-3 border-t border-border-subtle space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                    Member Share Breakdown ({rule.splitType})
                  </span>
                  <div className="space-y-1.5">
                    {rule.sharesPreview.map((share) => (
                      <div key={share.userId} className="flex justify-between items-center text-xs text-content-primary">
                        <span className="text-content-muted truncate max-w-[140px]">
                          {share.name || `User #${share.userId}`}
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
          ))}
        </div>
      )}

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
              className="w-full sm:max-w-lg bg-surface-primary border border-border-subtle rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-border-strong rounded-full mx-auto mb-4 sm:hidden" />
              <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
                <h3 className="text-lg font-bold text-content-primary">Create Recurring Bill</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-surface-secondary text-content-muted hover:text-content-primary"
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
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-content-muted block mb-1">Execution Day (1-28)</label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      required
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* 3-Tab Split Editor */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-semibold text-content-muted block">Split Mode</label>
                  <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-surface-secondary border border-border-subtle">
                    {(['equal', 'percentage', 'fixed'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSplitType(mode)}
                        className={`min-h-[44px] py-2 text-xs font-bold rounded-lg capitalize transition-all ${
                          splitType === mode
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'text-content-muted hover:text-content-primary'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  {/* Split editor body */}
                  {splitType !== 'equal' && (
                    <div className="p-3 rounded-xl bg-surface-secondary border border-border-subtle space-y-2.5">
                      <span className="text-[11px] font-semibold text-content-muted block">
                        {splitType === 'percentage'
                          ? 'Enter percentage for each member (%):'
                          : `Enter fixed dollar share for each member (${currencySymbol}):`}
                      </span>
                      {members.map((m) => (
                        <div key={m.userId} className="flex items-center justify-between gap-3">
                          <span className="text-xs text-content-primary font-medium truncate max-w-[150px]">
                            {m.userName || `User #${m.userId}`}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={splitType === 'percentage' ? '%' : currencySymbol}
                            value={customShares[String(m.userId)] ?? ''}
                            onChange={(e) => handleShareChange(m.userId, parseFloat(e.target.value) || 0)}
                            className="w-24 px-3 py-1.5 rounded-lg bg-surface-primary border border-border-subtle text-xs text-content-primary text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] mt-4 py-3 rounded-xl bg-emerald-500 font-bold text-white text-xs hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Confirm & Save Bill'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
