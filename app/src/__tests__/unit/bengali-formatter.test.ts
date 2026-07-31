import { describe, it, expect } from 'vitest';
import { toBengaliNumerals, formatLocaleCurrency } from '@/lib/formatters/bengaliNumerals';

describe('Module 17: Bengali Numeral & Currency Formatter', () => {
  it('should convert Western digits to Bengali numerals', () => {
    expect(toBengaliNumerals('1234567890')).toBe('১২৩৪৫৬৭৮৯০');
    expect(toBengaliNumerals(42.5)).toBe('৪২.৫');
  });

  it('should format English currency using USD / BDT standard', () => {
    const formatted = formatLocaleCurrency(12450.5, 'en', 'USD');
    expect(formatted).toContain('12,450.50');
  });
});
