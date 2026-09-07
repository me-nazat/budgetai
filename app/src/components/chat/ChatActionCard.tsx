'use client';

/**
 * @fileoverview Inline Action Card for AI Coach tool calls (Module 19).
 * Renders proposed autonomous actions (transaction, budget limit, savings goal)
 * with Apply (1-tap execute), Reject, and Edit buttons, plus a 5-second Sonner undo toast.
 *
 * @module components/chat/ChatActionCard
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/hooks/useCurrency';
import { formatLocaleCurrency, toBengaliNumerals } from '@/lib/formatters/locale';

export interface ChatActionCardProps {
  executionId?: number;
  toolName: string;
  parameters: Record<string, any>;
  initialStatus?: 'pending' | 'executed' | 'cancelled';
  onActionComplete?: (result: any) => void;
  onUndoComplete?: () => void;
}

export default function ChatActionCard({
  executionId,
  toolName,
  parameters,
  initialStatus = 'pending',
  onActionComplete,
  onUndoComplete,
}: ChatActionCardProps) {
  const { locale, t } = useLanguage();
  const { currency } = useCurrency();
  const [status, setStatus] = useState<'pending' | 'executed' | 'cancelled'>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [activeExecId, setActiveExecId] = useState<number | undefined>(executionId);

  const normalizedTool = (toolName || '').toLowerCase();
  const isTransaction = normalizedTool.includes('transaction') || normalizedTool.includes('expense');
  const isBudget = normalizedTool.includes('budget');
  const isGoal = normalizedTool.includes('goal');

  const amount = parameters.amount || parameters.monthlyLimit || parameters.targetAmount || 0;
  const formattedAmount = formatLocaleCurrency(amount, locale, currency);

  const handleApply = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId: activeExecId,
          toolName,
          parameters,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus('executed');
        const execId = data.executionId || activeExecId;
        setActiveExecId(execId);

        if (onActionComplete) onActionComplete(data.result);

        // 5-second Sonner Undo Toast
        toast.success(
          locale === 'bn'
            ? 'পদক্ষেপ সফলভাবে লেজারে যুক্ত হয়েছে!'
            : 'Action applied to ledger successfully!',
          {
            duration: 5000,
            action: execId
              ? {
                  label: locale === 'bn' ? 'বাতিল করুন (Undo)' : 'Undo (5s)',
                  onClick: () => handleUndo(execId),
                }
              : undefined,
          }
        );
      } else {
        toast.error(data.error || 'Action execution failed');
      }
    } catch {
      toast.error('Network error executing action');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId: activeExecId,
          action: 'reject',
          toolName,
          parameters,
        }),
      });
      if (res.ok) {
        setStatus('cancelled');
        toast.info(locale === 'bn' ? 'পদক্ষেপ বাতিল করা হয়েছে।' : 'Action rejected.');
      }
    } catch {
      toast.error('Error rejecting action');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (execId: number) => {
    setUndoing(true);
    try {
      const res = await fetch(`/api/chat/undo/${execId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('cancelled');
        toast.success(
          locale === 'bn'
            ? 'পদক্ষেপ সফলভাবে প্রত্যাহার করা হয়েছে।'
            : 'Action successfully rolled back.'
        );
        if (onUndoComplete) onUndoComplete();
      } else {
        toast.error(data.error || 'Could not undo action (window may have expired)');
      }
    } catch {
      toast.error('Network error during rollback');
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="w-full mt-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-white/80 to-primary/5 dark:from-primary/10 dark:via-[#161b22] dark:to-primary/5 p-4 shadow-sm backdrop-blur-sm transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">
              {isTransaction ? 'receipt_long' : isBudget ? 'savings' : 'flag'}
            </span>
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              {t('chat.actionCard.proposeAction', 'Proposed Autonomous Action')}
            </span>
            <div className="text-sm font-black text-gray-900 dark:text-white">
              {isTransaction && (parameters.description || parameters.name || 'Log Transaction')}
              {isBudget && `Set ${parameters.categoryName || parameters.category || 'Category'} Budget`}
              {isGoal && `Create Goal: ${parameters.goalName || parameters.name || 'Target'}`}
            </div>
          </div>
        </div>

        {status === 'executed' && (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-accent-emerald/15 text-accent-emerald rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">check</span>
            {t('chat.actionCard.executed', 'Executed')}
          </span>
        )}

        {status === 'cancelled' && (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-rose-500/15 text-rose-500 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">close</span>
            {t('chat.actionCard.rejected', 'Cancelled')}
          </span>
        )}
      </div>

      {/* Details Grid */}
      <div className="my-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-white/5">
          <div className="text-[10px] uppercase font-semibold text-gray-400">Amount</div>
          <div className="text-sm font-black text-gray-900 dark:text-white mt-0.5">
            {formattedAmount}
          </div>
        </div>

        {(parameters.category || parameters.categoryName) && (
          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-white/5">
            <div className="text-[10px] uppercase font-semibold text-gray-400">Category</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5 truncate">
              {parameters.category || parameters.categoryName}
            </div>
          </div>
        )}

        {(parameters.date || parameters.targetDate) && (
          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 col-span-2 sm:col-span-1">
            <div className="text-[10px] uppercase font-semibold text-gray-400">Date</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5">
              {locale === 'bn'
                ? toBengaliNumerals(parameters.date || parameters.targetDate)
                : parameters.date || parameters.targetDate}
            </div>
          </div>
        )}
      </div>

      {/* Actions Bar */}
      {status === 'pending' && (
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-md hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>
              {loading ? 'progress_activity' : 'check'}
            </span>
            {loading ? t('chat.actionCard.applying', 'Executing...') : t('chat.actionCard.apply', 'Apply Action')}
          </button>

          <button
            type="button"
            onClick={handleReject}
            disabled={loading}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:text-rose-500 hover:border-rose-300 font-bold text-xs transition-colors"
          >
            {t('chat.actionCard.reject', 'Reject')}
          </button>

          <button
            type="button"
            onClick={() => {
              if (isTransaction) {
                window.location.href = `/transactions/new?prefillAmount=${encodeURIComponent(
                  amount
                )}&prefillCategory=${encodeURIComponent(
                  parameters.category || 'Other'
                )}&prefillNote=${encodeURIComponent(parameters.description || '')}`;
              } else if (isBudget) {
                window.location.href = `/budgets?category=${encodeURIComponent(
                  parameters.categoryName || ''
                )}`;
              } else {
                window.location.href = `/wealth-goals`;
              }
            }}
            className="min-h-[44px] px-3 py-2.5 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white font-semibold text-xs transition-colors text-center"
          >
            {t('chat.actionCard.edit', 'Edit Details')}
          </button>
        </div>
      )}

      {status === 'executed' && activeExecId && (
        <div className="pt-1 flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-text-muted">
            {t('chat.actionCard.transactionSuccess', 'Transaction logged into ledger.')}
          </span>
          <button
            type="button"
            onClick={() => handleUndo(activeExecId)}
            disabled={undoing}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-sm">undo</span>
            {undoing ? t('chat.actionCard.undoing', 'Rolling back...') : t('chat.actionCard.undo', 'Undo')}
          </button>
        </div>
      )}
    </div>
  );
}
