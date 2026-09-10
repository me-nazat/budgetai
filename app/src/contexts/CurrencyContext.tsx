'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CurrencyCode, CURRENCIES, formatCurrency, convertAmount, FALLBACK_RATES } from '@/lib/currency';
import { useLanguage } from '@/contexts/LanguageContext';

interface CurrencyContextType {
    currency: CurrencyCode;
    symbol: string;
    rates: Record<string, number>;
    setCurrency: (currency: CurrencyCode) => void;
    fmt: (amountInBase: number) => string;
    fmtRaw: (amountInLocal: number) => string;
    convert: (amount: number, from: CurrencyCode, to: CurrencyCode) => number;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const { locale } = useLanguage();
    const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
        if (typeof window === 'undefined') return 'BDT';
        const stored = localStorage.getItem('budget-ai-currency') as CurrencyCode;
        return stored && Object.keys(CURRENCIES).includes(stored) ? stored : 'BDT';
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

    const fmt = (amountInBase: number) => {
        const converted = convertAmount(amountInBase, 'BDT', currency, rates);
        return formatCurrency(converted, currency, locale);
    };

    const fmtRaw = (amountInLocal: number) => {
        return formatCurrency(amountInLocal, currency, locale);
    };


    const convert = (amount: number, from: CurrencyCode, to: CurrencyCode) => {
        return convertAmount(amount, from, to, rates);
    };

    const symbol = CURRENCIES[currency]?.symbol || '$';

    return (
        <CurrencyContext.Provider value={{ currency, symbol, rates, setCurrency, fmt, fmtRaw, convert }}>
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
