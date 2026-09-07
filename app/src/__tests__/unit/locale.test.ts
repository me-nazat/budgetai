import { describe, it, expect } from 'vitest';
import {
  toBengaliNumerals,
  formatLocaleCurrency,
  formatLocaleDate,
  formatLocalePercent,
  formatLocaleCompact,
  formatLocaleNumber,
  BENGALI_DIGITS,
} from '@/lib/formatters/locale';
import en from '@/locales/en.json';
import bn from '@/locales/bn.json';

describe('Module 17: Native Bilingual Localization & Formatting', () => {
  describe('toBengaliNumerals', () => {
    it('should convert every Western digit 0-9 to native Bengali digits', () => {
      expect(toBengaliNumerals('0123456789')).toBe('০১২৩৪৫৬৭৮৯');
      expect(toBengaliNumerals(9876543210)).toBe('৯৮৭৬৫৪৩২১০');
      expect(toBengaliNumerals('42.50')).toBe('৪২.৫০');
      expect(toBengaliNumerals(-100)).toBe('-১০০');
    });

    it('should handle empty or null values gracefully', () => {
      expect(toBengaliNumerals('')).toBe('');
      // @ts-expect-error test invalid inputs
      expect(toBengaliNumerals(null)).toBe('');
    });
  });

  describe('formatLocaleCurrency', () => {
    it('should format USD in English mode', () => {
      const formatted = formatLocaleCurrency(12500.75, 'en', 'USD');
      expect(formatted).toContain('12,500.75');
      expect(formatted).toContain('$');
    });

    it('should format BDT in English mode', () => {
      const formatted = formatLocaleCurrency(50000, 'en', 'BDT');
      expect(formatted).toContain('50,000.00');
      expect(formatted).toContain('BDT');
    });

    it('should format BDT in Bengali mode with Bengali digits', () => {
      const formatted = formatLocaleCurrency(50000, 'bn', 'BDT');
      expect(formatted).toContain('৫০,০০০.০০');
    });
  });

  describe('formatLocaleDate', () => {
    const testDate = new Date('2026-09-07T12:00:00Z');

    it('should format dates in English mode', () => {
      const formatted = formatLocaleDate(testDate, 'en', { dateStyle: 'medium' });
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Sep');
    });

    it('should format dates in Bengali mode with Bengali numerals', () => {
      const formatted = formatLocaleDate(testDate, 'bn', { dateStyle: 'medium' });
      expect(formatted).toContain('২০২৬');
    });

    it('should return empty string for invalid dates', () => {
      expect(formatLocaleDate('invalid-date', 'en')).toBe('');
    });
  });

  describe('formatLocalePercent', () => {
    it('should format percentage in English', () => {
      expect(formatLocalePercent(15.5, 'en')).toBe('15.5%');
    });

    it('should format percentage in Bengali numerals', () => {
      expect(formatLocalePercent(15.5, 'bn')).toBe('১৫.৫%');
    });
  });

  describe('formatLocaleCompact', () => {
    it('should format compact quantities in English', () => {
      const formatted = formatLocaleCompact(150000, 'en', 'USD');
      expect(formatted).toContain('$');
      expect(formatted).toContain('150K');
    });

    it('should format compact quantities in Bengali', () => {
      const formatted = formatLocaleCompact(150000, 'bn', 'BDT');
      expect(formatted).toContain('৳');
      // Should contain at least one Bengali digit
      expect(BENGALI_DIGITS.some((d) => formatted.includes(d))).toBe(true);
    });
  });

  describe('formatLocaleNumber', () => {
    it('should format localized numbers with thousands/lakh grouping', () => {
      expect(formatLocaleNumber(1234567, 'en', 0)).toBe('1,234,567');
      expect(formatLocaleNumber(1234567, 'bn', 0)).toBe('১২,৩৪,৫৬৭');
    });
  });

  describe('Translation Key Parity (en.json vs bn.json)', () => {
    function getKeys(obj: Record<string, any>, prefix = ''): string[] {
      let keys: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          keys = keys.concat(getKeys(v, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    }

    it('should have 100% key parity between en.json and bn.json', () => {
      const enKeys = getKeys(en);
      const bnKeys = getKeys(bn);

      const missingInBn = enKeys.filter((k) => !bnKeys.includes(k));
      const missingInEn = bnKeys.filter((k) => !enKeys.includes(k));

      expect(missingInBn).toEqual([]);
      expect(missingInEn).toEqual([]);
      expect(enKeys.length).toBeGreaterThan(40);
    });
  });
});
