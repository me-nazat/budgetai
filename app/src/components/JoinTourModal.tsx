'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useHaptics } from '@/hooks/useHaptics';
import { getApiErrorMessage } from '@/lib/api-errors';
import { mutate } from 'swr';

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

interface JoinParticipant {
  id: number;
  name: string;
  isClaimed: boolean;
  isCurrentUser: boolean;
}

interface JoinTourInfo {
  id: number;
  name: string;
  participants: JoinParticipant[];
  alreadyJoined: boolean;
}

interface JoinTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JoinTourModal({ isOpen, onClose }: JoinTourModalProps) {
  const router = useRouter();
  const haptics = useHaptics();

  const [step, setStep] = useState<'input' | 'loading' | 'select'>('input');
  const [inviteUrl, setInviteUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [tourInfo, setTourInfo] = useState<JoinTourInfo | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<number | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Extract code from URL or text
  const extractCode = (input: string) => {
    try {
      const url = new URL(input);
      const parts = url.pathname.split('/');
      // look for /tours/join/CODE
      const joinIndex = parts.indexOf('join');
      if (joinIndex !== -1 && parts.length > joinIndex + 1) {
        return parts[joinIndex + 1];
      }
      return input.trim();
    } catch {
      // If it's not a valid URL, it might be the code itself
      return input.trim();
    }
  };

  const handleLookup = async () => {
    const code = extractCode(inviteUrl);
    if (!code) {
      setError('Please enter a valid invite link or code.');
      return;
    }

    setStep('loading');
    setError(null);

    try {
      const res = await fetch(`/api/bill-splits/tours/join?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(getApiErrorMessage(data, 'Invalid or expired invite link.'));
      }

      const info: JoinTourInfo = data.tour;

      if (info.alreadyJoined) {
        haptics.success();
        router.push(`/tours/${info.id}`);
        onClose();
        return;
      }

      setTourInfo(info);
      setStep('select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load invite information.');
      setStep('input');
      haptics.error();
    }
  };

  const handleJoin = async () => {
    if (selectedParticipant === null || !tourInfo) return;
    const code = extractCode(inviteUrl);

    setIsJoining(true);
    setError(null);

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

      haptics.success();
      await mutate('/api/bill-splits/tours');
      router.push(`/tours/${data.tourId}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join tour.');
      haptics.error();
    } finally {
      setIsJoining(false);
    }
  };

  const closeModal = () => {
    if (isJoining) return;
    setStep('input');
    setInviteUrl('');
    setError(null);
    setTourInfo(null);
    setSelectedParticipant(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.button
            type="button"
            aria-label="Close modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.98 }}
            transition={spring}
            className="relative z-50 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] border border-white/10 bg-background/95 shadow-2xl backdrop-blur-xl sm:rounded-[2rem] ring-1 ring-white/10"
          >
            <div className="p-6 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Join Tour</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-950 dark:text-white">
                    {step === 'select' && tourInfo ? tourInfo.name : 'Enter Invite Link'}
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

              {step === 'input' && (
                <div className="space-y-5">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Paste the invite link shared by the tour organizer to join the budget plan.
                  </p>
                  <div>
                    <input
                      type="url"
                      value={inviteUrl}
                      onChange={(e) => setInviteUrl(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm font-bold text-gray-950 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="https://.../tours/join/..."
                      required
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500 dark:text-rose-400"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="button"
                    onClick={handleLookup}
                    disabled={!inviteUrl.trim()}
                    whileTap={inviteUrl.trim() ? { scale: 0.97 } : undefined}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.25)] hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
                  >
                    Find Tour
                  </motion.button>
                </div>
              )}

              {step === 'loading' && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <span className="size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  <p className="text-sm font-bold text-gray-500">Looking up tour...</p>
                </div>
              )}

              {step === 'select' && tourInfo && (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                      Which participant are you? Choose your profile to sync your transactions.
                    </p>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                      {tourInfo.participants.map((p) => {
                        const isSelectable = !p.isClaimed && !p.isCurrentUser;
                        const isSelected = selectedParticipant === p.id;

                        return (
                          <button
                            key={p.id}
                            disabled={!isSelectable}
                            onClick={() => setSelectedParticipant(p.id)}
                            className={\`w-full flex items-center justify-between p-4 rounded-2xl border transition-all \${
                              isSelected
                                ? 'border-primary bg-primary/10 dark:bg-primary/5'
                                : isSelectable
                                  ? 'border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]'
                                  : 'border-transparent bg-gray-50 opacity-60 dark:bg-white/[0.02]'
                            }\`}
                          >
                            <span className={\`font-bold \${isSelected ? 'text-primary' : 'text-gray-900 dark:text-white'}\`}>
                              {p.name}
                            </span>
                            {p.isCurrentUser ? (
                              <span className="text-xs font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">You</span>
                            ) : p.isClaimed ? (
                              <span className="text-xs font-black uppercase tracking-wider text-gray-400">Claimed</span>
                            ) : isSelected && (
                              <span className="material-symbols-outlined text-primary">check_circle</span>
                            )}
                          </button>
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
                        className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500 dark:text-rose-400"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('input')}
                      className="flex-1 rounded-2xl bg-gray-100 py-4 font-black text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleJoin}
                      disabled={selectedParticipant === null || isJoining}
                      className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.25)] hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
                    >
                      {isJoining ? (
                        <span className="size-5 rounded-full border-2 border-white/35 border-t-white animate-spin" />
                      ) : (
                        'Confirm & Join'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
