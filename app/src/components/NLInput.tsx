'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useHaptics } from '@/hooks/useHaptics';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { parseFinancialText, type DeterministicParsedTokens } from '@/lib/deterministic-nlp';
import { useAccounts } from '@/hooks/useApi';
import { QUICK_CATEGORIES } from '@/lib/categoryUtils';

interface ParsedTransaction {
    type: string;
    amount: number;
    category: string;
    description: string;
    date: string;
    account?: string;
}

export default function NLInput() {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
    const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
    const [accountPickerOpen, setAccountPickerOpen] = useState(false);
    
    // User manual overrides on live pills
    const [overrideType, setOverrideType] = useState<'expense' | 'earning' | null>(null);
    const [overrideCategory, setOverrideCategory] = useState<string | null>(null);
    const [overrideAccountId, setOverrideAccountId] = useState<number | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const { success: hapticSuccess, tap: hapticTap } = useHaptics();
    const invalidateFinancialData = useInvalidateFinancialData();
    const { accounts } = useAccounts();

    // Live deterministic token detection as user types
    const detectedTokens: DeterministicParsedTokens | null = useMemo(() => {
        if (!input.trim()) return null;
        return parseFinancialText(input);
    }, [input]);

    const activeType = overrideType || detectedTokens?.type || 'expense';
    const activeCategory = overrideCategory || detectedTokens?.category || (activeType === 'earning' ? 'Income' : 'Other');
    
    // Resolve matched account
    const matchedAccount = useMemo(() => {
        if (overrideAccountId) {
            return accounts.find((a) => a.id === overrideAccountId);
        }
        if (detectedTokens?.accountHint && accounts.length > 0) {
            const hint = detectedTokens.accountHint.toLowerCase();
            return accounts.find((a) =>
                a.name.toLowerCase().includes(hint) ||
                hint.includes(a.name.toLowerCase()) ||
                a.type.toLowerCase().includes(hint)
            );
        }
        return accounts[0] || null;
    }, [overrideAccountId, detectedTokens?.accountHint, accounts]);

    const resetOverrides = () => {
        setOverrideType(null);
        setOverrideCategory(null);
        setOverrideAccountId(null);
        setCategoryPickerOpen(false);
        setAccountPickerOpen(false);
    };

    const handleSubmit = useCallback(async (overrideText?: string) => {
        const text = (overrideText || input).trim();
        if (!text || loading) return;

        setLoading(true);
        setParsed(null);
        if (!overrideText) setInput(''); // clear input early for better UX

        const overridesToSend: Record<string, any> = {};
        if (overrideType) overridesToSend.type = overrideType;
        if (overrideCategory) overridesToSend.category = overrideCategory;
        if (overrideAccountId) overridesToSend.accountId = overrideAccountId;

        try {
            const res = await fetch('/api/transactions/nlp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    override: Object.keys(overridesToSend).length > 0 ? overridesToSend : undefined,
                }),
            });

            if (!res.ok) throw new Error('NLP parsing failed');

            const data = await res.json();
            if (data.transaction) {
                setParsed(data.transaction);
                resetOverrides();
                hapticSuccess();
                toast.success(`Logged: ${data.transaction.description}`, {
                    description: `${data.transaction.type === 'expense' ? '−' : '+'} ${data.transaction.amount} → ${data.transaction.category}`,
                });
                await invalidateFinancialData();
                setTimeout(() => setParsed(null), 4000);
            }
        } catch {
            toast.error('Could not parse. Try: "Coffee at North End 420 from City Bank"');
            if (!overrideText) setInput(text); // restore input on failure
        } finally {
            setLoading(false);
        }
    }, [input, loading, overrideType, overrideCategory, overrideAccountId, hapticSuccess, invalidateFinancialData]);

    const { isListening, startListening, stopListening, supported: voiceSupported } = useVoiceRecognition((text) => {
        hapticTap();
        setInput(text);
        void handleSubmit(text);
    });

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSubmit();
        }
    };

    return (
        <div className="w-full">
            <div className="relative flex items-center gap-2">
                <div className="relative flex-1 group">
                    <span
                        className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-gray-400 dark:text-gray-500 group-focus-within:text-primary transition-colors"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                        auto_awesome
                    </span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={isListening ? 'Listening...' : input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            if (!e.target.value) resetOverrides();
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder='Try: "Coffee at North End 420 from City Bank" or "Salary 80000 yesterday"'
                        disabled={loading || isListening}
                        className="w-full rounded-2xl border border-gray-200 bg-white/80 pl-11 pr-12 py-3 text-sm font-medium text-gray-900 outline-none backdrop-blur-lg placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500 transition-all"
                    />
                    {voiceSupported && !input && (
                        <button
                            type="button"
                            onClick={isListening ? stopListening : startListening}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                                isListening
                                    ? 'bg-rose-100 text-rose-500 dark:bg-rose-500/20 animate-pulse'
                                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-300'
                            }`}
                            title="Log by voice"
                        >
                            <span
                                className="material-symbols-outlined text-lg"
                                style={{ fontVariationSettings: isListening ? "'FILL' 1" : "'FILL' 0" }}
                            >
                                mic
                            </span>
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={!input.trim() || loading || isListening}
                    className="h-[46px] w-[46px] shrink-0 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/25 hover:bg-blue-600 disabled:opacity-40 disabled:shadow-none transition-all active:scale-95"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <span className="material-symbols-outlined text-xl">send</span>
                    )}
                </button>
            </div>

            {/* Live Interactive Token Preview Pills */}
            {detectedTokens && input.trim().length > 3 && !parsed && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 animate-fade-in text-xs">
                    {/* Type pill */}
                    <button
                        type="button"
                        onClick={() => {
                            hapticTap();
                            setOverrideType(activeType === 'expense' ? 'earning' : 'expense');
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-all ${
                            activeType === 'expense'
                                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
                        }`}
                        title="Click to toggle Expense / Income"
                    >
                        <span className="material-symbols-outlined text-[13px]">
                            {activeType === 'expense' ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                        <span>{activeType === 'expense' ? 'Expense' : 'Income'}</span>
                    </button>

                    {/* Amount pill */}
                    {detectedTokens.amount !== null && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono font-bold tabular-nums bg-gray-100 text-gray-800 border border-gray-200 dark:bg-[#161b22] dark:text-white dark:border-[#30363d]">
                            <span className="text-gray-400 font-sans">Amt:</span>
                            {detectedTokens.amount.toLocaleString()}
                        </span>
                    )}

                    {/* Category pill with popover override */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                hapticTap();
                                setCategoryPickerOpen(!categoryPickerOpen);
                                setAccountPickerOpen(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20 hover:bg-blue-100 transition-colors"
                            title="Click to change category"
                        >
                            <span className="material-symbols-outlined text-[13px]">category</span>
                            <span>{activeCategory}</span>
                            <span className="material-symbols-outlined text-[12px] opacity-60">arrow_drop_down</span>
                        </button>

                        {categoryPickerOpen && (
                            <div className="absolute top-full mt-1 left-0 z-50 w-44 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-[#30363d] dark:bg-[#161b22] max-h-48 overflow-y-auto">
                                {QUICK_CATEGORIES.map((cat: string) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => {
                                            setOverrideCategory(cat);
                                            setCategoryPickerOpen(false);
                                        }}
                                        className="w-full text-left px-2 py-1 rounded-md text-xs hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-800 dark:text-gray-200"
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Account hint / match pill */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                hapticTap();
                                setAccountPickerOpen(!accountPickerOpen);
                                setCategoryPickerOpen(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold bg-gray-100 text-gray-700 border border-gray-200 dark:bg-[#161b22] dark:text-gray-300 dark:border-[#30363d] hover:bg-gray-200 transition-colors"
                            title="Click to change account"
                        >
                            <span className="material-symbols-outlined text-[13px]">account_balance_wallet</span>
                            <span>{matchedAccount?.name || 'Default Account'}</span>
                            <span className="material-symbols-outlined text-[12px] opacity-60">arrow_drop_down</span>
                        </button>

                        {accountPickerOpen && accounts.length > 0 && (
                            <div className="absolute top-full mt-1 left-0 z-50 w-48 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-[#30363d] dark:bg-[#161b22] max-h-48 overflow-y-auto">
                                {accounts.map((acc) => (
                                    <button
                                        key={acc.id}
                                        type="button"
                                        onClick={() => {
                                            setOverrideAccountId(acc.id);
                                            setAccountPickerOpen(false);
                                        }}
                                        className="w-full text-left px-2 py-1 rounded-md text-xs hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-800 dark:text-gray-200 flex justify-between"
                                    >
                                        <span className="truncate">{acc.name}</span>
                                        <span className="text-[10px] text-gray-400 capitalize">{acc.type}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Date pill */}
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-gray-500 dark:text-gray-400 text-[11px]">
                        <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                        <span>{detectedTokens.date}</span>
                    </span>
                </div>
            )}

            {/* Committed Confirmation Pill */}
            {parsed && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-fade-in">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span className="font-mono font-bold tabular-nums">
                        {parsed.type === 'expense' ? '−' : '+'}{parsed.amount}
                    </span>
                    <span className="text-emerald-500">•</span>
                    <span>{parsed.category}</span>
                    <span className="text-emerald-500">•</span>
                    <span className="truncate max-w-[200px]">{parsed.description}</span>
                </div>
            )}
        </div>
    );
}
