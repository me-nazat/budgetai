'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';

export interface InsightItem {
  id: string;
  type: 'BILL_DUE' | 'BUDGET_OVERRUN' | 'ROUND_UP_SWEEP' | 'SPENDING_SPIKE' | 'SAVINGS_OPPORTUNITY';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  actionLabel?: string;
  actionLink?: string;
  actionType?: 'link' | 'pay_bill' | 'sweep_roundup';
  actionPayload?: any;
}

interface UnifiedInsightsHubProps {
  insights?: InsightItem[];
  onDismiss?: (id: string) => void;
  currencySymbol?: string;
  budgetAlerts?: Array<{ category: string; limit: number; spent: number; percentage: number }>;
}

export function UnifiedInsightsHub({
  insights: propInsights,
  onDismiss,
  currencySymbol = '$',
  budgetAlerts = [],
}: UnifiedInsightsHubProps) {
  const { fmt } = useCurrency();
  const { formatAmount } = usePrivacy();
  const invalidateFinancialData = useInvalidateFinancialData();

  // Local dismissed IDs for instant optimistic UI removal
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);

  // Queries for live dynamic signals if props are not explicitly providing them
  const { data: recurringData } = useSWR<{ items: Array<{ id: number; name: string; amount: number; nextDate?: string; next_date?: string; active?: number; type: string }> }>(
    '/api/recurring'
  );
  const { data: roundUpData } = useSWR<{ pendingTotal: number; pendingCount: number; targetGoalName: string; threshold: number }>(
    '/api/round-ups'
  );

  // Derive high-signal prioritized cards
  const prioritizedCards: InsightItem[] = useMemo(() => {
    if (propInsights && propInsights.length > 0) {
      return propInsights;
    }

    const cards: InsightItem[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Priority 1: Overdue or Due-Today Recurring Bills
    if (recurringData?.items) {
      const activeExpenses = recurringData.items.filter(
        (r) => r.active !== 0 && r.type === 'expense'
      );
      for (const bill of activeExpenses) {
        const dueDate = bill.nextDate || bill.next_date;
        if (!dueDate) continue;

        if (dueDate < todayStr) {
          const diffDays = Math.round(
            (new Date(todayStr).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          cards.push({
            id: `bill-overdue-${bill.id}`,
            type: 'BILL_DUE',
            severity: 'CRITICAL',
            title: `Overdue Bill: ${bill.name}`,
            message: `${bill.name} was due ${diffDays} day${diffDays > 1 ? 's' : ''} ago (${formatAmount(bill.amount, fmt(bill.amount))}). Pay now to avoid penalties.`,
            actionLabel: 'Mark Paid',
            actionType: 'pay_bill',
            actionPayload: { id: bill.id, name: bill.name },
          });
        } else if (dueDate === todayStr) {
          cards.push({
            id: `bill-today-${bill.id}`,
            type: 'BILL_DUE',
            severity: 'WARNING',
            title: `Bill Due Today: ${bill.name}`,
            message: `${bill.name} (${formatAmount(bill.amount, fmt(bill.amount))}) is due today.`,
            actionLabel: 'Mark Paid',
            actionType: 'pay_bill',
            actionPayload: { id: bill.id, name: bill.name },
          });
        }
      }
    }

    // Priority 2: Budget Categories Crossed 85% of Allocation
    if (budgetAlerts && budgetAlerts.length > 0) {
      for (const b of budgetAlerts) {
        if (b.percentage >= 85) {
          const isOver = b.percentage >= 100;
          cards.push({
            id: `budget-alert-${b.category}`,
            type: 'BUDGET_OVERRUN',
            severity: isOver ? 'CRITICAL' : 'WARNING',
            title: `${isOver ? 'Budget Exceeded' : 'Budget Warning'}: ${b.category}`,
            message: `Consumed ${b.percentage}% (${formatAmount(b.spent, fmt(b.spent))} of ${formatAmount(b.limit, fmt(b.limit))}). Review envelope to prevent runway erosion.`,
            actionLabel: 'Manage Budget',
            actionType: 'link',
            actionLink: '/budgets',
          });
        }
      }
    }

    // Priority 3: Pending Spare-Change Round-Ups Ready to Sweep
    const pendingAmount = roundUpData?.pendingTotal ?? 0;
    const targetGoal = roundUpData?.targetGoalName || 'Savings Goal';
    if (pendingAmount > 0) {
      cards.push({
        id: 'roundup-sweep-ready',
        type: 'ROUND_UP_SWEEP',
        severity: 'INFO',
        title: `Micro-Savings: ${currencySymbol}${pendingAmount.toFixed(2)} Ready`,
        message: `Spare change accumulated from recent debit transactions ready to sweep into ${targetGoal}.`,
        actionLabel: 'Sweep to Goal',
        actionType: 'sweep_roundup',
        actionPayload: { amount: pendingAmount, targetGoal },
      });
    }

    // Return at most 3 highest urgency cards
    return cards.slice(0, 3);
  }, [propInsights, recurringData, budgetAlerts, roundUpData, currencySymbol, fmt, formatAmount]);

  const visibleCards = prioritizedCards.filter((card) => !dismissedIds.has(card.id));

  const handleDismiss = async (id: string) => {
    // 1. Optimistic removal
    setDismissedIds((prev) => new Set(prev).add(id));
    if (onDismiss) {
      onDismiss(id);
    }

    // 2. Dispatch to API
    try {
      await fetch(`/api/insights/${encodeURIComponent(id)}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: 'dismissed' }),
      });
    } catch {
      // Non-blocking error
    }
  };

  const handleAction = async (card: InsightItem) => {
    if (card.actionType === 'pay_bill') {
      setProcessingActionId(card.id);
      try {
        const res = await fetch('/api/recurring/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: card.actionPayload?.id }),
        });
        if (!res.ok) throw new Error('Payment recording failed');
        toast.success(`Paid ${card.actionPayload?.name}!`);
        await invalidateFinancialData();
        handleDismiss(card.id);
      } catch (err: any) {
        toast.error(err.message || 'Payment recording failed');
      } finally {
        setProcessingActionId(null);
      }
    } else if (card.actionType === 'sweep_roundup') {
      setProcessingActionId(card.id);
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(50);
        }

        const res = await fetch('/api/round-ups/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
        });

        if (res.ok) {
          confetti({
            particleCount: 70,
            spread: 55,
            origin: { y: 0.7 },
          });
          toast.success(`Transferred spare change to ${card.actionPayload?.targetGoal || 'savings'}!`);
          await invalidateFinancialData();
          handleDismiss(card.id);
        } else {
          toast.error('Sweep failed to process');
        }
      } catch {
        toast.error('Sweep failed to process');
      } finally {
        setProcessingActionId(null);
      }
    }
  };

  if (visibleCards.length === 0) {
    return null;
  }

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200';
      case 'WARNING':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200';
      default:
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'error';
      case 'WARNING':
        return 'warning';
      default:
        return 'bolt';
    }
  };

  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-text-muted flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[16px]">priority_high</span>
          <span>Actionable Briefing ({visibleCards.length})</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AnimatePresence>
          {visibleCards.map((card) => {
            const isProcessing = processingActionId === card.id;

            return (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.96, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.18 }}
                className={`p-4 rounded-2xl border backdrop-blur-md flex flex-col justify-between shadow-sm relative group ${getSeverityStyle(
                  card.severity
                )}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">
                        {getSeverityIcon(card.severity)}
                      </span>
                      <h4 className="text-xs font-bold leading-tight line-clamp-1">{card.title}</h4>
                    </div>

                    {/* Dismiss Button */}
                    <button
                      type="button"
                      onClick={() => handleDismiss(card.id)}
                      className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                      title="Dismiss alert"
                    >
                      <span className="material-symbols-outlined text-sm leading-none">close</span>
                    </button>
                  </div>

                  <p className="text-[11px] opacity-90 leading-relaxed mb-3">
                    {card.message}
                  </p>
                </div>

                {/* Card Action */}
                <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-end">
                  {card.actionType === 'link' && card.actionLink ? (
                    <Link
                      href={card.actionLink}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-900 dark:text-white hover:underline"
                    >
                      <span>{card.actionLabel || 'Inspect'}</span>
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAction(card)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-[11px] font-bold shadow-sm active:scale-95 transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {isProcessing ? 'sync' : card.actionType === 'sweep_roundup' ? 'bolt' : 'check'}
                      </span>
                      <span>{isProcessing ? 'Processing...' : card.actionLabel || 'Action'}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default UnifiedInsightsHub;
