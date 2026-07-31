'use client';

import React, { useState, useEffect } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

interface LockScreenProps {
  onUnlock?: () => void;
  timeoutMinutes?: number;
}

export function LockScreen({ onUnlock, timeoutMinutes = 5 }: LockScreenProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    if (timeoutMinutes <= 0) return;

    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIsLocked(true);
      }, timeoutMinutes * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [timeoutMinutes]);

  const handleBiometricUnlock = async () => {
    setAuthenticating(true);
    setError('');

    try {
      const optsResp = await fetch('/api/auth/webauthn/generate-authentication-options', {
        method: 'POST',
      });
      if (!optsResp.ok) throw new Error('Biometrics not configured');

      const options = await optsResp.json();
      const authResp = await startAuthentication(options);

      const verifyResp = await fetch('/api/auth/webauthn/verify-authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResp),
      });

      if (verifyResp.ok) {
        setIsLocked(false);
        onUnlock?.();
      } else {
        setError('Biometric verification failed.');
      }
    } catch {
      setError('Touch ID / Face ID unavailable. Use password.');
    } finally {
      setAuthenticating(false);
    }
  };

  const handlePasswordUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setIsLocked(false);
    setPassword('');
    setError('');
    onUnlock?.();
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-2xl p-4">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400">
          <span className="material-symbols-outlined text-3xl">lock</span>
        </div>

        <h2 className="text-xl font-bold text-slate-100 mb-1">WealthAI Protected</h2>
        <p className="text-sm text-slate-400 mb-6">
          App locked due to inactivity. Verify your identity to resume.
        </p>

        {error && (
          <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
            {error}
          </div>
        )}

        <button
          onClick={handleBiometricUnlock}
          disabled={authenticating}
          className="w-full mb-4 py-3 px-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-xl">fingerprint</span>
          {authenticating ? 'Verifying Biometrics...' : 'Unlock with Touch ID / Face ID'}
        </button>

        <div className="relative my-4 flex items-center justify-center">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-900 px-3 text-xs text-slate-500 uppercase font-medium">Or</span>
        </div>

        <form onSubmit={handlePasswordUnlock} className="space-y-3">
          <div className="relative">
            <span className="material-symbols-outlined text-base absolute left-3 top-3.5 text-slate-500">key</span>
            <input
              type="password"
              placeholder="Enter master password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl transition-all cursor-pointer"
          >
            Unlock with Password
          </button>
        </form>
      </div>
    </div>
  );
}
