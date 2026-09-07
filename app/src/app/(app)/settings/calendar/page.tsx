'use client';

/**
 * @fileoverview Google Calendar Synchronization & Smart Push Alerts Dashboard (Module 18).
 * Renders connection status, per-source sync toggles (bills, subscriptions, debts),
 * reminder advance stepper, immediate sync trigger, and audit event logs.
 *
 * @module app/(app)/settings/calendar/page
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocaleDate, toBengaliNumerals } from '@/lib/formatters/locale';

interface CalendarSettingsState {
  isConnected: boolean;
  googleUserEmail: string | null;
  syncBills: boolean;
  syncSubscriptions: boolean;
  syncDebts: boolean;
  reminderDaysBefore: number;
  lastSyncedAt: number | null;
  recentLogs: Array<{
    id: string;
    sourceType: string;
    sourceId: string;
    googleEventId: string;
    nextPushAt: number | null;
    updatedAt: number | null;
  }>;
}

export default function CalendarSettingsPage() {
  const { locale, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [settings, setSettings] = useState<CalendarSettingsState>({
    isConnected: false,
    googleUserEmail: null,
    syncBills: true,
    syncSubscriptions: true,
    syncDebts: true,
    reminderDaysBefore: 2,
    lastSyncedAt: null,
    recentLogs: [],
  });

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/calendar');
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setSettings({
          isConnected: Boolean(data.isConnected),
          googleUserEmail: data.googleUserEmail || null,
          syncBills: data.syncBills ?? true,
          syncSubscriptions: data.syncSubscriptions ?? true,
          syncDebts: data.syncDebts ?? true,
          reminderDaysBefore: data.reminderDaysBefore ?? 2,
          lastSyncedAt: data.lastSyncedAt || null,
          recentLogs: data.recentLogs || [],
        });
      }
    } catch (err) {
      console.error('Failed to load calendar settings:', err);
      toast.error('Failed to load calendar sync settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = async (key: 'syncBills' | 'syncSubscriptions' | 'syncDebts') => {
    const nextVal = !settings[key];
    const updated = { ...settings, [key]: nextVal };
    setSettings(updated);

    try {
      const res = await fetch('/api/settings/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [key]: nextVal,
        }),
      });
      if (res.ok) {
        toast.success(
          locale === 'bn'
            ? 'পছন্দ সফলভাবে হালনাগাদ হয়েছে।'
            : 'Sync preference updated.'
        );
      }
    } catch {
      toast.error('Failed to update sync toggle.');
      setSettings(settings); // rollback
    }
  };

  const handleReminderDaysChange = async (delta: number) => {
    const next = Math.max(1, Math.min(7, settings.reminderDaysBefore + delta));
    if (next === settings.reminderDaysBefore) return;

    setSettings((prev) => ({ ...prev, reminderDaysBefore: next }));

    try {
      const res = await fetch('/api/settings/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderDaysBefore: next }),
      });
      if (res.ok) {
        toast.success(
          locale === 'bn'
            ? `রিমাইন্ডার ${toBengaliNumerals(next)} দিন আগে নির্ধারিত হয়েছে।`
            : `Reminder set to ${next} days in advance.`
        );
      }
    } catch {
      toast.error('Failed to update reminder window.');
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/calendar/auth', { method: 'POST' });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error(data.error || 'Failed to initiate OAuth flow');
      }
    } catch {
      toast.error('Failed to connect Google Calendar');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/settings/calendar', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Google Calendar disconnected and tokens revoked.');
        setSettings((prev) => ({
          ...prev,
          isConnected: false,
          googleUserEmail: null,
        }));
      } else {
        toast.error('Failed to disconnect Google Calendar');
      }
    } catch {
      toast.error('Error disconnecting calendar');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        const counts = json.data?.syncedEventsCount || {};
        toast.success(
          locale === 'bn'
            ? 'ক্যালেন্ডার ও পুশ অ্যালার্ট সফলভাবে সিঙ্ক হয়েছে।'
            : 'Calendar and smart push alerts synced successfully!'
        );
        fetchSettings();
      } else {
        toast.error(json.error || 'Sync failed');
      }
    } catch {
      toast.error('Error triggering calendar synchronization');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Breadcrumb Header */}
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-text-muted">
        <Link href="/settings" className="hover:text-primary transition-colors">
          {t('nav.settings', 'Settings')}
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white">
          {t('calendar.title', 'Google Calendar Sync')}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-3xl">calendar_month</span>
            {t('calendar.title', 'Google Calendar Sync')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-text-muted mt-1 max-w-2xl">
            {t(
              'calendar.subtitle',
              'Synchronize recurring obligations, debt payoff milestones, and subscription renewals directly to your primary calendar.'
            )}
          </p>
        </div>

        {settings.isConnected && (
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
          >
            <span className={`material-symbols-outlined text-lg ${syncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            {syncing
              ? t('calendar.syncing', 'Syncing...')
              : t('calendar.syncNow', 'Sync Now')}
          </button>
        )}
      </div>

      {/* Connection Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-3xl p-6 border border-gray-200/80 dark:border-white/10"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                settings.isConnected
                  ? 'bg-accent-emerald/15 text-accent-emerald'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-400'
              }`}
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={{ fontVariationSettings: settings.isConnected ? "'FILL' 1" : "'FILL' 0" }}
              >
                {settings.isConnected ? 'cloud_done' : 'cloud_off'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {settings.isConnected
                    ? t('calendar.statusConnected', 'Connected to Google Calendar')
                    : t('calendar.statusDisconnected', 'Not Connected to Calendar')}
                </h2>
                {settings.isConnected && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-accent-emerald/15 text-accent-emerald rounded-full">
                    Active 2-Way Sync
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                {settings.isConnected
                  ? `Connected as ${settings.googleUserEmail || 'Authorized Google Account'}`
                  : 'Connect your Google account to automatically push scheduled reminders.'}
              </p>
            </div>
          </div>

          <div>
            {settings.isConnected ? (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 transition-all min-h-[44px]"
              >
                {disconnecting ? 'Revoking...' : t('calendar.disconnectButton', 'Disconnect')}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-md hover:bg-primary/90 active:scale-95 transition-all min-h-[44px]"
              >
                <span className="material-symbols-outlined text-base">link</span>
                {connecting ? 'Redirecting to Google...' : t('calendar.connectButton', 'Connect Google Calendar')}
              </button>
            )}
          </div>
        </div>

        {settings.lastSyncedAt && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-xs text-gray-500">
            <span>{t('calendar.lastSynced', 'Last synchronized at')}:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-300">
              {formatLocaleDate(settings.lastSyncedAt * 1000, locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </motion.div>

      {/* Per-Source Toggles */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-panel rounded-3xl p-6 border border-gray-200/80 dark:border-white/10 space-y-4"
      >
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">toggle_on</span>
          Synchronization Source Controls
        </h3>
        <p className="text-xs text-gray-500 dark:text-text-muted">
          Choose which financial milestones and recurring obligations are mirrored to your schedule.
        </p>

        <div className="divide-y divide-gray-100 dark:divide-white/5 pt-2">
          {/* Recurring Bills */}
          <div className="py-4 flex items-center justify-between min-h-[56px]">
            <div className="pr-4">
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {t('calendar.syncBills', 'Recurring Invoices & Bills')}
              </div>
              <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                {t(
                  'calendar.syncBillsDesc',
                  'Auto-push utility, rent, and provider invoices due dates to calendar.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('syncBills')}
              className={`w-12 h-6 rounded-full transition-colors relative min-w-[48px] ${
                settings.syncBills ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.syncBills ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Subscriptions */}
          <div className="py-4 flex items-center justify-between min-h-[56px]">
            <div className="pr-4">
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {t('calendar.syncSubscriptions', 'Streaming & SaaS Subscriptions')}
              </div>
              <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                {t(
                  'calendar.syncSubscriptionsDesc',
                  'Schedule alerts before recurring monthly and annual renewals charge your accounts.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('syncSubscriptions')}
              className={`w-12 h-6 rounded-full transition-colors relative min-w-[48px] ${
                settings.syncSubscriptions ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.syncSubscriptions ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Debts */}
          <div className="py-4 flex items-center justify-between min-h-[56px]">
            <div className="pr-4">
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {t('calendar.syncDebts', 'Debt Payoff Milestones')}
              </div>
              <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                {t(
                  'calendar.syncDebtsDesc',
                  'Add payoff horizon dates and major principal reduction checkpoints.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('syncDebts')}
              className={`w-12 h-6 rounded-full transition-colors relative min-w-[48px] ${
                settings.syncDebts ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.syncDebts ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Reminder Days Stepper */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-h-[56px]">
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {t('calendar.reminderDays', 'Advance Alert Horizon')}
              </div>
              <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                {t(
                  'calendar.reminderDaysDesc',
                  'Number of calendar days prior to event to fire proactive notification at 8:00 AM.'
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#161b22] px-3 py-1.5 rounded-2xl border border-gray-200 dark:border-white/10 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleReminderDaysChange(-1)}
                disabled={settings.reminderDaysBefore <= 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">remove</span>
              </button>
              <span className="font-mono font-bold text-sm text-gray-900 dark:text-white min-w-[50px] text-center">
                {locale === 'bn'
                  ? `${toBengaliNumerals(settings.reminderDaysBefore)} দিন`
                  : `${settings.reminderDaysBefore} days`}
              </span>
              <button
                type="button"
                onClick={() => handleReminderDaysChange(1)}
                disabled={settings.reminderDaysBefore >= 7}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sync Audit Event Logs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel rounded-3xl p-6 border border-gray-200/80 dark:border-white/10"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">history</span>
            {t('calendar.logsTitle', 'Recent Synchronization Audit Trail')}
          </h3>
          <span className="text-xs font-semibold text-primary">Last 5 Events</span>
        </div>

        {settings.recentLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-xs font-medium">
            {t(
              'calendar.logsEmpty',
              'No sync events recorded yet. Connect and initiate a sync to populate.'
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {settings.recentLogs.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      log.sourceType === 'BILL'
                        ? 'bg-blue-500/10 text-blue-500'
                        : log.sourceType === 'SUBSCRIPTION'
                        ? 'bg-purple-500/10 text-purple-500'
                        : 'bg-amber-500/10 text-amber-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {log.sourceType === 'BILL'
                        ? 'receipt_long'
                        : log.sourceType === 'SUBSCRIPTION'
                        ? 'subscriptions'
                        : 'credit_card'}
                    </span>
                  </span>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">
                      {log.sourceType}: ID {log.sourceId}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-text-muted font-mono">
                      Event: {log.googleEventId}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-emerald/10 text-accent-emerald font-semibold">
                    Synced
                  </span>
                  {log.nextPushAt && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Push: {formatLocaleDate(log.nextPushAt * 1000, locale, { month: 'short', day: 'numeric', hour: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
