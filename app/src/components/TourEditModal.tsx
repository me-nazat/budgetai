'use client';

import { FormEvent, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useHaptics } from '@/hooks/useHaptics';
import { mutate } from 'swr';
import { getApiErrorMessage } from '@/lib/api-errors';

interface Participant {
  id?: number;
  name: string;
  userId?: number | null;
  isDeleted?: boolean;
}

interface TourEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  tourId: number;
  initialName: string;
  initialDestination?: string | null;
  initialStartDate?: string | null;
  initialEndDate?: string | null;
  initialTotalBudget?: number | null;
  initialStatus?: string | null;
  initialBaseCurrency?: string | null;
  initialParticipants: { id: number; name: string; userId: number | null }[];
  onSaveSuccess: () => void;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

export default function TourEditModal({
  isOpen,
  onClose,
  tourId,
  initialName,
  initialDestination = '',
  initialStartDate = '',
  initialEndDate = '',
  initialTotalBudget = 0,
  initialStatus = 'active',
  initialBaseCurrency = 'BDT',
  initialParticipants,
  onSaveSuccess,
}: TourEditModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState(initialName);
  const [destination, setDestination] = useState(initialDestination || '');
  const [startDate, setStartDate] = useState(initialStartDate || '');
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [totalBudget, setTotalBudget] = useState(initialTotalBudget ? String(initialTotalBudget) : '');
  const [status, setStatus] = useState(initialStatus || 'active');
  const [baseCurrency, setBaseCurrency] = useState(initialBaseCurrency || 'BDT');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const haptics = useHaptics();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDestination(initialDestination || '');
      setStartDate(initialStartDate || '');
      setEndDate(initialEndDate || '');
      setTotalBudget(initialTotalBudget ? String(initialTotalBudget) : '');
      setStatus(initialStatus || 'active');
      setBaseCurrency(initialBaseCurrency || 'BDT');
      setParticipants(initialParticipants.map((p) => ({ ...p, isDeleted: false })));
      setError(null);
      setIsSubmitting(false);
    }
  }, [
    isOpen,
    initialName,
    initialDestination,
    initialStartDate,
    initialEndDate,
    initialTotalBudget,
    initialStatus,
    initialBaseCurrency,
    initialParticipants,
  ]);

  const activeParticipants = participants.filter((p) => !p.isDeleted);
  const canSubmit = name.trim().length > 0 && activeParticipants.length >= 2 && !isSubmitting;

  const tripDuration = useMemo(() => {
    if (startDate && endDate) {
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 ? diff : null;
    }
    return null;
  }, [startDate, endDate]);

  const handleAddParticipant = () => {
    setParticipants([...participants, { name: '', isDeleted: false }]);
  };

  const handleUpdateParticipant = (index: number, newName: string) => {
    const next = [...participants];
    next[index].name = newName;
    setParticipants(next);
  };

  const handleRemoveParticipant = (index: number) => {
    const next = [...participants];
    if (next[index].id) {
      next[index].isDeleted = true;
    } else {
      next.splice(index, 1);
    }
    setParticipants(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Check unique active names
    const names = activeParticipants.map((p) => p.name.trim().toLowerCase()).filter(Boolean);
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      setError('Participant names must be unique.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        destination: destination.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
        baseCurrency,
        totalBudget: totalBudget ? parseFloat(totalBudget) : null,
        status,
        participants: participants.map((p) => ({
          id: p.id,
          name: p.name.trim(),
          isDeleted: p.isDeleted,
        })),
      };

      const res = await fetch(`/api/bill-splits/tours/${tourId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(getApiErrorMessage(data, 'Failed to update tour details.'));
      }

      haptics.success();
      await mutate(`/api/bill-splits/tours/${tourId}`);
      await mutate('/api/bill-splits/tours');
      onSaveSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating the tour.');
      haptics.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    haptics.tap();
    onClose();
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
            aria-labelledby="tour-edit-title"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.98 }}
            transition={spring}
            className="relative z-50 max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0A0E1A]/95 shadow-2xl backdrop-blur-xl sm:rounded-[2rem] ring-1 ring-white/10"
          >
            <div className="p-5 sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Tour Settings</p>
                  </div>
                  <h2 id="tour-edit-title" className="mt-1 text-2xl font-black tracking-tight text-white">
                    Edit Tour & Itinerary
                  </h2>
                </div>
                <motion.button
                  type="button"
                  onClick={closeModal}
                  whileTap={{ scale: 0.92 }}
                  transition={spring}
                  className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </motion.button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 1. Basic Trip Details */}
                <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">trip</span>
                      Trip Essentials
                    </span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="rounded-xl border border-white/10 bg-[#111827] px-3 py-1 text-xs font-black uppercase tracking-wider text-white outline-none focus:border-primary"
                    >
                      <option value="planning">Planning</option>
                      <option value="active">Active Trip</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="tour-name" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                      Trip Name <span className="text-primary">*</span>
                    </label>
                    <input
                      id="tour-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="e.g. Summer Vacation, Roadtrip"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="tour-destination" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                      Destination City / Region
                    </label>
                    <div className="relative mt-1">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
                        location_on
                      </span>
                      <input
                        id="tour-destination"
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                        placeholder="e.g. Cox's Bazar, Bali, Paris"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Dates & Budget */}
                <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px]">calendar_month</span>
                    Dates & Target Budget
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-primary [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-primary [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {tripDuration !== null && (
                    <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-400 border border-emerald-500/20">
                      <span className="material-symbols-outlined text-[15px]">schedule</span>
                      <span>{tripDuration} Days Journey</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Total Trip Budget</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 font-mono">
                          {baseCurrency}
                        </span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={totalBudget}
                          onChange={(e) => setTotalBudget(e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-14 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-primary"
                          placeholder="e.g. 50000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Base Currency</label>
                      <select
                        value={baseCurrency}
                        onChange={(e) => setBaseCurrency(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-primary"
                      >
                        <option value="BDT">BDT (৳)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="THB">THB (฿)</option>
                        <option value="JPY">JPY (¥)</option>
                        <option value="INR">INR (₹)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Participants Roster */}
                <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">group</span>
                      Travellers ({activeParticipants.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddParticipant}
                      className="inline-flex items-center gap-1 text-xs font-black text-primary hover:text-primary-hover"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      Add Person
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {participants.map((p, index) => {
                      if (p.isDeleted) return null;
                      return (
                        <div key={p.id ?? `new-${index}`} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={p.name}
                              onChange={(e) => handleUpdateParticipant(index, e.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-primary"
                              placeholder="Traveller Name"
                              required
                            />
                            {p.userId && (
                              <span
                                className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-primary text-[16px]"
                                title="Linked Wealth AI Account"
                              >
                                link
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(index)}
                            disabled={activeParticipants.length <= 2}
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 transition-colors"
                            title="Remove Traveller"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={spring}
                      className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300"
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
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.25)] hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none transition-all"
                >
                  {isSubmitting ? (
                    <span className="size-5 rounded-full border-2 border-white/35 border-t-white animate-spin" />
                  ) : (
                    'Save Trip Settings'
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
