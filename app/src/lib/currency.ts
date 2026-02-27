// Currency utilities for USD / BDT switching
// Exchange rate: 1 USD ≈ 121 BDT (approximate)

export const CURRENCIES = {
    USD: { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
    BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', flag: '🇧🇩' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

const USD_TO_BDT_RATE = 121;

export function convertAmount(amount: number, from: CurrencyCode, to: CurrencyCode): number {
    if (from === to) return amount;
    if (from === 'USD' && to === 'BDT') return amount * USD_TO_BDT_RATE;
    if (from === 'BDT' && to === 'USD') return amount / USD_TO_BDT_RATE;
    return amount;
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'USD'): string {
    const info = CURRENCIES[currency];
    if (currency === 'BDT') {
        // BDT formatting: ৳1,234.56
        return `${info.symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// Format with conversion from stored USD to display currency
export function displayAmount(amountInUSD: number, displayCurrency: CurrencyCode = 'USD'): string {
    const converted = convertAmount(amountInUSD, 'USD', displayCurrency);
    return formatCurrency(converted, displayCurrency);
}
