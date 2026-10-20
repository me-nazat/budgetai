'use client';

/**
 * @fileoverview Institutional Action Diff Card for AI Copilot (Module 19 & Batch 9).
 * Renders staged actions as crisp before-and-after diffs with tabular-nums,
 * explicit Confirm & Execute confirmation, and guaranteed 1-click Undo.
 *
 * @module components/chat/ChatActionCard
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/hooks/useCurrency';
import { formatLocaleCurrency } from '@/lib/formatters/locale';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';

export interface ChatActionCardProps {
  executionId?: number;
  actionLogId?: string;
  toolName: string;
  parameters: Record<string, any>;
  initialStatus?: 'pending' | 'executed' | 'cancelled';
  onActionComplete?: (result: any) => void;
  onUndoComplete?: () => void;
}

export default function ChatActionCard({
  executionId,
  actionLogId,
  toolName,
  parameters = {},
  initialStatus = 'pending',
  onActionComplete,
  onUndoComplete,
}: ChatActionCardProps) {
  const { locale, t } = useLanguage();
  const { currency } = useCurrency();
  const invalidateFinancialData = useInvalidateFinancialData();

  const [status, setStatus] = useState<'pending' | 'executed' | 'cancelled'>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [activeExecId, setActiveExecId] = useState<number | undefined>(executionId);
  const [activeLogId, setActiveLogId] = useState<string | undefined>(actionLogId);

  const normalizedTool = (toolName || '').toLowerCase().replace(/_/g, '');
  const isTransaction = normalizedTool.includes('transaction') || normalizedTool.includes('expense');
  const isBudget = normalizedTool.includes('budget');
  const isGoal = normalizedTool.includes('goal');
  const isTransfer = normalizedTool.includes('transfer');
  const isAutomation = normalizedTool.includes('automation') || normalizedTool.includes('rule');

  const amount = Number(parameters.amount || parameters.monthlyLimit || parameters.targetAmount || 0);
  const formattedAmount = formatLocaleCurrency(amount, locale, currency);

  // Before & After Diff Calculations
  const oldLimit = parameters.oldLimit !== undefined ? Number(parameters.oldLimit) : null;
  const newLimit = parameters.monthlyLimit !== undefined ? Number(parameters.monthlyLimit) : (oldLimit !== null ? amount : null);

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
        const logId = data.actionLogId || activeLogId;
        setActiveExecId(execId);
        setActiveLogId(logId);

        invalidateFinancialData();
        if (onActionComplete) onActionComplete(data.result);

        toast.success(
          locale === 'bn'
            ? 'পদক্ষেপ সফলভাবে সম্পন্ন হয়েছে!'
            : 'Action executed and verified in ledger!',
          {
            duration: 6000,
            action: {
              label: locale === 'bn' ? 'বাতিল করুন (Undo)' : 'Undo Action',
              onClick: () => handleUndo(execId || logId),
            },
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
        toast.info(locale === 'bn' ? 'পদক্ষেপ বাতিল করা হয়েছে।' : 'Action cancelled.');
      }
    } catch {
      toast.error('Error rejecting action');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (targetId?: number | string) => {
    const idToUndo = targetId || activeExecId || activeLogId;
    if (!idToUndo) return;

    setUndoing(true);
    try {
      const res = await fetch(`/api/chat/undo/${idToUndo}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('cancelled');
        invalidateFinancialData();
        toast.success(
          locale === 'bn'
            ? 'পদক্ষেপ সফলভাবে প্রত্যাহার করা হয়েছে।'
            : 'Action atomically reverted in ledger.'
        );
        if (onUndoComplete) onUndoComplete();
      } else {
        toast.error(data.error || 'Could not undo action');
      }
    } catch {
      toast.error('Network error during rollback');
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="w-full mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-4 shadow-sm backdrop-blur-md transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">
              {isTransaction
                ? 'receipt_long'
                : isBudget
                ? 'donut_large'
                : isGoal
                ? 'savings'
                : isTransfer
                ? 'sync_alt'
                : 'rule'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-400">
              {status === 'pending'
                ? t('chat.actionCard.staged', 'Staged Mutation • Awaiting Confirmation')
                : status === 'executed'
                ? t('chat.actionCard.executedLedger', 'Committed to Ledger')
                : t('chat.actionCard.revertedLedger', 'Reverted')}
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {isTransaction && (parameters.description || parameters.merchant || parameters.name || 'Log Transaction')}
              {isBudget && `Adjust Budget: ${parameters.categoryName || parameters.category || 'Category'}`}
              {isGoal && `Create Vault: ${parameters.goalName || parameters.name || 'Savings Goal'}`}
              {isTransfer && `Transfer between accounts`}
              {isAutomation && `Rule: "${parameters.keyword}" ➔ ${parameters.category}`}
            </div>
          </div>
        </div>

        {/* State Badges */}
        {status === 'pending' && (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-xs">pending</span>
            Pending
          </span>
        )}

        {status === 'executed' && (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-xs">check_circle</span>
            Completed
          </span>
        )}

        {status === 'cancelled' && (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 rounded-full flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-xs">undo</span>
            Reverted
          </span>
        )}
      </div>

      {/* Institutional Diff Card */}
      <div className="my-3.5 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 text-xs">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Ledger Impact Diff
        </div>

        {isBudget && oldLimit !== null && (
          <div className="flex items-center justify-between py-1.5 border-b border-slate-200/50 dark:border-slate-800/60 font-mono text-xs tabular-nums">
            <span className="text-slate-500">Monthly Envelope Cap</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 line-through">
                {formatLocaleCurrency(oldLimit, locale, currency)}
              </span>
              <span className="material-symbols-outlined text-xs text-slate-400">arrow_forward</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatLocaleCurrency(newLimit || amount, locale, currency)}
              </span>
            </div>
          </div>
        )}

        {isTransfer && (
          <div className="space-y-1 py-1 font-mono text-xs tabular-nums">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Account #{parameters.fromAccountId}</span>
              <span className="text-rose-500 font-bold">-{formattedAmount}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Account #{parameters.toAccountId}</span>
              <span className="text-emerald-500 font-bold">+{formattedAmount}</span>
            </div>
          </div>
        )}

        {isTransaction && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <span className="text-[10px] text-slate-400 uppercase">Amount</span>
              <p className={`text-sm font-bold tabular-nums font-mono ${parameters.type === 'INCOME' || parameters.type === 'earning' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                {parameters.type === 'INCOME' || parameters.type === 'earning' ? '+' : '-'}{formattedAmount}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase">Category</span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {parameters.categoryName || parameters.category || 'Other'}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 uppercase">Effective Date</span>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                {parameters.date || new Date().toISOString().split('T')[0]}
              </p>
            </div>
          </div>
        )}

        {isGoal && (
          <div className="flex items-center justify-between py-1.5 text-xs font-mono tabular-nums">
            <span className="text-slate-500">Target Ceiling</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {formattedAmount}
            </span>
          </div>
        )}

        {isAutomation && (
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Merchant Match</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">"{parameters.keyword}"</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Auto-Assigned Category</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{parameters.category}</span>
            </div>
          </div>
        )}
      </div>

      {/* State Transitions: Buttons */}
      {status === 'pending' && (
        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-sm hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
              {loading ? 'progress_activity' : 'check'}
            </span>
            {loading ? 'Executing...' : 'Confirm & Execute'}
          </button>

          <button
            type="button"
            onClick={handleReject}
            disabled={loading}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-800 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {status === 'executed' && (
        <div className="pt-2 flex items-center justify-between text-xs">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check</span>
            Verified in balance ledger
          </span>

          <button
            type="button"
            onClick={() => handleUndo()}
            disabled={undoing}
            className="min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">undo</span>
            {undoing ? 'Reverting...' : 'Undo Action'}
          </button>
        </div>
      )}

      {status === 'cancelled' && (
        <div className="pt-2 text-xs text-slate-400 dark:text-slate-500 italic">
          Action was reverted. Ledger state remains unchanged.
        </div>
      )}
    </div>
  );
}
