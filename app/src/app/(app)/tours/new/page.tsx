'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { getApiErrorMessage } from '@/lib/api-errors';
import { useHaptics } from '@/hooks/useHaptics';

interface ParticipantDraft {
  id: string;
  name: string;
}

const spring = { type: 'spring' as const, stiffness: 420, damping: 28 };

function createParticipant(name = '', id?: string): ParticipantDraft {
  return {
    id: id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`),
    name,
  };
}

export default function NewTourPage() {
  const [name, setName] = useState('');
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    createParticipant('', 'participant-0'),
    createParticipant('', 'participant-1'),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const haptics = useHaptics();

  const validParticipants = useMemo(
    () => participants.map((participant) => participant.name.trim()).filter(Boolean),
    [participants],
  );

  const canSubmit = name.trim().length > 0 && validParticipants.length >= 2 && !isSubmitting;

  const handleAddParticipant = () => {
    haptics.tap();
    setParticipants((current) => [...current, createParticipant('')]);
  };

  const handleRemoveParticipant = (id: string) => {
    if (participants.length <= 2) return;
    haptics.tap();
    setParticipants((current) => current.filter((participant) => participant.id !== id));
  };

  const handleParticipantChange = (id: string, value: string) => {
    setParticipants((current) => current.map((participant) => (
      participant.id === id ? { ...participant, name: value } : participant
    )));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    const deduped = new Set(validParticipants.map((participant) => participant.toLocaleLowerCase()));
    if (deduped.size !== validParticipants.length) {
      setError('Participant names must be unique.');
      haptics.error();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/bill-splits/tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), participants: validParticipants }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || !data?.tour?.id) {
        throw new Error(getApiErrorMessage(data, 'Failed to create tour budget.'));
      }

      haptics.success();
      router.push(`/tours/${data.tour.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tour budget.');
      haptics.error();
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.button
        type="button"
        onClick={() => router.back()}
        whileTap={{ scale: 0.97 }}
        transition={spring}
        className="mb-8 inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/70 px-4 py-2 text-sm font-bold text-gray-500 shadow-sm backdrop-blur-xl hover:text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400 dark:hover:text-white"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back
      </motion.button>

      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="mb-8"
      >
        <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-primary">Tour Setup</p>
        <h1 className="max-w-2xl text-balance text-4xl font-black tracking-tight text-gray-950 dark:text-white sm:text-5xl">
          Start a shared budget that feels effortless.
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-sm font-medium leading-6 text-gray-500 dark:text-gray-400">
          Name the trip, add everyone who is paying, then move into a dedicated spendings workspace.
        </p>
      </motion.header>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.05 }}
        className="glass-panel overflow-hidden rounded-[2rem] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:p-6"
      >
        <div className="space-y-2">
          <label htmlFor="tour-name" className="ml-1 text-xs font-black uppercase tracking-[0.18em] text-gray-500">
            Name of the tour
          </label>
          <div className="group relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-primary">
              map
            </span>
            <input
              id="tour-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Bali summer trip"
              className="w-full rounded-2xl border border-gray-200 bg-white/80 py-4 pl-12 pr-4 text-base font-bold text-gray-950 outline-none backdrop-blur-xl placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-[#0d1117]/72 dark:text-white dark:placeholder:text-gray-600"
              required
            />
          </div>
        </div>

        <div className="mt-7 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <label className="ml-1 text-xs font-black uppercase tracking-[0.18em] text-gray-500">
                Participants
              </label>
              <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Add at least two unique names.
              </p>
            </div>
            <span className="rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-black text-gray-500 dark:border-white/10 dark:bg-white/[0.04]">
              {validParticipants.length} ready
            </span>
          </div>

          <motion.div layout className="space-y-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {participants.map((participant, index) => (
                <motion.div
                  key={participant.id}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={spring}
                  className="flex items-center gap-3"
                >
                  <div className="group relative flex-1">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-primary">
                      {index === 0 ? 'person' : 'group_add'}
                    </span>
                    <input
                      type="text"
                      value={participant.name}
                      onChange={(event) => handleParticipantChange(participant.id, event.target.value)}
                      placeholder={index === 0 ? 'You or organizer' : `Participant ${index + 1}`}
                      className="w-full rounded-2xl border border-gray-200 bg-white/75 py-3.5 pl-12 pr-4 text-sm font-bold text-gray-950 outline-none backdrop-blur-xl placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-[#0d1117]/72 dark:text-white dark:placeholder:text-gray-600"
                      required={index < 2}
                    />
                  </div>
                  <AnimatePresence>
                    {participants.length > 2 && (
                      <motion.button
                        type="button"
                        onClick={() => handleRemoveParticipant(participant.id)}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        whileTap={{ scale: 0.92 }}
                        transition={spring}
                        aria-label={`Remove participant ${index + 1}`}
                        className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:hover:bg-rose-500/15"
                      >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          <motion.button
            type="button"
            onClick={handleAddParticipant}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            className="inline-flex items-center gap-2 rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3 text-sm font-black text-primary hover:bg-primary/15"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            Add Person
          </motion.button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={spring}
              className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500 dark:text-rose-300"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          disabled={!canSubmit}
          whileHover={canSubmit ? { y: -1 } : undefined}
          whileTap={canSubmit ? { scale: 0.97 } : undefined}
          transition={spring}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.22)] hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
        >
          {isSubmitting ? (
            <>
              <span className="size-5 rounded-full border-2 border-white/35 border-t-white animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px]">route</span>
              Create Tour Budget
            </>
          )}
        </motion.button>
      </motion.form>
    </div>
  );
}
