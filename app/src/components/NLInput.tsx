'use client';

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useHaptics } from '@/hooks/useHaptics';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';

interface ParsedTransaction {
    type: string;
    amount: number;
    category: string;
    description: string;
    date: string;
}

export default function NLInput() {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { success: hapticSuccess, tap: hapticTap } = useHaptics();
    const invalidateFinancialData = useInvalidateFinancialData();

    const handleSubmit = useCallback(async (overrideText?: string) => {
        const text = (overrideText || input).trim();
        if (!text || loading) return;

        setLoading(true);
        setParsed(null);
        if (!overrideText) setInput(''); // clear input early for better UX

        try {
            const res = await fetch('/api/transactions/nlp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });

            if (!res.ok) throw new Error('NLP parsing failed');

            const data = await res.json();
            if (data.transaction) {
                setParsed(data.transaction);
                hapticSuccess();
                toast.success(`Logged: ${data.transaction.description}`, {
                    description: `${data.transaction.type === 'expense' ? '−' : '+'} ${data.transaction.amount} → ${data.transaction.category}`,
                });
                await invalidateFinancialData();
                setTimeout(() => setParsed(null), 3000);
            }
        } catch {
            toast.error('Could not parse. Try: "Spent 500 on groceries"');
            if (!overrideText) setInput(text); // restore input on failure
        } finally {
            setLoading(false);
        }
    }, [input, loading, hapticSuccess, invalidateFinancialData]);

    const { isListening, startListening, stopListening, supported: voiceSupported } = useVoiceRecognition((text) => {
        hapticTap();
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
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-gray-400 dark:text-gray-500 group-focus-within:text-primary transition-colors" style={{ fontVariationSettings: "'FILL' 1" }}>
                        auto_awesome
                    </span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={isListening ? 'Listening...' : input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder='Try: "Spent 1500 BDT on transport"'
                        disabled={loading || isListening}
                        className="w-full rounded-2xl border border-gray-200 bg-white/80 pl-11 pr-12 py-3 text-sm font-medium text-gray-900 outline-none backdrop-blur-lg placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500 transition-all"
                    />
                    {voiceSupported && !input && (
                        <button
                            onClick={isListening ? stopListening : startListening}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isListening ? 'bg-rose-100 text-rose-500 dark:bg-rose-500/20 animate-pulse' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-300'}`}
                            title="Log by voice"
                        >
                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: isListening ? "'FILL' 1" : "'FILL' 0" }}>mic</span>
                        </button>
                    )}
                </div>
                <button
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

            {parsed && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-fade-in">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>{parsed.type === 'expense' ? '−' : '+'}{parsed.amount}</span>
                    <span className="text-emerald-500">•</span>
                    <span>{parsed.category}</span>
                    <span className="text-emerald-500">•</span>
                    <span>{parsed.description}</span>
                </div>
            )}
        </div>
    );
}
