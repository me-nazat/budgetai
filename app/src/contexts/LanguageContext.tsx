'use client';

/**
 * @fileoverview Language context provider for EN ⇄ বাংলা (Bilingual) experience.
 *
 * Provides current locale state ('en' | 'bn'), toggle function, and t() translation function.
 * Persisted in localStorage and user profile settings.
 *
 * @module contexts/LanguageContext
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import en from '@/locales/en.json';
import bn from '@/locales/bn.json';

export type Locale = 'en' | 'bn';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const dictionaries: Record<Locale, Record<string, any>> = {
  en,
  bn,
};

const LanguageContext = createContext<LanguageContextValue>({
  locale: 'en',
  setLocale: () => {},
  toggleLanguage: () => {},
  t: (key, fallback) => fallback || key,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = localStorage.getItem('appLanguage') as Locale;
    if (stored && (stored === 'en' || stored === 'bn')) {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('appLanguage', newLocale);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLocaleState(prev => {
      const next = prev === 'en' ? 'bn' : 'en';
      localStorage.setItem('appLanguage', next);
      return next;
    });
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    const dict = dictionaries[locale] || dictionaries.en;
    const parts = key.split('.');
    let curr: any = dict;
    for (const p of parts) {
      if (curr && typeof curr === 'object' && p in curr) {
        curr = curr[p];
      } else {
        return fallback || key;
      }
    }
    return typeof curr === 'string' ? curr : fallback || key;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
