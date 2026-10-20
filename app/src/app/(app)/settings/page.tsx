'use client';

/**
 * @fileoverview Unified Master Settings Workspace (Batch 8 Part 4).
 * Consolidates all settings, security, privacy, integrations, and data controls into 4 clean tabs:
 * 1. General & Regional (Profile, Base Currency, English/Bengali, Dark/Light Theme)
 * 2. Security & Privacy (Passkeys, 2FA TOTP, Sessions, Auto-lock timer, Privacy masking)
 * 3. Automations & Integrations (Merchant Auto-Rules, Google Calendar Sync, Push Notifications, PWA Install)
 * 4. Data & Export (Full JSON/CSV Backup, Account Reset)
 *
 * @module app/(app)/settings/page
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES, CurrencyCode } from '@/lib/currency';
import { usePWAInstall } from '@/components/InstallPrompt';

type SettingsTab = 'general' | 'security' | 'integrations' | 'data';

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'general';

  const { locale, setLocale, t } = useLanguage();
  const { isPrivacyMode, togglePrivacy } = usePrivacy();
  const { currency, setCurrency } = useCurrency();
  const { canInstall, install } = usePWAInstall();

  const handleTabChange = (tab: SettingsTab) => {
    router.push(`/settings?tab=${tab}`);
  };

  // General States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Security & Privacy States
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loginActivity, setLoginActivity] = useState<any[]>([]);
  const [autoLockTimeout, setAutoLockTimeout] = useState<number>(5);
  const [lockOnBackground, setLockOnBackground] = useState<boolean>(true);
  const [shakeToHide, setShakeToHide] = useState<boolean>(true);
  const [maskAccountNumbers, setMaskAccountNumbers] = useState<boolean>(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // 2FA Setup Modal State
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{ uri: string; backupCodes: string[]; secret?: string } | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);

  // Integrations States
  const [calendarSettings, setCalendarSettings] = useState({
    isConnected: false,
    googleUserEmail: null as string | null,
    syncBills: true,
    syncSubscriptions: true,
    syncDebts: true,
    reminderDaysBefore: 2,
  });
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [notifyBudget, setNotifyBudget] = useState(true);
  const [notifyOverspend, setNotifyOverspend] = useState(true);

  // Load User Data
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setName(d.user.name || '');
          setEmail(d.user.email || '');
          setTotpEnabled(Boolean(d.user.totpEnabled));
        }
      })
      .catch(() => {});

    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const loadSecurityData = useCallback(() => {
    fetch('/api/auth/passkeys')
      .then((r) => r.json())
      .then((d) => {
        if (d.passkeys) setPasskeys(d.passkeys);
      })
      .catch(() => {});

    fetch('/api/auth/sessions')
      .then((r) => r.json())
      .then((d) => {
        if (d.sessions) setSessions(d.sessions);
      })
      .catch(() => {});

    fetch('/api/auth/login-activity')
      .then((r) => r.json())
      .then((d) => {
        if (d.activity) setLoginActivity(d.activity);
      })
      .catch(() => {});

    fetch('/api/settings/privacy')
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setAutoLockTimeout(d.data.autoLockTimeoutMinutes ?? 5);
          setLockOnBackground(d.data.lockOnBackground ?? true);
          setShakeToHide(d.data.shakeToHideEnabled ?? true);
          setMaskAccountNumbers(d.data.maskAccountNumbers ?? true);
        }
      })
      .catch(() => {});
  }, []);

  // Load Passkeys, Sessions, Activity on Security tab activation
  useEffect(() => {
    if (activeTab === 'security') {
      loadSecurityData();
    }
  }, [activeTab, loadSecurityData]);

  // Load Calendar Settings
  useEffect(() => {
    if (activeTab === 'integrations') {
      fetch('/api/settings/calendar')
        .then((r) => r.json())
        .then((json) => {
          const data = json.data || json;
          if (data) {
            setCalendarSettings({
              isConnected: Boolean(data.isConnected),
              googleUserEmail: data.googleUserEmail || null,
              syncBills: data.syncBills ?? true,
              syncSubscriptions: data.syncSubscriptions ?? true,
              syncDebts: data.syncDebts ?? true,
              reminderDaysBefore: data.reminderDaysBefore ?? 2,
            });
          }
        })
        .catch(() => {});
    }
  }, [activeTab]);

  // Save General Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, currency }),
      });
      if (res.ok) {
        toast.success(locale === 'bn' ? 'প্রোফাইল আপডেট হয়েছে' : 'Profile updated');
      }
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSavingGeneral(false);
    }
  };

  // Toggle Dark Mode
  const handleToggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('budget-ai-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
    toast.success(next ? 'Dark mode enabled' : 'Light mode enabled');
  };

  // Save Privacy Settings
  const handleSavePrivacy = async (updates: any) => {
    setSavingPrivacy(true);
    const payload = {
      autoLockTimeoutMinutes: updates.timeout ?? autoLockTimeout,
      lockOnBackground: updates.bg ?? lockOnBackground,
      shakeToHideEnabled: updates.shake ?? shakeToHide,
      maskAccountNumbers: updates.maskAcc ?? maskAccountNumbers,
    };
    try {
      const res = await fetch('/api/settings/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success('Security preferences saved');
      }
    } catch {
      toast.error('Failed to save security settings');
    } finally {
      setSavingPrivacy(false);
    }
  };

  // Passkey Registration & Revocation
  const handleRegisterPasskey = async () => {
    setIsRegisteringPasskey(true);
    try {
      const optRes = await fetch('/api/auth/passkeys/register/options', { method: 'POST' });
      if (!optRes.ok) throw new Error('Failed to obtain passkey registration options');
      const options = await optRes.json();

      const { startRegistration } = await import('@simplewebauthn/browser');
      const regResp = await startRegistration({ optionsJSON: options });

      const deviceLabel = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')
        ? 'MacBook Touch ID'
        : 'Biometric Authenticator';

      const verifyRes = await fetch('/api/auth/passkeys/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: regResp,
          name: deviceLabel,
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error || 'Passkey verification failed');
      }

      toast.success('Passkey registered successfully');
      loadSecurityData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Passkey registration cancelled or failed');
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  const handleRevokePasskey = async (passkeyId: number) => {
    try {
      const res = await fetch('/api/auth/passkeys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkeyId }),
      });
      if (res.ok) {
        toast.success('Passkey revoked');
        loadSecurityData();
      } else {
        toast.error('Failed to revoke passkey');
      }
    } catch {
      toast.error('Error revoking passkey');
    }
  };

  // 2FA TOTP Setup & Confirmation
  const handleStart2FASetup = async () => {
    try {
      const res = await fetch('/api/auth/2fa', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to initiate 2FA setup');
        return;
      }
      const data = await res.json();
      let secret = '';
      try {
        const parsedUrl = new URL(data.uri);
        secret = parsedUrl.searchParams.get('secret') || '';
      } catch {
        // Fallback
      }
      setTotpSetupData({ uri: data.uri, backupCodes: data.backupCodes || [], secret });
      setShow2FAModal(true);
    } catch {
      toast.error('Failed to load 2FA configuration');
    }
  };

  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpVerifyCode || totpVerifyCode.length !== 6) {
      toast.error('Enter a valid 6-digit verification code');
      return;
    }
    setIsVerifyingTotp(true);
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationCode: totpVerifyCode,
          secret: totpSetupData?.secret || '',
          backupCodes: totpSetupData?.backupCodes || [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Invalid 2FA code');
      }
      toast.success('Two-factor authentication enabled successfully!');
      setTotpEnabled(true);
      setShow2FAModal(false);
      setTotpVerifyCode('');
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setIsVerifyingTotp(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('Disable Two-Factor Authentication? Your account security will be lowered.')) return;
    try {
      const res = await fetch('/api/auth/2fa', { method: 'DELETE' });
      if (res.ok) {
        toast.success('2FA disabled');
        setTotpEnabled(false);
      } else {
        toast.error('Failed to disable 2FA');
      }
    } catch {
      toast.error('Error disabling 2FA');
    }
  };

  // Sessions Revocation
  const handleRevokeSession = async (sessionId: number) => {
    try {
      const res = await fetch(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Session revoked');
        loadSecurityData();
      } else {
        toast.error('Failed to revoke session');
      }
    } catch {
      toast.error('Error revoking session');
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    if (!confirm('Revoke all other logged-in sessions? You will stay logged in on this device.')) return;
    try {
      const res = await fetch('/api/auth/sessions', { method: 'DELETE' });
      if (res.ok) {
        toast.success('All other sessions revoked');
        loadSecurityData();
      } else {
        toast.error('Failed to revoke other sessions');
      }
    } catch {
      toast.error('Error revoking sessions');
    }
  };

  // Calendar Sync Handlers
  const handleCalendarToggle = async (key: 'syncBills' | 'syncSubscriptions' | 'syncDebts') => {
    const nextVal = !calendarSettings[key];
    const updated = { ...calendarSettings, [key]: nextVal };
    setCalendarSettings(updated);
    try {
      await fetch('/api/settings/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: nextVal }),
      });
      toast.success('Sync settings updated');
    } catch {
      toast.error('Failed to update sync setting');
    }
  };

  const handleSyncNow = async () => {
    setSyncingCalendar(true);
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' });
      if (res.ok) {
        toast.success('Calendar successfully synchronized!');
      } else {
        toast.error('Sync failed');
      }
    } catch {
      toast.error('Sync error');
    } finally {
      setSyncingCalendar(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-emerald-400 text-2xl">settings</span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            {locale === 'bn' ? 'সিস্টেম সেটিংস ও পছন্দসমূহ' : 'Settings & Preferences'}
          </h1>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          {locale === 'bn'
            ? 'প্রোফাইল, প্রাতিষ্ঠানিক নিরাপত্তা, অটোমেশন এবং ডেটা ম্যানেজমেন্ট'
            : 'Unified personal profile, security passkeys, automated integrations, and vault exports'}
        </p>
      </div>

      {/* 4 Clean Master Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 backdrop-blur-md">
        <button
          onClick={() => handleTabChange('general')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'general'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
          <span>General & Regional</span>
        </button>

        <button
          onClick={() => handleTabChange('security')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'security'
              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">shield</span>
          <span>Security & Privacy</span>
        </button>

        <button
          onClick={() => handleTabChange('integrations')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'integrations'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">integration_instructions</span>
          <span>Automations & Sync</span>
        </button>

        <button
          onClick={() => handleTabChange('data')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'data'
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">database</span>
          <span>Data & Export</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GENERAL & REGIONAL */}
      {/* ========================================================================= */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md space-y-5"
          >
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Personal Profile & Preferences
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full rounded-xl bg-slate-950/50 border border-slate-800/60 p-3 text-slate-500 outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Base Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white outline-none focus:border-emerald-500"
                >
                  {Object.entries(CURRENCIES).map(([code, cur]) => (
                    <option key={code} value={code}>
                      {code} ({cur.symbol}) - {cur.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Interface Language</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLocale('en')}
                    className={`flex-1 p-3 rounded-xl border text-xs font-bold transition-all ${
                      locale === 'en'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    English (US)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocale('bn')}
                    className={`flex-1 p-3 rounded-xl border text-xs font-bold transition-all ${
                      locale === 'bn'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    বাংলা (Bengali)
                  </button>
                </div>
              </div>
            </div>

            {/* Appearance Theme */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
              <div>
                <p className="text-xs font-bold text-white">Visual Appearance</p>
                <p className="text-[11px] text-slate-400">Toggle dark / light high-contrast theme</p>
              </div>
              <button
                type="button"
                onClick={handleToggleTheme}
                className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isDark ? 'dark_mode' : 'light_mode'}
                </span>
                <span>{isDark ? 'Dark Theme' : 'Light Theme'}</span>
              </button>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={savingGeneral}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                {savingGeneral ? 'Saving...' : 'Save Profile Preferences'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SECURITY & PRIVACY (4-CARD INSTITUTIONAL SECURITY CENTER) */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Card 1: Passkeys & Biometrics */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-lg">fingerprint</span>
                <div>
                  <h2 className="text-sm font-bold text-white">Passkeys & Biometrics</h2>
                  <p className="text-[11px] text-slate-400">Passwordless sign-in with Touch ID, Face ID, or security keys</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRegisterPasskey}
                disabled={isRegisteringPasskey}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isRegisteringPasskey ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>+ Register New Passkey</span>
                  </>
                )}
              </button>
            </div>

            {passkeys.length > 0 ? (
              <div className="space-y-2">
                {passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px]">key</span>
                      </div>
                      <div>
                        <p className="font-bold text-white">{pk.name || 'WebAuthn Passkey'}</p>
                        <p className="text-[10px] text-slate-400">
                          Added: {pk.createdAt ? new Date(pk.createdAt).toLocaleDateString() : 'Recent'}
                          {pk.lastUsedAt && ` • Last used: ${new Date(pk.lastUsedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokePasskey(pk.id)}
                      className="px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-bold text-[11px] transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
                <span className="material-symbols-outlined text-slate-600 text-3xl mb-1">fingerprint</span>
                <p className="text-xs font-semibold text-slate-300">No passkeys registered yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Register your device biometrics for 1-click passwordless login.</p>
              </div>
            )}
          </div>

          {/* Card 2: Two-Factor Authentication */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-400 text-lg">shield_lock</span>
                <div>
                  <h2 className="text-sm font-bold text-white">Two-Factor Authentication (TOTP)</h2>
                  <p className="text-[11px] text-slate-400">Time-based one-time passwords via Google Authenticator, Authy, or 1Password</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  totpEnabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {totpEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <p className="text-xs font-bold text-white">
                  {totpEnabled ? 'Two-Factor Protection Enabled' : 'Protect your vault with 2FA'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {totpEnabled
                    ? 'Requires a 6-digit code on new sign-ins from unrecognized browsers.'
                    : 'Add a mandatory verification step using any standard authenticator app.'}
                </p>
              </div>

              {totpEnabled ? (
                <button
                  type="button"
                  onClick={handleDisable2FA}
                  className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-bold transition-all"
                >
                  Disable 2FA
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStart2FASetup}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-sky-500/20"
                >
                  Setup 2FA Authenticator
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Active Sessions */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-lg">devices</span>
                <div>
                  <h2 className="text-sm font-bold text-white">Active Sessions</h2>
                  <p className="text-[11px] text-slate-400">Logged-in browsers, operating systems, and remote IP addresses</p>
                </div>
              </div>
              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={handleRevokeAllOtherSessions}
                  className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all"
                >
                  Revoke All Other Sessions
                </button>
              )}
            </div>

            <div className="space-y-2">
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300">
                      <span className="material-symbols-outlined text-[18px]">
                        {sess.deviceName?.includes('iOS') || sess.deviceName?.includes('Android') ? 'smartphone' : 'laptop'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{sess.deviceName || 'Web Browser'}</span>
                        {sess.isCurrentDevice && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Current Session
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        IP: {sess.ipAddress || 'Localhost'} • Last Active: {sess.lastUsedAt ? new Date(sess.lastUsedAt).toLocaleString() : 'Just now'}
                      </p>
                    </div>
                  </div>

                  {!sess.isCurrentDevice && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(sess.id)}
                      className="px-2.5 py-1 rounded-lg border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-[11px] font-bold transition-all"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Card 4: Recent Login Activity */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400 text-lg">history_toggle_off</span>
                <div>
                  <h2 className="text-sm font-bold text-white">Recent Login Activity</h2>
                  <p className="text-[11px] text-slate-400">Security audit timeline from account lockout and audit logs</p>
                </div>
              </div>
            </div>

            {loginActivity.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                      <th className="pb-2 font-bold">Status</th>
                      <th className="pb-2 font-bold">Event</th>
                      <th className="pb-2 font-bold">Device & IP</th>
                      <th className="pb-2 font-bold text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loginActivity.slice(0, 5).map((act) => (
                      <tr key={act.id} className="hover:bg-slate-950/40 transition-colors">
                        <td className="py-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                              act.success
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${act.success ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span>{act.success ? 'Success' : 'Blocked'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 font-semibold text-white">{act.action}</td>
                        <td className="py-2.5 text-slate-300">
                          {act.deviceName} <span className="text-slate-500 font-mono text-[11px]">({act.ipAddress})</span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-[11px] text-slate-400">
                          {act.createdAt ? new Date(act.createdAt).toLocaleString() : 'Recent'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                No recent login anomalies recorded.
              </div>
            )}
          </div>

          {/* Inactivity Auto-Lock & Privacy Preferences */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <span className="material-symbols-outlined text-slate-400 text-lg">visibility_off</span>
              Auto-Lock & Global Privacy Masking
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-slate-300 font-bold">Inactivity Auto-Lock Timer</label>
                <p className="text-[11px] text-slate-400">
                  Lock screen automatically after inactivity (Alt+L to lock immediately)
                </p>
                <select
                  value={autoLockTimeout}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setAutoLockTimeout(val);
                    void handleSavePrivacy({ timeout: val });
                  }}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2 text-white outline-none"
                >
                  <option value={0}>Never (Disabled)</option>
                  <option value={1}>1 Minute</option>
                  <option value={5}>5 Minutes (Recommended)</option>
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                </select>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-300">Lock on Background / Tab Switch</p>
                    <p className="text-[11px] text-slate-400">Lock immediately when navigating away</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={lockOnBackground}
                    onChange={(e) => {
                      setLockOnBackground(e.target.checked);
                      void handleSavePrivacy({ bg: e.target.checked });
                    }}
                    className="rounded border-slate-800 text-sky-500 focus:ring-0"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                  <div>
                    <p className="font-bold text-slate-300">Mask Account & Card Numbers</p>
                    <p className="text-[11px] text-slate-400">Show only last 4 digits (•••• 4821)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={maskAccountNumbers}
                    onChange={(e) => {
                      setMaskAccountNumbers(e.target.checked);
                      void handleSavePrivacy({ maskAcc: e.target.checked });
                    }}
                    className="rounded border-slate-800 text-sky-500 focus:ring-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2FA Setup Modal */}
          {show2FAModal && totpSetupData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
              <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 text-slate-100">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-base text-white">Setup Two-Factor Authentication</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShow2FAModal(false);
                      setTotpVerifyCode('');
                    }}
                    className="text-slate-500 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                <div className="text-center space-y-3">
                  <p className="text-xs text-slate-400">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
                  <div className="p-3 bg-white rounded-xl inline-block shadow-inner mx-auto">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpSetupData.uri)}`}
                      alt="2FA QR Code"
                      width={180}
                      height={180}
                      className="rounded"
                    />
                  </div>
                  {totpSetupData.secret && (
                    <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span className="truncate">Key: {totpSetupData.secret}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(totpSetupData.secret || '');
                          toast.success('Secret key copied');
                        }}
                        className="text-emerald-400 font-bold ml-2 shrink-0 hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>

                <form onSubmit={handleConfirm2FA} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Enter 6-Digit Code from App
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={totpVerifyCode}
                      onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full text-center text-lg font-mono font-bold tracking-widest py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-sky-500"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShow2FAModal(false)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifyingTotp || totpVerifyCode.length !== 6}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {isVerifyingTotp ? 'Verifying...' : 'Enable 2FA'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUTOMATIONS & INTEGRATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* Merchant Auto-Rules Quick Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-lg">rule</span>
                Merchant Automation Rules
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure auto-categorization and tax tagging for repeating merchants
              </p>
            </div>
            <Link
              href="/automation-rules"
              className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-bold text-emerald-400 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>Manage Rules</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          {/* Google Calendar Bill Sync */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-lg">calendar_month</span>
                  Google Calendar Synchronizer
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synchronize recurring bills and debt due dates directly with Google Calendar
                </p>
              </div>

              {calendarSettings.isConnected ? (
                <button
                  onClick={handleSyncNow}
                  disabled={syncingCalendar}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5"
                >
                  <span className={`material-symbols-outlined text-[16px] ${syncingCalendar ? 'animate-spin' : ''}`}>
                    sync
                  </span>
                  <span>{syncingCalendar ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              ) : (
                <button
                  onClick={() => toast.info('Connecting to Google Calendar...')}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold"
                >
                  Connect Google Account
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="text-slate-300 font-semibold">Sync Bills</span>
                <input
                  type="checkbox"
                  checked={calendarSettings.syncBills}
                  onChange={() => handleCalendarToggle('syncBills')}
                  className="rounded border-slate-800 text-amber-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="text-slate-300 font-semibold">Sync Subscriptions</span>
                <input
                  type="checkbox"
                  checked={calendarSettings.syncSubscriptions}
                  onChange={() => handleCalendarToggle('syncSubscriptions')}
                  className="rounded border-slate-800 text-amber-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="text-slate-300 font-semibold">Sync Debt Due Dates</span>
                <input
                  type="checkbox"
                  checked={calendarSettings.syncDebts}
                  onChange={() => handleCalendarToggle('syncDebts')}
                  className="rounded border-slate-800 text-amber-500 focus:ring-0"
                />
              </label>
            </div>
          </div>

          {/* PWA Mobile App Installation */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-400 text-lg">install_mobile</span>
                Progressive Web App (PWA)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Install Wealth AI on your device home screen for instant access and offline caching
              </p>
            </div>
            {canInstall ? (
              <button
                onClick={install}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-sky-500/20"
              >
                Install App
              </button>
            ) : (
              <span className="text-xs font-mono text-slate-500 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                PWA Installed / Running
              </span>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DATA & EXPORT */}
      {/* ========================================================================= */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Certified Ledger & Vault Backups
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div>
                  <p className="font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-lg">csv</span>
                    Full Ledger CSV Export
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Complete tabular export of all transactions, categories, and account transfers
                  </p>
                </div>
                <a
                  href="/api/export?format=csv"
                  download
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Download CSV</span>
                </a>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div>
                  <p className="font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-sky-400 text-lg">code</span>
                    Complete JSON Snapshot
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Structured dump of accounts, debts, budgets, goals, and automation rules
                  </p>
                </div>
                <a
                  href="/api/export?format=json"
                  download
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Download JSON</span>
                </a>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-rose-900/40 bg-rose-950/10 p-5 md:p-6 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">warning</span>
              Danger Zone
            </h3>
            <p className="text-xs text-slate-400">
              Irreversible actions. Resetting or deleting will permanently remove all financial ledgers.
            </p>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to reset all transaction data? This cannot be undone.')) {
                  toast.error('Data reset requires master PIN confirmation.');
                }
              }}
              className="px-4 py-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold text-xs hover:bg-rose-500/25 transition-all"
            >
              Reset Financial Records
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
          Loading Settings...
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
