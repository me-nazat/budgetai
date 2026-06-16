'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getApiErrorMessage } from '@/lib/api-errors';
import {
  getCategoryHex,
  CUSTOM_COLORS,
  CUSTOM_CATEGORY_ICONS,
  getColorStyle,
  getIconCandidates,
  resolveIcon,
  resolveColor
} from '@/lib/categoryUtils';
import { useHaptics } from '@/hooks/useHaptics';
import { useCurrency } from '@/hooks/useCurrency';
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
  paidByName?: string | null;
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
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };
type SplitType = 'equal' | 'percentage' | 'exact';

export default function TourEditCostModal({
  isOpen,
  onClose,
  participants,
  tourId,
  onSaveSuccess,
  currentUserId,
  isCreator = false,
  transaction,
}: TourEditCostModalProps) {
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Travel');
  const [date, setDate] = useState('');
  const [paidBy, setPaidBy] = useState<number>(0);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const haptics = useHaptics();
  const { currency, fmt } = useCurrency();
  const { categories: customCategories } = useCustomCategories('expense');

  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Custom Category Creator states
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState(CUSTOM_CATEGORY_ICONS[0]);
  const [customColor, setCustomColor] = useState(CUSTOM_COLORS[0]);
  const [generatedIcons, setGeneratedIcons] = useState(CUSTOM_CATEGORY_ICONS.slice(0, 40));

  const isPaidByLocked = false; // Allow any participant to change the paid by field

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
      setSplitType(transaction.splitType as SplitType);
      setIsCreatingCustom(false);
      setCustomName('');
      setError(null);
    }
  }, [isOpen, transaction, participants]);

  const allCategories = useMemo(() => {
    const base = [
      { label: 'Travel', icon: 'flight_takeoff', color: 'blue' },
      { label: 'Food', icon: 'restaurant', color: 'orange' },
      { label: 'Hotel', icon: 'hotel', color: 'indigo' },
      { label: 'Transport', icon: 'directions_car', color: 'emerald' },
      { label: 'Tickets', icon: 'local_activity', color: 'rose' }
    ];
    const custom = customCategories.map(c => ({
      label: c.name,
      icon: c.icon || 'label',
      color: c.color || 'gray'
    }));
    return [...base, ...custom];
  }, [customCategories]);

  // Smart auto-resolve custom category icons & colors
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
  const canSubmit = Number.isFinite(amountNumber) && amountNumber > 0 && description.trim().length > 0 && paidBy > 0 && !isSubmitting;

  const reset = useCallback(() => {
    setAmount('');
    setDescription('');
    setCategory('Travel');
    setDate(new Date().toISOString().split('T')[0]);
    setError(null);
    setIsCreatingCustom(false);
    setCustomName('');
  }, []);

  const closeModal = useCallback(() => {
    haptics.tap();
    onClose();
  }, [haptics, onClose]);

  const handleSaveCustomCategory = async () => {
    const trimmedName = customName.trim().replace(/\s+/g, ' ');
    if (!trimmedName) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          type: 'expense',
          icon: customIcon,
          color: customColor
        })
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
          body: JSON.stringify({ name: trimmedName, type: 'expense', icon: customIcon, color: customColor })
        });
        await mutate((key) => typeof key === 'string' && key.startsWith('/api/categories'));
        setCategory(trimmedName);
        setIsCreatingCustom(false);
        setCustomName('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !transaction) return;

    setIsSubmitting(true);
    setError(null);

    const amountNum = amountNumber;
    const txId = transaction.id;
    const swrKey = `/api/bill-splits/tours/${tourId}`;

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
          paidBy,
          paidByParticipantId: paidBy,
          splitType,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(getApiErrorMessage(data, 'Failed to save changes.'));
      }

      haptics.success();
      onSaveSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update this cost.');
      haptics.error();
      mutate(swrKey);
    } finally {
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
            className="relative z-50 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-background/95 shadow-2xl backdrop-blur-xl sm:rounded-[2rem] ring-1 ring-white/10"
          >
            <div className="p-5 sm:p-6">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                    {isCreatingCustom ? 'Custom Category' : 'Your Ledger: Update Cost'}
                  </p>
                  <h2 id="tour-edit-cost-title" className="mt-1 text-2xl font-black tracking-tight text-white">
                    {isCreatingCustom ? 'Create New Category' : 'Edit Cost'}
                  </h2>
                </div>
                <motion.button
                  type="button"
                  onClick={() => isCreatingCustom ? setIsCreatingCustom(false) : closeModal()}
                  whileTap={{ scale: 0.92 }}
                  transition={spring}
                  aria-label={isCreatingCustom ? 'Back' : 'Close'}
                  className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isCreatingCustom ? 'arrow_back' : 'close'}
                  </span>
                </motion.button>
              </div>

              {isCreatingCustom ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Category Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        placeholder="e.g. Coffee, Gym, Pets"
                        className="w-full pl-12 pr-4 py-4 text-base font-bold text-white bg-white/[0.04] border border-white/10 rounded-2xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        autoFocus
                      />
                      <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${customName.trim() ? getColorStyle(customColor).bg : 'bg-white/[0.08]'}`}>
                        <span className="material-symbols-outlined text-white text-[16px]">
                          {customName.trim() ? customIcon : 'edit'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Color</label>
                    <div className="flex flex-wrap gap-2.5">
                      {CUSTOM_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setCustomColor(color)}
                          className={`w-8 h-8 rounded-full ${getColorStyle(color).bg} flex items-center justify-center transition-all ${
                            customColor === color ? 'ring-2 ring-offset-2 ring-offset-black ring-white scale-110' : 'hover:scale-110'
                          }`}
                        >
                          {customColor === color && <span className="material-symbols-outlined text-white text-[16px]">check</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Icon</label>
                      <button
                        type="button"
                        onClick={() => {
                          const candidates = getIconCandidates(customName || 'Travel');
                          setGeneratedIcons(candidates);
                          setCustomIcon(candidates[0]);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20"
                      >
                        <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                        Generate icon
                      </button>
                    </div>
                    <div className="grid grid-cols-6 gap-2.5 max-h-40 overflow-y-auto p-1 custom-scrollbar">
                      {generatedIcons.map(icon => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setCustomIcon(icon)}
                          className={`aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                            customIcon === icon 
                              ? `${getColorStyle(customColor).bg} text-white shadow-md scale-110`
                              : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]'
                          }`}
                        >
                          <span className="material-symbols-outlined">{icon}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    onClick={handleSaveCustomCategory}
                    disabled={isSubmitting || !customName.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.25)] hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Create Category'
                    )}
                  </motion.button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                    <div>
                      <label htmlFor="tour-edit-cost-amount" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Cost</label>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-gray-500">{symbol}</span>
                        <input
                          id="tour-edit-cost-amount"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-4 pr-4 font-mono text-2xl font-black tabular-nums text-white outline-none placeholder:text-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/10"
                          style={{ paddingLeft: `${symbol.length * 0.75 + 1.5}rem` }}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="tour-edit-cost-date" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Date</label>
                      <input
                        id="tour-edit-cost-date"
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm font-bold text-white outline-none [color-scheme:dark] focus:border-primary focus:ring-4 focus:ring-primary/10"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="tour-edit-cost-description" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Description</label>
                    <textarea
                      id="tour-edit-cost-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="mt-1 min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Dinner at the restaurant..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="tour-edit-cost-category" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Category</label>
                      <div className="relative">
                        <input
                          id="tour-edit-cost-category"
                          value={category}
                          onChange={(event) => setCategory(event.target.value)}
                          onFocus={() => setShowCategoryDropdown(true)}
                          onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-bold text-white outline-none placeholder:text-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/10"
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
                                  onClick={() => { setCategory(c.label); setShowCategoryDropdown(false); }}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-white/5 rounded-lg text-left transition-colors"
                                >
                                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getCategoryHex(c.label, customCategories) }} />
                                  <span className="text-sm font-semibold text-gray-200 truncate">{c.label}</span>
                                </button>
                             ))}
                             <div className="h-px bg-white/10 my-1" />
                             <button
                               type="button"
                               onMouseDown={(e) => e.preventDefault()}
                               onClick={() => { setIsCreatingCustom(true); setShowCategoryDropdown(false); }}
                               className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-primary/20 text-primary rounded-lg text-left transition-colors font-bold"
                             >
                               <span className="material-symbols-outlined text-[18px]">add</span>
                               <span className="text-sm">Custom...</span>
                             </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="tour-edit-cost-paid-by" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Paid By</label>
                      <select
                        id="tour-edit-cost-paid-by"
                        value={paidBy}
                        onChange={(event) => setPaidBy(Number(event.target.value))}
                        disabled={isPaidByLocked}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
                      >
                        {participants.map((participant) => (
                          <option key={participant.id} value={participant.id}>{participant.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="tour-edit-cost-split" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Split</label>
                      <select
                        id="tour-edit-cost-split"
                        value={splitType}
                        onChange={(event) => setSplitType(event.target.value as SplitType)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      >
                        <option value="equal">Equal</option>
                        <option value="percentage">Percentage</option>
                        <option value="exact">Exact</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary">attachment</span>
                      <div>
                        <p className="text-sm font-bold text-white">Manage Attachments</p>
                        <p className="mt-0.5 text-xs font-medium text-gray-400">Save your changes and click on the transaction card to manage multiple attachments.</p>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={spring}
                        className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-300"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={!canSubmit}
                    whileTap={canSubmit ? { scale: 0.97 } : undefined}
                    transition={spring}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.25)] hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="size-5 rounded-full border-2 border-white/35 border-t-white animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">save</span>
                        Update Cost
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
