'use client';

/**
 * @fileoverview Lock Screen component — Full-bleed overlay that blocks app access.
 *
 * Triggers:
 * - Inactivity timeout (configurable: never / 1min / 5min)
 * - visibilitychange (when PWA goes to background and returns)
 *
 * Unlock requires password re-entry.
 *
 * @module components/LockScreen
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LockScreenProps {
  /** Timeout in minutes before auto-lock. 0 = never. */
  timeoutMinutes: number;
  /** Whether to lock on background/foreground transitions */
  lockOnBackground: boolean;
}

export default function LockScreen({ timeoutMinutes = 0, lockOnBackground = false }: LockScreenProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const lastActivityRef = useRef(Date.now());

  // Track activity
  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, updateActivity));
  }, []);

  // Inactivity timer
  useEffect(() => {
    if (timeoutMinutes <= 0) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastActivityRef.current) / 1000 / 60;
      if (elapsed >= timeoutMinutes) {
        setIsLocked(true);
      }
    }, 10000); // Check every 10s

    return () => clearInterval(interval);
  }, [timeoutMinutes]);

  // Background/foreground lock
  useEffect(() => {
    if (!lockOnBackground) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only lock if was hidden for >5 seconds
        const elapsed = (Date.now() - lastActivityRef.current) / 1000;
        if (elapsed > 5) {
          setIsLocked(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [lockOnBackground]);

  const handleUnlock = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setIsLocked(false);
        setPassword('');
        lastActivityRef.current = Date.now();
      } else {
        setError('Incorrect password');
      }
    } catch {
      setError('Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  }, [password]);

  return (
    <AnimatePresence>
      {isLocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-gray-950/95 backdrop-blur-2xl flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-sm text-center"
          >
            {/* App Logo/Lock Icon */}
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/30">
              <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">App Locked</h2>
            <p className="text-gray-400 text-sm mb-8">
              Enter your password to continue
            </p>

            <form onSubmit={handleUnlock}>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Password"
                className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white text-center text-base placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                autoFocus
                autoComplete="current-password"
                style={{ fontSize: '16px' }}
              />

              {error && (
                <p className="text-sm text-accent-rose mt-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={!password || loading}
                className="w-full mt-4 py-3.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:bg-primary-hover transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Unlock'}
              </button>
            </form>

            <p className="text-xs text-gray-600 mt-6">
              Locked for your security
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
