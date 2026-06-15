'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { getApiErrorMessage } from '@/lib/api-errors';
import { getCategoryHex } from '@/lib/categoryUtils';
import { useHaptics } from '@/hooks/useHaptics';

interface Participant {
  id: number;
  name: string;
}

interface TourAddCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  tourId: number;
  onSaveSuccess: () => void;
  initialTransaction?: {
    id: number;
    amount: number;
    description: string;
    category: string;
    date: string;
    paidByParticipantId?: number;
    paidBy?: number;
    splitType: string;
  } | null;
}

const spring = { type: 'spring' as const, stiffness: 420, damping: 28 };
type SplitType = 'equal' | 'percentage' | 'exact';

export default function TourAddCostModal({
  isOpen,
  onClose,
  participants,
  tourId,
  onSaveSuccess,
  initialTransaction,
}: TourAddCostModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Travel');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState<number>(participants[0]?.id ?? 0);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [includeInMainLedger, setIncludeInMainLedger] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const haptics = useHaptics();

  const [customCategories, setCustomCategories] = useState<{ name: string; color: string }[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialTransaction) {
        setAmount(initialTransaction.amount.toString());
        setDescription(initialTransaction.description);
        setCategory(initialTransaction.category);
        setDate(initialTransaction.date);
        setPaidBy(initialTransaction.paidByParticipantId ?? initialTransaction.paidBy ?? participants[0]?.id ?? 0);
        setSplitType(initialTransaction.splitType as SplitType);
        setIncludeInMainLedger(false);
      } else {
        setAmount('');
        setDescription('');
        setCategory('Travel');
        setDate(new Date().toISOString().split('T')[0]);
        setPaidBy(participants[0]?.id ?? 0);
        setSplitType('equal');
        setIncludeInMainLedger(false);
        setReceipt(null);
        setReceiptPreview(null);
      }

      fetch('/api/categories?type=expense')
        .then(res => res.json())
        .then(data => {
           if (data.categories) setCustomCategories(data.categories);
        })
        .catch(console.error);
    }
  }, [isOpen]);

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
      icon: 'label',
      color: c.color || 'gray'
    }));
    return [...base, ...custom];
  }, [customCategories]);



  const amountNumber = useMemo(() => Number.parseFloat(amount), [amount]);
  const canSubmit = Number.isFinite(amountNumber) && amountNumber > 0 && description.trim().length > 0 && paidBy > 0 && !isSubmitting;

  useEffect(() => {
    if (!participants.length) return;
    setPaidBy((current) => participants.some((participant) => participant.id === current) ? current : participants[0].id);
  }, [participants]);

  useEffect(() => {
    if (!receipt) {
      setReceiptPreview(null);
      return undefined;
    }

    const url = URL.createObjectURL(receipt);
    setReceiptPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [receipt]);

  const reset = useCallback(() => {
    setAmount('');
    setDescription('');
    setCategory('Travel');
    setDate(new Date().toISOString().split('T')[0]);
    setPaidBy(participants[0]?.id ?? 0);
    setSplitType('equal');
    setIncludeInMainLedger(false);
    setReceipt(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [participants]);

  const closeModal = useCallback(() => {
    haptics.tap();
    onClose();
  }, [haptics, onClose]);

  const chooseReceipt = useCallback((file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Receipt proof must be an image file.');
      haptics.error();
      return;
    }

    setReceipt(file);
    setError(null);
    haptics.tap();
  }, [haptics]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    chooseReceipt(event.target.files?.[0]);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    chooseReceipt(event.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const url = initialTransaction 
        ? `/api/bill-splits/tours/${tourId}/spendings/${initialTransaction.id}`
        : `/api/bill-splits/tours/${tourId}/spendings`;
      const method = initialTransaction ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNumber,
          description: description.trim(),
          category: category.trim() || 'Travel',
          date,
          paidBy,
          paidByParticipantId: paidBy,
          splitType,
          includeInMainLedger,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(getApiErrorMessage(data, 'Failed to save this tour cost.'));
      }

      // Upload receipt if one was selected
      if (data.transaction?.id && receipt) {
        const formData = new FormData();
        formData.append('attachments', receipt);
        await fetch(`/api/bill-splits/tours/${tourId}/spendings/${data.transaction.id}/attachments`, {
          method: 'POST',
          body: formData,
        });
      }

      haptics.success();
      reset();
      onSaveSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add this tour cost.');
      haptics.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Close add cost modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-black/70 backdrop-blur-xl"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-add-cost-title"
            initial={{ opacity: 0, y: 60, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 55, scale: 0.98 }}
            transition={spring}
            className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0d1117]/95 shadow-[0_28px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-[2rem]"
          >
            <div className="p-5 sm:p-6">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Tour Ledger</p>
                  <h2 id="tour-add-cost-title" className="mt-1 text-2xl font-black tracking-tight text-white">{initialTransaction ? 'Save Changes' : 'Add Cost'}</h2>
                </div>
                <motion.button
                  type="button"
                  onClick={closeModal}
                  whileTap={{ scale: 0.92 }}
                  transition={spring}
                  aria-label="Close"
                  className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </motion.button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <label htmlFor="tour-cost-amount" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Cost</label>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-gray-500">$</span>
                      <input
                        id="tour-cost-amount"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-4 pl-9 pr-4 font-mono text-2xl font-black tabular-nums text-white outline-none placeholder:text-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/10"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="tour-cost-date" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Date</label>
                    <input
                      id="tour-cost-date"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm font-bold text-white outline-none [color-scheme:dark] focus:border-primary focus:ring-4 focus:ring-primary/10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="tour-cost-description" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Description</label>
                  <textarea
                    id="tour-cost-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="mt-1 min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/10"
                    placeholder="Dinner at the restaurant, ferry tickets, hotel deposit..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="tour-cost-category" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Category</label>
                    <div className="relative">
                      <input
                        id="tour-cost-category"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        onFocus={() => setShowCategoryDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-bold text-white outline-none placeholder:text-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/10"
                        placeholder="Travel"
                        autoComplete="off"
                      />
                      {showCategoryDropdown && (
                        <div className="absolute z-10 mt-2 max-h-48 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#111827] shadow-xl custom-scrollbar">
                           {allCategories.map((c) => (
                              <button
                                key={c.label}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { setCategory(c.label); setShowCategoryDropdown(false); }}
                                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 text-left transition-colors"
                              >
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: getCategoryHex(c.label, customCategories) }} />
                                <span className="text-sm font-semibold text-gray-200">{c.label}</span>
                              </button>
                           ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="tour-cost-paid-by" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Paid By</label>
                    <select
                      id="tour-cost-paid-by"
                      value={paidBy}
                      onChange={(event) => setPaidBy(Number(event.target.value))}
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                    >
                      {participants.map((participant) => (
                        <option key={participant.id} value={participant.id}>{participant.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="tour-cost-split" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Split</label>
                    <select
                      id="tour-cost-split"
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

                                {!initialTransaction && (
                <div>
                  <label className="flex items-center gap-3 cursor-pointer p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-primary/35 hover:bg-white/[0.05] transition-colors">

                    <input
                      type="checkbox"
                      checked={includeInMainLedger}
                      onChange={(e) => setIncludeInMainLedger(e.target.checked)}
                      className="size-5 rounded-md border border-white/20 bg-[#111827] text-primary accent-primary outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <div>
                      <p className="text-sm font-bold text-white">Add to main transactions</p>
                      <p className="mt-0.5 text-xs text-gray-400 font-medium">Link this cost to your global dashboard & transactions</p>
                    </div>
                  </label>
                </div>
                )}

                
                {!initialTransaction ? (
                <div>
                  <label className="mb-2 ml-1 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">Receipt Proof</label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`w-full rounded-2xl border border-dashed p-4 text-left transition-colors ${
                      isDragging
                        ? 'border-primary/70 bg-primary/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-primary/35 hover:bg-white/[0.05]'
                    }`}
                  >
                    {receipt ? (
                      <div className="flex items-center gap-3">
                        {receiptPreview ? (
                          <Image
                            src={receiptPreview}
                            alt="Receipt preview"
                            width={56}
                            height={56}
                            unoptimized
                            className="size-14 shrink-0 rounded-2xl border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                            <span className="material-symbols-outlined text-emerald-400">image</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-white">{receipt.name}</p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">Receipt proof attached locally</p>
                        </div>
                        <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400">
                          <span className="material-symbols-outlined">cloud_upload</span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-200">Drop receipt image or browse</p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">JPG, PNG, or WebP proof for this cost</p>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
                ) : (
                  <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary">attachment</span>
                      <div>
                        <p className="text-sm font-bold text-white">Manage Attachments</p>
                        <p className="mt-0.5 text-xs font-medium text-gray-400">Save your edits and click on the transaction card to manage multiple attachments.</p>
                      </div>
                    </div>
                  </div>
                )}

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
                      <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add_card</span>
                      Add Cost
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
