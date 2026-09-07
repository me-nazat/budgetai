/**
 * @fileoverview Unified Locale-Aware Formatting Layer (Module 17).
 * Supports English (en-US) and Bengali (bn-BD) with native digit conversions,
 * South Asian compact numbering (হাজার, লাখ, কোটি), and date formatting.
 *
 * @module lib/formatters/locale
 */

import { toBengaliNumerals } from './bengaliNumerals';
import { useLanguage, type Locale } from '@/contexts/LanguageContext';

export { toBengaliNumerals };

export const BENGALI_MONTHS_FULL = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

export const BENGALI_MONTHS_SHORT = [
  'জানু',
  'ফেব্রু',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টে',
  'অক্টো',
  'নভে',
  'ডিসে',
];

/**
 * Formats a monetary amount into a localized currency string.
 */
export function formatLocaleCurrency(
  amount: number,
  locale: Locale = 'en',
  currencyCode: string = 'BDT'
): string {
  const safeAmount = isNaN(amount) ? 0 : amount;

  if (locale === 'bn') {
    const formatted = new Intl.NumberFormat('bn-BD', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);

    return toBengaliNumerals(formatted);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

/**
 * Formats a date string, timestamp, or Date object into a localized date string.
 */
export function formatLocaleDate(
  dateInput: string | number | Date,
  locale: Locale = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof dateInput === 'object' ? dateInput : new Date(dateInput);
  if (isNaN(dateObj.getTime())) return '';

  const defaultOpts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  const opts = options || defaultOpts;

  if (locale === 'bn') {
    try {
      const formatted = new Intl.DateTimeFormat('bn-BD', opts).format(dateObj);
      return toBengaliNumerals(formatted);
    } catch {
      // Fallback manual formatting if bn-BD locale not available in engine
      const day = toBengaliNumerals(dateObj.getDate());
      const month = BENGALI_MONTHS_SHORT[dateObj.getMonth()];
      const year = toBengaliNumerals(dateObj.getFullYear());
      return `${day} ${month}, ${year}`;
    }
  }

  return new Intl.DateTimeFormat('en-US', opts).format(dateObj);
}

/**
 * Formats a decimal or percentage number (e.g. 15.5 -> "15.5%" or "১৫.৫%").
 */
export function formatLocalePercent(
  value: number,
  locale: Locale = 'en',
  decimals: number = 1
): string {
  const safeVal = isNaN(value) ? 0 : value;
  const rounded = safeVal.toFixed(decimals);

  if (locale === 'bn') {
    return `${toBengaliNumerals(rounded)}%`;
  }
  return `${rounded}%`;
}

/**
 * Formats compact numbers (e.g. $1.2K / ৳১.২ হাজার, ৳১৫ লাখ, ৳২.৫ কোটি).
 */
export function formatLocaleCompact(
  amount: number,
  locale: Locale = 'en',
  currencySymbol: string = '৳'
): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  const abs = Math.abs(safeAmount);
  const sign = safeAmount < 0 ? '-' : '';

  if (locale === 'bn') {
    if (abs >= 10000000) {
      // Crore (কোটি)
      const val = (abs / 10000000).toFixed(2);
      return `${sign}${currencySymbol}${toBengaliNumerals(val)} কোটি`;
    }
    if (abs >= 100000) {
      // Lakh (লাখ)
      const val = (abs / 100000).toFixed(1);
      return `${sign}${currencySymbol}${toBengaliNumerals(val)} লাখ`;
    }
    if (abs >= 1000) {
      // Thousand (হাজার)
      const val = (abs / 1000).toFixed(1);
      return `${sign}${currencySymbol}${toBengaliNumerals(val)} হাজার`;
    }
    return `${sign}${currencySymbol}${toBengaliNumerals(abs.toFixed(0))}`;
  }

  // English standard compact (K, M, B)
  if (abs >= 1000000000) {
    return `${sign}${currencySymbol}${(abs / 1000000000).toFixed(1)}B`;
  }
  if (abs >= 1000000) {
    return `${sign}${currencySymbol}${(abs / 1000000).toFixed(1)}M`;
  }
  if (abs >= 1000) {
    return `${sign}${currencySymbol}${(abs / 1000).toFixed(1)}K`;
  }
  return `${sign}${currencySymbol}${abs.toFixed(0)}`;
}

/**
 * React hook that binds formatters to the active LanguageContext locale.
 */
export function useLocaleFormatters() {
  const { locale } = useLanguage();

  return {
    locale,
    formatCurrency: (amount: number, currencyCode?: string) =>
      formatLocaleCurrency(amount, locale, currencyCode),
    formatDate: (date: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
      formatLocaleDate(date, locale, options),
    formatPercent: (value: number, decimals?: number) =>
      formatLocalePercent(value, locale, decimals),
    formatCompact: (amount: number, currencySymbol?: string) =>
      formatLocaleCompact(amount, locale, currencySymbol),
    toNumerals: (input: string | number) =>
      locale === 'bn' ? toBengaliNumerals(input) : input.toString(),
  };
}
