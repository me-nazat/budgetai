'use client';

/**
 * @fileoverview Language picker sheet / modal for WealthAI.
 * Allows users to choose between English and Bengali, with stubs for Urdu, Hindi, and Arabic.
 * Saves preference to LanguageContext, localStorage, and PUT /api/settings/locale.
 *
 * @module components/settings/LanguagePickerSheet
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage, type Locale } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isAvailable: boolean;
  dir?: 'ltr' | 'rtl';
}

const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English (US)',
    flag: '🇺🇸',
    isAvailable: true,
    dir: 'ltr',
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা (Bangladesh)',
    flag: '🇧🇩',
    isAvailable: true,
    dir: 'ltr',
  },
  {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو (Pakistan)',
    flag: '🇵🇰',
    isAvailable: false,
    dir: 'rtl',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी (India)',
    flag: '🇮🇳',
    isAvailable: false,
    dir: 'ltr',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية (Standard)',
    flag: '🇸🇦',
    isAvailable: false,
    dir: 'rtl',
  },
];

interface LanguagePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LanguagePickerSheet({ isOpen, onClose }: LanguagePickerSheetProps) {
  const { locale, setLocale, t } = useLanguage();
  const [saving, setSaving] = useState(false);

  const handleSelect = async (lang: LanguageOption) => {
    if (!lang.isAvailable) {
      toast.info(`${lang.name} localization is coming soon in an upcoming release!`);
      return;
    }

    if (lang.code === locale) {
      onClose();
      return;
    }

    setSaving(true);
    const newLocale = lang.code as Locale;
    setLocale(newLocale);

    try {
      const res = await fetch('/api/settings/locale', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLocale: newLocale }),
      });
      if (res.ok) {
        toast.success(
          newLocale === 'bn'
            ? 'ভাষা সফলভাবে বাংলায় পরিবর্তিত হয়েছে।'
            : 'Language updated to English successfully.'
        );
      }
    } catch {
      // Local state is already updated via context
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white dark:bg-[#12161f] border border-gray-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 z-10 max-h-[85vh] overflow-y-auto"
          >
            {/* Grab handle for mobile */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">translate</span>
                  {t('settingsPage.languageSelect', 'Display Language & Locale')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                  {t(
                    'settingsPage.localeSection',
                    'Choose your active dialect, numeric digits, and calendar system.'
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-2.5 mt-4">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = locale === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleSelect(lang)}
                    disabled={saving}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all duration-200 min-h-[52px] ${
                      isSelected
                        ? 'bg-primary/10 border-primary/40 dark:border-primary/50 shadow-sm'
                        : 'bg-gray-50 dark:bg-[#161b22] border-transparent hover:border-gray-200 dark:hover:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5'
                    } ${!lang.isAvailable ? 'opacity-65' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="text-2xl drop-shadow-sm select-none">{lang.flag}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-sm ${
                              isSelected ? 'text-primary' : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {lang.nativeName}
                          </span>
                          {!lang.isAvailable && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-full">
                              {locale === 'bn' ? 'শীঘ্রই আসছে' : 'Coming soon'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-text-muted">
                          {lang.name} {lang.dir === 'rtl' ? '• RTL Ready' : ''}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <span
                        className="material-symbols-outlined text-primary text-xl"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-xs text-gray-500 dark:text-text-muted">
              <span>{t('settingsPage.autoDetectLocale', 'OS Locale Sync')}</span>
              <span className="font-semibold text-primary">
                {locale === 'bn' ? 'বাংলা (BD) সক্রিয়' : 'English (US) Active'}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
