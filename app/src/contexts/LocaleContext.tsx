'use client';

/**
 * @fileoverview Locale Context (Module 17).
 * Provides client-side bilingual localization context ('en' | 'bn'),
 * state management, translation helper t(key), and sync with users.locale.
 * Seamlessly aliases the canonical LanguageContext to prevent duplicate state trees.
 *
 * @module contexts/LocaleContext
 */

import {
  LanguageContext,
  LanguageProvider as LocaleProvider,
  useLanguage as useLocale,
  type Locale,
} from './LanguageContext';

export type { Locale };
export { LocaleProvider, useLocale };
export const LocaleContext = LanguageContext;
export default useLocale;
