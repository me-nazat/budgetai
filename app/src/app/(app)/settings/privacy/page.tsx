'use client';

/**
 * @fileoverview Privacy & Security Center Page (Module 14 — Global Privacy Mode).
 *
 * Provides dedicated configuration for:
 * - Inactivity Auto-Lock timer (Never, 1 min, 5 min, 15 min, 30 min)
 * - Lock on background / tab switch
 * - Mobile shake-to-hide financial numbers gesture
 * - Account & card number masking across lists and exports
 * - Live Privacy Mode preview and keyboard shortcut indicators
 *
 * @module app/(app)/settings/privacy/page
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { motion } from 'framer-motion';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { fadeIn, slideUp, staggerContainer, staggerItem } from '@/lib/motion';
import { maskAccountNumber } from '@/lib/security/privacy';

const TIMEOUT_OPTIONS = [
  { value: 0, labelKey: 'privacyPage.timeoutNever', defaultLabel: 'Never (Disabled)' },
  { value: 1, labelKey: 'privacyPage.timeout1m', defaultLabel: '1 Minute' },
  { value: 5, labelKey: 'privacyPage.timeout5m', defaultLabel: '5 Minutes (Recommended)' },
  { value: 15, labelKey: 'privacyPage.timeout15m', defaultLabel: '15 Minutes' },
  { value: 30, labelKey: 'privacyPage.timeout30m', defaultLabel: '30 Minutes' },
];

export default function PrivacySettingsPage() {
  const { isPrivacyMode, togglePrivacy } = usePrivacy();
  const { t } = useLanguage();

  const { data, isLoading } = useSWR<{
    data: {
      autoLockTimeoutMinutes: number;
      lockOnBackground: boolean;
      shakeToHideEnabled: boolean;
      maskAccountNumbers: boolean;
    };
  }>('/api/settings/privacy');

  const [autoLockTimeout, setAutoLockTimeout] = useState<number>(0);
  const [lockOnBackground, setLockOnBackground] = useState<boolean>(false);
  const [shakeToHide, setShakeToHide] = useState<boolean>(true);
  const [maskAccountNumbersState, setMaskAccountNumbersState] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (data?.data) {
      setAutoLockTimeout(data.data.autoLockTimeoutMinutes);
      setLockOnBackground(data.data.lockOnBackground);
      setShakeToHide(data.data.shakeToHideEnabled);
      setMaskAccountNumbersState(data.data.maskAccountNumbers);
    }
  }, [data]);

  const handleSave = async (updates?: {
    timeout?: number;
    bg?: boolean;
    shake?: boolean;
    maskAcc?: boolean;
  }) => {
    setSaving(true);
    setSavedSuccess(false);

    const payload = {
      autoLockTimeoutMinutes: updates?.timeout ?? autoLockTimeout,
      lockOnBackground: updates?.bg ?? lockOnBackground,
      shakeToHideEnabled: updates?.shake ?? shakeToHide,
      maskAccountNumbers: updates?.maskAcc ?? maskAccountNumbersState,
    };

    try {
      const res = await fetch('/api/settings/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await mutate('/api/settings/privacy');
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to update privacy settings', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8"
    >
      {/* Header with Navigation */}
      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              {t('settings', 'Settings')}
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('privacyMode', 'Privacy')}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {t('privacyPage.title', 'Privacy & Security Center')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t(
              'privacyPage.subtitle',
              'Configure app auto-lock, biometric shielding, and balance masking preferences.'
            )}
          </p>
        </div>

        {savedSuccess && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-emerald/10 text-accent-emerald text-sm font-semibold"
          >
            <span className="material-symbols-outlined text-base">check_circle</span>
            {t('privacyPage.saved', 'Settings Saved')}
          </motion.div>
        )}
      </motion.div>

      {/* Live Privacy Mode Preview Banner */}
      <motion.div
        variants={staggerItem}
        className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden bg-gradient-to-r from-primary/5 via-primary-light to-transparent"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">shield</span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('privacyPage.livePreviewTitle', 'Instant Privacy Shield')}
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl">
              {t(
                'privacyPage.livePreviewDesc',
                'Toggle privacy mode instantly across all screens. Use the keyboard shortcut anywhere in the app.'
              )}
            </p>
            <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-mono text-gray-600 dark:text-gray-300">
              <span className="font-semibold">Shortcut:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-black/40 border border-gray-300 dark:border-white/20 shadow-xs">
                ⌘ / Ctrl
              </kbd>
              +
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-black/40 border border-gray-300 dark:border-white/20 shadow-xs">
                Shift
              </kbd>
              +
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-black/40 border border-gray-300 dark:border-white/20 shadow-xs">
                P
              </kbd>
            </div>
          </div>

          {/* Interactive Toggle Card */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            <button
              type="button"
              onClick={togglePrivacy}
              className={`min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-sm ${
                isPrivacyMode
                  ? 'bg-accent-amber text-slate-950 hover:bg-amber-400 shadow-amber-500/20'
                  : 'bg-primary text-white hover:bg-primary-hover shadow-primary/25'
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {isPrivacyMode ? 'visibility_off' : 'visibility'}
              </span>
              {isPrivacyMode
                ? t('privacyPage.shieldActive', 'Shield Active (Masked)')
                : t('privacyPage.shieldInactive', 'Shield Inactive (Visible)')}
            </button>
            <div className="text-right">
              <span className="text-xs text-gray-400">Sample Card: </span>
              <span className="text-xs font-mono font-medium text-gray-800 dark:text-gray-200">
                {isPrivacyMode ? '••••••••' : '$145,280.00'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Auto-Lock Inactivity Configuration */}
      <motion.div variants={staggerItem} className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-xl">timer</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {t('privacyPage.autoLockHeader', 'Inactivity Auto-Lock')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(
                'privacyPage.autoLockSub',
                'Automatically shield the screen and require authentication after period of inactivity.'
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {TIMEOUT_OPTIONS.map((option) => {
            const isSelected = autoLockTimeout === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setAutoLockTimeout(option.value);
                  handleSave({ timeout: option.value });
                }}
                disabled={saving || isLoading}
                className={`min-h-[44px] px-4 py-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-sm">{t(option.labelKey, option.defaultLabel)}</span>
                <span className="material-symbols-outlined text-lg">
                  {isSelected ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Toggles & Behavior Settings */}
      <motion.div variants={staggerItem} className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
        <h3 className="text-base font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-white/10 pb-3">
          {t('privacyPage.behaviorHeader', 'Data Protection & Behavioral Triggers')}
        </h3>

        {/* Lock on background */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <label htmlFor="toggle-lock-bg" className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('privacyPage.lockOnBgTitle', 'Lock on Background / Tab Switch')}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(
                'privacyPage.lockOnBgDesc',
                'Immediately trigger the lock screen whenever you switch apps or minimize the browser window.'
              )}
            </p>
          </div>
          <button
            id="toggle-lock-bg"
            type="button"
            role="switch"
            aria-checked={lockOnBackground}
            onClick={() => {
              const next = !lockOnBackground;
              setLockOnBackground(next);
              handleSave({ bg: next });
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary ${
              lockOnBackground ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                lockOnBackground ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Shake to hide */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <label htmlFor="toggle-shake" className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('privacyPage.shakeTitle', 'Mobile Shake-to-Hide Gesture')}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(
                'privacyPage.shakeDesc',
                'On mobile devices with accelerometer, quickly shaking your phone activates privacy mode for 3 seconds.'
              )}
            </p>
          </div>
          <button
            id="toggle-shake"
            type="button"
            role="switch"
            aria-checked={shakeToHide}
            onClick={() => {
              const next = !shakeToHide;
              setShakeToHide(next);
              handleSave({ shake: next });
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary ${
              shakeToHide ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                shakeToHide ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Mask account numbers */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <label htmlFor="toggle-mask-acc" className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('privacyPage.maskAccTitle', 'Mask Account & Card Numbers in Reports')}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(
                'privacyPage.maskAccDesc',
                'Display only last 4 digits (e.g. •••• 9012) in account cards, transaction tables, PDF and CSV exports.'
              )}
            </p>
          </div>
          <button
            id="toggle-mask-acc"
            type="button"
            role="switch"
            aria-checked={maskAccountNumbersState}
            onClick={() => {
              const next = !maskAccountNumbersState;
              setMaskAccountNumbersState(next);
              handleSave({ maskAcc: next });
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary ${
              maskAccountNumbersState ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                maskAccountNumbersState ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </motion.div>

      {/* Account Number Preview Showcase */}
      <motion.div variants={staggerItem} className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-primary">credit_card</span>
          {t('privacyPage.accountPreviewTitle', 'Live Sanitization Preview')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-white/5 space-y-1">
            <span className="text-xs text-gray-400">Sample Chase Checking</span>
            <p className="text-base font-mono font-medium text-gray-900 dark:text-white">
              {maskAccountNumbersState ? maskAccountNumber('123456789012') : '123456789012'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-white/5 space-y-1">
            <span className="text-xs text-gray-400">Sample Visa Signature</span>
            <p className="text-base font-mono font-medium text-gray-900 dark:text-white">
              {maskAccountNumbersState ? maskAccountNumber('4532123456789012') : '4532 1234 5678 9012'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Anonymous Peer Benchmarking Consent Management (Feature 11.1) */}
      <motion.div variants={staggerItem} className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/10">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">leaderboard</span>
              Anonymous Peer Benchmarking Consent
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Strict k-anonymity (N ≥ 30) data sharing for demographic cohorts
            </p>
          </div>
          <Link
            href="/benchmarks"
            className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors"
          >
            Re-take Wizard
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-white/5">
          <div>
            <span className="text-xs font-semibold text-gray-900 dark:text-white block">
              Withdraw All Benchmark Data
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Immediately revokes all metric consents and removes your profile from cohort calculations.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (confirm('Withdraw completely from anonymous peer benchmarks?')) {
                await fetch('/api/benchmarking/consent', { method: 'DELETE' });
                alert('Successfully withdrawn from peer benchmarking');
              }
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-xs font-bold transition-all"
          >
            Withdraw from Benchmarks
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
