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

interface TourTransaction {
  id: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  paidByParticipantId?: number;
  paidBy: number;
  splitType: string;
  fundingSource?: 'member_direct' | 'tour_pool';
  linkedAccountId?: number | null;
  splitBreakdown?: any[];
  paidByName?: string | null;
  createdByName?: string | null;
}

interface TourEditCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  tourId: number;
  onSaveSuccess: () => void;
  currentUserId?: number;
  isCreator?: boolean;
  transaction: TourTransaction | null;
  kittyBalance?: number;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };
type SplitType = 'equal' | 'percentage' | 'exact' | 'shares';
type FundingSource = 'member_direct' | 'tour_pool';

interface CustomSplitRow {
  memberId: number;
  shareAmount?: number;
  sharePercentage?: number;
  shareWeight?: number;
}

export default function TourEditCostModal({
  isOpen,
  onClose,
  participants,
  tourId,
  onSaveSuccess,
  currentUserId,
  isCreator = false,
  transaction,
  kittyBalance = 0,
}: TourEditCostModalProps) {
  const [mounted, setMounted] = useState(false);
  const [fundingSource, setFundingSource] = useState<FundingSource>('member_direct');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Travel');
  const [date, setDate] = useState('');
  const [paidBy, setPaidBy] = useState<number>(0);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [selectedParticipants, setSelectedParticipants] = useState<Record<number, boolean>>({});
  const [customSplits, setCustomSplits] = useState<Record<number, number>>({});
  const [linkedAccountId, setLinkedAccountId] = useState<number | null>(null);

  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSavingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isOpen && transaction) {
      setAmount(transaction.amount.toString());
      setDescription(transaction.description);
      setCategory(transaction.category);
      setDate(transaction.date);
      setPaidBy(transaction.paidByParticipantId ?? transaction.paidBy ?? participants[0]?.id ?? 0);
      setFundingSource(transaction.fundingSource || 'member_direct');
      setSplitType((transaction.splitType as SplitType) || 'equal');
      setLinkedAccountId(transaction.linkedAccountId ?? null);

      const pMap: Record<number, boolean> = {};
      const splitMap: Record<number, number> = {};

      if (Array.isArray(transaction.splitBreakdown) && transaction.splitBreakdown.length > 0) {
        participants.forEach((p) => {
          const match = transaction.splitBreakdown?.find((item: any) => (item.memberId ?? item.id) === p.id);
          pMap[p.id] = !!match;
          if (match) {
            splitMap[p.id] = match.shareAmount ?? match.sharePercentage ?? match.shareWeight ?? match.amount ?? 0;
          }
        });
      } else {
        participants.forEach((p) => {
          pMap[p.id] = true;
        });
      }

      setSelectedParticipants(pMap);
      setCustomSplits(splitMap);
      setReceipt(null);
      setReceiptPreview(null);
      setIsCreatingCustom(false);
      setCustomName('');
      setError(null);
    }
  }, [isOpen, transaction, participants]);

  const allCategories = useMemo(() => {
    const base = [
      { label: 'Travel', icon: 'flight_takeoff', color: 'blue' },
      { label: 'Food', icon: 'restaurant', color: 'orange' },
      { label: 'Hotel', icon: 'hotel', color: 'emerald' },
      { label: 'Transport', icon: 'directions_car', color: 'emerald' },
      { label: 'Tickets', icon: 'local_activity', color: 'rose' },
      { label: 'Shopping', icon: 'shopping_bag', color: 'amber' },
      { label: 'Kitty Deposit', icon: 'savings', color: 'emerald' },
    ];
    const custom = customCategories.map((c) => ({
      label: c.name,
      icon: c.icon || 'label',
      color: c.color || 'gray',
    }));
    return [...base, ...custom];
  }, [customCategories]);

  useEffect(() => {
    if (customName.trim()) {
      const suggestedIcon = resolveIcon(customName);
      const suggestedColor = resolveColor(customName);
      setCustomIcon(suggestedIcon);
      setCustomColor(suggestedColor);
      setGeneratedIcons(getIconCandidates(customName));
    }
  }, [customName]);

  const amountNumber = useMemo(() => Number.parseFloat(amount), [amount]);

  const activeParticipants = useMemo(() => {
    return participants.filter((p) => selectedParticipants[p.id]);
  }, [participants, selectedParticipants]);

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
  }, [activeParticipants.length, splitType, splitRemainder, customSplitSum]);

  const canSubmit =
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    description.trim().length > 0 &&
    (fundingSource === 'tour_pool' || paidBy > 0) &&
    isSplitValid &&
    !isSubmitting;

  // Live accounting impact preview pill computation
  const accountingImpact = useMemo(() => {
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return null;

    const myParticipant = currentUserId ? participants.find((p) => p.userId === currentUserId) : null;
    const isPayerMe = fundingSource === 'member_direct' && myParticipant && paidBy === myParticipant.id;

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
        ? `Account impact: -${fmt(amountNumber)} | Your personal budget share: -${fmt(myShare)} | Owed back to you: +${fmt(lentToOthers)}`
        : fundingSource === 'tour_pool'
        ? `Paid from Kitty: ${fmt(amountNumber)} | Your personal budget share: -${fmt(myShare)} | Out-of-pocket: 0`
        : `Paid by Member | Your personal budget share: -${fmt(myShare)} | You owe payer: -${fmt(owedToPayer)}`,
    };
  }, [
    amountNumber,
    fundingSource,
    paidBy,
    participants,
    currentUserId,
    selectedParticipants,
    splitType,
    activeParticipants.length,
    customSplits,
    customSplitSum,
    fmt,
  ]);

  // Handle receipt selection
  const handleReceiptChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Attachment exceeds maximum limit of 10MB.');
        return;
      }
      setReceipt(file);
      const url = URL.createObjectURL(file);
      setReceiptPreview(url);
    }
  };

  const closeModal = useCallback(() => {
    haptics.tap();
    onClose();
  }, [haptics, onClose]);

  const handleCustomSplitChange = (memberId: number, valueStr: string) => {
    const num = parseFloat(valueStr) || 0;
    setCustomSplits((prev) => ({
      ...prev,
      [memberId]: num,
    }));
  };

  // Remainder distributor helper
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

  const handleToggleAllParticipants = () => {
    haptics.tap();
    const allSelected = activeParticipants.length === participants.length;
    const nextMap: Record<number, boolean> = {};
    participants.forEach((p) => {
      nextMap[p.id] = !allSelected;
    });
    setSelectedParticipants(nextMap);
  };

  const handleSaveCustomCategory = async () => {
    const trimmedName = customName.trim().replace(/\s+/g, ' ');
    if (!trimmedName || isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          type: 'expense',
          icon: customIcon,
          color: customColor,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await mutate((key) => typeof key === 'string' && key.startsWith('/api/categories'));
        setCategory(data.name || trimmedName);
        setIsCreatingCustom(false);
        setCustomName('');
      } else if (data.error === 'Category already exists') {
        await fetch('/api/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedName, type: 'expense', icon: customIcon, color: customColor }),
        });
        await mutate((key) => typeof key === 'string' && key.startsWith('/api/categories'));
        setCategory(trimmedName);
        setIsCreatingCustom(false);
        setCustomName('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      isSavingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !transaction || isSavingRef.current) return;

    isSavingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const amountNum = amountNumber;
    const txId = transaction.id;
    const swrKey = `/api/bill-splits/tours/${tourId}`;

    let formattedCustomSplits: CustomSplitRow[] | undefined = undefined;
    if (splitType !== 'equal') {
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

    try {
      const url = `/api/bill-splits/tours/${tourId}/spendings/${txId}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          description: description.trim(),
          category: category.trim() || 'Travel',
          date,
          paidBy: fundingSource === 'tour_pool' ? (participants[0]?.id ?? 0) : paidBy,
          paidByParticipantId: fundingSource === 'tour_pool' ? (participants[0]?.id ?? 0) : paidBy,
          fundingSource,
          splitType,
          customSplits: formattedCustomSplits,
          linkedAccountId: linkedAccountId,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(getApiErrorMessage(data, 'Failed to save changes.'));
      }

      // If a new receipt was uploaded, send it to attachment API
      if (receipt) {
        const formData = new FormData();
        formData.append('file', receipt);
        formData.append('title', description.trim() || 'Receipt');
        await fetch(`/api/bill-splits/tours/${tourId}/spendings/${txId}/attachments`, {
          method: 'POST',
          body: formData,
        }).catch((e) => console.error('Attachment upload warning:', e));
      }

      await mutate(swrKey);
      await mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
      await mutate((key) => typeof key === 'string' && key.startsWith('/api/accounts'));

      haptics.success();
      onSaveSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update this cost.');
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
            aria-labelledby="tour-edit-cost-title"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.98 }}
            transition={spring}
            className="relative z-50 max-h-[88dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-[2rem] border border-white/10 bg-[#0f172a] shadow-2xl backdrop-blur-xl ring-1 ring-white/10"
          >
            <div className="p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                    {isCreatingCustom ? 'Custom Category' : 'Edit Collaborative Expense'}
                  </p>
                  <h2 id="tour-edit-cost-title" className="mt-1 text-2xl font-black tracking-tight text-white">
                    {isCreatingCustom ? 'Create New Category' : 'Edit Cost & Allocation'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => (isCreatingCustom ? setIsCreatingCustom(false) : closeModal())}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isCreatingCustom ? 'arrow_back' : 'close'}
                  </span>
                </button>
              </div>

              {isCreatingCustom ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                      Category Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="e.g. Fuel, Ferry Tickets"
                        className="w-full pl-12 pr-4 py-3.5 text-base font-bold text-white bg-white/[0.04] border border-white/10 rounded-2xl outline-none focus:border-emerald-500"
                        autoFocus
                      />
                      <div
                        className={`absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          customName.trim() ? getColorStyle(customColor).bg : 'bg-white/[0.08]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-white text-[16px]">
                          {customName.trim() ? customIcon : 'edit'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Color</label>
                    <div className="flex flex-wrap gap-2.5">
                      {CUSTOM_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setCustomColor(color)}
                          className={`w-8 h-8 rounded-full ${getColorStyle(color).bg} flex items-center justify-center transition-all ${
                            customColor === color
                              ? 'ring-2 ring-offset-2 ring-offset-black ring-white scale-110'
                              : 'hover:scale-110'
                          }`}
                        >
                          {customColor === color && (
                            <span className="material-symbols-outlined text-white text-[16px]">check</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCustomCategory}
                    disabled={isSubmitting || !customName.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 font-black text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Save Category'
                    )}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Funding Source Selector */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-2">
                      Payment Funding Source
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFundingSource('member_direct')}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                          fundingSource === 'member_direct'
                            ? 'border-emerald-500 bg-emerald-500/10 text-white'
                            : 'border-white/5 bg-white/[0.02] text-gray-400 hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-emerald-400">person</span>
                        <div>
                          <p className="text-xs font-bold leading-tight">Member Direct</p>
                          <p className="text-[10px] text-gray-400">Paid out of pocket</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFundingSource('tour_pool')}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                          fundingSource === 'tour_pool'
                            ? 'border-sky-500 bg-sky-500/10 text-white'
                            : 'border-white/5 bg-white/[0.02] text-gray-400 hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-sky-400">savings</span>
                        <div>
                          <p className="text-xs font-bold leading-tight">Shared Kitty Pool</p>
                          <p className="text-[10px] text-gray-400">Pool balance: {fmt(kittyBalance)}</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Amount and Date */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                    <div>
                      <label htmlFor="edit-cost-amount" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                        Total Amount
                      </label>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-gray-500">
                          {symbol}
                        </span>
                        <input
                          id="edit-cost-amount"
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pr-4 font-mono text-2xl font-black tabular-nums text-white outline-none focus:border-emerald-500"
                          style={{ paddingLeft: `${symbol.length * 0.75 + 1.5}rem` }}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="edit-cost-date" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                        Date
                      </label>
                      <input
                        id="edit-cost-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-bold text-white outline-none [color-scheme:dark] focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="edit-cost-description" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                      Description
                    </label>
                    <input
                      id="edit-cost-description"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Scuba diving gear rental"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  {/* Category & Payer */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="edit-cost-category" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                        Category
                      </label>
                      <div className="relative">
                        <input
                          id="edit-cost-category"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          onFocus={() => setShowCategoryDropdown(true)}
                          onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500"
                          placeholder="Travel"
                          autoComplete="off"
                        />
                        {showCategoryDropdown && (
                          <div className="absolute z-[110] mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#111827] shadow-2xl p-1 flex flex-col gap-0.5 custom-scrollbar">
                            {allCategories.map((c) => (
                              <button
                                key={c.label}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setCategory(c.label);
                                  setShowCategoryDropdown(false);
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2 hover:bg-white/5 rounded-lg text-left transition-colors"
                              >
                                <span
                                  className="h-3 w-3 rounded-full shrink-0"
                                  style={{ backgroundColor: getCategoryHex(c.label, customCategories) }}
                                />
                                <span className="text-sm font-semibold text-gray-200 truncate">{c.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="edit-cost-paid-by" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                        {fundingSource === 'tour_pool' ? 'Payer Source' : 'Who Paid?'}
                      </label>
                      {fundingSource === 'tour_pool' ? (
                        <div className="mt-1 flex items-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-bold text-sky-400">
                          <span className="material-symbols-outlined text-[18px]">savings</span>
                          Shared Tour Kitty
                        </div>
                      ) : (
                        <select
                          id="edit-cost-paid-by"
                          value={paidBy}
                          onChange={(e) => setPaidBy(Number(e.target.value))}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500"
                        >
                          {participants.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.userId === currentUserId ? '(You)' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* 4-Mode Split Selector Tabs */}
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                        Split Mode
                      </label>
                      <button
                        type="button"
                        onClick={handleToggleAllParticipants}
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        {activeParticipants.length === participants.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-black/30 p-1 border border-white/5">
                      {(['equal', 'exact', 'percentage', 'shares'] as SplitType[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setSplitType(mode)}
                          className={`rounded-lg py-2 text-xs font-black transition-all capitalize ${
                            splitType === mode
                              ? 'bg-emerald-600 text-white shadow-md'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {mode === 'equal' ? 'Equal' : mode === 'exact' ? 'Exact ($)' : mode === 'percentage' ? '% Split' : 'Shares'}
                        </button>
                      ))}
                    </div>

                    {/* Participant selector checklist */}
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {participants.map((p) => {
                          const isSelected = !!selectedParticipants[p.id];
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                isSelected
                                  ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
                                  : 'border-white/5 bg-white/[0.01] opacity-60'
                              }`}
                            >
                              <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    setSelectedParticipants((prev) => ({
                                      ...prev,
                                      [p.id]: !prev[p.id],
                                    }))
                                  }
                                  className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                                />
                                <span className="text-xs font-bold text-white truncate">
                                  {p.name} {p.userId === currentUserId ? '(You)' : ''}
                                </span>
                              </label>

                              {isSelected && splitType !== 'equal' && (
                                <div className="relative w-24 shrink-0">
                                  <input
                                    type="number"
                                    step={splitType === 'exact' ? '0.01' : splitType === 'percentage' ? '1' : '0.1'}
                                    min="0"
                                    value={customSplits[p.id] ?? ''}
                                    onChange={(e) => handleCustomSplitChange(p.id, e.target.value)}
                                    placeholder="0"
                                    className="w-full text-right pr-5 py-1 px-2 rounded-lg bg-white/[0.06] border border-white/10 text-xs font-mono font-bold text-white outline-none focus:border-emerald-500"
                                  />
                                  <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">
                                    {splitType === 'exact' ? symbol : splitType === 'percentage' ? '%' : 'sh'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Split validation bar & remainder helper */}
                      {splitType !== 'equal' && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
                          <span
                            className={`font-mono font-bold ${
                              isSplitValid ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {splitType === 'exact' &&
                              `Allocated: ${fmt(customSplitSum)} of ${fmt(amountNumber || 0)} (Remaining: ${fmt(
                                splitRemainder
                              )})`}
                            {splitType === 'percentage' &&
                              `Allocated: ${customSplitSum.toFixed(1)}% of 100% (Remaining: ${splitRemainder.toFixed(
                                1
                              )}%)`}
                            {splitType === 'shares' && `Total shares: ${customSplitSum}x`}
                          </span>

                          {(splitType === 'exact' || splitType === 'percentage') && Math.abs(splitRemainder) > 0.01 && (
                            <button
                              type="button"
                              onClick={handleDistributeRemainder}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500/30 transition-colors"
                            >
                              Distribute remainder equally
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Personal Bank Account Sync */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">account_balance</span>
                      Deduct from My Personal Account
                    </label>
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

                  {/* Receipt & Attachment */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                        Attach New Receipt / Bill (Image or PDF)
                      </label>
                      {receipt && (
                        <button
                          type="button"
                          onClick={() => {
                            setReceipt(null);
                            setReceiptPreview(null);
                          }}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleReceiptChange}
                      className="hidden"
                    />

                    {receiptPreview ? (
                      <div className="relative h-24 w-full rounded-xl overflow-hidden border border-white/10 bg-black/40">
                        <Image
                          src={receiptPreview}
                          alt="Receipt Preview"
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 rounded-xl border border-dashed border-white/20 hover:border-emerald-500/50 hover:bg-emerald-500/[0.03] text-xs font-bold text-gray-400 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">upload_file</span>
                        {receipt ? receipt.name : 'Upload Receipt / Proof'}
                      </button>
                    )}
                  </div>

                  {/* Live Accounting Preview Pill */}
                  {accountingImpact && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-2.5 text-center text-xs font-mono font-bold text-emerald-300 shadow-inner"
                    >
                      {accountingImpact.label}
                    </motion.div>
                  )}

                  {error && (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300">
                      {error}
                    </div>
                  )}

                  <motion.button
                    type="submit"
                    disabled={!canSubmit}
                    whileTap={canSubmit ? { scale: 0.98 } : undefined}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none transition-all"
                  >
                    {isSubmitting ? (
                      <span className="size-5 rounded-full border-2 border-white/35 border-t-white animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[20px]">save</span>
                        Save Changes
                      </>
                    )}
                  </motion.button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
