// Currency utilities for USD / BDT switching
// Exchange rate: 1 USD ≈ 121 BDT (approximate)

export const CURRENCIES = {
    USD: { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
    BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', flag: '🇧🇩' },
    EUR: { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
    GBP: { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
    INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
    CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
    AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

// Fallback rates if API is unavailable
export const FALLBACK_RATES: Record<CurrencyCode, number> = {
    USD: 1,
    BDT: 121,
    EUR: 0.92,
    GBP: 0.79,
    INR: 83.5,
    CAD: 1.36,
    AUD: 1.52,
};

export function convertAmount(amount: number, from: CurrencyCode, to: CurrencyCode, rates: Record<string, number> = FALLBACK_RATES): number {
    if (from === to) return amount;
    const amountInUSD = from === 'USD' ? amount : amount / (rates[from] || FALLBACK_RATES[from]);
    return amountInUSD * (rates[to] || FALLBACK_RATES[to]);
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'BDT'): string {
    const info = CURRENCIES[currency];
    if (currency === 'BDT' || currency === 'INR') {
        // South Asian numbering system formatting
        return `${info.symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

// Format with conversion from stored base (BDT) to display currency
export function displayAmount(amountInBase: number, displayCurrency: CurrencyCode = 'BDT'): string {
    const converted = convertAmount(amountInBase, 'BDT', displayCurrency);
    return formatCurrency(converted, displayCurrency);
}
