'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CURRENCIES, CurrencyCode } from '@/lib/currency';
import type { Variants } from 'framer-motion';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { SparkleEffect } from '@/components/effects/SparkleEffect';

function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const formatted = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const parsed = new Date(formatted);
  return isNaN(parsed.getTime()) ? new Date(dateStr) : parsed;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('BDT');
  const [notifyBudget, setNotifyBudget] = useState(true);
  const [notifyOverspend, setNotifyOverspend] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false);
  const [avatarHovered, setAvatarHovered] = useState(false);

  // 2FA states
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{ uri: string; backupCodes: string[]; secret?: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [totpBackupCodesToShow, setTotpBackupCodesToShow] = useState<string[] | null>(null);
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);

  // Passkeys states
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  const [passkeyName, setPasskeyName] = useState('');
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);

  // Sessions states
  const [sessions, setSessions] = useState<Array<{ id: number; deviceName: string; ipAddress: string; lastUsedAt: string; createdAt: string; isCurrentDevice: boolean }>>([]);
  const [revokingSessions, setRevokingSessions] = useState<Record<number, boolean>>({});
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  // Login activity states
  const [loginActivity, setLoginActivity] = useState<Array<{ id: number; action: string; ipAddress: string; deviceName: string; success: boolean; reason?: string; createdAt: string }>>([]);
  const [showLoginActivity, setShowLoginActivity] = useState(false);

  // Mobile swipe state
  const [swipedSessionId, setSwipedSessionId] = useState<number | null>(null);
  const touchStartX = useRef<number>(0);

  // Google Calendar states
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarConnecting, setCalendarConnecting] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/passkeys');
      const data = await res.json();
      if (data.passkeys) setPasskeys(data.passkeys);
    } catch (err) {
      console.error('Failed to fetch passkeys', err);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/sessions');
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  }, []);

  const fetchLoginActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/audit-log?limit=15');
      const data = await res.json();
      if (data.logs) setLoginActivity(data.logs);
    } catch (err) {
      console.error('Failed to fetch login activity', err);
    }
  }, []);

  const fetchCalendarStatus = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch('/api/calendar/auth');
      const data = await res.json();
      setCalendarConnected(data.isConnected || false);
    } catch (err) {
      console.error('Failed to fetch calendar status', err);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  const handleConnectCalendar = async () => {
    setCalendarConnecting(true);
    try {
      const res = await fetch('/api/calendar/auth', { method: 'POST' });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error(data.error || 'Failed to start calendar connection');
      }
    } catch {
      toast.error('Failed to connect Google Calendar');
    } finally {
      setCalendarConnecting(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      await fetch('/api/calendar/auth', { method: 'DELETE' });
      setCalendarConnected(false);
      toast.success('Google Calendar disconnected');
    } catch {
      toast.error('Failed to disconnect calendar');
    }
  };

  /** Downloads backup/recovery codes as a .txt file */
  const downloadRecoveryCodes = (codes: string[]) => {
    const content = [
      'Wealth AI — Recovery Codes',
      '================================',
      'Store these codes in a safe place.',
      'Each code can only be used once.',
      '',
      ...codes.map((code, i) => `${i + 1}. ${code}`),
      '',
      `Generated: ${new Date().toISOString()}`,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wealth-ai-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Recovery codes downloaded!');
  };

  /** Mobile swipe-to-revoke handlers */
  const handleTouchStart = (e: React.TouchEvent, sessionId: number) => {
    touchStartX.current = e.touches[0].clientX;
    if (swipedSessionId !== sessionId) setSwipedSessionId(null);
  };
  const handleTouchEnd = (e: React.TouchEvent, sessionId: number, isCurrentDevice: boolean) => {
    if (isCurrentDevice) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 80) {
      setSwipedSessionId(sessionId);
    } else if (diff < -40) {
      setSwipedSessionId(null);
    }
  };

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) {
        setName(d.user.name || '');
        setEmail(d.user.email || '');
        setCurrency((d.user.currency || 'BDT') as CurrencyCode);
        setNotifyBudget(d.user.notifyBudget !== undefined ? !!d.user.notifyBudget : !!d.user.notify_budget);
        setNotifyOverspend(d.user.notifyOverspend !== undefined ? !!d.user.notifyOverspend : !!d.user.notify_overspend);
        setTotpEnabled(!!d.user.totpEnabled);
      }
    });

    fetchPasskeys();
    fetchSessions();
    fetchLoginActivity();
    fetchCalendarStatus();

    // Handle OAuth redirect query params
    const params = new URLSearchParams(window.location.search);
    const calendarStatus = params.get('calendar');
    if (calendarStatus === 'connected') {
      toast.success('Google Calendar connected successfully!');
      setCalendarConnected(true);
      window.history.replaceState({}, '', '/settings');
    } else if (calendarStatus === 'denied') {
      toast.error('Google Calendar access was denied');
      window.history.replaceState({}, '', '/settings');
    } else if (calendarStatus === 'error') {
      toast.error('Failed to connect Google Calendar');
      window.history.replaceState({}, '', '/settings');
    }

    return () => observer.disconnect();
  }, [fetchPasskeys, fetchSessions, fetchLoginActivity, fetchCalendarStatus]);

  const save = async () => {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, currency, notifyBudget, notifyOverspend })
    });
    localStorage.setItem('budget-ai-currency', currency);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const toggleTheme = useCallback(() => {
    const html = document.documentElement;
    html.classList.add('theme-transitioning');
    html.classList.toggle('dark');
    const newDark = html.classList.contains('dark');
    setIsDark(newDark);
    localStorage.setItem('budget-ai-theme', newDark ? 'dark' : 'light');
    setTimeout(() => html.classList.remove('theme-transitioning'), 400);
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => { });
    localStorage.removeItem('wealth-ai-swr-cache-v1');
    localStorage.removeItem('wealth-ai-auth-state');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = '/login';
  };

  const handleStart2FASetup = async () => {
    try {
      const res = await fetch('/api/auth/2fa', { method: 'POST' });
      const data = await res.json();
      if (data.uri && data.backupCodes) {
        const url = new URL(data.uri);
        const secret = url.searchParams.get('secret') || '';
        setTotpSetupData({ uri: data.uri, backupCodes: data.backupCodes, secret });
        setIs2FAModalOpen(true);
      }
    } catch (err) {
      toast.error('Failed to initiate 2FA setup');
    }
  };

  const handleConfirm2FA = async () => {
    if (!totpSetupData) return;
    setIsEnabling2FA(true);
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationCode: totpCode,
          secret: totpSetupData.secret,
          backupCodes: totpSetupData.backupCodes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTotpEnabled(true);
        setIs2FAModalOpen(false);
        setTotpBackupCodesToShow(totpSetupData.backupCodes);
        setTotpCode('');
        setTotpSetupData(null);
        toast.success('Two-factor authentication enabled successfully!');
      } else {
        toast.error(data.error?.message || 'Invalid verification code');
      }
    } catch (err) {
      toast.error('Failed to confirm 2FA setup');
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('Are you sure you want to disable Two-Factor Authentication? This will reduce your account security.')) return;
    setIsDisabling2FA(true);
    try {
      const res = await fetch('/api/auth/2fa', { method: 'DELETE' });
      if (res.ok) {
        setTotpEnabled(false);
        toast.success('Two-factor authentication disabled successfully.');
      } else {
        toast.error('Failed to disable 2FA');
      }
    } catch (err) {
      toast.error('Error disabling 2FA');
    } finally {
      setIsDisabling2FA(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!passkeyName) {
      toast.error('Please enter a name for your passkey');
      return;
    }
    setIsRegisteringPasskey(true);
    try {
      const res = await fetch('/api/auth/passkeys/register/options', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to fetch registration options');
      const options = await res.json();

      const { startRegistration } = await import('@simplewebauthn/browser');
      const credential = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/passkeys/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: credential, name: passkeyName }),
      });
      const verifyData = await verifyRes.json();

      if (verifyRes.ok) {
        toast.success('Passkey registered successfully!');
        setIsPasskeyModalOpen(false);
        setPasskeyName('');
        fetchPasskeys();
      } else {
        toast.error(verifyData.error || 'Failed to verify passkey');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to register passkey. Make sure you are using a secure origin (localhost or HTTPS).');
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  const handleDeletePasskey = async (passkeyId: number) => {
    if (!confirm('Are you sure you want to delete this passkey?')) return;
    try {
      const res = await fetch('/api/auth/passkeys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkeyId }),
      });
      if (res.ok) {
        toast.success('Passkey deleted successfully.');
        fetchPasskeys();
      } else {
        toast.error('Failed to delete passkey');
      }
    } catch (err) {
      toast.error('Error deleting passkey');
    }
  };

  const handleRevokeSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to terminate this session?')) return;
    setRevokingSessions(prev => ({ ...prev, [sessionId]: true }));
    try {
      const res = await fetch(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Session terminated.');
        fetchSessions();
      } else {
        toast.error('Failed to revoke session');
      }
    } catch (err) {
      toast.error('Error revoking session');
    } finally {
      setRevokingSessions(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm('Are you sure you want to sign out of all other sessions?')) return;
    setIsRevokingAll(true);
    try {
      const res = await fetch('/api/auth/sessions', { method: 'DELETE' });
      if (res.ok) {
        toast.success('All other sessions revoked.');
        fetchSessions();
      } else {
        toast.error('Failed to revoke sessions');
      }
    } catch (err) {
      toast.error('Error revoking sessions');
    } finally {
      setIsRevokingAll(false);
    }
  };

  return (
    <motion.div
      className="p-4 lg:p-8 max-w-[800px] mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >

      {/* ═══════════════════════════════════════════════
               MOBILE SETTINGS VIEW
               ═══════════════════════════════════════════════ */}
      <div className="lg:hidden space-y-6">
        {/* Profile Header (Redesigned) */}
        <motion.div variants={itemVariants} className="flex flex-col items-center text-center pt-4 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse" />

          <div className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary via-blue-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold shadow-xl shadow-primary/20 mb-4 overflow-hidden border border-white/20">
            <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse" style={{ animationDuration: '3s' }} />
            <span className="relative z-10">{name?.charAt(0)?.toUpperCase() || 'U'}</span>
          </div>

          <div className="bg-white/50 dark:bg-[#161b22]/50 backdrop-blur-md px-6 py-2 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{name || 'User'}</h2>
            <p className="text-sm font-medium text-gray-500 dark:text-text-muted">{email}</p>
          </div>
        </motion.div>

        {/* Settings Groups */}
        <div className="space-y-4">
          {/* Account */}
          <motion.div variants={itemVariants} className="glass-panel rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-[#0A0E1A]/80 backdrop-blur-md border-b border-gray-100 dark:border-[#21262d]">
              <p className="text-[11px] font-bold text-gray-400 dark:text-text-muted uppercase tracking-wider">Account</p>
            </div>
            <div className="px-4 py-3.5 border-b border-gray-100 dark:border-[#21262d]">
              <label className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider mb-1.5 block">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0A0E1A] text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              />
            </div>
            <SparkleEffect sparkleCount={10}>
              <button onClick={save} disabled={saving} className="w-full px-4 py-3.5 text-sm font-bold text-primary dark:text-emerald-400 text-center active:bg-gray-50 dark:active:bg-[#0A0E1A] transition-colors disabled:opacity-50">
                {saved ? '✓ Saved Successfully' : saving ? 'Saving...' : 'Save Profile'}
              </button>
            </SparkleEffect>
          </motion.div>

          {/* Preferences */}
          <motion.div variants={itemVariants} className="glass-panel rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-[#0A0E1A]/80 backdrop-blur-md border-b border-gray-100 dark:border-[#21262d]">
              <p className="text-[11px] font-bold text-gray-400 dark:text-text-muted uppercase tracking-wider">Preferences</p>
            </div>
            <div className="px-4 py-3.5 border-b border-gray-100 dark:border-[#21262d]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Currency</span>
                </div>
                <select
                  value={currency}
                  onChange={e => { setCurrency(e.target.value as CurrencyCode); }}
                  className="bg-gray-100 dark:bg-[#0A0E1A] border border-gray-200 dark:border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 font-bold outline-none"
                >
                  {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => (
                    <option key={code} value={code}>{CURRENCIES[code].flag} {code}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-500 text-[18px]">{isDark ? 'dark_mode' : 'light_mode'}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Dark Mode</span>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isDark ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-500 ease-spring ${isDark ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div variants={itemVariants} className="glass-panel rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-[#0A0E1A]/80 backdrop-blur-md border-b border-gray-100 dark:border-[#21262d]">
              <p className="text-[11px] font-bold text-gray-400 dark:text-text-muted uppercase tracking-wider">Notifications</p>
            </div>
            {[
              { label: 'Budget Alerts', icon: 'trending_up', desc: 'Alert when nearing budget limits', value: notifyBudget, setter: setNotifyBudget, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
              { label: 'Overspending', icon: 'warning', desc: 'Alert on unusual spending', value: notifyOverspend, setter: setNotifyOverspend, color: 'text-rose-500', bg: 'bg-rose-500/10' },
            ].map((item, i) => (
              <div key={i} className={`px-4 py-3.5 ${i < 1 ? 'border-b border-gray-100 dark:border-[#21262d]' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${item.bg} flex items-center justify-center`}>
                      <span className={`material-symbols-outlined ${item.color} text-[18px]`}>{item.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => item.setter(!item.value)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${item.value ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-500 ease-spring ${item.value ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Security */}
          <motion.div variants={itemVariants} className="glass-panel rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-[#0A0E1A]/80 backdrop-blur-md border-b border-gray-100 dark:border-[#21262d]">
              <p className="text-[11px] font-bold text-gray-400 dark:text-text-muted uppercase tracking-wider">Security</p>
            </div>
            <div className="px-4 py-3.5 border-b border-gray-100 dark:border-[#21262d]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[18px]">vibration</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">2FA (TOTP)</p>
                  </div>
                </div>
                <button
                  onClick={totpEnabled ? handleDisable2FA : handleStart2FASetup}
                  disabled={isDisabling2FA}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${totpEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-500 ease-spring ${totpEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {totpBackupCodesToShow && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <p className="text-xs font-bold mb-1">✓ 2FA Activated!</p>
                  <p className="text-[10px] leading-relaxed mb-2">Save these backup codes. They will not be shown again:</p>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] select-all bg-black/20 p-2 rounded-lg text-center tracking-wider">
                    {totpBackupCodesToShow.map((code, idx) => (
                      <div key={idx}>{code}</div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => downloadRecoveryCodes(totpBackupCodesToShow)} className="text-[10px] font-bold underline hover:text-emerald-300 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">download</span> Download .txt
                    </button>
                    <button onClick={() => setTotpBackupCodesToShow(null)} className="text-[10px] font-bold underline hover:text-emerald-300">
                      I&apos;ve saved them
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3.5 border-b border-gray-100 dark:border-[#21262d] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-500 text-[18px]">fingerprint</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Passkeys</span>
                </div>
                <button
                  onClick={() => setIsPasskeyModalOpen(true)}
                  className="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg"
                >
                  Add
                </button>
              </div>

              {passkeys.length > 0 && (
                <div className="space-y-1.5 pt-1.5 border-t border-gray-100 dark:border-white/5">
                  {passkeys.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-black/10">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-gray-800 dark:text-gray-200">{p.name}</p>
                      </div>
                      <button onClick={() => handleDeletePasskey(p.id)} className="text-rose-500 p-1">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-500 text-[18px]">devices</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Active Sessions</span>
                </div>
              </div>
              <div className="space-y-1.5 pt-1.5 border-t border-gray-100 dark:border-white/5">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="relative overflow-hidden rounded-lg"
                    onTouchStart={(e) => handleTouchStart(e, s.id)}
                    onTouchEnd={(e) => handleTouchEnd(e, s.id, s.isCurrentDevice)}
                  >
                    {/* Swipe-to-revoke background */}
                    {!s.isCurrentDevice && (
                      <div className="absolute inset-y-0 right-0 w-20 bg-rose-500 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-[18px]">logout</span>
                      </div>
                    )}
                    <div
                      className={`relative flex items-center justify-between p-2.5 bg-gray-50 dark:bg-black/10 transition-transform duration-200 ${swipedSessionId === s.id ? '-translate-x-20' : 'translate-x-0'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold truncate text-gray-800 dark:text-gray-200">{s.deviceName}</p>
                          {s.isCurrentDevice && (
                            <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-bold rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                              This device
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-gray-400 truncate">IP: {s.ipAddress} · {s.lastUsedAt ? (parseLocalDate(s.lastUsedAt)?.toLocaleDateString() || 'Invalid Date') : 'Active'}</p>
                      </div>
                      {!s.isCurrentDevice && (
                        <button
                          onClick={() => handleRevokeSession(s.id)}
                          disabled={revokingSessions[s.id]}
                          className="text-rose-500 p-1 disabled:opacity-50 hidden lg:block"
                        >
                          <span className="material-symbols-outlined text-[16px]">logout</span>
                        </button>
                      )}
                    </div>
                    {/* Swipe confirm button (visible when swiped) */}
                    {swipedSessionId === s.id && (
                      <button
                        onClick={() => { handleRevokeSession(s.id); setSwipedSessionId(null); }}
                        className="absolute inset-y-0 right-0 w-20 bg-rose-500 flex items-center justify-center active:bg-rose-600"
                      >
                        <span className="text-white text-[10px] font-bold">Revoke</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Login Activity Timeline (Mobile) */}
              <div className="pt-3 border-t border-gray-100 dark:border-white/5">
                <button
                  onClick={() => setShowLoginActivity(!showLoginActivity)}
                  className="flex items-center justify-between w-full py-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-gray-400 text-[16px]">history</span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Login Activity</span>
                  </div>
                  <span className={`material-symbols-outlined text-gray-400 text-[16px] transition-transform ${showLoginActivity ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                <AnimatePresence>
                  {showLoginActivity && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1.5 pt-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {loginActivity.length === 0 ? (
                          <p className="text-[10px] text-gray-400 text-center py-2">No login activity recorded yet</p>
                        ) : (
                          loginActivity.map((event) => (
                            <div key={event.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50/50 dark:bg-white/[0.02]">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${event.success ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
                                <span className={`material-symbols-outlined text-[12px] ${event.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {event.action === 'LOGOUT' ? 'logout' : event.success ? 'check' : 'close'}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate">
                                  {event.action === 'LOGIN' ? 'Signed in' : event.action === 'LOGOUT' ? 'Signed out' : 'Failed login'}
                                  {event.reason && <span className="text-gray-400 font-normal"> · {event.reason}</span>}
                                </p>
                                <p className="text-[9px] text-gray-400 truncate">{event.deviceName} · {event.ipAddress}</p>
                              </div>
                              <span className="text-[9px] text-gray-400 shrink-0 tabular-nums">
                                {parseLocalDate(event.createdAt)?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Sign Out */}
          <motion.div variants={itemVariants}>
            <button
              onClick={handleSignOut}
              className="w-full glass-panel rounded-2xl p-4 text-rose-500 font-bold text-sm text-center active:scale-[0.98] transition-transform shadow-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span> Sign Out
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="text-center pt-2 pb-6">
            <p className="text-[11px] font-medium tracking-wide text-gray-400 dark:text-text-muted/60 uppercase">Wealth AI Version 1.5.0</p>
            <p className="text-[10px] text-gray-400/60 dark:text-text-muted/40 mt-1">Made with ❤️ for precision</p>
          </motion.div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
               DESKTOP VIEW (hidden on mobile)
               ═══════════════════════════════════════════════ */}
      <div className="hidden lg:block">
        <motion.div variants={itemVariants} className="mb-10">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 mb-2 tracking-tight">Settings</h1>
          <p className="text-gray-500 dark:text-text-muted text-sm font-medium">Manage your personal profile and application preferences</p>
        </motion.div>

        <div className="grid grid-cols-12 gap-8">
          {/* Left Column */}
          <div className="col-span-8 space-y-6">
            {/* Profile Card */}
            <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-8 relative overflow-hidden group">
              {/* Decorative Background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform duration-700 group-hover:scale-110" />

              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2 relative z-10">
                <span className="material-symbols-outlined text-primary">person</span>Profile Information
              </h2>

              <div className="flex items-start gap-8 relative z-10">
                {/* Dynamic Avatar */}
                <div
                  className="relative w-24 h-24 rounded-full p-1 bg-gradient-to-br from-primary via-blue-500 to-indigo-600 shadow-xl shadow-primary/20 shrink-0 cursor-pointer overflow-hidden"
                  onMouseEnter={() => setAvatarHovered(true)}
                  onMouseLeave={() => setAvatarHovered(false)}
                >
                  <div className="w-full h-full rounded-full bg-white dark:bg-[#0A0E1A] flex items-center justify-center relative overflow-hidden">
                    {/* Name Initial */}
                    <span className={`text-3xl font-black bg-clip-text text-transparent bg-gradient-to-tr from-primary to-cyan-600 transition-transform duration-300 ${avatarHovered ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}>
                      {name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>

                    {/* Hover Overlay */}
                    <div className={`absolute inset-0 bg-primary/90 flex flex-col items-center justify-center text-white transition-opacity duration-300 ${avatarHovered ? 'opacity-100' : 'opacity-0'}`}>
                      <span className="material-symbols-outlined text-[20px] mb-0.5">add_a_photo</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Display Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-transparent bg-gray-50 hover:bg-gray-100 focus:bg-white dark:bg-[#161b22] dark:hover:bg-[#1c2128] dark:focus:bg-[#0A0E1A] dark:border-white/5 text-gray-900 dark:text-white outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Email Address</label>
                    <input type="email" value={email} disabled className="w-full px-4 py-3 rounded-xl border border-transparent bg-gray-50 dark:bg-[#0A0E1A] text-gray-400 font-medium cursor-not-allowed opacity-70" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Notifications */}
            <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">notifications_active</span>Notification Preferences
              </h2>
              <div className="space-y-4">
                {[{ label: 'Budget Limit Alerts', desc: 'Receive immediate alerts when you exceed 80% of your category limits.', value: notifyBudget, setter: setNotifyBudget, icon: 'account_balance_wallet', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Overspending Detection', desc: 'AI-powered alerts for unusual or exceptionally high transactions.', value: notifyOverspend, setter: setNotifyOverspend, icon: 'monitoring', color: 'text-amber-500', bg: 'bg-amber-500/10' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50 dark:bg-[#161b22] border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-colors group">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                        <span className={`material-symbols-outlined ${item.color}`}>{item.icon}</span>
                      </div>
                      <div>
                        <h3 className="text-gray-900 dark:text-white font-bold text-sm mb-1">{item.label}</h3>
                        <p className="text-gray-500 dark:text-text-muted text-xs font-medium leading-relaxed max-w-md">{item.desc}</p>
                      </div>
                    </div>
                    <button onClick={() => item.setter(!item.value)}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-300 outline-none shadow-inner shrink-0 ${item.value ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}>
                      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-500 ease-spring ${item.value ? 'translate-x-7' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
            {/* Security Card */}
            <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-8 space-y-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">security</span>Security Settings
              </h2>

              {/* 2FA Section */}
              <div className="p-6 rounded-2xl bg-gray-50/50 dark:bg-[#161b22]/50 border border-gray-100 dark:border-white/5 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary">vibration</span>
                    </div>
                    <div>
                      <h3 className="text-gray-900 dark:text-white font-bold text-sm mb-1">Two-Factor Authentication (TOTP)</h3>
                      <p className="text-gray-500 dark:text-text-muted text-xs font-medium leading-relaxed max-w-md">
                        Protect your account with a temporary verification code from your authenticator app.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={totpEnabled ? handleDisable2FA : handleStart2FASetup}
                    disabled={isDisabling2FA}
                    className={`relative w-14 h-7 rounded-full transition-colors duration-300 outline-none shadow-inner shrink-0 ${totpEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
                  >
                    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-500 ease-spring ${totpEnabled ? 'translate-x-7' : 'translate-x-0'}`} />
                  </button>
                </div>

                {totpBackupCodesToShow && (
                  <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <p className="text-xs font-bold mb-2">✓ Two-Factor Authentication Activated!</p>
                    <p className="text-[11px] leading-relaxed mb-3">
                      Save these backup codes in a secure place. They will not be shown again. Each code can be used once if you lose access to your authenticator.
                    </p>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs select-all bg-black/20 p-3 rounded-lg text-center tracking-wider">
                      {totpBackupCodesToShow.map((code, idx) => (
                        <div key={idx}>{code}</div>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <button onClick={() => downloadRecoveryCodes(totpBackupCodesToShow)} className="text-xs font-bold underline hover:text-emerald-300 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">download</span> Download as .txt
                      </button>
                      <button onClick={() => setTotpBackupCodesToShow(null)} className="text-xs font-bold underline hover:text-emerald-300 block">
                        I have saved these codes
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Passkeys Section */}
              <div className="p-6 rounded-2xl bg-gray-50/50 dark:bg-[#161b22]/50 border border-gray-100 dark:border-white/5 transition-colors space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-indigo-500">fingerprint</span>
                    </div>
                    <div>
                      <h3 className="text-gray-900 dark:text-white font-bold text-sm mb-1">Passkeys</h3>
                      <p className="text-gray-500 dark:text-text-muted text-xs font-medium leading-relaxed max-w-md">
                        Sign in securely using biometric verification (Face ID, Touch ID) or a physical hardware security key.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPasskeyModalOpen(true)}
                    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-md shadow-primary/20"
                  >
                    Add Passkey
                  </button>
                </div>

                {passkeys.length > 0 ? (
                  <div className="space-y-2 pt-2 border-t border-gray-200/50 dark:border-[#30363d]/50">
                    {passkeys.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/40 dark:bg-black/20 border border-gray-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-gray-400 dark:text-text-muted">key</span>
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">{p.name}</p>
                            <p className="text-[10px] text-gray-400 dark:text-text-muted/60 mt-0.5">
                              Registered {parseLocalDate(p.createdAt)?.toLocaleDateString()}
                              {p.lastUsedAt && ` • Used ${parseLocalDate(p.lastUsedAt)?.toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => handleDeletePasskey(p.id)} className="text-rose-500 hover:text-rose-400 p-1.5 rounded-lg active:scale-95 transition-transform">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 dark:text-text-muted/60 italic pt-2">No passkeys registered yet.</p>
                )}
              </div>

              {/* Active Sessions Section */}
              <div className="p-6 rounded-2xl bg-gray-50/50 dark:bg-[#161b22]/50 border border-gray-100 dark:border-white/5 transition-colors space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-amber-500">devices</span>
                    </div>
                    <div>
                      <h3 className="text-gray-900 dark:text-white font-bold text-sm mb-1">Active Sessions</h3>
                      <p className="text-gray-500 dark:text-text-muted text-xs font-medium leading-relaxed max-w-md">
                        List of active devices logged into your account.
                      </p>
                    </div>
                  </div>
                  {sessions.length > 1 && (
                    <button
                      onClick={handleRevokeAllSessions}
                      disabled={isRevokingAll}
                      className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      {isRevokingAll ? 'Revoking...' : 'Revoke All Others'}
                    </button>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-200/50 dark:border-[#30363d]/50">
                  {sessions.map((s) => (
                    <div key={s.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${s.isCurrentDevice ? 'bg-emerald-500/5 dark:bg-emerald-500/5 border-emerald-500/20' : 'bg-white/40 dark:bg-black/20 border-gray-100 dark:border-white/5'}`}>
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-gray-400 dark:text-text-muted">
                          {s.deviceName?.toLowerCase()?.includes('phone') || s.deviceName?.toLowerCase()?.includes('android') || s.deviceName?.toLowerCase()?.includes('iphone') ? 'smartphone' : 'laptop'}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-gray-900 dark:text-white">{s.deviceName}</p>
                            {s.isCurrentDevice && (
                              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                This device
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 dark:text-text-muted/60 mt-0.5">
                            IP: {s.ipAddress} • Active: {parseLocalDate(s.lastUsedAt || s.createdAt)?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {!s.isCurrentDevice && (
                        <button
                          onClick={() => handleRevokeSession(s.id)}
                          disabled={revokingSessions[s.id]}
                          className="text-rose-500 hover:text-rose-400 p-1.5 rounded-lg active:scale-95 transition-transform disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">logout</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Login Activity Timeline (Desktop) */}
                <div className="pt-4 mt-4 border-t border-gray-200/50 dark:border-[#30363d]/50">
                  <button
                    onClick={() => setShowLoginActivity(!showLoginActivity)}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors group"
                  >
                    <span className="material-symbols-outlined text-[18px] text-gray-400 group-hover:text-primary transition-colors">history</span>
                    Login Activity
                    <span className={`material-symbols-outlined text-[16px] text-gray-400 transition-transform ${showLoginActivity ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  <AnimatePresence>
                    {showLoginActivity && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-1.5 pt-3 max-h-64 overflow-y-auto custom-scrollbar">
                          {loginActivity.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">No login activity recorded yet</p>
                          ) : (
                            loginActivity.map((event) => (
                              <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/40 dark:bg-black/10 border border-gray-100 dark:border-white/5">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${event.success ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
                                  <span className={`material-symbols-outlined text-[14px] ${event.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {event.action === 'LOGOUT' ? 'logout' : event.success ? 'check_circle' : 'cancel'}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    {event.action === 'LOGIN' ? 'Successful sign-in' : event.action === 'LOGOUT' ? 'Signed out' : 'Failed login attempt'}
                                    {event.reason && <span className="text-gray-400 font-normal"> — {event.reason}</span>}
                                  </p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">{event.deviceName} · {event.ipAddress}</p>
                                </div>
                                <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                                  {parseLocalDate(event.createdAt)?.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="col-span-4 space-y-6">
            {/* Appearance / Theme */}
            <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-6 relative overflow-hidden group cursor-pointer" onClick={toggleTheme}>
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-colors duration-500 ${isDark ? 'bg-amber-500/10' : 'bg-primary/10'}`} />

              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 relative z-10">
                <span className={`material-symbols-outlined ${isDark ? 'text-amber-500' : 'text-primary'}`}>{isDark ? 'dark_mode' : 'light_mode'}</span>Appearance
              </h2>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <h3 className="text-gray-900 dark:text-white font-bold text-sm">Dark Mode</h3>
                  <p className="text-gray-500 dark:text-text-muted text-xs mt-0.5 font-medium">{isDark ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isDark ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}>
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-500 ease-spring ${isDark ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
              </div>
            </motion.div>

            {/* Currency */}
            <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-6">
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">payments</span>Currency
              </h2>
              <div className="space-y-3">
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => {
                  const cur = CURRENCIES[code];
                  const isActive = currency === code;
                  return (
                    <button
                      key={code}
                      onClick={() => setCurrency(code)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${isActive
                        ? 'bg-primary/10 border-2 border-primary/20 shadow-sm'
                        : 'bg-gray-50 dark:bg-[#161b22] border-2 border-transparent hover:border-gray-200 dark:hover:border-white/10'
                        }`}
                    >
                      <span className="text-2xl drop-shadow-sm">{cur.flag}</span>
                      <div className="text-left flex-1 min-w-0">
                        <div className={`font-bold text-sm ${isActive ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                          {cur.symbol} {cur.code}
                        </div>
                      </div>
                      {isActive && (
                        <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Google Calendar Integration */}
            <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-6">
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">calendar_month</span>Google Calendar
              </h2>
              <p className="text-xs text-gray-500 dark:text-text-muted mb-4 font-medium">
                Sync your bills, debt payoffs, and reminders to Google Calendar.
              </p>
              {calendarLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Checking connection...
                </div>
              ) : calendarConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-accent-emerald">
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Connected
                  </div>
                  <button
                    onClick={handleDisconnectCalendar}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectCalendar}
                  disabled={calendarConnecting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-all disabled:opacity-50"
                >
                  {calendarConnecting ? (
                    <><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Connecting...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[18px]">link</span> Connect Google Calendar</>
                  )}
                </button>
              )}
            </motion.div>

            {/* System Info */}
            <motion.div variants={itemVariants} className="pt-4 px-2">
              <p className="text-[11px] font-bold tracking-widest text-gray-400 dark:text-text-muted uppercase mb-1">System Version</p>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Wealth AI <span className="text-primary">v1.5.0</span></p>
            </motion.div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <motion.div variants={itemVariants} className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200/60 dark:border-[#30363d]/50">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-5 py-2.5 text-rose-500 font-bold text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span> Sign Out
          </button>

          <SparkleEffect sparkleCount={15}>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-8 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg shadow-black/10 dark:shadow-white/10">
              {saved ? <><span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Saved</> :
                saving ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> Saving...</> :
                  'Save Changes'}
            </button>
          </SparkleEffect>
        </motion.div>
      </div>

      <Toaster position="top-right" richColors />

      {/* 2FA Setup Modal/Drawer */}
      {(is2FAModalOpen && totpSetupData) && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-950/55 z-[99] backdrop-blur-md transition-opacity" onClick={() => setIs2FAModalOpen(false)} />

          {/* Mobile Sheet / Desktop Modal */}
          <div className={`
                        fixed z-[100] overflow-hidden transition-all duration-[400ms] transform
                        lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-[480px] lg:rounded-3xl lg:border lg:h-auto
                        bottom-0 left-0 w-full rounded-t-[2rem] border-t max-h-[90vh] flex flex-col
                        bg-white dark:bg-[#0A0E1A] border-gray-200/80 dark:border-white/10 shadow-2xl
                    `}>
            {/* Mobile Drag Handle */}
            <div className="w-full flex justify-center py-3 shrink-0 lg:hidden" onClick={() => setIs2FAModalOpen(false)}>
              <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Modal/Drawer Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5 shrink-0">
              <h3 className="text-gray-900 dark:text-white font-black text-lg">Set Up Two-Factor Auth</h3>
              <button onClick={() => setIs2FAModalOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-300 transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal/Drawer Content */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh] lg:max-h-[600px] scrollbar-none">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">1</span>
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">Scan this QR code with Google Authenticator or another TOTP app:</p>
                </div>

                <div className="flex justify-center p-4 bg-white rounded-2xl border border-gray-100 shadow-inner max-w-[200px] mx-auto">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpSetupData.uri)}`} alt="2FA QR Code" className="w-[180px] h-[180px] object-contain" />
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">2</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">Or enter this key manually:</p>
                    <p className="font-mono text-xs font-bold tracking-wider text-primary select-all bg-gray-100 dark:bg-white/5 px-3 py-2 rounded-xl mt-2 break-all text-center">{totpSetupData.secret}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-gray-100 dark:border-white/5">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">3</span>
                  <div className="flex-1 space-y-3">
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">Enter the 6-digit confirmation code from your app:</p>
                    <input
                      type="text"
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full text-center px-4 py-3 rounded-xl font-mono text-lg tracking-[0.5rem] border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-black/40 text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleConfirm2FA}
                disabled={isEnabling2FA || totpCode.length !== 6}
                className="w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg shadow-black/10 dark:shadow-white/10"
              >
                {isEnabling2FA ? 'Verifying...' : 'Enable 2FA'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Passkey Modal/Drawer */}
      {isPasskeyModalOpen && (
        <>
          <div className="fixed inset-0 bg-slate-950/55 z-[99] backdrop-blur-md transition-opacity" onClick={() => setIsPasskeyModalOpen(false)} />

          <div className={`
                        fixed z-[100] overflow-hidden transition-all duration-[400ms] transform
                        lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-[400px] lg:rounded-3xl lg:border lg:h-auto
                        bottom-0 left-0 w-full rounded-t-[2rem] border-t max-h-[80vh] flex flex-col
                        bg-white dark:bg-[#0A0E1A] border-gray-200/80 dark:border-white/10 shadow-2xl
                    `}>
            <div className="w-full flex justify-center py-3 shrink-0 lg:hidden" onClick={() => setIsPasskeyModalOpen(false)}>
              <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5 shrink-0">
              <h3 className="text-gray-900 dark:text-white font-black text-lg">Add Passkey</h3>
              <button onClick={() => setIsPasskeyModalOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-300 transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Passkey Name</label>
                <input
                  type="text"
                  value={passkeyName}
                  onChange={e => setPasskeyName(e.target.value)}
                  placeholder="e.g. iPhone, YubiKey, MacBook"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-black/40 text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>

              <button
                onClick={handleRegisterPasskey}
                disabled={isRegisteringPasskey || !passkeyName}
                className="w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg shadow-black/10 dark:shadow-white/10"
              >
                {isRegisteringPasskey ? 'Registering...' : 'Register Passkey'}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
