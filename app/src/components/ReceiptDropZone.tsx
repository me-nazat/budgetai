'use client';

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useHaptics } from '@/hooks/useHaptics';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';

export default function ReceiptDropZone() {
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [result, setResult] = useState<{ vendor: string; amount: number; category: string } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const { success: hapticSuccess } = useHaptics();
    const invalidateFinancialData = useInvalidateFinancialData();

    const processFile = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Only image files (JPG, PNG, WebP) are supported');
            return;
        }

        setLoading(true);
        setResult(null);

        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/transactions/scan', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('OCR scan failed');

            const data = await res.json();
            if (data.transactions && data.transactions.length > 0) {
                const tx = data.transactions[0];
                setResult({
                    vendor: tx.description || 'Unknown Vendor',
                    amount: tx.amount || 0,
                    category: tx.category || 'Other',
                });
                hapticSuccess();
                toast.success(`Receipt scanned: ${tx.description}`, {
                    description: `${tx.amount} → ${tx.category}`,
                });
                await invalidateFinancialData();
            } else {
                toast.info('No transaction data found in this receipt.');
            }
        } catch {
            toast.error('Failed to scan receipt. Try a clearer image.');
        } finally {
            setLoading(false);
        }
    }, [hapticSuccess, invalidateFinancialData]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void processFile(file);
    }, [processFile]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) void processFile(file);
    }, [processFile]);

    const reset = () => {
        setPreview(null);
        setResult(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    return (
        <div className="w-full">
            <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition-all duration-200
                    ${isDragging
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 scale-[1.01]'
                        : 'border-gray-200 dark:border-white/10 hover:border-primary/40 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
            >
                <input aria-label="Input field"
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {loading ? (
                    <div className="flex flex-col items-center gap-2 py-3">
                        <div className="w-7 h-7 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Scanning receipt...</p>
                    </div>
                ) : result ? (
                    <div className="flex items-center gap-3 text-left animate-fade-in">
                        {preview && (
                            <img src={preview} alt="Receipt" className="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-white/10 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{result.vendor}</p>
                            <p className="text-xs text-gray-500">{result.amount} → {result.category}</p>
                        </div>
                        <button
                            onClick={e => { e.stopPropagation(); reset(); }}
                            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1.5 py-2">
                        <span className="material-symbols-outlined text-2xl text-gray-400 dark:text-gray-500" style={{ fontVariationSettings: "'FILL' 0" }}>
                            receipt_long
                        </span>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            Drop receipt image or <span className="text-primary font-bold">browse</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
