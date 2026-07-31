/**
 * @fileoverview Bengali Numeral & South Asian Currency Formatter.
 * Converts Western digits (0-9) to native Bengali digits (০-৯) and formats currency values.
 */

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliNumerals(numberStr: string | number): string {
  const str = numberStr.toString();
  return str.replace(/[0-9]/g, (digit) => BENGALI_DIGITS[parseInt(digit, 10)]);
}

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
  }).format(amount);
}
