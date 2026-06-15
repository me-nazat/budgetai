'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { getApiErrorMessage } from '@/lib/api-errors';

interface JoinParticipant {
  id: number;
  name: string;
  isClaimed: boolean;
  isCurrentUser: boolean;
}

interface JoinTourInfo {
  id: number;
  name: string;
  createdAt: string | null;
  participants: JoinParticipant[];
  alreadyJoined: boolean;
  isCreator: boolean;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

export default function JoinTourPage() {
  const [tourInfo, setTourInfo] = useState<JoinTourInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<number | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code;

  const fetchTourInfo = useCallback(async () => {
    if (!code) return;
    setError(null);

    try {
      const res = await fetch(`/api/bill-splits/tours/join?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(getApiErrorMessage(data, 'Invalid or expired invite link.'));
      }

      setTourInfo(data.tour);

      // If user already joined, redirect to the tour
      if (data.tour.alreadyJoined) {
        router.replace(`/tours/${data.tour.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load invite information.');
    } finally {
      setIsLoading(false);
    }
  }, [code, router]);

  useEffect(() => {
    void fetchTourInfo();
  }, [fetchTourInfo]);

  const handleJoin = async () => {
    if (selectedParticipant === null || !tourInfo) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      const res = await fetch('/api/bill-splits/tours/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, participantId: selectedParticipant }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(getApiErrorMessage(data, 'Failed to join this tour.'));
      }

      router.push(`/tours/${data.tourId}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join tour.');
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <span className="size-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Loading invite details…</p>
        </motion.div>
      </div>
    );
  }

  if (error || !tourInfo) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl items-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="glass-panel w-full rounded-[2rem] p-8 text-center"
        >
          <span className="material-symbols-outlined mb-3 text-5xl text-rose-400">link_off</span>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white">Invite Link Invalid</h1>
          <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">{error ?? 'This invite link is not valid or has expired.'}</p>
          <Link href="/tours" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Go to Tours
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl items-center px-4 py-8 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-full"
      >
        <div className="glass-panel overflow-hidden rounded-[2rem] p-0">
          {/* Header */}
          <div className="relative overflow-hidden bg-[#0d1b2a] px-7 py-8 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.1),transparent_30%),linear-gradient(135deg,rgba(19,109,236,0.3),transparent_55%)]" />
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200/80">You&apos;re Invited</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">{tourInfo.name}</h1>
              <p className="mt-3 text-sm font-semibold text-blue-100/70">
                {tourInfo.participants.length} participants · Select your name to join
              </p>
            </div>
          </div>

          {/* Participant Selection */}
          <div className="p-6 sm:p-7">
            <p className="mb-5 text-xs font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Who are you?
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tourInfo.participants.map((participant, index) => {
                const isClaimed = participant.isClaimed;
                const isSelected = selectedParticipant === participant.id;

                return (
                  <motion.button
                    key={participant.id}
                    type="button"
                    disabled={isClaimed}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: index * 0.04 }}
                    whileTap={!isClaimed ? { scale: 0.97 } : undefined}
                    onClick={() => setSelectedParticipant(participant.id)}
                    className={`relative rounded-2xl border p-4 text-left transition-colors ${
                      isClaimed
                        ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-50 dark:border-white/5 dark:bg-white/[0.02]'
                        : isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30 dark:border-primary dark:bg-primary/10'
                          : 'cursor-pointer border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/5 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-primary/30 dark:hover:bg-primary/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                          isSelected
                            ? 'border-primary/20 bg-primary/15 text-primary'
                            : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-500'
                        }`}>
                          <span className="material-symbols-outlined text-[20px]">
                            {isClaimed ? 'person_check' : isSelected ? 'check_circle' : 'person'}
                          </span>
                        </div>
                        <span className={`text-sm font-black ${
                          isSelected ? 'text-primary' : 'text-gray-900 dark:text-white'
                        }`}>
                          {participant.name}
                        </span>
                      </div>

                      {isClaimed && (
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 dark:border-white/10 dark:bg-white/[0.04]">
                          Claimed
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {joinError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={spring}
                  className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-300"
                >
                  {joinError}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              disabled={selectedParticipant === null || isJoining}
              onClick={handleJoin}
              whileTap={selectedParticipant !== null ? { scale: 0.97 } : undefined}
              transition={spring}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.25)] hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
            >
              {isJoining ? (
                <>
                  <span className="size-5 rounded-full border-2 border-white/35 border-t-white animate-spin" />
                  Joining…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">group_add</span>
                  {selectedParticipant !== null
                    ? `I am ${tourInfo.participants.find(p => p.id === selectedParticipant)?.name}`
                    : 'Select Your Name Above'}
                </>
              )}
            </motion.button>

            <Link
              href="/tours"
              className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-500 hover:text-gray-900 dark:border-white/10 dark:bg-white/[0.03] dark:hover:text-white"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to My Tours
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
