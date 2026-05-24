'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CurrencyCode, CURRENCIES, formatCurrency, convertAmount, FALLBACK_RATES } from '@/lib/currency';

interface CurrencyContextType {
    currency: CurrencyCode;
    rates: Record<string, number>;
    setCurrency: (currency: CurrencyCode) => void;
    fmt: (amountInUSD: number) => string;
    fmtRaw: (amountInLocal: number) => string;
    convert: (amount: number, from: CurrencyCode, to: CurrencyCode) => number;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
        if (typeof window === 'undefined') return 'USD';
        const stored = localStorage.getItem('budget-ai-currency') as CurrencyCode;
        return stored && Object.keys(CURRENCIES).includes(stored) ? stored : 'USD';
    });

    const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);

    useEffect(() => {
        // Fetch user currency preference
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(d => {
                if (d.user?.currency && Object.keys(CURRENCIES).includes(d.user.currency)) {
                    setCurrencyState(d.user.currency as CurrencyCode);
                    localStorage.setItem('budget-ai-currency', d.user.currency);
                }
            })
            .catch(() => { });

        // Fetch live exchange rates
        fetch('/api/rates')
            .then(r => r.json())
            .then(d => {
                if (d.rates) {
                    setRates(d.rates);
                }
            })
            .catch(() => { });
    }, []);

    const setCurrency = (c: CurrencyCode) => {
        setCurrencyState(c);
        localStorage.setItem('budget-ai-currency', c);
    };

    const fmt = (amountInUSD: number) => {
        const converted = convertAmount(amountInUSD, 'USD', currency, rates);
        return formatCurrency(converted, currency);
    };

    const fmtRaw = (amountInLocal: number) => {
        return formatCurrency(amountInLocal, currency);
    };

    const convert = (amount: number, from: CurrencyCode, to: CurrencyCode) => {
        return convertAmount(amount, from, to, rates);
    };

    return (
        <CurrencyContext.Provider value={{ currency, rates, setCurrency, fmt, fmtRaw, convert }}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (!context) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
}
