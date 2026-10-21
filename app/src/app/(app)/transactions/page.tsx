'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useCurrency } from '@/hooks/useCurrency';
import { useSWRConfig } from 'swr';
import { useTransactions, useAccounts, type Transaction, type TransactionSplitItem } from '@/hooks/useApi';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { queueTransaction } from '@/lib/offlineDb';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import {
  CUSTOM_CATEGORY_ICONS,
  CUSTOM_COLORS,
  getCategoryIcon,
  getIconCandidates,
  resolveIcon,
  resolveColor,
  getCategoryHex,
} from '@/lib/categoryUtils';
import { CURRENCIES } from '@/lib/currency';
import { TransactionFiltersBar } from '@/components/transactions/TransactionFiltersBar';
import { QuickAddTransactionModal } from '@/components/transactions/QuickAddTransactionModal';
import { ReceiptScannerModal } from '@/components/transactions/ReceiptScannerModal';
import { TransactionRowActions } from '@/components/transactions/TransactionRowActions';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import { InlineTaxTagPill } from '@/components/tax/InlineTaxTagPill';
import ExportButton from '@/components/ExportButton';
import { toast } from 'sonner';

const QUICK_CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Health',
  'Education',
  'Business',
  'Savings',
  'Salary',
  'Freelance',
  'Investment',
  'Other',
];

interface DateGroup {
  date: string;
  formattedDate: string;
  transactions: Transaction[];
  totalInflows: number;
  totalOutflows: number;
  netCashflow: number;
}

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const { currency, fmt } = useCurrency();
  const sym = CURRENCIES[currency]?.symbol || '$';
  const { isOnline } = useNetworkStatus();
  const { formatAmount } = usePrivacy();
  const invalidateFinancialData = useInvalidateFinancialData();
  const { mutate } = useSWRConfig();

  // Read filter facets directly from URL search parameters
  const queryOptions = useMemo(() => {
    const opts: Record<string, any> = {};
    const search = searchParams.get('search');
    const month = searchParams.get('month');
    const startDate = searchParams.get('startDate') || searchParams.get('start');
    const endDate = searchParams.get('endDate') || searchParams.get('end');
    const category = searchParams.get('category');
    const categories = searchParams.get('categories');
    const type = searchParams.get('type');
    const accountId = searchParams.get('accountId');
    const accountIds = searchParams.get('accountIds');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const taxDeductible = searchParams.get('taxDeductible');
    const hasAttachments = searchParams.get('hasAttachments');
    const sortBy = searchParams.get('sortBy');

    if (search) opts.search = search;
    if (month) opts.month = month;
    if (startDate) opts.startDate = startDate;
    if (endDate) opts.endDate = endDate;
    if (category) opts.category = category;
    if (categories) opts.categories = categories;
    if (type && type !== 'all') opts.type = type;
    if (accountId) opts.accountId = accountId;
    if (accountIds) opts.accountIds = accountIds;
    if (minAmount) opts.minAmount = minAmount;
    if (maxAmount) opts.maxAmount = maxAmount;
    if (taxDeductible) opts.taxDeductible = taxDeductible;
    if (hasAttachments) opts.hasAttachments = hasAttachments;
    if (sortBy) opts.sortBy = sortBy;
    opts.limit = 500;

    return opts;
  }, [searchParams]);

  // SWR Hook with full options and filterSummary
  const { transactions, isLoading, isValidating, filterSummary, key: swrKey } = useTransactions(queryOptions);
  const { accounts, mutate: mutateAccounts } = useAccounts();
  const { categories: customCategories, mutate: mutateCategories } = useCustomCategories('all');

  // Multi-Row Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const lastCheckedIndexRef = useRef<number | null>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Progressive intersection chunking for 60fps rendering
  const [visibleGroupCount, setVisibleGroupCount] = useState<number>(10);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Quick Add & Modals State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedDetailTx, setSelectedDetailTx] = useState<Transaction | null>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<number | string | null>(null);

  // Cleanup click timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  // Quick Add Form State
  const [qaType, setQaType] = useState<'expense' | 'earning'>('expense');
  const [qaAmount, setQaAmount] = useState('');
  const [qaCategory, setQaCategory] = useState('');
  const [qaIsSplit, setQaIsSplit] = useState(false);
  const [qaSplits, setQaSplits] = useState<TransactionSplitItem[]>([]);
  const [qaDesc, setQaDesc] = useState('');
  const [qaDate, setQaDate] = useState(new Date().toISOString().split('T')[0]);
  const [qaNotes, setQaNotes] = useState('');
  const [qaAttachments, setQaAttachments] = useState<File[]>([]);
  const [qaScanningId, setQaScanningId] = useState<number | null>(null);
  const [qaSubmitting, setQaSubmitting] = useState(false);
  const [qaAddingCustomCategory, setQaAddingCustomCategory] = useState(false);
  const [qaCustomCategoryName, setQaCustomCategoryName] = useState('');
  const [qaCustomIcon, setQaCustomIcon] = useState(CUSTOM_CATEGORY_ICONS[0]);
  const [qaCustomColor, setQaCustomColor] = useState(CUSTOM_COLORS[0]);
  const [qaIconOptions, setQaIconOptions] = useState(CUSTOM_CATEGORY_ICONS.slice(0, 40));

  // Inline Cell Editing State
  const [editingCell, setEditingCell] = useState<{
    id: number | string;
    field: 'description' | 'amount' | 'category' | 'account';
  } | null>(null);
  const [inlineValue, setInlineValue] = useState<string>('');
  const [inlineCategorySearch, setInlineCategorySearch] = useState<string>('');

  // Bulk Action Bar Popovers
  const [bulkCategorizeOpen, setBulkCategorizeOpen] = useState(false);
  const [bulkMoveAccountOpen, setBulkMoveAccountOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Delete Confirmation Modals
  const [deletingTxId, setDeletingTxId] = useState<number | string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Accounts lookup map
  const accountsMap = useMemo(() => {
    const map = new Map<number, any>();
    accounts.forEach((acc: any) => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  // Combined categories list (quick defaults + custom categories)
  const allCategoryList = useMemo<string[]>(() => {
    const customList = (customCategories || []).map((c: any) => c.name);
    return Array.from(new Set([...QUICK_CATEGORIES, ...customList]));
  }, [customCategories]);

  // Chronologically group transactions by date
  const dateGroups = useMemo<DateGroup[]>(() => {
    const groupsMap = new Map<string, Transaction[]>();

    for (const tx of transactions) {
      const d = tx.date ? (tx.date.includes('T') ? tx.date.split('T')[0] : tx.date) : 'Undated';
      if (!groupsMap.has(d)) {
        groupsMap.set(d, []);
      }
      groupsMap.get(d)!.push(tx);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return Array.from(groupsMap.entries()).map(([dateStr, txList]) => {
      let formattedDate = dateStr;
      if (dateStr === todayStr) {
        const d = new Date();
        formattedDate = `Today, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else if (dateStr === yesterdayStr) {
        formattedDate = `Yesterday, ${yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else if (dateStr !== 'Undated') {
        const d = new Date(dateStr + 'T00:00:00');
        formattedDate = d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        });
      }

      let totalInflows = 0;
      let totalOutflows = 0;
      for (const t of txList) {
        if (t.type === 'earning') totalInflows += t.amount;
        else if (t.type === 'expense') totalOutflows += t.amount;
      }

      return {
        date: dateStr,
        formattedDate,
        transactions: txList,
        totalInflows,
        totalOutflows,
        netCashflow: totalInflows - totalOutflows,
      };
    });
  }, [transactions]);

  // Flattened visible transactions for keyboard navigation
  const flatVisibleTransactions = useMemo(() => {
    const visible = dateGroups.slice(0, visibleGroupCount);
    return visible.flatMap((g) => g.transactions);
  }, [dateGroups, visibleGroupCount]);

  // Fast index map for flat visible transactions (enables O(1) Shift+Click range lookups)
  const txIndexMap = useMemo(() => {
    const map = new Map<number | string, number>();
    flatVisibleTransactions.forEach((tx, idx) => {
      map.set(tx.id, idx);
    });
    return map;
  }, [flatVisibleTransactions]);

  // Infinite progressive chunking via IntersectionObserver (maintains 60fps)
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleGroupCount((prev) => Math.min(prev + 10, dateGroups.length));
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [dateGroups.length]);

  // Reset visible groups when filter query changes
  useEffect(() => {
    setVisibleGroupCount(10);
    setSelectedIds(new Set());
    lastCheckedIndexRef.current = null;
    setFocusedIndex(-1);
  }, [queryOptions]);

  // Keyboard navigation: j, k, x, Space, e, Delete, Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Escape clears selection or closes open bulk popovers
      if (e.key === 'Escape') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          setSelectedIds(new Set());
          lastCheckedIndexRef.current = null;
          setBulkCategorizeOpen(false);
          setBulkMoveAccountOpen(false);
          return;
        }
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, flatVisibleTransactions.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'x' || e.key === ' ') {
        if (focusedIndex >= 0 && focusedIndex < flatVisibleTransactions.length) {
          e.preventDefault();
          const focusedTx = flatVisibleTransactions[focusedIndex];
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(focusedTx.id)) next.delete(focusedTx.id);
            else next.add(focusedTx.id);
            return next;
          });
          lastCheckedIndexRef.current = focusedIndex;
        }
      } else if (e.key === 'e') {
        if (focusedIndex >= 0 && focusedIndex < flatVisibleTransactions.length) {
          e.preventDefault();
          const focusedTx = flatVisibleTransactions[focusedIndex];
          setEditingCell({ id: focusedTx.id, field: 'description' });
          setInlineValue(focusedTx.description || '');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (focusedIndex >= 0 && focusedIndex < flatVisibleTransactions.length) {
          e.preventDefault();
          const focusedTx = flatVisibleTransactions[focusedIndex];
          setDeletingTxId(focusedTx.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, flatVisibleTransactions, selectedIds.size]);

  // Shift + Click range checkbox selection handler
  const handleCheckboxClick = (
    tx: Transaction,
    index: number,
    e: React.MouseEvent<HTMLInputElement>
  ) => {
    if (e.shiftKey && lastCheckedIndexRef.current !== null && lastCheckedIndexRef.current !== index) {
      const start = Math.min(lastCheckedIndexRef.current, index);
      const end = Math.max(lastCheckedIndexRef.current, index);
      const targetSlice = flatVisibleTransactions.slice(start, end + 1);
      const shouldSelect = !selectedIds.has(tx.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        targetSlice.forEach((item) => {
          if (shouldSelect) next.add(item.id);
          else next.delete(item.id);
        });
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(tx.id)) next.delete(tx.id);
        else next.add(tx.id);
        return next;
      });
    }
    lastCheckedIndexRef.current = index;
  };

  // Debounced row click to open details without conflicting with double click
  const handleRowClick = (tx: Transaction) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    clickTimerRef.current = setTimeout(() => {
      setSelectedDetailTx(tx);
    }, 220);
  };

  // Double click merchant cell to enter inline rename
  const handleMerchantDoubleClick = (tx: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setEditingCell({ id: tx.id, field: 'description' });
    setInlineValue(tx.description || '');
  };

  // Toggle selection for all visible transactions
  const handleToggleSelectAll = () => {
    lastCheckedIndexRef.current = null;
    if (selectedIds.size === flatVisibleTransactions.length && flatVisibleTransactions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(flatVisibleTransactions.map((t) => t.id)));
    }
  };

  // Toggle selection for a single date group
  const handleToggleGroup = (group: DateGroup) => {
    lastCheckedIndexRef.current = null;
    const groupIds = group.transactions.map((t) => t.id);
    const allSelected = groupIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Live selected net sum calculation
  const selectedSummary = useMemo(() => {
    let count = 0;
    let net = 0;
    for (const tx of transactions) {
      if (selectedIds.has(tx.id)) {
        count++;
        if (tx.type === 'earning') net += tx.amount;
        else if (tx.type === 'expense') net -= tx.amount;
      }
    }
    return { count, net };
  }, [selectedIds, transactions]);

  // Save inline cell edit via PATCH /api/transactions
  const handleSaveInlineEdit = async (
    tx: Transaction,
    field: 'description' | 'amount' | 'category' | 'account',
    newValue: any
  ) => {
    setEditingCell(null);

    const patchPayload: Record<string, any> = { id: Number(tx.id) };
    if (field === 'description') patchPayload.description = String(newValue).trim();
    else if (field === 'amount') {
      const parsed = parseFloat(String(newValue));
      if (isNaN(parsed) || parsed <= 0) return;
      patchPayload.amount = parsed;
    } else if (field === 'category') patchPayload.category = String(newValue).trim();
    else if (field === 'account') patchPayload.accountId = Number(newValue) || null;

    // Optimistic SWR update
    mutate(
      swrKey,
      (current: any) => {
        if (!current) return current;
        return {
          ...current,
          transactions: current.transactions.map((t: Transaction) =>
            t.id === tx.id ? { ...t, ...patchPayload } : t
          ),
        };
      },
      false
    );

    try {
      const res = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });

      if (!res.ok) throw new Error('Failed to update transaction');

      toast.success('Updated');
      mutate(swrKey);
      mutateAccounts();
      if (field === 'amount' || field === 'account') {
        invalidateFinancialData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
      mutate(swrKey); // Rollback
    }
  };

  // Submit Bulk Categorize
  const handleBulkCategorize = async (category: string) => {
    if (selectedIds.size === 0 || !category) return;
    setBulkSubmitting(true);
    try {
      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'categorize',
          ids: Array.from(selectedIds),
          category,
        }),
      });

      if (!res.ok) throw new Error('Bulk categorize failed');
      const data = await res.json();
      toast.success(`Categorized ${data.count} transactions as ${category}`);
      setBulkCategorizeOpen(false);
      setSelectedIds(new Set());
      mutate(swrKey);
    } catch (err: any) {
      toast.error(err.message || 'Bulk categorization failed');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Submit Bulk Move Account
  const handleBulkMoveAccount = async (targetAccountId: number) => {
    if (selectedIds.size === 0 || !targetAccountId) return;
    setBulkSubmitting(true);
    try {
      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move_account',
          ids: Array.from(selectedIds),
          targetAccountId,
        }),
      });

      if (!res.ok) throw new Error('Bulk move account failed');
      const data = await res.json();
      toast.success(`Moved ${data.count} transactions to target account`);
      setBulkMoveAccountOpen(false);
      setSelectedIds(new Set());
      mutate(swrKey);
      mutateAccounts();
      invalidateFinancialData();
    } catch (err: any) {
      toast.error(err.message || 'Bulk account move failed');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Submit Bulk Tax Tag
  const handleBulkTaxTag = async (action: 'tag' | 'untag') => {
    if (selectedIds.size === 0) return;
    setBulkSubmitting(true);
    try {
      const res = await fetch('/api/tax/bulk-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          action,
        }),
      });

      if (!res.ok) throw new Error('Bulk tax tagging failed');
      const data = await res.json();
      toast.success(
        action === 'tag'
          ? `Marked ${data.count} transactions as tax-deductible`
          : `Removed tax tags from ${data.count} transactions`
      );
      mutate(swrKey);
    } catch (err: any) {
      toast.error(err.message || 'Bulk tax tagging failed');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Submit Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          ids: Array.from(selectedIds),
        }),
      });

      if (!res.ok) throw new Error('Bulk delete failed');
      const data = await res.json();
      toast.success(`Deleted ${data.count} transactions and restored balances`);
      setShowBulkDeleteConfirm(false);
      setSelectedIds(new Set());
      mutate(swrKey);
      mutateAccounts();
      invalidateFinancialData();
    } catch (err: any) {
      toast.error(err.message || 'Bulk delete failed');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Submit Single Delete
  const handleSingleDelete = async () => {
    if (!deletingTxId) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/transactions?id=${deletingTxId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Transaction deleted');
      setDeletingTxId(null);
      mutate(swrKey);
      mutateAccounts();
      invalidateFinancialData();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Submit Duplicate
  const handleDuplicate = async (tx: Transaction) => {
    try {
      const payload = {
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        description: `${tx.description || tx.category} (Copy)`,
        date: new Date().toISOString().split('T')[0],
        accountId: tx.accountId,
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to duplicate transaction');
      toast.success('Transaction duplicated');
      mutate(swrKey);
      mutateAccounts();
      invalidateFinancialData();
    } catch (err: any) {
      toast.error(err.message || 'Duplicate failed');
    }
  };

  // Quick Add submit
  const submitQuickAdd = async () => {
    if (qaSubmitting) return;
    const parsed = parseFloat(qaAmount);
    const categoryName = qaIsSplit
      ? 'Split Transaction'
      : qaAddingCustomCategory
      ? qaCustomCategoryName.trim().replace(/\s+/g, ' ')
      : qaCategory.trim().replace(/\s+/g, ' ');

    if (!qaAmount || isNaN(parsed) || parsed <= 0 || !categoryName) return;

    if (qaIsSplit) {
      if (qaSplits.length < 2) {
        toast.error('Split transactions must have at least 2 categories');
        return;
      }
      const splitSum = qaSplits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
      if (Math.abs(splitSum - parsed) > 0.01) {
        toast.error(`Split amounts (${sym}${splitSum.toFixed(2)}) must equal total (${sym}${parsed.toFixed(2)})`);
        return;
      }
    }

    setQaSubmitting(true);
    const clientMutationId = crypto.randomUUID();

    try {
      if (!isOnline) {
        await queueTransaction({
          clientMutationId,
          syncStatus: 'pending',
          type: qaType,
          amount: parsed,
          category: categoryName,
          description: qaDesc || categoryName,
          date: qaDate,
          notes: qaNotes.trim() || undefined,
          splits: qaIsSplit ? qaSplits : undefined,
        });
        toast.info('Saved offline! Will sync automatically when back online.');
        setShowQuickAdd(false);
        setQaAmount('');
        setQaDesc('');
        setQaCategory('');
        setQaNotes('');
        setQaAttachments([]);
        setQaIsSplit(false);
        setQaSplits([]);
        mutate(swrKey);
        return;
      }

      if (qaAddingCustomCategory && categoryName && !qaIsSplit) {
        await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: categoryName,
            type: qaType,
            icon: qaCustomIcon,
            color: qaCustomColor,
          }),
        }).catch(() => {});
        mutateCategories();
      }

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientMutationId,
          type: qaType,
          amount: parsed,
          category: categoryName,
          description: qaDesc || categoryName,
          date: qaDate,
          notes: qaNotes.trim() || undefined,
          splits: qaIsSplit ? qaSplits : undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to add transaction');
      const newTx = await res.json();

      if (newTx?.id && qaAttachments.length > 0) {
        const form = new FormData();
        qaAttachments.forEach((f) => form.append('files', f));
        await fetch(`/api/transactions/${newTx.id}/attachments`, {
          method: 'POST',
          body: form,
        }).catch(() => {});
      }

      toast.success('Transaction saved!');
      setShowQuickAdd(false);
      setQaAmount('');
      setQaDesc('');
      setQaCategory('');
      setQaNotes('');
      setQaAttachments([]);
      setQaIsSplit(false);
      setQaSplits([]);
      mutate(swrKey);
      mutateAccounts();
      invalidateFinancialData();
    } catch (err: any) {
      if (!navigator.onLine || err.name === 'TypeError') {
        try {
          await queueTransaction({
            clientMutationId,
            syncStatus: 'pending',
            type: qaType,
            amount: parsed,
            category: categoryName,
            description: qaDesc || categoryName,
            date: qaDate,
            notes: qaNotes.trim() || undefined,
            splits: qaIsSplit ? qaSplits : undefined,
          });
          toast.info('Network issue: Transaction queued offline for sync.');
          setShowQuickAdd(false);
          setQaAmount('');
          setQaDesc('');
          setQaCategory('');
          setQaNotes('');
          setQaAttachments([]);
          setQaIsSplit(false);
          setQaSplits([]);
          mutate(swrKey);
          return;
        } catch (queueErr) {
          console.error(queueErr);
        }
      }
      toast.error(err.message || 'Add transaction failed');
    } finally {
      setQaSubmitting(false);
    }
  };

  const handleScanAttachment = async (file: File) => {
    setQaScanningId(1);
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
      toast.success('Receipt details scanned');
    } catch {
      toast.error('Failed to extract receipt data');
    } finally {
      setQaScanningId(null);
    }
  };

  const generateInlineIconOptions = () => {
    const candidates = getIconCandidates(qaCustomCategoryName || qaCategory || qaType);
    setQaIconOptions(candidates);
    setQaCustomIcon(candidates[0]);
  };

  // Export full filtered ledger to Excel
  const exportExcel = async () => {
    try {
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Transactions');
      ws.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Description', key: 'description', width: 35 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Account', key: 'account', width: 20 },
      ];
      ws.getRow(1).font = { bold: true };
      transactions.forEach((t) =>
        ws.addRow({
          date: t.date,
          type: t.type,
          category: t.category,
          description: t.description,
          amount: t.amount,
          account: t.accountId ? accountsMap.get(t.accountId)?.name || t.accountId : '',
        })
      );
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Ledger exported to Excel');
    } catch {
      toast.error('Export failed');
    }
  };

  // Selected transactions array for ExportButton
  const selectedTransactionsArray = useMemo(() => {
    return transactions.filter((t) => selectedIds.has(t.id));
  }, [transactions, selectedIds]);

  return (
    <div className="p-4 lg:p-8 max-w-[1500px] mx-auto min-h-screen pb-32">
      {/* Background Revalidation Indicator */}
      {isValidating && (
        <div className="fixed top-0 left-0 lg:left-64 right-0 z-50 h-0.5">
          <div className="h-full bg-primary/70 animate-pulse rounded-full" />
        </div>
      )}

      {/* Upgraded Multi-Facet Filter Bar & Live Summary Strip */}
      <TransactionFiltersBar
        filterSummary={filterSummary}
        fmt={fmt}
        showQuickAdd={showQuickAdd}
        setShowQuickAdd={setShowQuickAdd}
        setIsScannerOpen={setIsScannerOpen}
        exportExcel={exportExcel}
      />

      {/* Keyboard Shortcuts Hint Bar */}
      <div className="hidden lg:flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-gray-400 px-3 py-1.5 mb-3 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/10 rounded-xl">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 font-mono text-[10px] text-gray-700 dark:text-gray-300">
              j
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 font-mono text-[10px] text-gray-700 dark:text-gray-300">
              k
            </kbd>
            <span>Navigate rows</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 font-mono text-[10px] text-gray-700 dark:text-gray-300">
              x
            </kbd>
            <span>Toggle select</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 font-mono text-[10px] text-gray-700 dark:text-gray-300">
              e
            </kbd>
            <span>Edit merchant</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 font-mono text-[10px] text-gray-700 dark:text-gray-300">
              Del
            </kbd>
            <span>Delete row</span>
          </span>
        </div>
        <div>
          <span>Tip: Click any merchant, category, account, or amount to edit inline</span>
        </div>
      </div>

      {/* ── Main Ledger Table (Desktop & Tablet) ── */}
      <div className="card-glass relative overflow-hidden rounded-3xl border border-white/[0.08] dark:border-white/[0.08] shadow-2xl backdrop-blur-2xl">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/90 dark:bg-[#0A0E1B]/90 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-white/[0.08]">
                <th className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all visible transactions"
                    checked={
                      selectedIds.size > 0 &&
                      selectedIds.size === flatVisibleTransactions.length &&
                      flatVisibleTransactions.length > 0
                    }
                    onChange={handleToggleSelectAll}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Merchant / Description</th>
                <th className="px-4 py-3.5 w-40">Category</th>
                <th className="px-4 py-3.5 w-36">Account</th>
                <th className="px-4 py-3.5 w-28 text-center">Tax Status</th>
                <th className="px-4 py-3.5 w-36 text-right">Amount</th>
                <th className="px-4 py-3.5 w-16 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
              {isLoading && transactions.length === 0 ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td className="px-4 py-4 text-center">
                      <div className="h-4 w-4 rounded shimmer-skeleton mx-auto" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl shimmer-skeleton shrink-0" />
                        <div className="space-y-2">
                          <div className="h-3.5 w-48 rounded shimmer-skeleton" />
                          <div className="h-2.5 w-24 rounded shimmer-skeleton" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-7 w-28 rounded-lg shimmer-skeleton" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-7 w-24 rounded-lg shimmer-skeleton" />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="h-7 w-16 rounded-lg shimmer-skeleton mx-auto" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-20 rounded shimmer-skeleton ml-auto" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-8 w-8 rounded-lg shimmer-skeleton ml-auto" />
                    </td>
                  </tr>
                ))
              ) : dateGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 dark:bg-white/5">
                      <span className="material-symbols-outlined text-3xl text-gray-400">
                        search_off
                      </span>
                    </div>
                    <p className="text-base font-bold text-gray-800 dark:text-gray-200">
                      No transactions found
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Try broadening your search query, adjusting date filters, or quick adding a transaction.
                    </p>
                  </td>
                </tr>
              ) : (
                dateGroups.slice(0, visibleGroupCount).map((group) => {
                  const isGroupAllSelected =
                    group.transactions.length > 0 &&
                    group.transactions.every((t) => selectedIds.has(t.id));

                  return (
                    <React.Fragment key={`group-${group.date}`}>
                      {/* ── Sticky Sub-Header for Date Group ── */}
                      <tr className="sticky top-0 z-20 bg-gray-50/95 dark:bg-[#0A0E1B]/95 border-y border-gray-200/80 dark:border-white/[0.08] backdrop-blur-md">
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Select all transactions on ${group.formattedDate}`}
                            checked={isGroupAllSelected}
                            onChange={() => handleToggleGroup(group)}
                            className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>
                        <td colSpan={4} className="px-4 py-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                              {group.formattedDate}
                            </span>
                            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                              {group.transactions.length} entry
                              {group.transactions.length !== 1 ? 'ies' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold tabular-nums ${
                              group.netCashflow >= 0
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                            }`}
                          >
                            {group.netCashflow >= 0 ? '+' : ''}
                            {formatAmount(group.netCashflow, fmt(group.netCashflow))}
                          </span>
                        </td>
                        <td className="px-4 py-2" />
                      </tr>

                      {/* ── Individual Transaction Rows ── */}
                      {group.transactions.map((tx) => {
                        const isSelected = selectedIds.has(tx.id);
                        const isFocused =
                          focusedIndex >= 0 && flatVisibleTransactions[focusedIndex]?.id === tx.id;
                        const accountObj = tx.accountId ? accountsMap.get(tx.accountId) : null;
                        const itemIndex = txIndexMap.get(tx.id) ?? -1;

                        return (
                          <tr
                            key={tx.id}
                            onClick={() => handleRowClick(tx)}
                            className={`group transition-colors duration-150 cursor-pointer h-[52px] ${
                              isSelected
                                ? 'bg-primary/10 dark:bg-primary/15'
                                : isFocused
                                ? 'bg-primary/5 dark:bg-primary/10 ring-1 ring-inset ring-primary/30'
                                : 'hover:bg-gray-50/80 dark:hover:bg-white/[0.03]'
                            }`}
                          >
                            {/* Checkbox Cell */}
                            <td
                              className="px-4 py-2 h-[52px] align-middle text-center w-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                aria-label={`Select transaction ${tx.description || tx.category}`}
                                checked={isSelected}
                                onClick={(e) => handleCheckboxClick(tx, itemIndex, e)}
                                onChange={() => {}}
                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                              />
                            </td>

                            {/* Merchant / Description (Double-Click Inline Editable, Single Click Opens Detail) */}
                            <td className="px-4 py-2 h-[52px] align-middle">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                    tx.type === 'expense'
                                      ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500'
                                      : tx.type === 'earning'
                                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'
                                      : 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-[#38bdf8]'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[17px]">
                                    {getCategoryIcon(tx.category, customCategories)}
                                  </span>
                                </div>

                                <div className="min-w-0 flex-1 flex flex-col justify-center">
                                  {editingCell?.id === tx.id &&
                                  editingCell?.field === 'description' ? (
                                    <input
                                      type="text"
                                      autoFocus
                                      value={inlineValue}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => setInlineValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSaveInlineEdit(tx, 'description', inlineValue);
                                        } else if (e.key === 'Escape') {
                                          setEditingCell(null);
                                        }
                                      }}
                                      onBlur={() =>
                                        handleSaveInlineEdit(tx, 'description', inlineValue)
                                      }
                                      className="w-full px-2 py-0.5 text-xs font-bold border border-primary rounded-lg bg-white dark:bg-[#0A0E1A] text-gray-900 dark:text-white outline-none"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span
                                        onDoubleClick={(e) => handleMerchantDoubleClick(tx, e)}
                                        className="font-bold text-gray-900 dark:text-white truncate cursor-pointer hover:underline decoration-dotted"
                                        title="Double-click to rename merchant inline, click row for details"
                                      >
                                        {tx.description || tx.category}
                                      </span>

                                      {/* Indicator badges */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        {/* Attachment Paperclip */}
                                        {Boolean(
                                          (tx.attachments && tx.attachments !== '[]' && tx.attachments !== '') ||
                                          tx.receipt_image
                                        )}
                                        {Boolean(
                                          (tx.attachments && tx.attachments !== '[]' && tx.attachments !== '') ||
                                          tx.receipt_image
                                        ) && (
                                          <span
                                            className="inline-flex items-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                            title="Receipt or attachment attached"
                                          >
                                            <span className="material-symbols-outlined text-[15px]">attach_file</span>
                                          </span>
                                        )}

                                        {/* Tax Pill */}
                                        {Boolean(tx.taxDeductible || tx.taxSuggested) && (
                                          <span
                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                            title={tx.taxDeductible ? 'Tax Deductible' : 'Tax Suggested'}
                                          >
                                            <span className="material-symbols-outlined text-[11px]">receipt_long</span>
                                            <span>Tax</span>
                                          </span>
                                        )}

                                        {/* Collaborative Pill */}
                                        {(tx.collaborativeSourceType ||
                                          (tx.personalShareAmount != null && tx.personalShareAmount < tx.amount)) && (
                                          <span
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
                                            title={`Collaborative: Personal share ${sym}${Number(
                                              tx.personalShareAmount ?? tx.amount
                                            ).toFixed(2)} of ${sym}${Number(tx.amount).toFixed(2)}`}
                                          >
                                            <span className="material-symbols-outlined text-[11px]">
                                              {tx.collaborativeSourceType === 'tour'
                                                ? 'travel'
                                                : tx.collaborativeSourceType === 'household'
                                                ? 'home'
                                                : 'group'}
                                            </span>
                                            <span>
                                              {tx.personalShareAmount != null
                                                ? `Share: ${sym}${Number(tx.personalShareAmount).toFixed(0)}/${sym}${Number(
                                                    tx.amount
                                                  ).toFixed(0)}`
                                                : tx.collaborativeSourceType === 'tour'
                                                ? 'Tour'
                                                : tx.collaborativeSourceType === 'household'
                                                ? 'Household'
                                                : 'Shared'}
                                            </span>
                                          </span>
                                        )}

                                        {/* Pending Status Pill */}
                                        {tx.status === 'pending' && (
                                          <span
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                            title="Pending: Does not affect liquid account balance"
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            Pending
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate leading-none mt-0.5">
                                    {tx.date}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Category Pill (Searchable Popover) */}
                            <td
                              className="px-4 py-2 h-[52px] align-middle relative w-44"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(() => {
                                const splitsArray: TransactionSplitItem[] = Array.isArray(tx.splits)
                                  ? tx.splits
                                  : typeof tx.splits === 'string'
                                  ? (() => {
                                      try {
                                        return JSON.parse(tx.splits);
                                      } catch {
                                        return [];
                                      }
                                    })()
                                  : [];

                                if (splitsArray.length > 0) {
                                  return (
                                    <div className="relative group/split inline-block">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedDetailTx(tx)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-primary/10 dark:bg-primary/15 text-primary dark:text-[#38bdf8] border border-primary/20 dark:border-primary/30 hover:bg-primary/20 transition-colors"
                                      >
                                        <span className="material-symbols-outlined text-[14px] text-primary">
                                          call_split
                                        </span>
                                        <span>Split ({splitsArray.length})</span>
                                      </button>
                                      {/* Tooltip on hover */}
                                      <div className="pointer-events-none opacity-0 group-hover/split:opacity-100 transition-opacity duration-150 absolute left-0 bottom-full mb-2 z-50 w-64 rounded-xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-xl p-2.5 shadow-xl text-left text-xs">
                                        <div className="font-semibold text-gray-900 dark:text-white pb-1.5 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
                                          <span>Split Breakdown</span>
                                          <span className="text-[10px] text-gray-400">{splitsArray.length} categories</span>
                                        </div>
                                        <div className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto">
                                          {splitsArray.map((s, idx) => {
                                            const pct = tx.amount > 0 ? Math.round((s.amount / tx.amount) * 100) : 0;
                                            return (
                                              <div key={s.id || idx} className="flex items-center justify-between text-[11px]">
                                                <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                                                  <span
                                                    className="w-2 h-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: getCategoryHex(s.category, customCategories) }}
                                                  />
                                                  <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                                                    {s.category}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-1 text-right">
                                                  <span className="font-mono text-gray-900 dark:text-white font-semibold">
                                                    {sym}{s.amount.toFixed(2)}
                                                  </span>
                                                  <span className="text-[10px] text-gray-400">({pct}%)</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        editingCell?.id === tx.id &&
                                        editingCell?.field === 'category'
                                      ) {
                                        setEditingCell(null);
                                      } else {
                                        setEditingCell({ id: tx.id, field: 'category' });
                                        setInlineCategorySearch('');
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border dark:border-white/10 text-gray-700 dark:text-gray-300 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[14px] text-gray-400">
                                      {getCategoryIcon(tx.category, customCategories)}
                                    </span>
                                    <span className="truncate max-w-[100px]">{tx.category}</span>
                                  </button>
                                );
                              })()}

                              {editingCell?.id === tx.id &&
                                editingCell?.field === 'category' && (
                                  <div className="absolute left-4 top-full mt-1 z-30 w-56 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-xl p-2 shadow-xl dark:border-white/10 dark:bg-[#12182B]/95">
                                    <input
                                      type="text"
                                      autoFocus
                                      placeholder="Search categories..."
                                      value={inlineCategorySearch}
                                      onChange={(e) =>
                                        setInlineCategorySearch(e.target.value)
                                      }
                                      className="w-full mb-1 px-2 py-1 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white outline-none focus:border-primary/50"
                                    />
                                    <div className="max-h-44 overflow-y-auto space-y-0.5">
                                      {allCategoryList
                                        .filter((c) =>
                                          c
                                            .toLowerCase()
                                            .includes(inlineCategorySearch.toLowerCase())
                                        )
                                        .map((c) => (
                                          <button
                                            key={c}
                                            type="button"
                                            onClick={() =>
                                              handleSaveInlineEdit(tx, 'category', c)
                                            }
                                            className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-left text-xs text-gray-800 dark:text-gray-200 font-medium"
                                          >
                                            <span className="material-symbols-outlined text-[14px] text-gray-400">
                                              {getCategoryIcon(c, customCategories)}
                                            </span>
                                            <span className="truncate">{c}</span>
                                          </button>
                                        ))}
                                    </div>
                                  </div>
                                )}
                            </td>

                            {/* Account Pill (Popover Switcher) */}
                            <td
                              className="px-4 py-2 h-[52px] align-middle relative w-36"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    editingCell?.id === tx.id &&
                                    editingCell?.field === 'account'
                                  ) {
                                    setEditingCell(null);
                                  } else {
                                    setEditingCell({ id: tx.id, field: 'account' });
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border dark:border-white/10 text-gray-700 dark:text-gray-300 transition-colors"
                              >
                                {accountObj && (
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                      backgroundColor: accountObj.colorTag || '#4F46E5',
                                    }}
                                  />
                                )}
                                <span className="truncate max-w-[100px]">
                                  {accountObj ? accountObj.name : 'No Account'}
                                </span>
                              </button>

                              {editingCell?.id === tx.id && editingCell?.field === 'account' && (
                                <div className="absolute left-4 top-full mt-1 z-30 w-56 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-xl p-2 shadow-xl dark:border-white/10 dark:bg-[#12182B]/95">
                                  <div className="max-h-44 overflow-y-auto space-y-0.5">
                                    {accounts.map((acc: any) => (
                                      <button
                                        key={acc.id}
                                        type="button"
                                        onClick={() =>
                                          handleSaveInlineEdit(tx, 'account', acc.id)
                                        }
                                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-left text-xs text-gray-800 dark:text-gray-200 font-medium"
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <span
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: acc.colorTag || '#4F46E5' }}
                                          />
                                          <span className="truncate">{acc.name}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                                          {acc.currency}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Tax Tag Status (Inline Interactive Pill) */}
                            <td
                              className="px-4 py-2 h-[52px] align-middle text-center w-28"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <InlineTaxTagPill
                                transactionId={Number(tx.id)}
                                amount={tx.amount}
                                category={tx.category}
                                isTagged={Boolean(tx.taxSuggested)}
                                onTagged={() => mutate(swrKey)}
                              />
                            </td>

                            {/* Amount Cell (Right-Aligned, Tabular-Nums, Professional High-Contrast Palette) */}
                            <td
                              className="px-4 py-2 h-[52px] align-middle text-right font-mono tabular-nums w-36"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {editingCell?.id === tx.id && editingCell?.field === 'amount' ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  autoFocus
                                  value={inlineValue}
                                  onChange={(e) => setInlineValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveInlineEdit(tx, 'amount', inlineValue);
                                    } else if (e.key === 'Escape') {
                                      setEditingCell(null);
                                    }
                                  }}
                                  onBlur={() => handleSaveInlineEdit(tx, 'amount', inlineValue)}
                                  className="w-28 px-2 py-1 text-sm font-bold border border-primary rounded-lg bg-white dark:bg-[#0A0E1A] text-right text-gray-900 dark:text-white outline-none"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCell({ id: tx.id, field: 'amount' });
                                    setInlineValue(String(tx.amount));
                                  }}
                                  className={`text-sm font-semibold group/amt transition-opacity inline-flex items-center justify-end gap-1 ${
                                    tx.type === 'earning'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : tx.type === 'transfer'
                                      ? 'text-slate-600 dark:text-slate-300'
                                      : 'text-gray-900 dark:text-white'
                                  }`}
                                  title="Click to edit amount inline"
                                >
                                  <span className="font-bold">
                                    {tx.type === 'earning' ? '+' : tx.type === 'transfer' ? '↔' : '−'}
                                  </span>
                                  <span>{formatAmount(tx.amount, fmt(tx.amount))}</span>
                                </button>
                              )}
                            </td>

                            {/* Row Action Dropdown */}
                            <td
                              className="px-4 py-2 h-[52px] align-middle text-right w-16"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <TransactionRowActions
                                transaction={tx as any}
                                isOpen={actionMenuOpenId === tx.id}
                                onToggle={() =>
                                  setActionMenuOpenId(actionMenuOpenId === tx.id ? null : tx.id)
                                }
                                onClose={() => setActionMenuOpenId(null)}
                                onView={() => setSelectedDetailTx(tx)}
                                onEdit={() => setSelectedDetailTx(tx)}
                                onSplit={() => setSelectedDetailTx(tx)}
                                onAttachReceipt={() => setSelectedDetailTx(tx)}
                                onDuplicate={() => handleDuplicate(tx)}
                                onDelete={(id) => setDeletingTxId(id)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 60fps Progressive Intersection Sentinel */}
        <div ref={sentinelRef} className="h-4 w-full" />
      </div>

      {/* ── Floating Multi-Select Bulk Action Bar (Bottom Viewport Anchor) ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && mounted && (
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[95vw] bg-white/95 dark:bg-[#12182B]/95 border border-primary/20 dark:border-white/10 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl flex items-center gap-2 flex-wrap sm:flex-nowrap"
          >
            {/* Selected Count & Live Net Sum */}
            <div className="flex items-center gap-2 pl-2 pr-3 py-1 border-r border-gray-200 dark:border-white/10 shrink-0">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                {selectedSummary.count}
              </span>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                Net:{' '}
                <span
                  className={`font-mono tabular-nums ${
                    selectedSummary.net >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {selectedSummary.net >= 0 ? '+' : ''}
                  {formatAmount(selectedSummary.net, fmt(selectedSummary.net))}
                </span>
              </span>
            </div>

            {/* Bulk Categorize Button & Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setBulkCategorizeOpen(!bulkCategorizeOpen);
                  setBulkMoveAccountOpen(false);
                }}
                disabled={bulkSubmitting}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px]">category</span>
                <span>Change Category</span>
              </button>

              {bulkCategorizeOpen && (
                <div className="absolute bottom-full mb-2 left-0 z-50 w-56 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-2xl p-2 shadow-2xl dark:border-white/10 dark:bg-[#12182B]/95">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 px-1">
                    Assign Category
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {allCategoryList.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleBulkCategorize(cat)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-left text-xs font-medium text-gray-800 dark:text-gray-200"
                      >
                        <span className="material-symbols-outlined text-[15px] text-gray-400">
                          {getCategoryIcon(cat, customCategories)}
                        </span>
                        <span>{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bulk Move Account Button & Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setBulkMoveAccountOpen(!bulkMoveAccountOpen);
                  setBulkCategorizeOpen(false);
                }}
                disabled={bulkSubmitting}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                <span>Move Account</span>
              </button>

              {bulkMoveAccountOpen && (
                <div className="absolute bottom-full mb-2 left-0 z-50 w-56 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-2xl p-2 shadow-2xl dark:border-white/10 dark:bg-[#12182B]/95">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 px-1">
                    Select Target Account
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {accounts.map((acc: any) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleBulkMoveAccount(acc.id)}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-left text-xs font-medium text-gray-800 dark:text-gray-200"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: acc.colorTag || '#4F46E5' }}
                          />
                          <span className="truncate">{acc.name}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">{acc.currency}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bulk Tax Tagging */}
            <button
              type="button"
              onClick={() => handleBulkTaxTag('tag')}
              disabled={bulkSubmitting}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px]">sell</span>
              <span>Mark Tax Deductible</span>
            </button>

            {/* Export Selected Rows via ExportButton */}
            <ExportButton
              transactions={selectedTransactionsArray as any}
              className="shrink-0"
            />

            {/* Bulk Delete Button */}
            <button
              type="button"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={bulkSubmitting}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>Delete Selected</span>
            </button>

            {/* Deselect All (Esc) */}
            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set());
                lastCheckedIndexRef.current = null;
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              title="Clear Selection (Esc)"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              <span className="hidden md:inline text-[10px] font-mono font-semibold">Esc</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Single Delete Confirmation Modal ── */}
      {deletingTxId &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-white/10 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-[28px]">delete_forever</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Delete Transaction?
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                This transaction and any paired transfer legs will be removed, and account balances
                will be restored atomically.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingTxId(null)}
                  className="flex-1 py-2 px-4 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={handleSingleDelete}
                  className="flex-1 py-2 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md shadow-rose-500/30"
                >
                  {deleteSubmitting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {/* ── Bulk Delete Confirmation Modal ── */}
      {showBulkDeleteConfirm &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-white/10 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-[28px]">delete_sweep</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Delete {selectedIds.size} Transactions?
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                All selected transactions will be deleted in a single atomic database operation. All
                affected account balances will be restored with zero drift.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="flex-1 py-2 px-4 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={handleBulkDelete}
                  className="flex-1 py-2 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md shadow-rose-500/30"
                >
                  {deleteSubmitting ? 'Deleting...' : `Delete (${selectedIds.size})`}
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {/* ── Full Transaction Detail & Attachments Modal ── */}
      {selectedDetailTx && mounted && (
        <TransactionDetailModal
          transaction={selectedDetailTx as any}
          customCategories={customCategories}
          onClose={() => setSelectedDetailTx(null)}
          onEdit={() => {
            setSelectedDetailTx(null);
            mutate(swrKey);
          }}
          onDuplicate={(tx) => {
            setSelectedDetailTx(null);
            handleDuplicate(tx);
          }}
          onDelete={(tx) => {
            setSelectedDetailTx(null);
            setDeletingTxId(tx.id);
          }}
          onNotesChange={() => mutate(swrKey)}
        />
      )}

      {/* ── Quick Add Modal ── */}
      <QuickAddTransactionModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        qaType={qaType}
        setQaType={setQaType}
        qaAmount={qaAmount}
        setQaAmount={setQaAmount}
        qaCategory={qaCategory}
        setQaCategory={setQaCategory}
        qaIsSplit={qaIsSplit}
        setQaIsSplit={setQaIsSplit}
        qaSplits={qaSplits}
        setQaSplits={setQaSplits}
        qaDesc={qaDesc}
        setQaDesc={setQaDesc}
        qaDate={qaDate}
        setQaDate={setQaDate}
        qaNotes={qaNotes}
        setQaNotes={setQaNotes}
        qaAttachments={qaAttachments}
        setQaAttachments={setQaAttachments}
        qaScanningId={qaScanningId}
        qaSubmitting={qaSubmitting}
        submitQuickAdd={submitQuickAdd}
        sym={sym}
        handleScanAttachment={handleScanAttachment}
        customCategories={customCategories}
        qaAddingCustomCategory={qaAddingCustomCategory}
        setQaAddingCustomCategory={setQaAddingCustomCategory}
        qaCustomCategoryName={qaCustomCategoryName}
        setQaCustomCategoryName={setQaCustomCategoryName}
        qaCustomIcon={qaCustomIcon}
        setQaCustomIcon={setQaCustomIcon}
        qaCustomColor={qaCustomColor}
        setQaCustomColor={setQaCustomColor}
        qaIconOptions={qaIconOptions}
        generateInlineIconOptions={generateInlineIconOptions}
      />

      {/* ── Receipt Scanner Modal ── */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={() => {
          setIsScannerOpen(false);
          mutate(swrKey);
          mutateAccounts();
          invalidateFinancialData();
        }}
      />
    </div>
  );
}
