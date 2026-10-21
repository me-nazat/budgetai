'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface ExportButtonProps {
    transactions?: Array<{
        date: string;
        type: string;
        category: string;
        description: string;
        amount: number;
        account?: string;
        accountName?: string;
        currency?: string;
        personalShareAmount?: number;
        taxDeductible?: number | boolean;
        notes?: string;
        [key: string]: any;
    }>;
    label?: string;
    className?: string;
}

export default function ExportButton({ transactions: propTransactions, label, className }: ExportButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleExport = async (format: 'csv' | 'json') => {
        setLoading(true);
        try {
            let blob: Blob;
            const nowStr = new Date().toISOString().split('T')[0];
            let filename = `wealthai-export-${nowStr}.${format}`;

            if (!propTransactions) {
                // Direct download from institutional export endpoint
                const res = await fetch(`/api/export?format=${format}`);
                if (!res.ok) throw new Error('Failed to fetch data');

                blob = await res.blob();
                const disposition = res.headers.get('content-disposition');
                if (disposition && disposition.includes('filename=')) {
                    const match = disposition.match(/filename="?([^";]+)"?/);
                    if (match?.[1]) filename = match[1];
                }
            } else {
                if (propTransactions.length === 0) {
                    toast.info('No transactions to export.');
                    return;
                }

                if (format === 'csv') {
                    const header = 'Date,Account,Currency,Type,Category,Merchant/Description,Total Amount,Personal Share Amount,Tax Deductible,Notes\n';
                    const rows = propTransactions
                        .map((t) => {
                            const date = t.date || '';
                            const account = (t.account || t.accountName || 'Default').replace(/"/g, '""');
                            const currency = (t.currency || 'BDT').replace(/"/g, '""');
                            const type = (t.type || '').replace(/"/g, '""');
                            const category = (t.category || 'Other').replace(/"/g, '""');
                            const desc = (t.description || '').replace(/"/g, '""');
                            const totalAmount = t.amount ?? 0;
                            const personalShare = t.personalShareAmount ?? t.amount ?? 0;
                            const tax = t.taxDeductible ? 'Yes' : 'No';
                            const notes = (t.notes || '').replace(/"/g, '""');
                            return `"${date}","${account}","${currency}","${type}","${category}","${desc}",${totalAmount},${personalShare},"${tax}","${notes}"`;
                        })
                        .join('\n');

                    blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' });
                    filename = `wealthai-transactions-${nowStr}.csv`;
                } else {
                    blob = new Blob([JSON.stringify(propTransactions, null, 2)], { type: 'application/json;charset=utf-8' });
                    filename = `wealthai-transactions-${nowStr}.json`;
                }
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            const count = propTransactions ? propTransactions.length : 'All';
            toast.success(`Exported ${count} records as ${format.toUpperCase()}`);
        } catch {
            toast.error('Export failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flex items-center gap-1.5 ${className || ''}`}>
            {label && <span className="text-xs font-semibold text-gray-500 mr-1">{label}</span>}
            <button
                type="button"
                onClick={() => void handleExport('csv')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/80 dark:bg-surface-dark text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-hover hover:border-primary/40 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
            >
                <span className="material-symbols-outlined text-[16px]">table_view</span>
                CSV
            </button>
            <button
                type="button"
                onClick={() => void handleExport('json')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/80 dark:bg-surface-dark text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-hover hover:border-primary/40 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
            >
                <span className="material-symbols-outlined text-[16px]">data_object</span>
                JSON
            </button>
        </div>
    );
}
