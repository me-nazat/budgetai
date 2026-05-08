'use client';

import { useState, useEffect } from 'react';
import { CurrencyCode, formatCurrency } from '@/lib/currency';

export function useCurrency() {
    const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
        if (typeof window === 'undefined') return 'USD';
        const stored = localStorage.getItem('budget-ai-currency');
        return stored === 'USD' || stored === 'BDT' ? stored : 'USD';
    });

    useEffect(() => {
        // Fetch the server value to be sure
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(d => {
                if (d.user?.currency && (d.user.currency === 'USD' || d.user.currency === 'BDT')) {
                    setCurrencyState(d.user.currency as CurrencyCode);
                    localStorage.setItem('budget-ai-currency', d.user.currency);
                }
            })
            .catch(() => { });
    }, []);

    const fmt = (amount: number) => formatCurrency(amount, currency);

    // Format with currency symbol but NO conversion (for amounts already in the user's currency)
    const fmtRaw = (amount: number) => formatCurrency(amount, currency);

    return { currency, fmt, fmtRaw };
}
