'use client';

import { useState, useEffect } from 'react';
import { CURRENCIES, CurrencyCode } from '@/lib/currency';

export default function CurrencySelector() {
    const [show, setShow] = useState(false);
    const [selected, setSelected] = useState<CurrencyCode | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Check if currency has been chosen before
        const stored = localStorage.getItem('budget-ai-currency');
        if (!stored) {
            // No currency set — show the selector
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShow(true);
        }
    }, []);

    const handleSelect = async (code: CurrencyCode) => {
        setSelected(code);
        setSaving(true);

        try {
            // Save to server
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currency: code }),
            });
        } catch { /* ignore */ }

        // Save to localStorage
        localStorage.setItem('budget-ai-currency', code);
        setSaving(false);
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#1a1f2e] rounded-3xl border border-gray-200 dark:border-gray-700/50 shadow-2xl shadow-black/30 p-8 max-w-md w-full mx-4 animate-scale-in">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>currency_exchange</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose Your Currency</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">All amounts will be displayed in your selected currency. You can change this later in Settings.</p>
                </div>

                {/* Currency Options */}
                <div className="space-y-3">
                    {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
                        const cur = CURRENCIES[code];
                        const isSelected = selected === code;
                        return (
                            <button
                                key={code}
                                onClick={() => handleSelect(code)}
                                disabled={saving}
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all duration-200 group
                                    ${isSelected
                                        ? 'bg-primary/10 border-primary dark:border-primary ring-2 ring-primary/20'
                                        : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-white/10 hover:border-primary/50'
                                    }`}
                            >
                                <span className="text-3xl">{cur.flag}</span>
                                <div className="flex flex-col items-start">
                                    <span className="font-semibold text-gray-900 dark:text-white">{cur.name}</span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">{cur.symbol} ({cur.code})</span>
                                </div>
                                <div className="ml-auto">
                                    {isSelected && saving ? (
                                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    ) : isSelected ? (
                                        <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                    ) : (
                                        <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 group-hover:text-primary/50 transition-colors">radio_button_unchecked</span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
