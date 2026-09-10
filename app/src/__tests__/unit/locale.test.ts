import { describe, it, expect } from 'vitest';
import {
  formatLocaleCurrency,
  formatLocaleDate,
  formatLocalePercent,
  formatLocaleCompact,
  toBengaliNumerals,
} from '@/lib/formatters/locale';

describe('Module 17: Unified Locale Formatting Suite', () => {
  describe('formatLocaleCurrency', () => {
    it('formats BDT currency in English locale correctly', () => {
      const res = formatLocaleCurrency(50000, 'en', 'BDT');
      expect(res).toBeDefined();
      expect(res).toContain('50,000.00');
    });

    it('formats BDT currency in Bengali locale with native digits', () => {
      const res = formatLocaleCurrency(50000, 'bn', 'BDT');
      expect(res).toBeDefined();
      expect(res).toContain('৫০,০০০');
    });

    it('handles negative balances gracefully', () => {
      const resEn = formatLocaleCurrency(-1250.5, 'en', 'BDT');
      expect(resEn).toContain('-');
      expect(resEn).toContain('1,250.50');
      const resBn = formatLocaleCurrency(-1250.5, 'bn', 'BDT');
      expect(resBn).toContain('১,২৫০');
    });

    it('handles zero and NaN safely', () => {
      expect(formatLocaleCurrency(0, 'en', 'USD')).toContain('0.00');
      expect(formatLocaleCurrency(NaN, 'bn', 'BDT')).toContain('০.০০');
    });
  });

  describe('formatLocaleDate', () => {
    const testDate = new Date('2026-03-15T12:00:00Z');

    it('formats dates in English standard', () => {
      const res = formatLocaleDate(testDate, 'en');
      expect(res).toMatch(/Mar(ch)? 15, 2026/);
    });

    it('formats dates in Bengali with Bengali month or numerals', () => {
      const res = formatLocaleDate(testDate, 'bn');
      expect(res).toMatch(/২০২৬/); // Bengali 2026
      expect(res).toMatch(/১৫/); // Bengali 15
    });

    it('returns empty string on invalid dates', () => {
      expect(formatLocaleDate('invalid-date-string', 'en')).toBe('');
      expect(formatLocaleDate('invalid-date-string', 'bn')).toBe('');
    });
  });

  describe('formatLocalePercent', () => {
    it('formats percentage in English', () => {
      expect(formatLocalePercent(18.75, 'en', 1)).toBe('18.8%');
      expect(formatLocalePercent(0.42, 'en', 2)).toBe('0.42%');
    });

    it('formats percentage in Bengali with Bengali numerals', () => {
      expect(formatLocalePercent(18.8, 'bn', 1)).toBe('১৮.৮%');
      expect(formatLocalePercent(100, 'bn', 0)).toBe('১০০%');
    });
  });

  describe('formatLocaleCompact', () => {
    it('formats compact values in English (K, M, B)', () => {
      expect(formatLocaleCompact(1500, 'en', '$')).toBe('$1.5K');
      expect(formatLocaleCompact(2500000, 'en', '$')).toBe('$2.5M');
      expect(formatLocaleCompact(1200000000, 'en', '$')).toBe('$1.2B');
    });

    it('formats compact values in Bengali using South Asian units (হাজার, লাখ, কোটি)', () => {
      expect(formatLocaleCompact(1500, 'bn', '৳')).toBe('৳১.৫ হাজার');
      expect(formatLocaleCompact(250000, 'bn', '৳')).toBe('৳২.৫ লাখ');
      expect(formatLocaleCompact(15000000, 'bn', '৳')).toBe('৳১.৫০ কোটি');
    });

    it('handles negative compact values cleanly', () => {
      expect(formatLocaleCompact(-5000, 'en', '$')).toBe('-$5.0K');
      expect(formatLocaleCompact(-5000, 'bn', '৳')).toBe('-৳৫.০ হাজার');
    });
  });

  describe('toBengaliNumerals', () => {
    it('converts all digits 0-9 accurately', () => {
      expect(toBengaliNumerals('0123456789')).toBe('০১২৩৪৫৬৭৮৯');
    });

    it('preserves formatting punctuation like commas, dots, and currency symbols', () => {
      expect(toBengaliNumerals('৳ 1,23,456.78')).toBe('৳ ১,২৩,৪৫৬.৭৮');
    });
  });

  describe('formatCurrency with Bengali locale branching', () => {
    it('formats BDT currency with English digits when locale is en', async () => {
      const { formatCurrency } = await import('@/lib/currency');
      const res = formatCurrency(25000, 'BDT', 'en');
      expect(res).toContain('25,000.00');
    });

    it('routes through bengaliNumerals when locale is bn', async () => {
      const { formatCurrency } = await import('@/lib/currency');
      const res = formatCurrency(25000, 'BDT', 'bn');
      expect(res).toContain('২৫,০০০');
    });

    it('formats USD currency in Bengali digits when locale is bn', async () => {
      const { formatCurrency } = await import('@/lib/currency');
      const res = formatCurrency(120, 'USD', 'bn');
      expect(res).toContain('১২০');
    });
  });
});

