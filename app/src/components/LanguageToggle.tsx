'use client';

/**
 * @fileoverview Language toggle component for switching between English (EN) and Bengali (বাংলা).
 *
 * Provides a tactile, accessible 44px-compliant button that toggles the global
 * language context state and persists preference in localStorage.
 *
 * @module components/LanguageToggle
 */

import { useLanguage } from '@/contexts/LanguageContext';

interface LanguageToggleProps {
  className?: string;
}

export default function LanguageToggle({ className = '' }: LanguageToggleProps) {
  const { locale, toggleLanguage } = useLanguage();

  const isEn = locale === 'en';

  return (
    <button
      onClick={toggleLanguage}
      type="button"
      className={`relative inline-flex items-center justify-center min-w-[44px] h-10 px-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-surface-dark hover:bg-gray-100 dark:hover:bg-surface-hover active:scale-95 transition-all duration-200 shadow-sm group ${className}`}
      title={isEn ? 'বাংলা ভাষায় পরিবর্তন করুন (Switch to Bengali)' : 'Switch to English'}
      aria-label={isEn ? 'Switch to Bengali language' : 'Switch to English language'}
    >
      <div className="flex items-center gap-1 font-semibold text-xs tracking-tight">
        <span
          className={`transition-colors duration-200 ${
            isEn ? 'text-primary font-bold' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
          }`}
        >
          EN
        </span>
        <span className="text-gray-300 dark:text-white/20 select-none">/</span>
        <span
          className={`transition-colors duration-200 ${
            !isEn ? 'text-primary font-bold' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
          }`}
        >
          বাং
        </span>
      </div>
    </button>
  );
}
