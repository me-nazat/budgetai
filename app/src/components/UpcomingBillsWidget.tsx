'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';

export interface RecurringBillItem {
  id: number;
  name: string;
  type: string;
  amount: number;
  category: string;
  frequency: string;
  next_date?: string;
  nextDate?: string;
  active?: number;
}

export default function UpcomingBillsWidget() {
  const { fmt } = useCurrency();
  const { formatAmount } = usePrivacy();
  const invalidateFinancialData = useInvalidateFinancialData();
  const [payingId, setPayingId] = useState<number | null>(null);

  const { data, isLoading } = useSWR<{ items: RecurringBillItem[] }>('/api/recurring');

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const upcomingBills = useMemo(() => {
    if (!data?.items) return [];

    const now = new Date();
    const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const limitIso = `${fourteenDaysLater.getFullYear()}-${String(fourteenDaysLater.getMonth() + 1).padStart(2, '0')}-${String(fourteenDaysLater.getDate()).padStart(2, '0')}`;

    return data.items
      .filter((item) => {
        if (item.active === 0 || item.type !== 'expense') return false;
        const d = item.nextDate || item.next_date;
        if (!d) return false;
        return d <= limitIso;
      })
      .map((item) => {
        const d = (item.nextDate || item.next_date)!;
        const targetDate = new Date(d + 'T00:00:00');
        const currentDate = new Date(todayStr + 'T00:00:00');
        const diffTime = targetDate.getTime() - currentDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let status: 'overdue' | 'due_today' | 'upcoming';
        let statusLabel: string;

        if (diffDays < 0) {
          status = 'overdue';
          statusLabel = `Overdue (${Math.abs(diffDays)}d)`;
        } else if (diffDays === 0) {
          status = 'due_today';
          statusLabel = 'Due Today';
        } else {
          status = 'upcoming';
          statusLabel = `In ${diffDays}d`;
        }

        return {
          ...item,
          dueDate: d,
          diffDays,
          status,
          statusLabel,
        };
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [data, todayStr]);

  const handleMarkPaid = async (bill: RecurringBillItem & { dueDate: string }) => {
    setPayingId(bill.id);
    try {
      const res = await fetch('/api/recurring/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bill.id }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to record bill payment');
      }

      toast.success(`Recorded payment for ${bill.name}!`);
      await invalidateFinancialData();
    } catch (err: any) {
      console.error('Mark paid error:', err);
      toast.error(err.message || 'Payment recording failed');
    } finally {
      setPayingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-panel p-5 rounded-3xl border border-gray-200 dark:border-white/5 bg-white dark:bg-surface-dark shadow-sm animate-pulse">
        <div className="h-4 w-36 bg-gray-200 dark:bg-white/10 rounded-full mb-4" />
        <div className="space-y-3">
          <div className="h-14 bg-gray-100 dark:bg-white/5 rounded-2xl" />
          <div className="h-14 bg-gray-100 dark:bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="card-glass relative overflow-hidden p-5 sm:p-6 rounded-3xl border border-white/[0.08] shadow-sm flex flex-col justify-between h-full">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20" />
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">schedule</span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Upcoming Bills (14d)</h3>
            {upcomingBills.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                {upcomingBills.length}
              </span>
            )}
          </div>
          <Link
            href="/recurring-subscriptions"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
          >
            <span>Manage</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>

        {/* Bill Rows */}
        {upcomingBills.length === 0 ? (
          <div className="text-center py-6 px-4 rounded-2xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-150/70 dark:border-white/5">
            <span className="material-symbols-outlined text-3xl text-emerald-500 mb-1 block">
              verified
            </span>
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">All clear for the next 14 days!</p>
            <p className="text-[11px] text-gray-400 mt-0.5">No committed bills or subscriptions due soon.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcomingBills.slice(0, 4).map((bill) => (
              <div
                key={bill.id}
                className="flex items-center justify-between p-3 rounded-2xl border border-gray-150/80 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] hover:bg-gray-100/50 dark:hover:bg-white/[0.04] transition-all gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {bill.name}
                    </p>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full border ${
                        bill.status === 'overdue'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          : bill.status === 'due_today'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300 border-slate-200/50 dark:border-white/5'
                      }`}
                    >
                      {bill.statusLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-text-muted">
                    Due {new Date(bill.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {bill.category}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums font-mono">
                    {formatAmount(bill.amount, fmt(bill.amount))}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleMarkPaid(bill)}
                    disabled={payingId === bill.id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[11px] font-bold shadow-sm transition-all disabled:opacity-50 min-h-[30px]"
                    title={`Record payment for ${bill.name}`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {payingId === bill.id ? 'sync' : 'check'}
                    </span>
                    <span>{payingId === bill.id ? 'Saving...' : 'Paid'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {upcomingBills.length > 4 && (
        <div className="pt-3 mt-3 border-t border-gray-150 dark:border-white/5 text-center">
          <Link
            href="/recurring-subscriptions"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            +{upcomingBills.length - 4} more bills scheduled →
          </Link>
        </div>
      )}
    </div>
  );
}
