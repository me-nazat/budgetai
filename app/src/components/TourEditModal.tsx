'use client';

import { FormEvent, useEffect, useState } from 'react';
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
  initialParticipants: { id: number; name: string; userId: number | null }[];
  onSaveSuccess: () => void;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

export default function TourEditModal({
  isOpen,
  onClose,
  tourId,
  initialName,
  initialParticipants,
  onSaveSuccess,
}: TourEditModalProps) {
  const [name, setName] = useState(initialName);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const haptics = useHaptics();

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setParticipants(initialParticipants.map(p => ({ ...p, isDeleted: false })));
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialName, initialParticipants]);

  const activeParticipants = participants.filter(p => !p.isDeleted);
  const canSubmit = name.trim().length > 0 && activeParticipants.length >= 2 && !isSubmitting;

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
    // If it has an ID, mark as deleted so backend knows. If not, just remove from array.
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
    const names = activeParticipants.map(p => p.name.trim().toLowerCase()).filter(Boolean);
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      setError("Participant names must be unique.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        participants: participants.map(p => ({
          id: p.id,
          name: p.name.trim(),
          isDeleted: p.isDeleted
        }))
      };

      const res = await fetch(`/api/bill-splits/tours/${tourId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.button
            type="button"
            aria-label="Close edit tour modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-edit-title"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.98 }}
            transition={spring}
            className="relative z-50 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] border border-white/10 bg-background/95 shadow-2xl backdrop-blur-xl sm:rounded-[2rem] ring-1 ring-white/10"
          >
            <div className="p-5 sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Tour Settings</p>
                  <h2 id="tour-edit-title" className="mt-1 text-2xl font-black tracking-tight text-white">Edit Details</h2>
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
                <div>
                  <label htmlFor="tour-name" className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Trip Name</label>
                  <input
                    id="tour-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-base font-bold text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                    placeholder="E.g. Summer Vacation, Roadtrip"
                    required
                  />
                </div>

                <div>
                  <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Participants</label>
                  <div className="mt-2 space-y-3">
                    {participants.map((p, index) => {
                      if (p.isDeleted) return null;
                      return (
                        <div key={p.id ?? `new-${index}`} className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={p.name}
                              onChange={(e) => handleUpdateParticipant(index, e.target.value)}
                              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                              placeholder="Name"
                              required
                            />
                            {p.userId && (
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-primary text-[18px]" title="Linked Account">
                                link
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(index)}
                            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-400 transition-colors hover:bg-rose-100 hover:text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddParticipant}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-3.5 text-sm font-bold text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Add Person
                  </button>
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
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.25)] hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                >
                  {isSubmitting ? (
                    <span className="size-5 rounded-full border-2 border-white/35 border-t-white animate-spin" />
                  ) : (
                    'Save Details'
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
