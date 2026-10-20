'use client';

/**
 * @fileoverview Standalone Ad-Hoc Bill Splitter & IOU Tracker.
 * Allows quick split creation in under 15 seconds:
 * - Enter Total Bill, optional Tax/Tip percentage
 * - Select Payer (Me + linked personal account, or Friend)
 * - 3 Split Modes (Equal, Exact Itemized, Shares)
 * - Live ledger preview pill (Account impact vs Personal budget impact)
 * - Active IOUs summary list with one-click "Settle IOU" to personal bank account.
 *
 * @module app/(app)/bill-split/page
 */

import React, { useState, useMemo } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { useAccounts } from '@/hooks/useApi';
import CollaborativeNavSwitcher from '@/components/CollaborativeNavSwitcher';

interface Participant {
  name: string;
  share?: number;
  amount?: number;
  weight?: number;
  isMe?: boolean;
  settled?: boolean;
  settledAt?: string;
}

interface BillSplit {
  id: number;
  description: string;
  totalAmount: number;
  date: string;
  splitMode: 'Equal' | 'Percentage' | 'Custom';
  participants: Participant[];
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BillSplitPage() {
  const { fmt } = useCurrency();
  const { accounts } = useAccounts();

  // Data fetching
  const { data: splits = [], isLoading, mutate } = useSWR<BillSplit[]>('/api/bill-splits', fetcher);

  // Form State
  const [description, setDescription] = useState('');
  const [baseAmount, setBaseAmount] = useState<string>('');
  const [taxTipPct, setTaxTipPct] = useState<number>(0);
  const [category, setCategory] = useState('Dining & Food');
  const [paidByMe, setPaidByMe] = useState(true);
  const [payerFriendName, setPayerFriendName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [splitMode, setSplitMode] = useState<'Equal' | 'Exact' | 'Shares'>('Equal');

  // Participants list (defaults to Me and 1 Friend)
  const [participants, setParticipants] = useState<Array<{ name: string; isMe: boolean; val: number }>>([
    { name: 'Me', isMe: true, val: 0 },
    { name: 'Friend 1', isMe: false, val: 0 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Settlement modal state
  const [settlingIou, setSettlingIou] = useState<{
    splitId: number;
    participantIndex: number;
    name: string;
    amount: number;
    description: string;
    date: string;
  } | null>(null);
  const [depositAccountId, setDepositAccountId] = useState<number | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  // Computed total with tip/tax
  const baseNum = parseFloat(baseAmount) || 0;
  const taxTipMultiplier = 1 + (taxTipPct / 100);
  const totalAmount = Math.round(baseNum * taxTipMultiplier * 100) / 100;

  // Compute calculated amounts per participant based on split mode
  const computedParticipants = useMemo(() => {
    if (participants.length === 0 || totalAmount <= 0) {
      return participants.map((p) => ({ ...p, calculatedAmount: 0 }));
    }

    if (splitMode === 'Equal') {
      const perPerson = Math.round((totalAmount / participants.length) * 100) / 100;
      return participants.map((p, idx) => {
        // adjust rounding on last participant
        if (idx === participants.length - 1) {
          const othersSum = perPerson * (participants.length - 1);
          return { ...p, calculatedAmount: Math.round((totalAmount - othersSum) * 100) / 100 };
        }
        return { ...p, calculatedAmount: perPerson };
      });
    }

    if (splitMode === 'Exact') {
      return participants.map((p) => ({
        ...p,
        calculatedAmount: Math.round((p.val * taxTipMultiplier) * 100) / 100,
      }));
    }

    // Shares mode (weights)
    const totalWeight = participants.reduce((sum, p) => sum + (p.val > 0 ? p.val : 1), 0);
    return participants.map((p) => {
      const weight = p.val > 0 ? p.val : 1;
      const share = Math.round(((totalAmount * weight) / totalWeight) * 100) / 100;
      return { ...p, calculatedAmount: share };
    });
  }, [participants, totalAmount, splitMode, taxTipMultiplier]);

  const myShare = useMemo(() => {
    const me = computedParticipants.find((p) => p.isMe);
    return me ? me.calculatedAmount : 0;
  }, [computedParticipants]);

  const othersOwe = useMemo(() => {
    return computedParticipants
      .filter((p) => !p.isMe)
      .reduce((sum, p) => sum + p.calculatedAmount, 0);
  }, [computedParticipants]);

  // Active IOUs across all bill splits
  const activeIous = useMemo(() => {
    const ious: Array<{
      splitId: number;
      participantIndex: number;
      name: string;
      amount: number;
      description: string;
      date: string;
    }> = [];

    splits.forEach((s) => {
      if (Array.isArray(s.participants)) {
        s.participants.forEach((p, idx) => {
          if (!p.isMe && !p.settled) {
            const amt = Number(p.amount ?? p.share ?? 0);
            if (amt > 0) {
              ious.push({
                splitId: s.id,
                participantIndex: idx,
                name: p.name,
                amount: amt,
                description: s.description,
                date: s.date,
              });
            }
          }
        });
      }
    });

    return ious;
  }, [splits]);

  // Overall KPI stats
  const totalOwedToMe = useMemo(() => {
    return activeIous.reduce((sum, i) => sum + i.amount, 0);
  }, [activeIous]);

  const totalSplitSpend = useMemo(() => {
    return splits.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
  }, [splits]);

  // Add friend to participant list
  const handleAddParticipant = () => {
    setParticipants((prev) => [
      ...prev,
      { name: `Friend ${prev.length}`, isMe: false, val: splitMode === 'Shares' ? 1 : 0 },
    ]);
  };

  const handleRemoveParticipant = (index: number) => {
    if (participants[index].isMe || participants.length <= 2) return;
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleParticipantChange = (index: number, field: 'name' | 'val', val: any) => {
    setParticipants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  // Submit quick bill split
  const handleCreateSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return toast.error('Please enter a description');
    if (totalAmount <= 0) return toast.error('Please enter a valid bill amount');

    setIsSubmitting(true);
    try {
      const payloadParticipants = computedParticipants.map((p) => ({
        name: p.isMe ? 'Me' : p.name.trim() || 'Friend',
        isMe: p.isMe,
        amount: p.calculatedAmount,
        share: p.calculatedAmount,
        settled: p.isMe || !paidByMe,
      }));

      const res = await fetch('/api/bill-splits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          totalAmount,
          date: new Date().toISOString().split('T')[0],
          splitMode: splitMode === 'Exact' ? 'Custom' : splitMode,
          participants: payloadParticipants,
          accountId: paidByMe ? selectedAccountId : null,
          paidByMe,
          category,
        }),
      });

      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to create bill split');

      toast.success(
        `Split recorded! Your share: ${fmt(myShare)}. ${paidByMe ? `${fmt(othersOwe)} in receivables synced to personal ledger.` : 'Payable logged.'}`
      );

      // Reset form
      setDescription('');
      setBaseAmount('');
      setTaxTipPct(0);
      setParticipants([
        { name: 'Me', isMe: true, val: 0 },
        { name: 'Friend 1', isMe: false, val: 0 },
      ]);

      mutate();
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/accounts'));
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open settle IOU modal
  const handleOpenSettleModal = (iou: typeof activeIous[0]) => {
    setSettlingIou(iou);
    if (accounts && accounts.length > 0) {
      setDepositAccountId(accounts[0].id);
    } else {
      setDepositAccountId(null);
    }
  };

  // Confirm IOU payback
  const handleConfirmSettle = async () => {
    if (!settlingIou) return;
    setIsSettling(true);

    try {
      const res = await fetch('/api/bill-splits/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          splitId: settlingIou.splitId,
          participantIndex: settlingIou.participantIndex,
          accountId: depositAccountId,
          amount: settlingIou.amount,
        }),
      });

      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to settle IOU');

      toast.success(
        `Settled ${fmt(settlingIou.amount)} from ${settlingIou.name}! Funds credited to personal account.`
      );

      setSettlingIou(null);
      mutate();
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/accounts'));
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-24">
      <Toaster position="top-center" richColors />

      {/* Unified Collaborative Navigation Switcher */}
      <CollaborativeNavSwitcher />

      {/* Executive Header & KPI Strip */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400 mb-1">
            Fast Collaborative Finance
          </p>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Ad-Hoc Bill Splitter & IOU Tracker
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Split dinners, cabs, and shared expenses in under 15 seconds — auto-synced to your personal accounts
          </p>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Total Split Spend</p>
          <h3 className="text-xl sm:text-2xl font-black text-white font-mono mt-1 tabular-nums">
            {fmt(totalSplitSpend)}
          </h3>
          <p className="text-[10px] text-gray-500 mt-1">{splits.length} standalone splits logged</p>
        </div>

        <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-xl">
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400">You Are Owed (IOUs)</p>
          <h3 className="text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-1 tabular-nums">
            +{fmt(totalOwedToMe)}
          </h3>
          <p className="text-[10px] text-emerald-500/80 mt-1">{activeIous.length} pending repayments</p>
        </div>

        <div className="p-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] backdrop-blur-xl">
          <p className="text-[11px] font-black uppercase tracking-wider text-rose-400">Active IOUs Count</p>
          <h3 className="text-xl sm:text-2xl font-black text-rose-400 font-mono mt-1 tabular-nums">
            {activeIous.length}
          </h3>
          <p className="text-[10px] text-rose-400/80 mt-1">Pending settling</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <p className="text-[11px] font-black uppercase tracking-wider text-sky-400">Settled Clean</p>
          <h3 className="text-xl sm:text-2xl font-black text-sky-400 font-mono mt-1 tabular-nums">
            100%
          </h3>
          <p className="text-[10px] text-gray-400 mt-1">No ghost debts</p>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: 15-Second Quick Split Form */}
        <div className="lg:col-span-7 p-6 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[22px] text-amber-400">bolt</span>
              <h2 className="text-lg font-black text-white">Create Quick Split</h2>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              ⚡ Under 15 Seconds
            </span>
          </div>

          <form onSubmit={handleCreateSplit} className="space-y-4">
            {/* Amount & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                  Total Bill Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-xl font-black font-mono text-white outline-none focus:border-amber-400 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dinner at Gulshan, Taxi ride"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-sm font-bold text-white outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Tax & Tip Shortcuts */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                  Tax / Tip Percentage ({taxTipPct}%)
                </label>
                {taxTipPct > 0 && (
                  <span className="text-xs font-mono font-bold text-amber-400">
                    Gross Total: {fmt(totalAmount)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setTaxTipPct(pct)}
                    className={`py-2 text-xs font-black rounded-xl border transition-all ${
                      taxTipPct === pct
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-white/[0.02] border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    {pct === 0 ? 'No Tip' : `+${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Payer Toggle & Bank Account Selector */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block">
                Who Paid for This?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaidByMe(true)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paidByMe
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-white/5 bg-white/[0.02] text-gray-400'
                  }`}
                >
                  <p className="text-xs font-black">I Paid Out of Pocket</p>
                  <p className="text-[10px] text-gray-400">Others owe me their shares</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaidByMe(false)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    !paidByMe
                      ? 'border-rose-500 bg-rose-500/10 text-white'
                      : 'border-white/5 bg-white/[0.02] text-gray-400'
                  }`}
                >
                  <p className="text-xs font-black">A Friend Paid</p>
                  <p className="text-[10px] text-gray-400">I owe my share to friend</p>
                </button>
              </div>

              {paidByMe && (
                <div className="pt-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block mb-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">account_balance</span>
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
                        {acc.name} ({fmt(Number(acc.currentBalance ?? acc.balance ?? 0))}) • {acc.type}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Split Mode Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                  Split Mode
                </label>
                <button
                  type="button"
                  onClick={handleAddParticipant}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  Add Friend
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5">
                {(['Equal', 'Exact', 'Shares'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSplitMode(mode)}
                    className={`py-2 text-xs font-black rounded-lg transition-all ${
                      splitMode === mode
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {mode === 'Equal' ? '1. Equal' : mode === 'Exact' ? '2. Exact Itemized' : '3. Shares (1x, 2x)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Participant Breakdown List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {computedParticipants.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-white/5 bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-gray-400">
                      {p.isMe ? 'account_circle' : 'person'}
                    </span>
                    {p.isMe ? (
                      <span className="text-xs font-black text-white">You (Me)</span>
                    ) : (
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => handleParticipantChange(idx, 'name', e.target.value)}
                        placeholder="Friend Name"
                        className="w-full bg-transparent text-xs font-bold text-white outline-none border-b border-transparent focus:border-amber-400"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {splitMode !== 'Equal' && (
                      <div className="relative w-20">
                        <input
                          type="number"
                          step={splitMode === 'Exact' ? '0.01' : '1'}
                          min="0"
                          value={participants[idx]?.val || ''}
                          onChange={(e) => handleParticipantChange(idx, 'val', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full text-right pr-5 py-1 px-2 rounded-lg bg-white/[0.05] border border-white/10 text-xs font-mono font-bold text-white outline-none focus:border-amber-400"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">
                          {splitMode === 'Exact' ? '$' : 'x'}
                        </span>
                      </div>
                    )}

                    <span className="text-xs font-mono font-black text-amber-300 w-16 text-right tabular-nums">
                      {fmt(p.calculatedAmount)}
                    </span>

                    {!p.isMe && participants.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(idx)}
                        className="text-gray-500 hover:text-rose-400 transition-colors p-1"
                        title="Remove"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Live Personal Ledger Preview Pill */}
            {totalAmount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-center text-xs font-mono font-bold text-amber-300 space-y-0.5"
              >
                <p>
                  {paidByMe
                    ? `Account impact: -${fmt(totalAmount)} | Your personal budget share: -${fmt(myShare)} | Owed back to you: +${fmt(othersOwe)}`
                    : `Paid by Friend | Your personal budget share: -${fmt(myShare)} | You owe friend: -${fmt(myShare)}`}
                </p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || totalAmount <= 0}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span className="size-5 rounded-full border-2 border-slate-950/40 border-t-slate-950 animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">send</span>
                  Create Split & Record to Ledger
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Active IOUs (Who Owes Who) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-emerald-400">handshake</span>
                <h2 className="text-lg font-black text-white">Active IOUs (Who Owes Who)</h2>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                Total: +{fmt(totalOwedToMe)}
              </span>
            </div>

            {activeIous.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl space-y-2">
                <span className="material-symbols-outlined text-[36px] text-emerald-400">check_circle</span>
                <p className="text-sm font-bold text-white">All Square!</p>
                <p className="text-xs text-gray-400">No friends currently owe you money from bill splits.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {activeIous.map((iou, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{iou.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-wider">
                          Owes You
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[180px]">
                        {iou.description} • {iou.date}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-black font-mono text-emerald-400">
                        +{fmt(iou.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenSettleModal(iou)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">check</span>
                        Settle IOU
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Splits History */}
          <div className="p-6 rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-xl space-y-3">
            <h3 className="text-sm font-black text-gray-300 uppercase tracking-wider">
              Recent Bill Splits ({splits.length})
            </h3>
            {splits.length === 0 ? (
              <p className="text-xs text-gray-500">No past splits yet.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {splits.slice(0, 8).map((s) => (
                  <div key={s.id} className="p-2.5 rounded-xl border border-white/5 bg-white/[0.01] flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{s.description}</p>
                      <p className="text-[10px] text-gray-400">{s.date} • {s.splitMode}</p>
                    </div>
                    <span className="font-mono font-black text-gray-300">
                      {fmt(Number(s.totalAmount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settle IOU Confirmation Modal with Bank Account Selector */}
      <AnimatePresence>
        {settlingIou && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettlingIou(null)}
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
                    <span className="material-symbols-outlined text-[22px]">payments</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Settle Friend IOU</h3>
                    <p className="text-[11px] text-gray-400">Mark repaid and credit your personal bank account</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettlingIou(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-4 py-2">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Friend:</span>
                    <span className="font-bold text-white">{settlingIou.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Repayment Amount:</span>
                    <span className="font-black text-emerald-400 font-mono">
                      +{fmt(settlingIou.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">For Split:</span>
                    <span className="font-bold text-gray-300">{settlingIou.description}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-emerald-400 block mb-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">account_balance</span>
                    Deposit Funds Into My Account
                  </label>
                  <select
                    value={depositAccountId ?? ''}
                    onChange={(e) => setDepositAccountId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1e293b] border border-white/10 text-xs font-bold text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">Do not link personal account</option>
                    {accounts.map((acc: any) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({fmt(Number(acc.currentBalance ?? acc.balance ?? 0))}) • {acc.type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setSettlingIou(null)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSettle}
                  disabled={isSettling}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
                >
                  {isSettling ? (
                    <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Confirm Payback
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
