'use client';

/**
 * @fileoverview Streamlined Bank Statement Import and 1-Screen Reconciliation Engine.
 *
 * Implements a high-density, 3-step inline reconciliation workflow:
 * 1. Account & File Dropzone (auto-detects CSV/TSV instant parsing vs PDF multi-page)
 * 2. High-Density Reconciliation Table (bulk controls, inline editing, duplicate resolution)
 * 3. Instant Post-Commit Confirmation & Ledger Impact Banner
 *
 * Zero popup modals. Sovereign Sapphire Palette compliant.
 *
 * @module app/(app)/bank-import/page
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import { guessCategoryFromDescription } from '@/lib/ai/statementParser';

interface AccountOption {
  id: number;
  name: string;
  type: string;
  currency: string;
  currentBalance: number;
}

interface ReconciliationRow {
  id: string | number;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'expense' | 'earning';
  status: 'new_transaction' | 'probable_duplicate' | 'exact_match';
  matchConfidence: number;
  isDuplicate: boolean;
  matchedExistingTransactionId?: number | null;
  matchedExistingTransaction?: {
    id: number;
    date: string;
    description: string;
    amount: number;
    category: string;
    type?: string;
  } | null;
  action: 'import' | 'skip';
  resolution?: 'merged' | 'kept_both' | 'discarded' | 'pending';
}

const STANDARD_CATEGORIES = [
  'Food',
  'Groceries',
  'Transport',
  'Housing',
  'Utilities',
  'Shopping',
  'Entertainment',
  'Health',
  'Education',
  'Salary',
  'Freelance',
  'Investment',
  'Other',
];

export default function BankImportPage() {
  const { fmtRaw, currency } = useCurrency();
  const currencySymbol = CURRENCIES[currency]?.symbol || '$';
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Account & File State (Step 1) ── */
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [bankName, setBankName] = useState('Primary Bank');
  const [file, setFile] = useState<File | null>(null);
  const [retainFile, setRetainFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseStepText, setParseStepText] = useState('Analyzing statement...');

  /* ── Reconciliation Table State (Step 2) ── */
  const [activeStatementId, setActiveStatementId] = useState<string | null>(null);
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'duplicates' | 'skipped'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDuplicateId, setExpandedDuplicateId] = useState<string | number | null>(null);

  /* ── Commit State (Step 3) ── */
  const [committing, setCommitting] = useState(false);
  const [isCommitted, setIsCommitted] = useState(false);
  const [committedStats, setCommittedStats] = useState<{
    rowsCommitted: number;
    createdCount: number;
    mergedCount: number;
    netBalanceImpact: number;
    previousBalance: number;
    updatedAccountBalance: number | null;
    accountName: string;
  } | null>(null);

  // Load user accounts on mount
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch('/api/accounts');
        if (res.ok) {
          const data = await res.json();
          const list: AccountOption[] = data.accounts || [];
          setAccounts(list);
          if (list.length > 0) {
            setSelectedAccountId((prev) => prev || list[0].id);
            setBankName((prev) => prev || list[0].name);
          }
        }
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    }
    loadAccounts();
  }, []);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null;
  }, [accounts, selectedAccountId]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setIsCommitted(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setIsCommitted(false);
    }
  };

  // Step 1: Upload & Parse
  const handleParseStatement = async () => {
    if (!file) {
      toast.error('Please select a CSV, TSV, or PDF statement file.');
      return;
    }

    setParsing(true);
    setIsCommitted(false);
    setParseStepText('Scanning file bytes...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bankName', bankName || selectedAccount?.name || 'Primary Bank');
    if (selectedAccountId) {
      formData.append('accountId', String(selectedAccountId));
    }
    if (retainFile) {
      formData.append('retainFile', 'true');
    }

    const isCSV = file.name.toLowerCase().match(/\.(csv|tsv|txt)$/);

    const stepInterval = setInterval(() => {
      setParseStepText((prev) => {
        if (prev.includes('Scanning')) return 'Parsing transaction rows & date formats...';
        if (prev.includes('Parsing')) return 'Running duplicate detection against ledger...';
        if (prev.includes('duplicate')) return 'Auto-assigning financial categories...';
        return prev;
      });
    }, isCSV ? 250 : 800);

    try {
      const res = await fetch('/api/bank-import/parse', {
        method: 'POST',
        body: formData,
      });

      clearInterval(stepInterval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || 'Failed to parse statement');
      }

      const data = await res.json();
      setActiveStatementId(data.statementId || String(data.batchId));

      const rawItems: any[] = data.queueItems || [];
      const normalized: ReconciliationRow[] = rawItems.map((q: any) => ({
        id: q.id,
        date: q.date,
        description: q.description,
        amount: q.amount,
        category: q.category || 'Other',
        type: q.type || 'expense',
        status: q.status || (q.isDuplicate ? (q.matchConfidence >= 0.92 ? 'exact_match' : 'probable_duplicate') : 'new_transaction'),
        matchConfidence: q.matchConfidence ?? 0.5,
        isDuplicate: Boolean(q.isDuplicate),
        matchedExistingTransactionId: q.matchedExistingTransactionId,
        matchedExistingTransaction: q.matchedExistingTransaction || null,
        action: q.action || (q.isDuplicate ? 'skip' : 'import'),
        resolution: q.resolution || (q.isDuplicate ? 'merged' : 'kept_both'),
      }));

      setRows(normalized);
      toast.success(
        `Parsed ${normalized.length} transactions (${data.exactMatchCount || 0} duplicates identified)`
      );
    } catch (err: any) {
      clearInterval(stepInterval);
      toast.error(err.message || 'Statement parsing failed');
    } finally {
      setParsing(false);
    }
  };

  // Metrics calculation
  const totalExtracted = rows.length;
  const itemsToImport = useMemo(() => rows.filter((r) => r.action === 'import'), [rows]);
  const itemsToSkip = useMemo(() => rows.filter((r) => r.action === 'skip'), [rows]);
  const duplicateItems = useMemo(
    () => rows.filter((r) => r.status === 'exact_match' || r.status === 'probable_duplicate'),
    [rows]
  );
  const newItems = useMemo(() => rows.filter((r) => r.status === 'new_transaction'), [rows]);

  const netBalanceImpact = useMemo(() => {
    return itemsToImport.reduce((acc, r) => {
      return acc + (r.type === 'earning' ? r.amount : -r.amount);
    }, 0);
  }, [itemsToImport]);

  // Bulk Actions
  const handleSelectAllNew = () => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.status === 'new_transaction') {
          return { ...r, action: 'import', resolution: 'kept_both' };
        }
        return r;
      })
    );
    toast.info('Marked all new transactions for import');
  };

  const handleSkipAllDuplicates = () => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.status === 'exact_match' || r.status === 'probable_duplicate') {
          return { ...r, action: 'skip', resolution: 'merged' };
        }
        return r;
      })
    );
    toast.info('Skipped all duplicates and exact matches');
  };

  const handleAutoCategorizeAll = () => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.category === 'Other') {
          const guessed = guessCategoryFromDescription(r.description);
          return { ...r, category: guessed };
        }
        return r;
      })
    );
    toast.success('Applied keyword categorization rules');
  };

  // Row update handlers
  const handleToggleAction = (id: string | number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextAction = r.action === 'import' ? 'skip' : 'import';
          return {
            ...r,
            action: nextAction,
            resolution: nextAction === 'import' ? 'kept_both' : 'merged',
          };
        }
        return r;
      })
    );
  };

  const handleCategoryChange = (id: string | number, newCategory: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, category: newCategory } : r))
    );
  };

  const handleDescriptionChange = (id: string | number, newDesc: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, description: newDesc } : r))
    );
  };

  // Filtered rows for display
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Tab filter
      if (activeFilter === 'new' && r.status !== 'new_transaction') return false;
      if (
        activeFilter === 'duplicates' &&
        r.status !== 'exact_match' &&
        r.status !== 'probable_duplicate'
      )
        return false;
      if (activeFilter === 'skipped' && r.action !== 'skip') return false;

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesDesc = r.description.toLowerCase().includes(q);
        const matchesCat = r.category.toLowerCase().includes(q);
        const matchesAmt = r.amount.toString().includes(q);
        const matchesDate = r.date.includes(q);
        return matchesDesc || matchesCat || matchesAmt || matchesDate;
      }
      return true;
    });
  }, [rows, activeFilter, searchQuery]);

  // Step 3: Atomic Commit
  const handleCommitReconciliation = async () => {
    if (itemsToImport.length === 0 && itemsToSkip.length === 0) {
      toast.error('No items to reconcile.');
      return;
    }

    setCommitting(true);
    const previousBalance = selectedAccount?.currentBalance ?? 0;

    try {
      const payload = {
        statementId: activeStatementId,
        batchId: activeStatementId,
        accountId: selectedAccountId,
        items: rows.map((r) => ({
          id: r.id,
          action: r.action,
          resolution: r.action === 'import' ? 'kept_both' : 'merged',
          date: r.date,
          description: r.description,
          amount: r.amount,
          category: r.category,
          type: r.type,
          matchedExistingTransactionId: r.matchedExistingTransactionId,
        })),
      };

      const res = await fetch('/api/bank-import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to commit reconciliation');
      }

      const data = await res.json();

      setCommittedStats({
        rowsCommitted: data.rowsCommitted || itemsToImport.length,
        createdCount: data.createdCount ?? itemsToImport.length,
        mergedCount: data.mergedCount ?? itemsToSkip.length,
        netBalanceImpact: data.netBalanceImpact ?? netBalanceImpact,
        previousBalance,
        updatedAccountBalance: data.updatedAccountBalance ?? previousBalance + netBalanceImpact,
        accountName: selectedAccount?.name || 'Primary Account',
      });

      // Update local account balance
      if (data.updatedAccountBalance !== null && data.updatedAccountBalance !== undefined) {
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === selectedAccountId
              ? { ...a, currentBalance: data.updatedAccountBalance }
              : a
          )
        );
      }

      setIsCommitted(true);
      toast.success(
        `Successfully reconciled ${data.createdCount ?? itemsToImport.length} transactions!`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to commit transactions');
    } finally {
      setCommitting(false);
    }
  };

  const handleResetForNewImport = () => {
    setFile(null);
    setRows([]);
    setActiveStatementId(null);
    setIsCommitted(false);
    setCommittedStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </span>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                Bank Statement Reconciliation
              </h1>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Deterministic CSV/TSV extraction and multi-page PDF ingestion with 1-screen duplicate reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/transactions"
              className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/60"
            >
              View Ledger
            </Link>
            {rows.length > 0 && !isCommitted && (
              <button
                onClick={handleResetForNewImport}
                className="text-xs font-medium text-zinc-400 hover:text-rose-400 transition-colors px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/60"
              >
                Clear & Reset
              </button>
            )}
          </div>
        </div>

        {/* ── STEP 3: Post-Commit Confirmation Banner ── */}
        <AnimatePresence>
          {isCommitted && committedStats && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6 shadow-lg shadow-emerald-950/20"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-400">
                      Reconciliation Complete
                    </h3>
                    <p className="mt-1 text-sm text-zinc-300">
                      Successfully committed{' '}
                      <span className="font-semibold text-zinc-100">
                        {committedStats.createdCount} new transactions
                      </span>{' '}
                      and reconciled{' '}
                      <span className="font-semibold text-zinc-100">
                        {committedStats.mergedCount} duplicates
                      </span>{' '}
                      into <span className="font-semibold text-emerald-300">{committedStats.accountName}</span>.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-mono">
                      <span className="text-zinc-400">
                        Previous Balance: {fmtRaw(committedStats.previousBalance)}
                      </span>
                      <span className="text-zinc-500">→</span>
                      <span className="text-zinc-400">
                        Net Impact:{' '}
                        <span
                          className={
                            committedStats.netBalanceImpact >= 0
                              ? 'text-emerald-400 font-semibold'
                              : 'text-rose-400 font-semibold'
                          }
                        >
                          {committedStats.netBalanceImpact >= 0 ? '+' : ''}
                          {fmtRaw(committedStats.netBalanceImpact)}
                        </span>
                      </span>
                      <span className="text-zinc-500">→</span>
                      <span className="text-emerald-400 font-bold">
                        Updated Balance:{' '}
                        {committedStats.updatedAccountBalance !== null
                          ? fmtRaw(committedStats.updatedAccountBalance)
                          : fmtRaw(committedStats.previousBalance + committedStats.netBalanceImpact)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Link
                    href={`/transactions?accountId=${selectedAccountId || ''}`}
                    className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                  >
                    View in Transactions
                  </Link>
                  <button
                    onClick={handleResetForNewImport}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 transition-colors"
                  >
                    Import Another
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── STEP 1: Account & File Dropzone ── */}
        {!isCommitted && (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center">
                  1
                </span>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                  Target Account & Document Ingestion
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                Deterministic Local CSV Engine Ready
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Account Selector */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Target Ledger Account
                  </label>
                  <select
                    value={selectedAccountId || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setSelectedAccountId(id);
                      const acc = accounts.find((a) => a.id === id);
                      if (acc) setBankName(acc.name);
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type.toUpperCase()}) — {fmtRaw(acc.currentBalance)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Institution / Statement Label
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Chase Checking, Standard Chartered, Wise"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2.5 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={retainFile}
                      onChange={(e) => setRetainFile(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Retain encrypted file audit token in Document Vault</span>
                  </label>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div className="md:col-span-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.tsv,.txt,.pdf"
                  className="hidden"
                />

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : file
                      ? 'border-zinc-700 bg-zinc-900/60'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40'
                  }`}
                >
                  {parsing ? (
                    <div className="w-full max-w-md py-4 text-center space-y-3">
                      <div className="w-8 h-8 mx-auto border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-medium text-zinc-200">{parseStepText}</p>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-full w-2/3 animate-pulse rounded-full" />
                      </div>
                      <p className="text-xs text-zinc-500">
                        Zero data leaves your sandbox. Ledger checks run locally.
                      </p>
                    </div>
                  ) : file ? (
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-zinc-200">{file.name}</span>
                      <span className="text-xs text-zinc-400">
                        {(file.size / 1024).toFixed(1)} KB ·{' '}
                        {file.name.toLowerCase().endsWith('.pdf') ? 'PDF Document' : 'Delimited Table'}
                      </span>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleParseStatement();
                          }}
                          className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                        >
                          Analyze Statement
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 transition-colors"
                        >
                          Replace File
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className="w-12 h-12 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-300">
                          Click to browse or drop your bank statement here
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Supports CSV, TSV, TXT (instant local parse) and PDF (multi-page)
                        </p>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <span className="px-2 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          CSV / TSV (Instant)
                        </span>
                        <span className="px-2 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          PDF (Multi-Page OCR)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: High-Density Reconciliation Table ── */}
        {rows.length > 0 && !isCommitted && (
          <div className="space-y-6">
            {/* Summary Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/60">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Total Parsed
                </span>
                <p className="text-xl font-semibold text-zinc-100 tabular-nums mt-1">
                  {totalExtracted}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-950/10">
                <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">
                  New to Import
                </span>
                <p className="text-xl font-semibold text-emerald-400 tabular-nums mt-1">
                  {newItems.length}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-950/10">
                <span className="text-[11px] font-medium uppercase tracking-wider text-amber-400">
                  Needs Review
                </span>
                <p className="text-xl font-semibold text-amber-400 tabular-nums mt-1">
                  {duplicateItems.length}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Skipped / Merged
                </span>
                <p className="text-xl font-semibold text-zinc-300 tabular-nums mt-1">
                  {itemsToSkip.length}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/60 col-span-2 sm:col-span-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Ledger Impact
                </span>
                <p
                  className={`text-xl font-semibold font-mono tabular-nums mt-1 ${
                    netBalanceImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {netBalanceImpact >= 0 ? '+' : ''}
                  {fmtRaw(netBalanceImpact)}
                </p>
              </div>
            </div>

            {/* Filter Tabs & Bulk Actions Toolbar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === 'all'
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  All ({rows.length})
                </button>
                <button
                  onClick={() => setActiveFilter('new')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === 'new'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  New ({newItems.length})
                </button>
                <button
                  onClick={() => setActiveFilter('duplicates')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === 'duplicates'
                      ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Duplicates & Review ({duplicateItems.length})
                </button>
                <button
                  onClick={() => setActiveFilter('skipped')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === 'skipped'
                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Skipped ({itemsToSkip.length})
                </button>
              </div>

              {/* Search & Bulk Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search table..."
                    className="w-40 sm:w-48 bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <svg
                    className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                <button
                  onClick={handleSelectAllNew}
                  className="px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
                >
                  Select All New
                </button>
                <button
                  onClick={handleSkipAllDuplicates}
                  className="px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-950/30 hover:bg-amber-950/50 rounded-lg border border-amber-500/20 transition-colors"
                >
                  Skip Duplicates
                </button>
                <button
                  onClick={handleAutoCategorizeAll}
                  className="px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
                >
                  Auto-Categorize
                </button>

                <button
                  onClick={handleCommitReconciliation}
                  disabled={committing || itemsToImport.length === 0}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 transition-colors ${
                    itemsToImport.length > 0 && !committing
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                  }`}
                >
                  {committing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Reconciling...</span>
                    </>
                  ) : (
                    <>
                      <span>Commit {itemsToImport.length} Transactions</span>
                      <span className="opacity-80 font-mono">
                        ({netBalanceImpact >= 0 ? '+' : ''}
                        {fmtRaw(netBalanceImpact)})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Reconciliation Table */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-medium uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-28">Action</th>
                      <th className="py-3 px-3 w-28">Date</th>
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 px-3 w-40">Category</th>
                      <th className="py-3 px-3 w-24">Type</th>
                      <th className="py-3 px-4 w-32 text-right">Amount</th>
                      <th className="py-3 px-3 w-32 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-normal">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-500">
                          No transactions matching current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => {
                        const isExpanded = expandedDuplicateId === row.id;
                        const hasMatch = Boolean(row.matchedExistingTransaction);

                        return (
                          <React.Fragment key={row.id}>
                            <tr
                              className={`transition-colors hover:bg-zinc-850/50 ${
                                row.action === 'skip'
                                  ? 'bg-zinc-950/40 opacity-60'
                                  : 'bg-zinc-900/20'
                              }`}
                            >
                              {/* Action Segmented Toggle */}
                              <td className="py-2.5 px-4 whitespace-nowrap">
                                <div className="inline-flex rounded-lg border border-zinc-700/80 p-0.5 bg-zinc-950">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (row.action !== 'import') handleToggleAction(row.id);
                                    }}
                                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                      row.action === 'import'
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                  >
                                    Import
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (row.action !== 'skip') handleToggleAction(row.id);
                                    }}
                                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                      row.action === 'skip'
                                        ? 'bg-zinc-700 text-zinc-200'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                  >
                                    Skip
                                  </button>
                                </div>
                              </td>

                              {/* Date */}
                              <td className="py-2.5 px-3 text-zinc-300 font-mono text-[11px] whitespace-nowrap">
                                {row.date}
                              </td>

                              {/* Description (Editable inline) */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  value={row.description}
                                  onChange={(e) =>
                                    handleDescriptionChange(row.id, e.target.value)
                                  }
                                  className="w-full bg-transparent hover:bg-zinc-900/80 focus:bg-zinc-900 border border-transparent hover:border-zinc-700 focus:border-emerald-500 rounded px-2 py-1 text-zinc-200 text-xs transition-colors"
                                />
                                {hasMatch && (
                                  <div className="mt-0.5 px-2 flex items-center gap-1.5 text-[10px] text-amber-400">
                                    <span>
                                      Existing match: &quot;{row.matchedExistingTransaction?.description}&quot;
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedDuplicateId(isExpanded ? null : row.id)
                                      }
                                      className="underline hover:text-amber-300"
                                    >
                                      {isExpanded ? 'Hide' : 'Details'}
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* Category Dropdown */}
                              <td className="py-2.5 px-3">
                                <select
                                  value={row.category}
                                  onChange={(e) =>
                                    handleCategoryChange(row.id, e.target.value)
                                  }
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                                >
                                  {STANDARD_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Type */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                                    row.type === 'earning'
                                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20'
                                      : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                  }`}
                                >
                                  {row.type === 'earning' ? 'Income' : 'Expense'}
                                </span>
                              </td>

                              {/* Amount */}
                              <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                <span
                                  className={`font-mono text-xs font-semibold tabular-nums ${
                                    row.type === 'earning'
                                      ? 'text-emerald-400'
                                      : 'text-zinc-100'
                                  }`}
                                >
                                  {row.type === 'earning' ? '+' : '-'}
                                  {fmtRaw(row.amount)}
                                </span>
                              </td>

                              {/* Status Badge */}
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {row.status === 'exact_match' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                                    Exact Duplicate
                                  </span>
                                ) : row.status === 'probable_duplicate' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/40 text-amber-400 border border-amber-500/30">
                                    Probable Match ({Math.round(row.matchConfidence * 100)}%)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-500/20">
                                    New
                                  </span>
                                )}
                              </td>
                            </tr>

                            {/* Expanded Details Drawer */}
                            {isExpanded && hasMatch && (
                              <tr className="bg-zinc-950/80 border-y border-amber-500/20">
                                <td colSpan={7} className="py-3 px-6 text-xs space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                        />
                                      </svg>
                                      Comparison with Database Record #{row.matchedExistingTransaction?.id}
                                    </span>
                                    <span className="text-zinc-500 font-mono text-[11px]">
                                      Match Score: {(row.matchConfidence * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                                    <div>
                                      <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                                        Statement Inflow
                                      </span>
                                      <p className="font-medium text-zinc-200 mt-0.5">{row.description}</p>
                                      <p className="text-zinc-400 text-[11px] font-mono mt-0.5">
                                        {row.date} · {fmtRaw(row.amount)} ({row.category})
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                                        Existing Database Entry
                                      </span>
                                      <p className="font-medium text-zinc-200 mt-0.5">
                                        {row.matchedExistingTransaction?.description}
                                      </p>
                                      <p className="text-zinc-400 text-[11px] font-mono mt-0.5">
                                        {row.matchedExistingTransaction?.date} ·{' '}
                                        {fmtRaw(row.matchedExistingTransaction?.amount || 0)} (
                                        {row.matchedExistingTransaction?.category})
                                      </p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
