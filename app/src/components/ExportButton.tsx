'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export default function ExportButton() {
    const [loading, setLoading] = useState(false);

    const handleExport = async (format: 'csv' | 'json') => {
        setLoading(true);
        try {
            const now = new Date();
            const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            const end = now.toISOString().split('T')[0];

            const res = await fetch(`/api/transactions?start=${start}&end=${end}&limit=500`);
            if (!res.ok) throw new Error('Failed to fetch data');

            const data = await res.json();
            const transactions = data.transactions || [];

            if (transactions.length === 0) {
                toast.info('No transactions to export this month.');
                return;
            }

            let blob: Blob;
            let filename: string;

            if (format === 'csv') {
                const header = 'Date,Type,Category,Description,Amount\n';
                const rows = transactions.map((t: { date: string; type: string; category: string; description: string; amount: number }) =>
                    `${t.date},${t.type},"${t.category}","${(t.description || '').replace(/"/g, '""')}",${t.amount}`
                ).join('\n');
                blob = new Blob([header + rows], { type: 'text/csv' });
                filename = `transactions-${start}-to-${end}.csv`;
            } else {
                blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' });
                filename = `transactions-${start}-to-${end}.json`;
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            toast.success(`Exported ${transactions.length} transactions as ${format.toUpperCase()}`);
        } catch {
            toast.error('Export failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => void handleExport('csv')}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-surface-hover disabled:opacity-50 transition-all active:scale-95"
            >
                <span className="material-symbols-outlined text-lg">table_view</span>
                CSV
            </button>
            <button
                onClick={() => void handleExport('json')}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-surface-hover disabled:opacity-50 transition-all active:scale-95"
            >
                <span className="material-symbols-outlined text-lg">data_object</span>
                JSON
            </button>
        </div>
    );
}
