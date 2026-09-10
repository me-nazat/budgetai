'use client';

/**
 * @fileoverview Locale Context (Module 17).
 * Provides client-side bilingual localization context ('en' | 'bn'),
 * state management, translation helper t(key), and sync with users.locale.
 *
 * @module contexts/LocaleContext
 */

import React from 'react';
import {
  LanguageProvider as LocaleProvider,
  useLanguage as useLocale,
  type Locale,
} from './LanguageContext';

export type { Locale };
export { LocaleProvider, useLocale };

export const LocaleContext = React.createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}>({
  locale: 'en',
  setLocale: () => {},
  toggleLanguage: () => {},
  t: (key, fallback) => fallback || key,
});
