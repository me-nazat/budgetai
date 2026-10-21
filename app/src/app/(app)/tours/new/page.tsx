'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiErrorMessage } from '@/lib/api-errors';
import { useHaptics } from '@/hooks/useHaptics';
import { useCurrency } from '@/hooks/useCurrency';
import useSWR from 'swr';

interface ParticipantDraft {
  id: string;
  name: string;
  emailOrNote?: string;
}

const spring = { type: 'spring' as const, stiffness: 420, damping: 28 };

function createParticipant(name = '', id?: string): ParticipantDraft {
  return {
    id: id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`),
    name,
    emailOrNote: '',
  };
}

const POPULAR_CURRENCIES = [
  { code: 'BDT', label: 'BDT (৳)', symbol: '৳' },
  { code: 'USD', label: 'USD ($)', symbol: '$' },
  { code: 'EUR', label: 'EUR (€)', symbol: '€' },
  { code: 'GBP', label: 'GBP (£)', symbol: '£' },
  { code: 'THB', label: 'THB (฿)', symbol: '฿' },
  { code: 'JPY', label: 'JPY (¥)', symbol: '¥' },
  { code: 'INR', label: 'INR (₹)', symbol: '₹' },
];

export default function NewTourPage() {
  const router = useRouter();
  const haptics = useHaptics();
  const { currency: defaultCurrency } = useCurrency();

  const { data: authData } = useSWR<{ user?: { id: number; name: string; email: string } }>('/api/auth/me');
  const currentUserName = authData?.user?.name || 'Me';

  // Form States
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [baseCurrency, setBaseCurrency] = useState<string>(defaultCurrency || 'BDT');
  const [totalBudget, setTotalBudget] = useState('');
  const [enableKittyPool, setEnableKittyPool] = useState(true);

  // Participants
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    createParticipant(currentUserName, 'participant-me'),
    createParticipant('', 'participant-1'),
  ]);

  // Optional Category Budget Allocations
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({
    Accommodation: '',
    Transport: '',
    Food: '',
    Activities: '',
    Shopping: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validParticipants = useMemo(
    () => participants.map((p) => p.name.trim()).filter(Boolean),
    [participants]
  );

  const canSubmit = name.trim().length > 0 && validParticipants.length >= 2 && !isSubmitting;

  const handleAddParticipant = () => {
    haptics.tap();
    setParticipants((current) => [...current, createParticipant('')]);
  };

  const handleRemoveParticipant = (id: string) => {
    if (participants.length <= 2) return;
    haptics.tap();
    setParticipants((current) => current.filter((p) => p.id !== id));
  };

  const handleParticipantChange = (id: string, value: string) => {
    setParticipants((current) =>
      current.map((p) => (p.id === id ? { ...p, name: value } : p))
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    const deduped = new Set(validParticipants.map((p) => p.toLocaleLowerCase()));
    if (deduped.size !== validParticipants.length) {
      setError('Traveller names must be unique to prevent split confusion.');
      haptics.error();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const budgetNum = totalBudget ? parseFloat(totalBudget) : null;

    try {
      const res = await fetch('/api/bill-splits/tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          destination: destination.trim() || null,
          startDate: startDate || null,
          endDate: endDate || null,
          baseCurrency,
          totalBudget: budgetNum,
          enableKittyPool,
          participants: validParticipants,
          categoryAllocations: showCategoryBreakdown ? categoryBudgets : undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || !data?.tour?.id) {
        throw new Error(getApiErrorMessage(data, 'Failed to create tour.'));
      }

      haptics.success();
      router.push(`/tours/${data.tour.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tour.');
      haptics.error();
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <motion.button
        type="button"
        onClick={() => router.back()}
        whileTap={{ scale: 0.97 }}
        transition={spring}
        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-surface-dark/90 px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white shadow-sm transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Tours
      </motion.button>

      <header>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary mb-1">Trip Creator</p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-950 dark:text-white">
          Create New Group Tour
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Set trip details, target budgets, shared kitty pool, and initial travellers.
        </p>
      </header>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-500 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Tour Details */}
        <div className="p-6 rounded-3xl card-glass space-y-4 shadow-xl">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-950 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">flight_takeoff</span>
            1. Trip Essentials
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
                Tour Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cox's Bazar Road Trip, Bali Vacation 2026"
                className="w-full px-4 py-3.5 rounded-2xl bg-white/80 dark:bg-[#0A0E1B] border border-gray-200/80 dark:border-white/10 text-sm font-bold text-gray-950 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
                Destination (Optional)
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Cox's Bazar, Bali, Rome"
                className="w-full px-4 py-3.5 rounded-2xl bg-white/80 dark:bg-[#0A0E1B] border border-gray-200/80 dark:border-white/10 text-sm font-bold text-gray-950 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
                Base Currency
              </label>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-white/80 dark:bg-[#0A0E1B] border border-gray-200/80 dark:border-white/10 text-sm font-bold text-gray-950 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              >
                {POPULAR_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-white dark:bg-slate-900 text-gray-950 dark:text-white">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-white/80 dark:bg-[#0A0E1B] border border-gray-200/80 dark:border-white/10 text-sm font-bold text-gray-950 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-white/80 dark:bg-[#0A0E1B] border border-gray-200/80 dark:border-white/10 text-sm font-bold text-gray-950 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Target Budget & Kitty Pool Toggle */}
        <div className="p-6 rounded-3xl card-glass space-y-4 shadow-xl">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-950 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
            2. Budget & Kitty Pool
          </h2>

          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
              Total Target Budget (Optional)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-4 py-3.5 rounded-2xl bg-white/80 dark:bg-[#0A0E1B] border border-gray-200/80 dark:border-white/10 text-base font-mono font-bold text-gray-950 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 dark:text-gray-400">
                {baseCurrency}
              </span>
            </div>
          </div>

          {/* Shared Tour Kitty Pool Switch */}
          <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/10 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500 dark:text-emerald-400 text-[20px]">savings</span>
                <span className="text-xs font-black text-gray-950 dark:text-white uppercase tracking-wider">
                  Enable Shared Tour Kitty / Pool
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Allows group members to deposit cash up front into a shared pool to pay for fuel, tolls, and group meals.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={enableKittyPool}
                onChange={(e) => setEnableKittyPool(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>
        </div>

        {/* Travellers Section */}
        <div className="p-6 rounded-3xl card-glass space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-gray-950 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[18px]">group</span>
              3. Travellers & Members ({validParticipants.length})
            </h2>
            <button
              type="button"
              onClick={handleAddParticipant}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              Add Traveller
            </button>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Add friends, family, or offline guests. Registered users can claim their spot later with the invite link.
          </p>

          <div className="space-y-2.5">
            {participants.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">
                  #{idx + 1}
                </div>
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => handleParticipantChange(p.id, e.target.value)}
                  placeholder={`Traveller ${idx + 1} name`}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-[#0A0E1B] border border-gray-200/80 dark:border-white/10 text-xs font-bold text-gray-950 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                  required
                />
                {participants.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveParticipant(p.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 shrink-0 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          whileHover={{ scale: canSubmit ? 1.01 : 1 }}
          whileTap={{ scale: canSubmit ? 0.98 : 1 }}
          className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover font-black text-sm text-white shadow-xl shadow-primary/25 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSubmitting ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px]">check</span>
              Launch Tour Workspace
            </>
          )}
        </motion.button>
      </form>
    </div>
  );
}
