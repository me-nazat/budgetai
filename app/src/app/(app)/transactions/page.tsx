'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import { useSWRConfig } from 'swr';
import { useTransactions } from '@/hooks/useApi';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { queueTransaction } from '@/lib/offlineDb';
import { useRouter } from 'next/navigation';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { CUSTOM_CATEGORY_ICONS, CUSTOM_COLORS, getCategoryIcon, getColorStyle, getIconCandidates, resolveIcon, resolveColor, getCategoryHex } from '@/lib/categoryUtils';
import { CURRENCIES } from '@/lib/currency';
import { generateMonthOptions } from '@/lib/dateUtils';
import { MAX_ATTACHMENT_FILES } from '@/lib/transaction-attachments';
import TransactionAttachmentsSection from '@/components/TransactionAttachmentsSection';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import { ReceiptScannerModal } from '@/components/transactions/ReceiptScannerModal';
const QUICK_CATEGORIES = ['Food', 'Transport', 'Housing', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Education', 'Business', 'Savings', 'Salary', 'Freelance', 'Investment', 'Other'];

interface TransactionRecord {
    id: number | string;
    type: 'expense' | 'earning';
    amount: number;
    category: string;
    description?: string;
    date: string;
    created_at?: string;
    pending?: boolean;
}

interface EditableTransaction extends Omit<TransactionRecord, 'amount'> {
    amount: number | string;
}

interface TransactionsCache {
    transactions: TransactionRecord[];
    total: number;
}

export default function TransactionsPage() {
    const [selectedMonth, setSelectedMonth] = useState<string>(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    );
    const router = useRouter();
    const [selectedWeek, setSelectedWeek] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastSubmitOffline, setLastSubmitOffline] = useState(false);
    const { currency, fmt } = useCurrency();
    const sym = CURRENCIES[currency].symbol;
    const { isOnline } = useNetworkStatus();

    // Quick Add state
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [qaType, setQaType] = useState<'expense' | 'earning'>('expense');
    const [qaAmount, setQaAmount] = useState('');
    const [qaCategory, setQaCategory] = useState('');
    const [qaDesc, setQaDesc] = useState('');
    const [qaDate, setQaDate] = useState(new Date().toISOString().split('T')[0]);
    const [qaNotes, setQaNotes] = useState('');
    const [qaAttachments, setQaAttachments] = useState<File[]>([]);
    const [qaScanningId, setQaScanningId] = useState<number | null>(null);
    const [qaSubmitting, setQaSubmitting] = useState(false);
    
    const invalidateFinancialData = useInvalidateFinancialData();
    const { mutate } = useSWRConfig();

    // Custom Category Add State (Desktop Inline)
    const [qaAddingCustomCategory, setQaAddingCustomCategory] = useState(false);
    const [qaCustomCategoryName, setQaCustomCategoryName] = useState('');
    const [qaCustomIcon, setQaCustomIcon] = useState(CUSTOM_CATEGORY_ICONS[0]);
    const [qaCustomColor, setQaCustomColor] = useState(CUSTOM_COLORS[0]);
    const [qaIconOptions, setQaIconOptions] = useState(CUSTOM_CATEGORY_ICONS.slice(0, 40));
    const { categories: customCategories, mutate: mutateCategories } = useCustomCategories('all');

    // Edit/Action state
     
    const [selectedDetailTx, setSelectedDetailTx] = useState<any | null>(null);
    const [editingTx, setEditingTx] = useState<EditableTransaction | null>(null);
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [deletingTxId, setDeletingTxId] = useState<number | string | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [actionMenuOpenId, setActionMenuOpenId] = useState<number | string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setTimeout(() => setMounted(true), 0);
    }, []);

    useEffect(() => {
        if (!qaAddingCustomCategory) return;

        const name = qaCustomCategoryName.trim();
        if (!name) {
            setQaCustomIcon(CUSTOM_CATEGORY_ICONS[0]);
            setQaCustomColor(CUSTOM_COLORS[0]);
            setQaIconOptions(CUSTOM_CATEGORY_ICONS.slice(0, 40));
            return;
        }

        setQaCustomIcon(resolveIcon(name));
        setQaCustomColor(resolveColor(name));
        setQaIconOptions(getIconCandidates(name));
    }, [qaAddingCustomCategory, qaCustomCategoryName]);

    // Global click-outside handler for the dropdown
    useEffect(() => {
        if (actionMenuOpenId === null) return;
        
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            // Close if we clicked outside the menu container
            if (!target.closest('.action-menu-container')) {
                setActionMenuOpenId(null);
            }
        };

        // Use mousedown to act before click events can fire inappropriately
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [actionMenuOpenId]);

    // Compute date ranges from month/week selection
    const dateRange = useMemo(() => {
        let currentYear: number, currentMonth: number;
        if (selectedMonth && selectedMonth.match(/^\d{4}-\d{2}$/)) {
            [currentYear, currentMonth] = selectedMonth.split('-').map(Number);
        } else {
            const now = new Date();
            currentYear = now.getFullYear();
            currentMonth = now.getMonth() + 1;
        }

        let startDay = 1;
        let endDay = new Date(currentYear, currentMonth, 0).getDate();

        if (selectedWeek && selectedWeek !== 'all') {
            const weekNum = parseInt(selectedWeek);
            if (weekNum === 1) { startDay = 1; endDay = 7; }
            else if (weekNum === 2) { startDay = 8; endDay = 14; }
            else if (weekNum === 3) { startDay = 15; endDay = 21; }
            else if (weekNum === 4) { startDay = 22; /* endDay is already last day of month */ }
        }

        const start = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
        const end = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
        return { start, end };
    }, [selectedMonth, selectedWeek]);

    // SWR hook — cached, stale-while-revalidate
    const { transactions, isLoading, isValidating } = useTransactions(
        dateRange.start, dateRange.end, typeFilter
    );

    const [localCacheData, setLocalCacheData] = useState<TransactionsCache | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem('wealth-ai-swr-cache-v1');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const params = new URLSearchParams();
                    if (dateRange.start) params.set('start', dateRange.start);
                    if (dateRange.end) params.set('end', dateRange.end);
                    if (typeFilter !== 'all') params.set('type', typeFilter);
                    params.set('limit', '200');
                    const cacheKey = `/api/transactions?${params.toString()}`;
                    const entry = parsed[cacheKey];
                    if (entry && entry.value && entry.value.data) {
                        setLocalCacheData(entry.value.data);
                    }
                }
            } catch (e) {
                console.error('Failed to load local SWR cache:', e);
            }
        }
    }, [dateRange.start, dateRange.end, typeFilter]);

    const activeTransactions = transactions.length > 0 ? transactions : (localCacheData?.transactions || []);

    // Build the SWR key to match what useTransactions generates
    const swrKey = useMemo(() => {
        const params = new URLSearchParams();
        if (dateRange.start) params.set('start', dateRange.start);
        if (dateRange.end) params.set('end', dateRange.end);
        if (typeFilter !== 'all') params.set('type', typeFilter);
        params.set('limit', '200');
        return `/api/transactions?${params.toString()}`;
    }, [dateRange.start, dateRange.end, typeFilter]);

    const handleScanAttachment = async (file: File, index: number) => {
        setQaScanningId(index);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/transactions/scan', { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Scan failed');
            const data = await res.json();
            
            if (data.amount) setQaAmount(data.amount.toString());
            if (data.date) setQaDate(data.date);
            if (data.description) setQaDesc(data.description);
            if (data.category) setQaCategory(data.category);
            if (data.type === 'earning' || data.type === 'expense') setQaType(data.type);
        } catch (error) {
            console.error('Failed to scan attachment:', error);
            alert('Failed to extract data from image.');
        } finally {
            setQaScanningId(null);
        }
    };

    const submitQuickAdd = async () => {
        if (qaSubmitting) return;
        const parsed = parseFloat(qaAmount);
        const categoryName = (qaAddingCustomCategory ? qaCustomCategoryName.trim().replace(/\s+/g, ' ') : qaCategory.trim().replace(/\s+/g, ' '));
        if (!qaAmount || isNaN(parsed) || parsed <= 0 || !categoryName) return;
        setQaSubmitting(true);

        const payload = {
            actionType: 'add' as const,
            type: qaType,
            amount: parsed,
            category: categoryName,
            description: qaDesc || categoryName,
            date: qaDate,
            notes: qaNotes.trim() || undefined,
        };

        try {
            if (qaAddingCustomCategory && categoryName) {
                try {
                    await fetch('/api/categories', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: categoryName, type: qaType, icon: qaCustomIcon, color: qaCustomColor })
                    });
                    mutateCategories(); // Refresh the list
                } catch {}
            }

            if (isOnline) {
                // Optimistic SWR update for online POST
                const tempId = 'temp-' + Date.now();
                const optimisticTx = {
                    id: tempId,
                    type: qaType,
                    amount: parsed,
                    category: categoryName,
                    description: qaDesc || categoryName,
                    date: qaDate,
                    created_at: new Date().toISOString(),
                    pending: true,
                };
                mutate(
                    swrKey,
                    (current: TransactionsCache | undefined) => {
                        return {
                            transactions: [optimisticTx, ...(current?.transactions || [])],
                            total: (current?.total || 0) + 1,
                        };
                    },
                    { revalidate: false }
                );

                // Online: POST directly to API
                const { actionType, ...apiPayload } = payload;
                const res = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiPayload),
                });
                if (!res.ok) throw new Error('API add failed');
                const data = await res.json();
                
                if (data.id && qaAttachments.length > 0) {
                    const form = new FormData();
                    qaAttachments.forEach(file => form.append('attachments', file));
                    await fetch(`/api/transactions/${data.id}/attachments`, {
                        method: 'POST',
                        body: form
                    });
                }
                
                invalidateFinancialData();
                mutate(swrKey);
                router.refresh();
                setLastSubmitOffline(false);
            } else {
                // Offline: queue to IndexedDB + optimistic SWR update
                await queueTransaction(payload);
                mutate(
                    swrKey,
                    (current: TransactionsCache | undefined) => {
                        const optimistic = {
                            id: Date.now(),
                            ...payload,
                            created_at: new Date().toISOString(),
                            pending: true,
                        };
                        return {
                            transactions: [optimistic, ...(current?.transactions || [])],
                            total: (current?.total || 0) + 1,
                        };
                    },
                    { revalidate: false }
                );
                setLastSubmitOffline(true);
            }

            setQaAmount(''); setQaDesc(''); setQaCategory(''); setShowQuickAdd(false); setQaSubmitting(false);
            setQaNotes(''); setQaAttachments([]);
            setQaAddingCustomCategory(false); setQaCustomCategoryName('');
            setQaCustomIcon(CUSTOM_CATEGORY_ICONS[0]); setQaCustomColor(CUSTOM_COLORS[0]); setQaIconOptions(CUSTOM_CATEGORY_ICONS.slice(0, 40));
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error('Quick Add error:', error);
            setQaSubmitting(false);
            mutate(swrKey); // Rollback optimistic update
        }
    };

    const handleCustomCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === 'ADD_CUSTOM') {
            setQaAddingCustomCategory(true);
            setQaCategory('');
        } else {
            setQaCategory(e.target.value);
            setQaAddingCustomCategory(false);
        }
    };

    const generateInlineIconOptions = () => {
        const candidates = getIconCandidates(qaCustomCategoryName || qaCategory || qaType);
        setQaIconOptions(candidates);
        setQaCustomIcon(candidates[0]);
    };

    const submitEdit = async () => {
        if (editSubmitting) return;
        if (!editingTx) return;

        const parsed = parseFloat(String(editingTx.amount));
        if (!editingTx.amount || isNaN(parsed) || parsed <= 0 || !editingTx.category) return;
        setEditSubmitting(true);

        const payload = {
            actionType: 'edit' as const,
            id: editingTx.id,
            type: editingTx.type,
            amount: parsed,
            category: editingTx.category,
            description: editingTx.description || editingTx.category,
            date: editingTx.date,
        };

        try {
            if (isOnline) {
                // Optimistic SWR update
                mutate(
                    swrKey,
                    (current: TransactionsCache | undefined) => {
                        const updated = (current?.transactions || []).map(t =>
                            t.id === editingTx.id ? { ...t, ...payload, pending: true } : t
                        );
                        return { transactions: updated, total: current?.total || 0 };
                    },
                    { revalidate: false }
                );

                // Online: PUT directly to API
                const res = await fetch('/api/transactions', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingTx.id,
                        type: editingTx.type,
                        amount: parsed,
                        category: editingTx.category,
                        description: editingTx.description || editingTx.category,
                        date: editingTx.date,
                    }),
                });
                if (!res.ok) throw new Error('API update failed');
                
                invalidateFinancialData();
                mutate(swrKey);
                router.refresh();
                setLastSubmitOffline(false);
            } else {
                // Offline: queue to IndexedDB + optimistic update
                await queueTransaction(payload);
                mutate(
                    swrKey,
                    (current: TransactionsCache | undefined) => {
                        const updated = (current?.transactions || []).map(t =>
                            t.id === editingTx.id ? { ...t, ...payload, pending: true } : t
                        );
                        return { transactions: updated, total: current?.total || 0 };
                    },
                    { revalidate: false }
                );
                setLastSubmitOffline(true);
            }

            setEditingTx(null); setEditSubmitting(false); setActionMenuOpenId(null);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error('Edit error:', error);
            setEditSubmitting(false);
            mutate(swrKey); // Rollback optimistic update
        }
    };

    const submitDelete = async () => {
        if (deleteSubmitting) return;
        if (!deletingTxId) return;
        setDeleteSubmitting(true);

        const payload = { actionType: 'delete' as const, id: Number(deletingTxId) };

        try {
            if (isOnline) {
                // Optimistic SWR update
                mutate(
                    swrKey,
                    (current: TransactionsCache | undefined) => {
                        const filtered = (current?.transactions || []).filter(t => t.id !== deletingTxId);
                        return { transactions: filtered, total: Math.max(0, (current?.total || 1) - 1) };
                    },
                    { revalidate: false }
                );

                const res = await fetch(`/api/transactions?id=${deletingTxId}`, {
                    method: 'DELETE',
                });
                if (!res.ok) throw new Error('API delete failed');

                invalidateFinancialData();
                mutate(swrKey);
                router.refresh();
                setLastSubmitOffline(false);
            } else {
                await queueTransaction(payload);
                mutate(
                    swrKey,
                    (current: TransactionsCache | undefined) => {
                        const filtered = (current?.transactions || []).filter(t => t.id !== deletingTxId);
                        return { transactions: filtered, total: Math.max(0, (current?.total || 1) - 1) };
                    },
                    { revalidate: false }
                );
                setLastSubmitOffline(true);
            }
            setActionMenuOpenId(null);
            setDeletingTxId(null);
            setDeleteSubmitting(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error('Delete error:', error);
            setDeleteSubmitting(false);
            mutate(swrKey); // Rollback optimistic update
        }
    };

    const submitDuplicate = async (tx: TransactionRecord) => {
        if (qaSubmitting) return;
        setQaSubmitting(true);
        const payload = {
            actionType: 'add' as const,
            type: tx.type,
            amount: tx.amount,
            category: tx.category,
            description: tx.description,
            date: new Date().toISOString().split('T')[0], // Use today for duplication
        };

        try {
            if (isOnline) {
                // Optimistic SWR update
                const tempId = 'temp-' + Date.now();
                const optimisticTx = {
                    id: tempId,
                    ...payload,
                    created_at: new Date().toISOString(),
                    pending: true,
                };
                mutate(
                    swrKey,
                    (current: TransactionsCache | undefined) => {
                        return {
                            transactions: [optimisticTx, ...(current?.transactions || [])],
                            total: (current?.total || 0) + 1,
                        };
                    },
                    { revalidate: false }
                );

                const { actionType, ...apiPayload } = payload;
                const res = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiPayload),
                });
                if (!res.ok) throw new Error('API duplicate failed');
                
                invalidateFinancialData();
                mutate(swrKey);
                router.refresh();
                setLastSubmitOffline(false);
            } else {
                await queueTransaction(payload);
                mutate(
                    swrKey,
                    (current: TransactionsCache | undefined) => {
                        const optimistic = {
                            id: Date.now(),
                            ...payload,
                            created_at: new Date().toISOString(),
                            pending: true,
                        };
                        return {
                            transactions: [optimistic, ...(current?.transactions || [])],
                            total: (current?.total || 0) + 1,
                        };
                    },
                    { revalidate: false }
                );
                setLastSubmitOffline(true);
            }
            setActionMenuOpenId(null);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
            setQaSubmitting(false);
        } catch (error) {
            console.error('Duplicate error:', error);
            setQaSubmitting(false);
            mutate(swrKey); // Rollback optimistic update
        }
    };

    // Generate last 12 months for the dropdown without 31st overflow bugs
    const monthOptions = useMemo(() => generateMonthOptions(12), []);

    const weekOptions = [
        { value: 'all', label: 'Full Month' },
        { value: '1', label: 'Week 1 (1st-7th)' },
        { value: '2', label: 'Week 2 (8th-14th)' },
        { value: '3', label: 'Week 3 (15th-21st)' },
        { value: '4', label: 'Week 4 (22nd-End)' },
    ];

    const transactionRows = activeTransactions as TransactionRecord[];
    const sorted = [...transactionRows]
        .filter(t => !searchQuery || (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) || t.category.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortField === 'date') return (a.date > b.date ? 1 : -1) * dir;
        if (sortField === 'amount') return (a.amount - b.amount) * dir;
        if (sortField === 'category') return a.category.localeCompare(b.category) * dir;
        return 0;
    });

    const toggleSort = (field: string) => {
        if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    const exportExcel = async () => {
        const ExcelJS = await import('exceljs');
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Transactions');
        ws.columns = [
            { header: 'Date', key: 'date', width: 15 }, { header: 'Type', key: 'type', width: 10 },
            { header: 'Category', key: 'category', width: 15 }, { header: 'Description', key: 'description', width: 30 },
            { header: 'Amount', key: 'amount', width: 12 },
        ];
        ws.getRow(1).font = { bold: true };
        sorted.forEach(t => ws.addRow(t));
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Transactions_${new Date().toISOString().split('T')[0]}.xlsx`; a.click();
        URL.revokeObjectURL(url);
    };

    const totalExpenses = sorted.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalEarnings = sorted.filter(t => t.type === 'earning').reduce((s, t) => s + t.amount, 0);

    // Wealth Insights logic based purely on currently loaded/filtered table data
    const expensesOnly = sorted.filter(t => t.type === 'expense');

    // 1. Biggest Single Expense
    let biggestExpense = null;
    if (expensesOnly.length > 0) {
        biggestExpense = expensesOnly.reduce((max, t) => t.amount > max.amount ? t : max, expensesOnly[0]);
    }

    // 2. Most Frequent Category
    const categoryCounts: Record<string, number> = {};
    expensesOnly.forEach(t => { categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1; });

    let topCategory = null;
    let topCategoryCount = 0;
    Object.entries(categoryCounts).forEach(([cat, count]) => {
        if (count > topCategoryCount) {
            topCategoryCount = count;
            topCategory = cat;
        }
    });

    const quickCategoriesForType = qaType === 'earning'
        ? ['Salary', 'Freelance', 'Investment', 'Business', 'Savings', 'Other']
        : ['Food', 'Transport', 'Housing', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Education', 'Other'];

    // Show loading only on first ever load (no cached data)
    const showFullLoading = !activeTransactions.length && isLoading;

    return (
        <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
            {/* Subtle revalidation indicator */}
            {isValidating && (
                <div className="fixed top-0 left-0 lg:left-64 right-0 z-50 h-0.5">
                    <div className="h-full bg-primary/60 animate-pulse rounded-full" />
                </div>
            )}

            {/* Success Toast */}
            {showSuccess && (
                <div className="fixed top-6 right-6 z-50 toast-enter">
                    <div className={`flex items-center gap-2 px-4 py-3 text-white rounded-xl shadow-lg ${lastSubmitOffline ? 'bg-amber-500 shadow-amber-500/20' : 'bg-emerald-500 shadow-emerald-500/20'}`}>
                        <span className="material-symbols-outlined text-lg">{lastSubmitOffline ? 'schedule' : 'check_circle'}</span>
                        <span className="text-sm font-semibold">{lastSubmitOffline ? 'Queued — will sync when online' : 'Transaction saved!'}</span>
                    </div>
                </div>
            )}

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Transactions</h2>
                    <p className="text-gray-500 dark:text-text-muted text-sm mt-1">View and manage your expenses and earnings</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsScannerOpen(true)} className="px-4 py-2.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-500/20 active:scale-95 shadow-sm">
                        <span className="material-symbols-outlined text-[18px]">document_scanner</span> <span className="hidden sm:inline">Smart Scan</span>
                    </button>
                    <button onClick={() => setShowQuickAdd(!showQuickAdd)} className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5 btn-primary-glow active:scale-95">
                        <span className="material-symbols-outlined text-[18px]">{showQuickAdd ? 'close' : 'add'}</span> {showQuickAdd ? 'Cancel' : 'Quick Add'}
                    </button>
                    <button onClick={exportExcel} className="px-4 py-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl text-sm font-semibold transition-all border border-emerald-200 dark:border-emerald-500/20 hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-1.5 active:scale-95">
                        <span className="material-symbols-outlined text-[18px]">download</span> Export
                    </button>
                </div>
            </header>

            {/* Summary Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                <div className="glass-panel p-4 rounded-xl stat-gradient-emerald lg:col-span-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider">Earnings</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{fmt(totalEarnings)}</p>
                </div>
                <div className="glass-panel p-4 rounded-xl stat-gradient-orange lg:col-span-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider">Expenses</p>
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">{fmt(totalExpenses)}</p>
                </div>
                <div className="glass-panel p-4 rounded-xl stat-gradient-blue col-span-2 lg:col-span-1 border-r border-transparent lg:border-gray-200 lg:dark:border-white/10">
                    <p className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider">Net</p>
                    <p className={`text-lg font-bold mt-1 ${totalEarnings - totalExpenses >= 0 ? 'text-primary' : 'text-rose-500'}`}>
                        {totalEarnings - totalExpenses >= 0 ? '+' : ''}{fmt(totalEarnings - totalExpenses)}
                    </p>
                </div>

                {/* Wealth Insights Widget */}
                <div className="glass-panel p-4 rounded-xl col-span-2 lg:col-span-2 flex gap-4 bg-gradient-to-r from-teal-500/5 to-cyan-500/5 items-center justify-around border-teal-100 dark:border-teal-500/10 border">
                    <div className="flex flex-col items-center justify-center text-center w-1/2">
                        <span className="material-symbols-outlined text-teal-500 text-sm mb-0.5">warning</span>
                        <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Largest Expense</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white mt-1 truncate w-full px-2" title={biggestExpense?.description || biggestExpense?.category || 'None'}>
                            {biggestExpense ? `${fmt(biggestExpense.amount)} (${biggestExpense.description || biggestExpense.category})` : 'N/A'}
                        </p>
                    </div>
                    <div className="w-px h-10 bg-gray-200 dark:bg-[#30363d]"></div>
                    <div className="flex flex-col items-center justify-center text-center w-1/2">
                        <span className="material-symbols-outlined text-cyan-500 text-sm mb-0.5">repeat</span>
                        <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Frequent Category</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white mt-1 truncate w-full px-2">
                            {topCategory ? `${topCategory} (${topCategoryCount}x)` : 'N/A'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Add Form */}
            {showQuickAdd && (
                <form onSubmit={e => { e.preventDefault(); submitQuickAdd(); }} className="glass-panel mb-5 overflow-hidden rounded-2xl animate-slide-up">
                    <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
                        <div className={`relative p-4 lg:p-5 ${qaType === 'expense' ? 'stat-gradient-orange' : 'stat-gradient-emerald'}`}>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-text-muted">New transaction</p>
                                    <h3 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{qaType === 'expense' ? 'Record Expense' : 'Record Earning'}</h3>
                                </div>
                                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${qaType === 'expense' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                    <span className="material-symbols-outlined text-2xl">{qaType === 'expense' ? 'shopping_cart' : 'payments'}</span>
                                </div>
                            </div>

                            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white/70 p-1 dark:bg-black/20">
                                {(['expense', 'earning'] as const).map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => { setQaType(type); setQaCategory(''); setQaAddingCustomCategory(false); }}
                                        className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${qaType === type ? (type === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'bg-emerald-500 text-white shadow-sm') : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">{type === 'expense' ? 'arrow_upward' : 'arrow_downward'}</span>
                                        {type === 'expense' ? 'Expense' : 'Earning'}
                                    </button>
                                ))}
                            </div>

                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Amount</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400 dark:text-gray-500">{sym}</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={qaAmount}
                                    onChange={e => setQaAmount(e.target.value)}
                                    className="w-full rounded-2xl border border-gray-200 bg-white/85 py-4 pl-12 pr-4 text-4xl font-black tracking-tight text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-[#0B0F17]/80 dark:text-white"
                                />
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Date</label>
                                    <input
                                        type="date"
                                        value={qaDate}
                                        onChange={e => setQaDate(e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white/85 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-[#0B0F17]/80 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Description</label>
                                    <input
                                        type="text"
                                        placeholder="Optional"
                                        value={qaDesc}
                                        onChange={e => setQaDesc(e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-white/85 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-[#0B0F17]/80 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Additional Notes */}
                            <div className="mt-3">
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Additional Notes (Optional)</label>
                                <textarea
                                    value={qaNotes}
                                    onChange={e => setQaNotes(e.target.value)}
                                    placeholder="Receipt info, context..."
                                    rows={2}
                                    className="w-full resize-none rounded-xl border border-gray-200 bg-white/85 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-[#0B0F17]/80 dark:text-white"
                                />
                            </div>

                            {/* Attachments */}
                            <div className="mt-4">
                                <div className="mb-2 flex items-center justify-between">
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Attachments</label>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">{qaAttachments.length}/{MAX_ATTACHMENT_FILES}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {qaAttachments.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs dark:border-white/10 dark:bg-[#0B0F17]">
                                            <span className="material-symbols-outlined text-gray-500 text-[14px]">
                                                {file.type.startsWith('image/') ? 'image' : 'description'}
                                            </span>
                                            <span className="max-w-[100px] truncate text-gray-700 dark:text-gray-300">{file.name}</span>
                                            
                                            {(file.type.startsWith('image/') || file.type === 'application/pdf') && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleScanAttachment(file, idx)}
                                                    disabled={qaScanningId === idx}
                                                    className="ml-1 flex items-center gap-1 rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-600 hover:bg-teal-200 disabled:opacity-50 dark:bg-teal-500/20 dark:text-teal-300"
                                                >
                                                    {qaScanningId === idx ? 'Scanning...' : 'Scan'}
                                                    <span className="material-symbols-outlined text-[12px]">document_scanner</span>
                                                </button>
                                            )}

                                            <button 
                                                type="button" 
                                                onClick={() => setQaAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                className="ml-1 flex items-center justify-center text-gray-400 hover:text-rose-500"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        </div>
                                    ))}
                                    {qaAttachments.length < MAX_ATTACHMENT_FILES && (
                                        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all">
                                            <span className="material-symbols-outlined text-[14px]">attach_file</span>
                                            Attach File
                                            <input 
                                                type="file" 
                                                multiple 
                                                className="hidden" 
                                                accept="image/*,application/pdf"
                                                onChange={e => {
                                                    if (!e.target.files?.length) return;
                                                    const newFiles = Array.from(e.target.files);
                                                    if (qaAttachments.length + newFiles.length > MAX_ATTACHMENT_FILES) {
                                                        alert(`Max ${MAX_ATTACHMENT_FILES} files allowed.`);
                                                        return;
                                                    }
                                                    setQaAttachments(prev => [...prev, ...newFiles]);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 lg:p-5">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-text-muted">Category</p>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-text-muted">{qaAddingCustomCategory ? 'Custom style' : 'Select a group'}</p>
                                </div>
                                {qaAddingCustomCategory && (
                                    <button
                                        type="button"
                                        onClick={() => { setQaAddingCustomCategory(false); setQaCustomCategoryName(''); setQaCategory(''); }}
                                        className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-500 hover:text-rose-500 dark:bg-surface-dark"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                )}
                            </div>

                            {!qaAddingCustomCategory ? (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        {quickCategoriesForType.map(category => {
                                            const selected = qaCategory === category;
                                            return (
                                                <button
                                                    key={category}
                                                    type="button"
                                                    onClick={() => { setQaCategory(category); setQaAddingCustomCategory(false); }}
                                                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${selected ? 'border-primary bg-primary text-white shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-primary/30 hover:bg-primary/5 dark:border-white/10 dark:bg-[#0B0F17] dark:text-gray-400 dark:hover:text-white'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">{getCategoryIcon(category, customCategories)}</span>
                                                    {category}
                                                </button>
                                            );
                                        })}
                                        {customCategories.filter(category => category.type === qaType).map(category => {
                                            const selected = qaCategory.toLowerCase() === category.name.toLowerCase();
                                            return (
                                                <button
                                                    key={category.id}
                                                    type="button"
                                                    onClick={() => setQaCategory(category.name)}
                                                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${selected ? getColorStyle(category.color).selected : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-primary/30 hover:bg-primary/5 dark:border-white/10 dark:bg-[#0B0F17] dark:text-gray-400 dark:hover:text-white'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">{category.icon}</span>
                                                    {category.name}
                                                </button>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            onClick={() => { setQaAddingCustomCategory(true); setQaCategory(''); }}
                                            className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/20"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">add</span>
                                            Custom
                                        </button>
                                    </div>

                                    <select value={qaCategory} onChange={handleCustomCategoryChange} className="sr-only" aria-label="Category fallback selector">
                                        <option value="">Category</option>
                                        {QUICK_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                                        <optgroup label="Custom Categories">
                                            {customCategories.filter(category => category.type === qaType).map(category => (
                                                <option key={`cc-${category.id}`} value={category.name}>{category.name}</option>
                                            ))}
                                        </optgroup>
                                        <option value="ADD_CUSTOM">Add Custom Category</option>
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-[#0B0F17]/70">
                                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Custom category name</label>
                                        <div className="flex items-center gap-3">
                                            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${qaCustomCategoryName.trim() ? getColorStyle(qaCustomColor).bg : 'bg-gray-300 dark:bg-gray-700'}`}>
                                                <span className="material-symbols-outlined text-xl text-white">{qaCustomCategoryName.trim() ? qaCustomIcon : 'edit'}</span>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="e.g. Coffee, Gym, Crypto"
                                                value={qaCustomCategoryName}
                                                onChange={e => {
                                                    setQaCustomCategoryName(e.target.value);
                                                    setQaCategory(e.target.value);
                                                }}
                                                className="w-full bg-transparent text-base font-semibold text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Icon</label>
                                            <button
                                                type="button"
                                                onClick={generateInlineIconOptions}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20"
                                            >
                                                <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                                                Generate icon
                                            </button>
                                        </div>
                                        <div className="grid max-h-40 grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 overflow-y-auto rounded-2xl border border-gray-200 bg-white/50 p-2 dark:border-white/10 dark:bg-[#0B0F17]/50">
                                            {qaIconOptions.map(icon => (
                                                <button
                                                    key={icon}
                                                    type="button"
                                                    onClick={() => setQaCustomIcon(icon)}
                                                    className={`aspect-square rounded-xl text-lg transition-all ${qaCustomIcon === icon ? `${getColorStyle(qaCustomColor).bg} text-white shadow-md scale-105` : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-surface-dark dark:text-gray-400 dark:hover:bg-surface-hover'}`}
                                                >
                                                    <span className="material-symbols-outlined">{icon}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Color</label>
                                        <div className="flex flex-wrap gap-2">
                                            {CUSTOM_COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setQaCustomColor(color)}
                                                    className={`h-8 w-8 rounded-full ${getColorStyle(color).bg} ${qaCustomColor === color ? 'ring-2 ring-gray-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-[#161b22]' : 'hover:scale-105'}`}
                                                    aria-label={`${color} category color`}
                                                >
                                                    {qaCustomColor === color && <span className="material-symbols-outlined text-[16px] text-white">check</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={qaSubmitting || !qaAmount || !(qaAddingCustomCategory ? qaCustomCategoryName.trim() : qaCategory) || isNaN(parseFloat(qaAmount)) || parseFloat(qaAmount) <= 0}
                                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-bold text-white shadow-lg disabled:opacity-40 active:scale-[0.98] ${qaType === 'expense' ? 'bg-rose-500 shadow-rose-500/20 hover:bg-rose-600' : 'bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-600'}`}
                            >
                                {qaSubmitting ? (
                                    <span className="h-5 w-24 rounded-full bg-white/30 shimmer-skeleton" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-xl">check_circle</span>
                                        Save {qaType === 'expense' ? 'Expense' : 'Earning'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* Filters */}
            <div className="glass-panel flex flex-wrap gap-3 mb-5 p-3 rounded-xl">
                <div className="bg-gray-100 dark:bg-surface-dark p-0.5 rounded-xl flex text-xs border border-gray-200 dark:border-white/10">
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                        <span className="material-symbols-outlined text-[16px] text-gray-500">calendar_month</span>
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 font-semibold cursor-pointer"
                        >
                            {monthOptions.map(m => (
                                <option key={m.value} value={m.value} className="bg-white dark:bg-surface-dark">{m.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-gray-100 dark:bg-surface-dark p-0.5 rounded-xl flex text-xs border border-gray-200 dark:border-white/10">
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                        <span className="material-symbols-outlined text-[16px] text-gray-500">view_week</span>
                        <select
                            value={selectedWeek}
                            onChange={e => setSelectedWeek(e.target.value)}
                            className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 font-semibold cursor-pointer"
                        >
                            {weekOptions.map(w => (
                                <option key={w.value} value={w.value} className="bg-white dark:bg-surface-dark">{w.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-gray-100 dark:bg-surface-dark p-0.5 rounded-xl flex text-xs border border-gray-200 dark:border-white/10">
                    {['all', 'expense', 'earning'].map(t => (
                        <button key={t} onClick={() => setTypeFilter(t)}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition-all capitalize ${typeFilter === t ? 'bg-primary text-white shadow-sm' : 'text-gray-500 dark:text-text-muted hover:text-gray-900 dark:hover:text-white'}`}>
                            {t === 'all' ? 'All' : t + 's'}
                        </button>
                    ))}
                </div>
                <div className="ml-auto w-full lg:w-auto">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                        <input 
                            type="text" 
                            placeholder="Search description or category..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full lg:w-64 pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-gray-900 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Mobile Transaction Cards */}
            <div className="md:hidden space-y-3 mb-5" style={{ animation: 'slideUp 0.5s ease-out 0.1s both' }}>
                {showFullLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                        <div key={`mobile-tx-skeleton-${index}`} className="skeleton-panel p-4">
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl shimmer-skeleton" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="h-3 w-36 rounded-full shimmer-skeleton" />
                                    <div className="h-2.5 w-24 rounded-full shimmer-skeleton" />
                                </div>
                                <div className="h-3 w-16 rounded-full shimmer-skeleton" />
                            </div>
                        </div>
                    ))
                ) : sorted.length === 0 ? (
                    <div className="glass-panel rounded-3xl p-8 text-center">
                        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 dark:bg-surface-dark">
                            <span className="material-symbols-outlined text-3xl text-gray-400 dark:text-gray-500">search_off</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-500 dark:text-text-muted">No transactions found for this period.</p>
                    </div>
                ) : sorted.map((t, i) => (
                    <div
                        key={t.id}
                        onClick={() => setSelectedDetailTx(t)}
                        className={`relative overflow-visible rounded-3xl border border-gray-200/70 bg-white/88 p-4 shadow-sm backdrop-blur-xl transition-all active:scale-[0.985] dark:border-white/10 dark:bg-surface-dark/82 cursor-pointer hover:border-primary/30`}
                        style={{ animation: `slideUp 0.3s ease-out ${Math.min(i * 0.03, 0.3)}s both` }}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-sm ${t.type === 'expense' ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'}`}>
                                <span className="material-symbols-outlined text-[22px]">
                                    {getCategoryIcon(t.category, customCategories)}
                                </span>
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{t.description || t.category}</p>
                                    {t.pending && (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            Sync
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-gray-400 dark:text-text-muted">
                                    <span 
                                        className="rounded-full px-2 py-0.5 font-bold"
                                        style={{ 
                                            backgroundColor: `${getCategoryHex(t.category, customCategories)}26`, 
                                            color: getCategoryHex(t.category, customCategories) 
                                        }}
                                    >
                                        {t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase()}
                                    </span>
                                    <span>{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                                <p className={`text-sm font-black ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {t.type === 'expense' ? '−' : '+'}{fmt(t.amount)}
                                </p>
                                <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 ml-1 text-sm">chevron_right</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="glass-panel hidden rounded-2xl md:block" style={{ animation: 'slideUp 0.5s ease-out 0.1s both' }}>
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-[#0B0F17] text-xs text-gray-500 dark:text-text-muted uppercase tracking-wider border-b border-gray-200 dark:border-white/10">
                                {[['Transaction', ''], ['Category', 'category'], ['Date', 'date'], ['Amount', 'amount']].map(([label, field]) => (
                                    <th key={label} className={`px-6 py-3.5 font-semibold ${field ? 'cursor-pointer group hover:text-primary transition-colors' : ''} ${label === 'Amount' ? 'text-right' : ''}`}
                                        onClick={() => field && toggleSort(field)}>
                                        <span className={`flex items-center gap-1 ${label === 'Amount' ? 'justify-end' : 'justify-start'}`}>
                                            {label}{field && sortField === field && <span className="material-symbols-outlined text-xs text-primary">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                                        </span>
                                    </th>
                                ))}
                                <th className="px-6 py-3.5 font-semibold text-right w-12">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#21262d] text-sm">
                            {showFullLoading ? (
                                Array.from({ length: 7 }).map((_, index) => (
                                    <tr key={`tx-skeleton-${index}`}>
                                        <td className="px-6 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl shimmer-skeleton" />
                                                <div className="space-y-2">
                                                    <div className="h-3 w-40 rounded-full shimmer-skeleton" />
                                                    <div className="h-2.5 w-24 rounded-full shimmer-skeleton" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5"><div className="h-7 w-24 rounded-md shimmer-skeleton" /></td>
                                        <td className="px-6 py-3.5"><div className="h-3 w-28 rounded-full shimmer-skeleton" /></td>
                                        <td className="px-6 py-3.5"><div className="ml-auto h-3 w-20 rounded-full shimmer-skeleton" /></td>
                                        <td className="px-6 py-3.5"><div className="ml-auto h-8 w-8 rounded-full shimmer-skeleton" /></td>
                                    </tr>
                                ))
                            ) : sorted.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center">
                                    <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 block mb-2">search_off</span>
                                    <p className="text-gray-400 dark:text-text-muted">No transactions found for this period.</p>
                                </td></tr>
                            ) : sorted.map((t, i) => (
                                <tr key={t.id} 
                                    onClick={() => setSelectedDetailTx(t)}
                                    className={`group hover:bg-gray-50/50 dark:hover:bg-surface-hover/30 transition-colors duration-200 cursor-pointer relative z-0`}
                                    style={{ animation: `slideUp 0.3s ease-out ${Math.min(i * 0.03, 0.3)}s both` }}>
                                    <td className="px-6 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'expense' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'}`}>
                                                <span className="material-symbols-outlined text-lg">
                                                    {getCategoryIcon(t.category, customCategories)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900 dark:text-white">{t.description || t.category}</span>
                                                {t.pending && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                        Pending sync
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3.5">
                                        <span 
                                            className="text-xs font-bold px-2.5 py-1 rounded-md"
                                            style={{ 
                                                backgroundColor: `${getCategoryHex(t.category, customCategories)}26`, 
                                                color: getCategoryHex(t.category, customCategories) 
                                            }}
                                        >
                                            {t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3.5 text-gray-500 dark:text-text-muted">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                    <td className={`px-6 py-3.5 text-right font-semibold ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        {t.type === 'expense' ? '−' : '+'}{fmt(t.amount)}
                                    </td>
                                    <td className="px-6 py-3.5 text-right w-12 text-gray-400">
                                        <span className="material-symbols-outlined text-[20px] group-hover:text-primary transition-colors">chevron_right</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-gray-200 dark:border-white/10 text-xs text-gray-400 dark:text-text-muted flex items-center justify-between">
                    <span>Showing {sorted.length} transaction{sorted.length !== 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">filter_list</span>
                        {selectedWeek === 'all' ? selectedMonth : `${selectedMonth} (Week ${selectedWeek})`}
                    </span>
                </div>
            </div>

            {/* Edit Modal / Portal */}
            {mounted && createPortal(
                <AnimatePresence>
                    {editingTx && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[6px]" onClick={() => { setEditingTx(null); setEditSubmitting(false); }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 12 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-[420px] bg-white dark:bg-surface-dark rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-xl">edit</span>
                                    Edit Transaction
                                </h3>
                                <button onClick={() => { setEditingTx(null); setEditSubmitting(false); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/10">
                                    <span className="material-symbols-outlined text-xl">close</span>
                                </button>
                            </div>
                            <form onSubmit={e => { e.preventDefault(); submitEdit(); }} className="px-5 py-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-text-muted mb-1 uppercase tracking-wider">Type</label>
                                        <select value={editingTx.type} onChange={e => setEditingTx({...editingTx, type: e.target.value as "expense" | "earning"})}
                                            className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#0B0F17] text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm">
                                            <option value="expense">Expense</option>
                                            <option value="earning">Earning</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-text-muted mb-1 uppercase tracking-wider">Amount</label>
                                        <input type="number" step="0.01" value={editingTx.amount} onChange={e => setEditingTx({...editingTx, amount: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#0B0F17] text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-text-muted mb-1 uppercase tracking-wider">Category</label>
                                        <select value={editingTx.category} onChange={e => setEditingTx({...editingTx, category: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#0B0F17] text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm">
                                            <option value="">Select</option>
                                            {QUICK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            {customCategories.filter(c => c.type === editingTx.type).length > 0 && (
                                                <optgroup label="Custom">
                                                    {customCategories.filter(c => c.type === editingTx.type).map(c => (
                                                        <option key={`cc-e-${c.id}`} value={c.name}>{c.name}</option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-text-muted mb-1 uppercase tracking-wider">Date</label>
                                        <input type="date" value={editingTx.date ? (editingTx.date.includes('T') ? editingTx.date.split('T')[0] : editingTx.date) : ''} onChange={e => setEditingTx({...editingTx, date: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#0B0F17] text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-text-muted mb-1 uppercase tracking-wider">Description</label>
                                    <input type="text" value={editingTx.description || ''} onChange={e => setEditingTx({...editingTx, description: e.target.value})}
                                        placeholder="Optional description"
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#0B0F17] text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm" />
                                </div>
                                <TransactionAttachmentsSection transactionId={Number(editingTx.id)} transactionDescription={editingTx.description || editingTx.category} />
                                <div className="pt-1 flex gap-3">
                                    <button type="button" onClick={() => { setEditingTx(null); setEditSubmitting(false); }}
                                        className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-gray-700 dark:text-gray-300 rounded-lg font-semibold text-sm transition-colors cursor-pointer">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={editSubmitting || !editingTx.amount || !editingTx.category || isNaN(parseFloat(String(editingTx.amount))) || parseFloat(String(editingTx.amount)) <= 0}
                                        className="flex-1 py-2 px-4 bg-primary text-white rounded-lg font-bold hover:bg-primary-hover transition-all flex justify-center items-center disabled:opacity-40 active:scale-[0.98] cursor-pointer text-sm">
                                        {editSubmitting ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
                </AnimatePresence>,
            document.body)}

            {/* Delete Confirmation Modal / Portal */}
            {mounted && createPortal(
                <AnimatePresence>
                    {deletingTxId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10"
                            >
                                <div className="p-5 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-[32px]">delete_forever</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Transaction?</h3>
                                    <p className="text-gray-500 dark:text-text-muted text-sm mb-6">
                                        This action cannot be undone. This transaction will be permanently removed from your history and net balance.
                                    </p>
                                    <div className="flex gap-3 w-full">
                                        <button onClick={() => { setDeletingTxId(null); setDeleteSubmitting(false); }}
                                            className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-surface-dark dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm transition-colors cursor-pointer">
                                            Cancel
                                        </button>
                                        <button onClick={() => submitDelete()} disabled={deleteSubmitting}
                                            className="flex-1 py-2.5 px-4 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/30 flex justify-center items-center disabled:opacity-40 active:scale-95 cursor-pointer">
                                            {deleteSubmitting ? (
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : 'Delete'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
            document.body)}

            {/* Global Details Modal */}
            {selectedDetailTx && mounted && (
                <TransactionDetailModal
                    transaction={selectedDetailTx}
                    customCategories={customCategories}
                    onClose={() => setSelectedDetailTx(null)}
                    onEdit={(tx) => {
                        setSelectedDetailTx(null);
                        setEditingTx({ ...tx });
                    }}
                    onDuplicate={(tx) => {
                        setSelectedDetailTx(null);
                        submitDuplicate(tx);
                    }}
                    onDelete={(tx) => {
                        setSelectedDetailTx(null);
                        setDeletingTxId(tx.id);
                    }}
                    onNotesChange={(id, notes) => {
                        mutate('/api/transactions?month=' + selectedMonth);
                    }}
                />
            )}
        </div>
    );
}
