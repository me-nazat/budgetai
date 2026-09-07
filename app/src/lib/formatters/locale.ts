/**
 * @fileoverview Centralized Locale Formatting Engine (Module 17 — Bilingual Localization).
 *
 * Provides locale-aware number, currency, date, and percentage formatting
 * with native support for Bengali (বাংলা) and English (EN).
 *
 * @module lib/formatters/locale
 */

export const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/**
 * Converts Western digits (0-9) to native Bengali numerals (০-৯).
 *
 * @param numberStr - Any string or number to be converted
 * @returns Digits converted to Bengali numeral equivalents
 */
export function toBengaliNumerals(numberStr: string | number): string {
  if (numberStr === null || numberStr === undefined) return '';
  const str = numberStr.toString();
  return str.replace(/[0-9]/g, (digit) => BENGALI_DIGITS[parseInt(digit, 10)]);
}

/**
 * Formats a currency amount according to the chosen locale and ISO currency code.
 * In Bengali locale, Western digits are translated to native Bengali numerals.
 *
 * @param amount - Monetary quantity
 * @param locale - 'en' or 'bn'
 * @param currencyCode - ISO currency code (default 'BDT')
 * @returns Formatted currency string (e.g. "৳১,২৩৪.৫০" or "$1,234.50")
 */
export function formatLocaleCurrency(
  amount: number,
  locale: 'en' | 'bn',
  currencyCode: string = 'BDT'
): string {
  if (locale === 'bn') {
    const formatted = new Intl.NumberFormat('bn-BD', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return toBengaliNumerals(formatted);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats dates according to locale and format style.
 *
 * @param date - Date object, ISO timestamp, or milliseconds epoch
 * @param locale - 'en' or 'bn'
 * @param options - Standard Intl DateTimeFormat options
 * @returns Formatted localized date string
 */
export function formatLocaleDate(
  date: Date | string | number,
  locale: 'en' | 'bn',
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const tag = locale === 'bn' ? 'bn-BD' : 'en-US';
  const formatted = new Intl.DateTimeFormat(tag, options).format(d);
  return locale === 'bn' ? toBengaliNumerals(formatted) : formatted;
}

/**
 * Formats percentages according to locale.
 * e.g. 15.5% or ১৫.৫%
 */
export function formatLocalePercent(
  value: number,
  locale: 'en' | 'bn',
  decimals: number = 1
): string {
  const numStr = value.toFixed(decimals);
  if (locale === 'bn') {
    return `${toBengaliNumerals(numStr)}%`;
  }
  return `${numStr}%`;
}

/**
 * Formats compact numbers for stat cards and chart badges.
 * e.g. 125000 -> $125K / ৳১.৩লা
 */
export function formatLocaleCompact(
  amount: number,
  locale: 'en' | 'bn',
  currencyCode?: string
): string {
  const tag = locale === 'bn' ? 'bn-BD' : 'en-US';
  const formatted = new Intl.NumberFormat(tag, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);

  const prefix = currencyCode
    ? currencyCode === 'BDT'
      ? '৳'
      : currencyCode === 'USD'
      ? '$'
      : `${currencyCode} `
    : '';

  const result = locale === 'bn' ? toBengaliNumerals(formatted) : formatted;
  return `${prefix}${result}`;
}

/**
 * Formats plain numbers with localized thousands grouping.
 */
export function formatLocaleNumber(
  num: number,
  locale: 'en' | 'bn',
  decimals?: number
): string {
  const tag = locale === 'bn' ? 'bn-BD' : 'en-US';
  const formatted = new Intl.NumberFormat(tag, {
    minimumFractionDigits: decimals !== undefined ? decimals : 0,
    maximumFractionDigits: decimals !== undefined ? decimals : 2,
  }).format(num);

  return locale === 'bn' ? toBengaliNumerals(formatted) : formatted;
}
