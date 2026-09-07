'use client';

/**
 * @fileoverview Feature 10.2: Household Settlements Card Stack & Workflow.
 * Renders minimal debt settlement plan, one-tap "Settle all", and interactive
 * cards for upcoming payments with 44px touch target "Mark paid" confirmations.
 *
 * @module components/household/HouseholdSettlementsCardStack
 */

import React, { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

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

  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data, error, isLoading, mutate } = useSWR<{
    balances: Balance[];
    minSettlements: PaymentPlan[];
    upcomingSettlements: UpcomingSettlement[];
  }>(`/api/households/${householdId}/settlements/preview`, fetcher);

  const balances = data?.balances || [];
  const minSettlements = data?.minSettlements || [];
  const upcoming = data?.upcomingSettlements || [];

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

  const handleMarkPaid = async (settlementId: string) => {
    setPayingId(settlementId);
    try {
      const res = await fetch(`/api/households/${householdId}/settlements/${settlementId}/confirm`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to confirm settlement');
      toast.success('Settlement confirmed and marked paid!');
      mutate();
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
      <div className="p-5 rounded-2xl bg-surface-primary border border-border-subtle flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-content-primary">Debt Minimization & Settlements</h3>
          <p className="text-xs text-content-muted">
            Greedy cash-flow minimization computes fewest payments across all members
          </p>
        </div>
        <button
          onClick={handleSettleAll}
          disabled={isGenerating || minSettlements.length === 0}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
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
              className="p-4 rounded-xl bg-surface-secondary border border-border-subtle flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-content-primary block">{b.userName}</span>
                <span className="text-[11px] text-content-muted">
                  {isOwed ? 'Is owed' : owes ? 'Owes' : 'Settled up'}
                </span>
              </div>
              <div
                className={`text-sm font-black ${
                  isOwed ? 'text-emerald-400' : owes ? 'text-red-400' : 'text-content-muted'
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
        <div className="p-5 rounded-2xl bg-surface-primary border border-border-subtle space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-content-muted">
            Recommended Minimal Transfers ({minSettlements.length})
          </h4>
          <div className="space-y-2.5">
            {minSettlements.map((plan, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-surface-secondary border border-border-subtle flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-bold text-content-primary">{plan.fromUserName}</span>
                  <span className="material-symbols-outlined text-content-muted text-[16px]">arrow_forward</span>
                  <span className="font-bold text-content-primary">{plan.toUserName}</span>
                </div>
                <div className="text-sm font-black text-emerald-400">
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
          <div className="p-8 rounded-2xl bg-surface-primary border border-dashed border-border-subtle text-center text-xs text-content-muted">
            No upcoming settlement cards. Click "Settle All" above to schedule.
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((item) => (
              <motion.div
                key={item.id}
                layout
                className={`p-4 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-4 ${
                  item.status === 'paid'
                    ? 'bg-surface-secondary/50 border-border-subtle opacity-75'
                    : 'bg-surface-primary border-border-subtle shadow-xs'
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
                  <p className="text-[11px] text-content-muted">
                    Due: {item.dueDate}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-base font-black text-content-primary">
                    {currencySymbol}{item.amount.toFixed(2)}
                  </span>
                  {item.status !== 'paid' && (
                    <button
                      onClick={() => handleMarkPaid(item.id)}
                      disabled={payingId === item.id}
                      className="min-w-[44px] min-h-[44px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      {payingId === item.id ? 'Saving...' : 'Mark Paid'}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
