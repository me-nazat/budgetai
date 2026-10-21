'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import { useAccounts } from '@/hooks/useApi';
import { useHaptics } from '@/hooks/useHaptics';
import { getApiErrorMessage } from '@/lib/api-errors';
import { mutate } from 'swr';

interface Participant {
  id: number;
  name: string;
  userId?: number | null;
}

interface TourSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tourId: number;
  participants: Participant[];
  prefill?: {
    fromParticipantId?: number;
    toParticipantId?: number;
    amount?: number;
  } | null;
  onSaveSuccess: () => void;
  currentUserId?: number;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

export default function TourSettlementModal({
  isOpen,
  onClose,
  tourId,
  participants,
  prefill,
  onSaveSuccess,
  currentUserId,
}: TourSettlementModalProps) {
  const [mounted, setMounted] = useState(false);
  const [fromParticipantId, setFromParticipantId] = useState<number>(0);
  const [toParticipantId, setToParticipantId] = useState<number>(0);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { currency, fmt } = useCurrency();
  const { accounts } = useAccounts();
  const haptics = useHaptics();
  const isSavingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (prefill) {
        setFromParticipantId(prefill.fromParticipantId ?? (participants[0]?.id || 0));
        setToParticipantId(prefill.toParticipantId ?? (participants[1]?.id || participants[0]?.id || 0));
        setAmount(prefill.amount ? prefill.amount.toFixed(2) : '');
      } else {
        const myP = currentUserId ? participants.find((p) => p.userId === currentUserId) : null;
        setFromParticipantId(myP?.id ?? (participants[0]?.id || 0));
        const otherP = participants.find((p) => p.id !== (myP?.id ?? participants[0]?.id));
        setToParticipantId(otherP?.id ?? (participants[1]?.id || participants[0]?.id || 0));
        setAmount('');
      }
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setError(null);
      // Default to first user account if available
      if (accounts && accounts.length > 0) {
        setSelectedAccountId(accounts[0].id);
      } else {
        setSelectedAccountId(null);
      }
    }
  }, [isOpen, prefill, participants, currentUserId, accounts]);

  const amountNumber = useMemo(() => Number.parseFloat(amount), [amount]);
  const canSubmit =
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    fromParticipantId > 0 &&
    toParticipantId > 0 &&
    fromParticipantId !== toParticipantId &&
    !isSubmitting;

  const closeModal = useCallback(() => {
    haptics.tap();
    onClose();
  }, [haptics, onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSavingRef.current) return;

    isSavingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const fromMember = participants.find((p) => p.id === fromParticipantId);
    const toMember = participants.find((p) => p.id === toParticipantId);
    const descriptionText = notes.trim()
      ? `Settlement: ${notes.trim()}`
      : `Settlement: ${fromMember?.name || 'Member'} paid ${toMember?.name || 'Member'}`;

    const swrKey = `/api/bill-splits/tours/${tourId}`;

    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}/spendings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNumber,
          description: descriptionText,
          category: 'Settlement',
          date,
          paidBy: fromParticipantId,
          recipientMemberId: toParticipantId,
          entryType: 'settlement',
          fundingSource: 'member_direct',
          splitType: 'equal',
          linkedAccountId: selectedAccountId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(getApiErrorMessage(data, 'Failed to record settlement payment.'));
      }

      await mutate(swrKey);
      await mutate((key) => typeof key === 'string' && key.startsWith('/api/accounts'));
      await mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));

      haptics.success();
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to record settlement.');
      haptics.error();
    } finally {
      isSavingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-lg z-40"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-settlement-title"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.98 }}
            transition={spring}
            className="relative z-50 max-h-[88dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl card-glass-elevated border border-white/10 bg-white/95 dark:bg-[#12182B]/95 shadow-2xl backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between gap-4 border-b border-gray-200/80 dark:border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[26px] text-emerald-500 dark:text-emerald-400">handshake</span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400">Tour Accounting</p>
                    <h2 id="tour-settlement-title" className="text-xl font-black text-gray-950 dark:text-white">Record Debt Settlement</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {error && (
                <div className="mb-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-xs font-bold text-rose-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Transfer Flow visual */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">Payer (Who Paid)</label>
                    <select
                      value={fromParticipantId}
                      onChange={(e) => setFromParticipantId(Number(e.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-[#1e293b] px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-500"
                    >
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-center pt-5 text-emerald-400">
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">Recipient (Paid To)</label>
                    <select
                      value={toParticipantId}
                      onChange={(e) => setToParticipantId(Number(e.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-[#1e293b] px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-500"
                    >
                      {participants.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.id === fromParticipantId}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Amount and Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-400">Amount</label>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 px-4 font-mono text-xl font-black text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-400">Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-bold text-white outline-none [color-scheme:dark] focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>

                {/* Personal Bank Account Bridge */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">account_balance</span>
                      Personal Bank Account
                    </label>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Double-Entry Sync</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Settlements adjust your bank account balance without corrupting your monthly budget or category spending.
                  </p>
                  <select
                    value={selectedAccountId ?? ''}
                    onChange={(e) => setSelectedAccountId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-xl border border-white/10 bg-[#1e293b] px-3.5 py-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">Do not link personal bank account</option>
                    {accounts.map((acc: any) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({fmt(acc.currentBalance ?? acc.balance ?? 0)}) • {acc.type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Note */}
                <div>
                  <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-400">Note / Reference (Optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. bKash transfer #TXN9042, Cash handed over"
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold text-white outline-none placeholder:text-gray-600 focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2">
                  <motion.button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    whileHover={{ scale: canSubmit ? 1.01 : 1 }}
                    whileTap={{ scale: canSubmit ? 0.98 : 1 }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 disabled:opacity-50 disabled:pointer-events-none transition-all"
                  >
                    {isSubmitting ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        Confirm Settlement Payment
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
