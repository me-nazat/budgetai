'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { getApiErrorMessage } from '@/lib/api-errors';
import {
  getCategoryHex,
  CUSTOM_COLORS,
  CUSTOM_CATEGORY_ICONS,
  getColorStyle,
  getIconCandidates,
  resolveIcon,
  resolveColor,
} from '@/lib/categoryUtils';
import { useHaptics } from '@/hooks/useHaptics';
import { useCurrency } from '@/hooks/useCurrency';
import { useAccounts } from '@/hooks/useApi';
import { CURRENCIES } from '@/lib/currency';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { mutate } from 'swr';

interface Participant {
  id: number;
  name: string;
  userId?: number | null;
}

export type EntryType = 'expense' | 'deposit' | 'settlement';
export type SplitType = 'equal' | 'exact' | 'percentage' | 'shares';
export type FundingSource = 'member_direct' | 'tour_pool';

interface TourAddCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  tourId: number;
  onSaveSuccess: () => void;
  currentUserId?: number;
  isCreator?: boolean;
  initialMode?: EntryType;
  initialPrefill?: {
    fromParticipantId?: number;
    toParticipantId?: number;
    amount?: number;
    description?: string;
    category?: string;
  } | null;
  kittyBalance?: number;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

interface CustomSplitRow {
  memberId: number;
  shareAmount?: number;
  sharePercentage?: number;
  shareWeight?: number;
}

export default function TourAddCostModal({
  isOpen,
  onClose,
  participants,
  tourId,
  onSaveSuccess,
  currentUserId,
  isCreator = false,
  initialMode = 'expense',
  initialPrefill,
  kittyBalance = 0,
}: TourAddCostModalProps) {
  const [mounted, setMounted] = useState(false);
  const [entryType, setEntryType] = useState<EntryType>(initialMode);
  const [fundingSource, setFundingSource] = useState<FundingSource>('member_direct');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Travel');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recipientMemberId, setRecipientMemberId] = useState<number>(0);
  const [selectedParticipants, setSelectedParticipants] = useState<Record<number, boolean>>({});

  const [paidBy, setPaidBy] = useState<number>(() => {
    if (currentUserId) {
      const match = participants.find((p) => p.userId === currentUserId);
      if (match) return match.id;
    }
    return participants[0]?.id ?? 0;
  });

  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [customSplits, setCustomSplits] = useState<Record<number, number>>({});
  const [includeInMainLedger, setIncludeInMainLedger] = useState(true);
  const [linkedAccountId, setLinkedAccountId] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);

  const haptics = useHaptics();
  const { currency, fmt } = useCurrency();
  const { accounts } = useAccounts();
  const { categories: customCategories } = useCustomCategories('expense');

  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Custom Category Creator states
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState(CUSTOM_CATEGORY_ICONS[0]);
  const [customColor, setCustomColor] = useState(CUSTOM_COLORS[0]);
  const [generatedIcons, setGeneratedIcons] = useState(CUSTOM_CATEGORY_ICONS.slice(0, 40));

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize or reset form on open
  useEffect(() => {
    if (isOpen) {
      const mode = initialMode || 'expense';
      setEntryType(mode);
      setFundingSource('member_direct');
      setSplitType('equal');

      // Initialize selected participants map
      const pMap: Record<number, boolean> = {};
      participants.forEach((p) => {
        pMap[p.id] = true;
      });
      setSelectedParticipants(pMap);

      if (initialPrefill) {
        setAmount(initialPrefill.amount ? initialPrefill.amount.toString() : '');
        setDescription(initialPrefill.description || '');
        if (initialPrefill.category) setCategory(initialPrefill.category);
        if (initialPrefill.fromParticipantId) setPaidBy(initialPrefill.fromParticipantId);
        if (initialPrefill.toParticipantId) setRecipientMemberId(initialPrefill.toParticipantId);
      } else {
        setAmount('');
        setDescription('');
        setCategory(mode === 'deposit' ? 'Kitty Deposit' : mode === 'settlement' ? 'Settlement' : 'Travel');
        const match = currentUserId ? participants.find((p) => p.userId === currentUserId) : null;
        setPaidBy(match ? match.id : (participants[0]?.id ?? 0));
        const otherP = participants.find((p) => p.id !== (match?.id ?? participants[0]?.id));
        setRecipientMemberId(otherP?.id ?? (participants[1]?.id || 0));
      }

      setDate(new Date().toISOString().split('T')[0]);
      setCustomSplits({});
      setIncludeInMainLedger(true);
      setLinkedAccountId(accounts && accounts.length > 0 ? accounts[0].id : null);
      setReceipt(null);
      setReceiptPreview(null);
      setIsCreatingCustom(false);
      setCustomName('');
      setError(null);
    }
  }, [isOpen, initialMode, initialPrefill, participants, currentUserId, accounts]);

  const allCategories = useMemo(() => {
    const base = [
      { label: 'Travel', icon: 'flight_takeoff', color: 'blue' },
      { label: 'Food', icon: 'restaurant', color: 'orange' },
      { label: 'Hotel', icon: 'hotel', color: 'indigo' },
      { label: 'Transport', icon: 'directions_car', color: 'emerald' },
      { label: 'Tickets', icon: 'local_activity', color: 'rose' },
      { label: 'Activities', icon: 'hiking', color: 'teal' },
      { label: 'Shopping', icon: 'shopping_bag', color: 'amber' },
      { label: 'Kitty Deposit', icon: 'savings', color: 'emerald' },
      { label: 'Settlement', icon: 'handshake', color: 'emerald' },
    ];
    const custom = customCategories.map((c) => ({
      label: c.name,
      icon: c.icon || 'label',
      color: c.color || 'gray',
    }));
    return [...base, ...custom];
  }, [customCategories]);

  // Amount parsing
  const amountNumber = useMemo(() => Number.parseFloat(amount), [amount]);

  // Active participants list
  const activeParticipants = useMemo(() => {
    return participants.filter((p) => selectedParticipants[p.id]);
  }, [participants, selectedParticipants]);

  // Live split validation calculation
  const customSplitSum = useMemo(() => {
    return activeParticipants.reduce((sum, p) => sum + (Number(customSplits[p.id]) || 0), 0);
  }, [activeParticipants, customSplits]);

  const splitRemainder = useMemo(() => {
    const total = amountNumber || 0;
    if (splitType === 'exact') {
      return Math.round((total - customSplitSum) * 100) / 100;
    }
    if (splitType === 'percentage') {
      return Math.round((100 - customSplitSum) * 100) / 100;
    }
    return 0;
  }, [splitType, amountNumber, customSplitSum]);

  const isSplitValid = useMemo(() => {
    if (entryType === 'deposit' || entryType === 'settlement') return true;
    if (activeParticipants.length === 0) return false;
    if (splitType === 'equal') return true;
    if (splitType === 'exact') {
      return Math.abs(splitRemainder) < 0.02;
    }
    if (splitType === 'percentage') {
      return Math.abs(splitRemainder) < 0.05;
    }
    if (splitType === 'shares') {
      return customSplitSum > 0;
    }
    return true;
  }, [entryType, activeParticipants.length, splitType, splitRemainder, customSplitSum]);

  const canSubmit =
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    (entryType === 'settlement' || description.trim().length > 0) &&
    (fundingSource === 'tour_pool' || paidBy > 0) &&
    (entryType !== 'settlement' || (recipientMemberId > 0 && recipientMemberId !== paidBy)) &&
    isSplitValid &&
    !isSubmitting;

  // Live accounting impact preview pill computation
  const accountingImpact = useMemo(() => {
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return null;

    const myParticipant = currentUserId ? participants.find((p) => p.userId === currentUserId) : null;
    const isPayerMe = fundingSource === 'member_direct' && myParticipant && paidBy === myParticipant.id;

    if (entryType === 'settlement') {
      const isRecipientMe = myParticipant && recipientMemberId === myParticipant.id;
      if (isPayerMe) {
        return {
          accountImpact: -amountNumber,
          personalBudgetShare: 0,
          netPosition: amountNumber, // paid back debt
          label: `Account impact: -${fmt(amountNumber)} | Personal budget share: 0 | Debt settled: ${fmt(amountNumber)}`,
        };
      }
      if (isRecipientMe) {
        return {
          accountImpact: +amountNumber,
          personalBudgetShare: 0,
          netPosition: -amountNumber,
          label: `Account impact: +${fmt(amountNumber)} | Personal budget share: 0 | Settlement received: +${fmt(amountNumber)}`,
        };
      }
      return null;
    }

    if (entryType === 'deposit') {
      if (isPayerMe) {
        return {
          accountImpact: -amountNumber,
          personalBudgetShare: 0,
          netPosition: amountNumber,
          label: `Account impact: -${fmt(amountNumber)} | Pool credit: +${fmt(amountNumber)} | Kitty funded`,
        };
      }
      return null;
    }

    // Expense mode:
    let myShare = 0;
    if (myParticipant && selectedParticipants[myParticipant.id]) {
      if (splitType === 'equal') {
        myShare = (amountNumber || 0) / (activeParticipants.length || 1);
      } else if (splitType === 'exact') {
        myShare = customSplits[myParticipant.id] || 0;
      } else if (splitType === 'percentage') {
        const pct = customSplits[myParticipant.id] || 0;
        myShare = ((amountNumber || 0) * pct) / 100;
      } else if (splitType === 'shares') {
        const myWeight = customSplits[myParticipant.id] || 0;
        const totalWeight = customSplitSum || 1;
        myShare = ((amountNumber || 0) * myWeight) / totalWeight;
      }
    }

    const accountOutflow = isPayerMe ? -amountNumber : 0;
    const lentToOthers = isPayerMe ? amountNumber - myShare : 0;
    const owedToPayer = !isPayerMe && fundingSource === 'member_direct' ? myShare : 0;

    return {
      accountImpact: accountOutflow,
      personalBudgetShare: myShare,
      lentToOthers,
      owedToPayer,
      label: isPayerMe
        ? `Account impact: -${fmt(amountNumber)} | Your budget share: -${fmt(myShare)} | Owed back to you: +${fmt(lentToOthers)}`
        : fundingSource === 'tour_pool'
        ? `Paid from Kitty: ${fmt(amountNumber)} | Your budget share: -${fmt(myShare)} | Out-of-pocket: 0`
        : `Paid by Member | Your budget share: -${fmt(myShare)} | You owe payer: -${fmt(owedToPayer)}`,
    };
  }, [
    amountNumber,
    entryType,
    fundingSource,
    paidBy,
    recipientMemberId,
    participants,
    currentUserId,
    selectedParticipants,
    splitType,
    activeParticipants.length,
    customSplits,
    customSplitSum,
    fmt,
  ]);

  // Receipt Preview
  useEffect(() => {
    if (!receipt) {
      setReceiptPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(receipt);
    setReceiptPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [receipt]);

  const closeModal = useCallback(() => {
    haptics.tap();
    onClose();
  }, [haptics, onClose]);

  // Distribute remainder helper
  const handleDistributeRemainder = () => {
    if (activeParticipants.length === 0) return;
    haptics.tap();

    if (splitType === 'exact') {
      const currentSum = activeParticipants.reduce((acc, p) => acc + (customSplits[p.id] || 0), 0);
      const remaining = Math.max(0, (amountNumber || 0) - currentSum);
      const perPerson = Math.round((remaining / activeParticipants.length) * 100) / 100;

      setCustomSplits((prev) => {
        const next = { ...prev };
        activeParticipants.forEach((p) => {
          next[p.id] = Math.round(((next[p.id] || 0) + perPerson) * 100) / 100;
        });
        return next;
      });
    } else if (splitType === 'percentage') {
      const currentSum = activeParticipants.reduce((acc, p) => acc + (customSplits[p.id] || 0), 0);
      const remaining = Math.max(0, 100 - currentSum);
      const perPerson = Math.floor(remaining / activeParticipants.length);

      setCustomSplits((prev) => {
        const next = { ...prev };
        activeParticipants.forEach((p) => {
          next[p.id] = (next[p.id] || 0) + perPerson;
        });
        return next;
      });
    }
  };

  // Toggle all participants
  const handleToggleAllParticipants = () => {
    haptics.tap();
    const allSelected = activeParticipants.length === participants.length;
    const nextMap: Record<number, boolean> = {};
    participants.forEach((p) => {
      nextMap[p.id] = !allSelected;
    });
    setSelectedParticipants(nextMap);
  };

  const handleCustomSplitChange = (memberId: number, valueStr: string) => {
    const num = parseFloat(valueStr) || 0;
    setCustomSplits((prev) => ({
      ...prev,
      [memberId]: num,
    }));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setError('Attachment must be an image or PDF file.');
        haptics.error();
        return;
      }
      setReceipt(file);
      setError(null);
      haptics.tap();
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || isSavingRef.current) return;

    isSavingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const swrKey = `/api/bill-splits/tours/${tourId}`;

    // Format custom splits
    let formattedCustomSplits: CustomSplitRow[] | undefined = undefined;
    if (entryType === 'expense' && splitType !== 'equal') {
      formattedCustomSplits = activeParticipants.map((p) => {
        const val = customSplits[p.id] || 0;
        return {
          memberId: p.id,
          shareAmount: splitType === 'exact' ? val : undefined,
          sharePercentage: splitType === 'percentage' ? val : undefined,
          shareWeight: splitType === 'shares' ? val : undefined,
        };
      });
    }

    const payerMember = participants.find((p) => p.id === paidBy);
    const recipientMember = participants.find((p) => p.id === recipientMemberId);
    const finalDescription =
      entryType === 'settlement'
        ? description.trim() || `Settlement: ${payerMember?.name || 'Member'} to ${recipientMember?.name || 'Member'}`
        : entryType === 'deposit'
        ? description.trim() || `Shared Kitty deposit by ${payerMember?.name || 'Member'}`
        : description.trim();

    try {
      const url = `/api/bill-splits/tours/${tourId}/spendings`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNumber,
          description: finalDescription,
          category:
            entryType === 'deposit' ? 'Kitty Deposit' : entryType === 'settlement' ? 'Settlement' : category.trim(),
          date,
          paidBy: fundingSource === 'tour_pool' ? (participants[0]?.id ?? 0) : paidBy,
          paidByParticipantId: fundingSource === 'tour_pool' ? (participants[0]?.id ?? 0) : paidBy,
          recipientMemberId: entryType === 'settlement' ? recipientMemberId : null,
          entryType,
          fundingSource: entryType === 'expense' ? fundingSource : 'member_direct',
          splitType: entryType === 'expense' ? splitType : 'equal',
          customSplits: formattedCustomSplits,
          includeInMainLedger,
          linkedAccountId: includeInMainLedger ? linkedAccountId : null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(getApiErrorMessage(data, 'Failed to save tour record.'));
      }

      // Upload receipt if attached
      if (data.transaction?.id && receipt) {
        const formData = new FormData();
        formData.append('attachments', receipt);
        await fetch(`/api/bill-splits/tours/${tourId}/spendings/${data.transaction.id}/attachments`, {
          method: 'POST',
          body: formData,
        });
      }

      await mutate(swrKey);
      await mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
      await mutate((key) => typeof key === 'string' && key.startsWith('/api/accounts'));

      haptics.success();
      onSaveSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tour entry.');
      haptics.error();
      await mutate(swrKey);
    } finally {
      isSavingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const symbol = CURRENCIES[currency]?.symbol ?? '$';

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.98 }}
            transition={spring}
            className="relative z-50 max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-[2rem] border border-white/10 bg-[#0f172a] shadow-2xl backdrop-blur-xl ring-1 ring-white/10"
          >
            <div className="p-5 sm:p-6 space-y-5">
              {/* Top Modal Header */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                    Tour Collaborative Ledger
                  </p>
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    {entryType === 'expense'
                      ? 'Add Group Expense'
                      : entryType === 'deposit'
                      ? 'Deposit to Shared Kitty'
                      : 'Record Debt Settlement'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* 1. Entry Type Segmented Control */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/[0.03] border border-white/10 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setEntryType('expense');
                    setCategory('Travel');
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                    entryType === 'expense' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">receipt_long</span>
                  Expense
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEntryType('deposit');
                    setFundingSource('member_direct');
                    setCategory('Kitty Deposit');
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                    entryType === 'deposit' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">savings</span>
                  Kitty Deposit
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEntryType('settlement');
                    setFundingSource('member_direct');
                    setCategory('Settlement');
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                    entryType === 'settlement' ? 'bg-sky-500 text-white shadow-md' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">handshake</span>
                  Settle Debt
                </button>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs font-bold text-rose-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* SETTLEMENT FLOW SELECTOR */}
                {entryType === 'settlement' ? (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                        Payer (Who Paid)
                      </label>
                      <select
                        value={paidBy}
                        onChange={(e) => setPaidBy(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-[#1e293b] px-3 py-2 text-xs font-bold text-white outline-none focus:border-sky-500"
                      >
                        {participants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-center pt-5 text-sky-400">
                      <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </div>

                    <div>
                      <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                        Recipient (Paid To)
                      </label>
                      <select
                        value={recipientMemberId}
                        onChange={(e) => setRecipientMemberId(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-[#1e293b] px-3 py-2 text-xs font-bold text-white outline-none focus:border-sky-500"
                      >
                        {participants.map((p) => (
                          <option key={p.id} value={p.id} disabled={p.id === paidBy}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  /* 2. FUNDING SOURCE TOGGLE (Expense mode) */
                  entryType === 'expense' && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-2">
                        Funding Source
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFundingSource('member_direct')}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                            fundingSource === 'member_direct'
                              ? 'border-primary bg-primary/10 text-white'
                              : 'border-white/5 bg-white/[0.02] text-gray-400 hover:text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                          <div>
                            <p className="text-xs font-bold">Individual Member</p>
                            <p className="text-[10px] text-gray-400">Paid out of personal pocket</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFundingSource('tour_pool')}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                            fundingSource === 'tour_pool'
                              ? 'border-emerald-500 bg-emerald-500/10 text-white'
                              : 'border-white/5 bg-white/[0.02] text-gray-400 hover:text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px] text-emerald-400">savings</span>
                          <div>
                            <p className="text-xs font-bold">Shared Tour Kitty</p>
                            <p className="text-[10px] text-emerald-400 font-mono">
                              Pool Available: {fmt(kittyBalance)}
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )
                )}

                {/* Amount and Date */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-400">Amount</label>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-gray-400">
                        {symbol}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pr-4 font-mono text-2xl font-black tabular-nums text-white outline-none focus:border-primary"
                        style={{ paddingLeft: `${symbol.length * 0.75 + 1.5}rem` }}
                        placeholder="0.00"
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
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-bold text-white outline-none [color-scheme:dark] focus:border-primary"
                      required
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-gray-600 focus:border-primary"
                    placeholder={
                      entryType === 'deposit'
                        ? 'e.g. Initial kitty pool deposit'
                        : entryType === 'settlement'
                        ? 'e.g. Paid debt for hotel share'
                        : 'Dinner at harbor, speed boat rent, park tickets...'
                    }
                    required={entryType !== 'settlement'}
                  />
                </div>

                {/* Category & Payer in Expense Mode */}
                {entryType === 'expense' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-[#1e293b] px-4 py-3 text-xs font-bold text-white outline-none focus:border-primary"
                      >
                        {allCategories.map((c) => (
                          <option key={c.label} value={c.label}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                        {fundingSource === 'tour_pool' ? 'Payer Source' : 'Paid By'}
                      </label>
                      {fundingSource === 'tour_pool' ? (
                        <div className="mt-1 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-400">
                          <span className="material-symbols-outlined text-[18px]">savings</span>
                          Shared Tour Kitty
                        </div>
                      ) : (
                        <select
                          value={paidBy}
                          onChange={(e) => setPaidBy(Number(e.target.value))}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-[#1e293b] px-4 py-3 text-xs font-bold text-white outline-none focus:border-primary"
                        >
                          {participants.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. INTERACTIVE 4-MODE SPLIT SELECTOR (Expense Mode Only) */}
                {entryType === 'expense' && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                        Split Among Travellers
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleAllParticipants}
                        className="text-[11px] font-bold text-gray-400 hover:text-white transition-colors"
                      >
                        {activeParticipants.length === participants.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {/* 4 Tabs Split Mode */}
                    <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
                      {[
                        { id: 'equal', label: 'Equal' },
                        { id: 'exact', label: 'Exact ($)' },
                        { id: 'percentage', label: 'Percent (%)' },
                        { id: 'shares', label: 'Shares (x:y)' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setSplitType(tab.id as SplitType);
                            if (tab.id === 'percentage') {
                              const pct = Math.floor(100 / (activeParticipants.length || 1));
                              const map: Record<number, number> = {};
                              activeParticipants.forEach((p) => {
                                map[p.id] = pct;
                              });
                              setCustomSplits(map);
                            } else if (tab.id === 'exact') {
                              const share =
                                Math.round(((amountNumber || 0) / (activeParticipants.length || 1)) * 100) / 100;
                              const map: Record<number, number> = {};
                              activeParticipants.forEach((p) => {
                                map[p.id] = share;
                              });
                              setCustomSplits(map);
                            } else if (tab.id === 'shares') {
                              const map: Record<number, number> = {};
                              activeParticipants.forEach((p) => {
                                map[p.id] = 1;
                              });
                              setCustomSplits(map);
                            }
                          }}
                          className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                            splitType === tab.id ? 'bg-emerald-500 text-white font-black' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Live Validation Bar for Exact and Percentage */}
                    {(splitType === 'exact' || splitType === 'percentage') && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-black/30 text-xs">
                        <span className="font-mono text-gray-400">
                          {splitType === 'exact'
                            ? `Assigned: ${fmt(customSplitSum)} of ${fmt(amountNumber || 0)}`
                            : `Assigned: ${customSplitSum.toFixed(1)}% of 100%`}
                          <span
                            className={`ml-2 font-bold ${
                              Math.abs(splitRemainder) < 0.02 ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            (Remaining: {splitType === 'exact' ? fmt(splitRemainder) : `${splitRemainder}%`})
                          </span>
                        </span>

                        {Math.abs(splitRemainder) >= 0.02 && (
                          <button
                            type="button"
                            onClick={handleDistributeRemainder}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-[10px] hover:bg-emerald-500/30 transition-colors"
                          >
                            Distribute remainder equally
                          </button>
                        )}
                      </div>
                    )}

                    {/* Participants List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {participants.map((p) => {
                        const isSelected = selectedParticipants[p.id];
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between gap-2 p-2 rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-[#1e293b] border-white/10'
                                : 'bg-black/20 border-white/5 opacity-50'
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={!!isSelected}
                                onChange={(e) =>
                                  setSelectedParticipants((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.checked,
                                  }))
                                }
                                className="size-4 rounded border-white/20 bg-slate-900 text-emerald-500 accent-emerald-500"
                              />
                              <span className="text-xs font-bold text-white truncate">{p.name}</span>
                            </label>

                            {/* Split input if custom mode */}
                            {isSelected && splitType !== 'equal' && (
                              <div className="relative w-24 shrink-0">
                                <input
                                  type="number"
                                  step={splitType === 'exact' ? '0.01' : splitType === 'percentage' ? '1' : '0.1'}
                                  min="0"
                                  value={customSplits[p.id] ?? ''}
                                  onChange={(e) => handleCustomSplitChange(p.id, e.target.value)}
                                  placeholder="0"
                                  className="w-full text-right pr-5 py-1 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-mono font-bold text-white outline-none focus:border-emerald-500"
                                />
                                <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">
                                  {splitType === 'exact' ? symbol : splitType === 'percentage' ? '%' : 'x'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PERSONAL BANK ACCOUNT LINKING (If user paid or settlement) */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">account_balance</span>
                      Deduct from My Account
                    </label>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                      Double-Entry Bridge
                    </span>
                  </div>
                  <select
                    value={linkedAccountId ?? ''}
                    onChange={(e) => setLinkedAccountId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-xl border border-white/10 bg-[#1e293b] px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">Do not link to personal account</option>
                    {accounts.map((acc: any) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({fmt(acc.currentBalance ?? acc.balance ?? 0)}) • {acc.type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Receipt Upload */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-left hover:bg-white/[0.04] transition-colors flex items-center gap-3"
                  >
                    {receipt ? (
                      <>
                        <span className="material-symbols-outlined text-emerald-400 text-xl">description</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{receipt.name}</p>
                          <p className="text-[10px] text-gray-400">Proof attached</p>
                        </div>
                        <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-gray-400 text-xl">cloud_upload</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-300">Attach Receipt / Ticket</p>
                          <p className="text-[10px] text-gray-500">Image or PDF proof</p>
                        </div>
                      </>
                    )}
                  </button>
                </div>

                {/* 4. LIVE ACCOUNTING PREVIEW PILL */}
                {accountingImpact && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5"
                  >
                    <span className="material-symbols-outlined text-emerald-400 text-[18px] shrink-0">
                      account_balance_wallet
                    </span>
                    <p className="text-xs font-mono font-bold text-emerald-300 truncate">
                      {accountingImpact.label}
                    </p>
                  </motion.div>
                )}

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  whileTap={canSubmit ? { scale: 0.98 } : undefined}
                  className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">
                        {entryType === 'deposit' ? 'savings' : entryType === 'settlement' ? 'handshake' : 'add_card'}
                      </span>
                      {entryType === 'deposit'
                        ? 'Confirm Kitty Deposit'
                        : entryType === 'settlement'
                        ? 'Confirm Debt Settlement'
                        : 'Save Expense to Tour'}
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
