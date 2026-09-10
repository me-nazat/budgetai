'use client';

/**
 * @fileoverview AI Bank Statement Importer & Duplicate-Reconciliation Hub (Module 16).
 * Supports multi-page statement chunked extraction, confidence scoring rubric,
 * side-by-side transaction comparison with diff highlights, and atomic commits.
 *
 * @module app/(app)/bank-import/page
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import confetti from 'canvas-confetti';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import {
  StatementReconciliationReviewSheet,
  ReconciliationItem,
} from '@/components/bank-import/StatementReconciliationReviewSheet';
import { MultiPageParseProgressModal } from '@/components/bank-import/MultiPageParseProgressModal';
import { BankReconciliationCardQueue } from '@/components/bank-import/BankReconciliationCardQueue';

type ResolutionAction = 'merged' | 'kept_both' | 'discarded' | 'pending';

export default function BankImportPage() {
  const { fmtRaw, currency } = useCurrency();
  const currencySymbol = CURRENCIES[currency]?.symbol || '$';

  /* ── Upload & Progress State ── */
  const [file, setFile] = useState<File | null>(null);
  const [bankName, setBankName] = useState('Primary Bank');
  const [retainFile, setRetainFile] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState({
    isOpen: false,
    pageCount: 1,
    pagesParsed: 0,
    percentage: 0,
    status: 'idle',
  });

  /* ── Reconciliation Queue State ── */
  const [activeStatementId, setActiveStatementId] = useState<string | null>(null);
  const [queueItems, setQueueItems] = useState<ReconciliationItem[]>([]);
  const [selectedSheetItem, setSelectedSheetItem] = useState<ReconciliationItem | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [committing, setCommitting] = useState(false);
  const [isCommitted, setIsCommitted] = useState(false);

  /* ── File Upload & Multi-Page Parse Handler ── */
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setParsing(true);
    setParseProgress({
      isOpen: true,
      pageCount: 1,
      pagesParsed: 0,
      percentage: 15,
      status: 'Uploading and analyzing document pages...',
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bankName', bankName);
    if (retainFile) {
      formData.append('retainFile', 'true');
    }

    try {
      // Simulate/poll progress steps for multi-page responsive UX
      const progressTimer = setInterval(() => {
        setParseProgress((prev) => {
          if (prev.percentage >= 90) return prev;
          const nextPages = Math.min(prev.pageCount, prev.pagesParsed + 1);
          return {
            ...prev,
            percentage: Math.min(88, prev.percentage + 18),
            pagesParsed: nextPages,
          };
        });
      }, 900);

      const res = await fetch('/api/bank-import/parse', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressTimer);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || 'Parsing failed');
      }

      const data = await res.json();
      setParseProgress({
        isOpen: true,
        pageCount: data.pageCount || 1,
        pagesParsed: data.totalPagesParsed || data.pageCount || 1,
        percentage: 100,
        status: 'Completed',
      });

      setActiveStatementId(data.statementId);

      // Normalize queue items
      const rawQueue = data.queueItems || [];
      const normalized: ReconciliationItem[] = rawQueue.map((q: any) => ({
        id: q.id,
        date: q.date,
        description: q.description,
        amount: q.amount,
        category: q.category || 'Other',
        type: q.type || 'expense',
        matchConfidence: q.matchConfidence ?? 0.5,
        isDuplicate: Boolean(q.isDuplicate),
        matchedExistingTransactionId: q.matchedExistingTransactionId,
        matchedExistingTransaction: q.matchedExistingTransaction || null,
        resolution: q.resolution || 'pending',
      }));

      setQueueItems(normalized);
      setIsCommitted(false);

      setTimeout(() => {
        setParseProgress((prev) => ({ ...prev, isOpen: false }));
        setParsing(false);
        toast.success(
          `Extracted ${normalized.length} transactions across ${data.pageCount || 1} pages!`
        );
      }, 600);
    } catch (err: any) {
      setParseProgress((prev) => ({ ...prev, isOpen: false }));
      setParsing(false);
      toast.error(err.message || 'Failed to parse statement. Please check file format.');
    }
  };

  /* ── Resolution Updater ── */
  const handleSetResolution = async (itemId: number | string, resolution: ResolutionAction) => {
    setQueueItems((prev) =>
      prev.map((item) => (String(item.id) === String(itemId) ? { ...item, resolution } : item))
    );

    try {
      await fetch('/api/bank-import/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewItemId: itemId, resolution }),
      });
    } catch (err) {
      console.warn('Resolution auto-sync deferred to batch commit:', err);
    }
  };

  /* ── Bulk Auto-Select High-Confidence Matches ── */
  const handleBulkMergeHighConfidence = () => {
    let count = 0;
    setQueueItems((prev) =>
      prev.map((item) => {
        if (item.matchConfidence >= 0.92 && item.matchedExistingTransactionId) {
          count++;
          return { ...item, resolution: 'merged' };
        }
        return item;
      })
    );
    toast.success(`Set ${count} high-confidence entries (≥92%) to Merge`);
  };

  /* ── Atomic Batch Commit ── */
  const handleCommitBatch = async () => {
    if (queueItems.length === 0 || !activeStatementId) return;

    setCommitting(true);
    const commitBatchId = crypto.randomUUID();

    try {
      const payload = {
        statementId: activeStatementId,
        commitBatchId,
        items: queueItems.map((item) => ({
          id: item.id,
          resolution: item.resolution,
          date: item.date,
          description: item.description,
          amount: item.amount,
          category: item.category,
          type: item.type,
          matchedExistingTransactionId: item.matchedExistingTransactionId,
        })),
      };

      const res = await fetch('/api/bank-import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.details || 'Atomic commit failed');
      }

      const data = await res.json();
      setIsCommitted(true);

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 75,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00D4B2', '#F59E0B', '#3B82F6'],
        });
      } catch {}

      toast.success(
        `Successfully committed ${data.rowsCommitted || queueItems.length} reconciled changes!`
      );
    } catch (err: any) {
      toast.error(`Commit failed and was rolled back: ${err.message}`);
    } finally {
      setCommitting(false);
    }
  };

  /* ── Computed Counts ── */
  const mergeCount = queueItems.filter((x) => x.resolution === 'merged').length;
  const createCount = queueItems.filter((x) => x.resolution === 'kept_both').length;
  const skipCount = queueItems.filter((x) => x.resolution === 'discarded').length;
  const highConfidenceCount = queueItems.filter((x) => x.matchConfidence >= 0.92).length;

  return (
    <div className="p-4 lg:p-8 max-w-[1280px] mx-auto page-enter pb-32">
      <Toaster position="top-center" richColors />

      {/* ── Multi-Page Parse Progress Modal ── */}
      <MultiPageParseProgressModal
        isOpen={parseProgress.isOpen}
        fileName={file?.name || 'statement.pdf'}
        pageCount={parseProgress.pageCount}
        pagesParsed={parseProgress.pagesParsed}
        percentage={parseProgress.percentage}
        status={parseProgress.status}
        onDismiss={() => setParseProgress((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* ── Side-by-Side Review Sheet ── */}
      <StatementReconciliationReviewSheet
        isOpen={Boolean(selectedSheetItem)}
        item={selectedSheetItem}
        currencySymbol={currencySymbol}
        onClose={() => setSelectedSheetItem(null)}
        onSelectResolution={handleSetResolution}
      />

      {/* ── Page Header ── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span
              className="material-symbols-outlined text-primary text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              account_balance_wallet
            </span>
            AI Bank Statement Parser & Reconciliation
          </h1>
          <p className="text-gray-500 dark:text-text-muted text-sm mt-1">
            Multi-page PDF extraction, institutional duplicate scoring, and atomic ledger reconciliation.
          </p>
        </div>

        {queueItems.length > 0 && !isCommitted && (
          <button
            onClick={() => {
              setQueueItems([]);
              setActiveStatementId(null);
              setFile(null);
            }}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all self-start sm:self-auto"
          >
            Start New Import
          </button>
        )}
      </div>

      {/* ── Upload Panel (Shown when queue is empty or after reset) ── */}
      {queueItems.length === 0 && (
        <form
          onSubmit={handleUpload}
          className="glass-panel p-8 lg:p-12 text-center border-2 border-dashed border-gray-200 dark:border-white/10 mb-8 rounded-3xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">picture_as_pdf</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Upload Multi-Page Bank or Card Statement
          </h2>
          <p className="text-xs text-gray-400 mb-6 max-w-md mx-auto">
            Supports PDF statements up to 25 MB and 200 pages. Gemini AI parses each page, merges cross-page line items, and detects duplicates.
          </p>

          <div className="max-w-xs mx-auto mb-5 text-left">
            <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
              Bank / Institution Name
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="e.g. Chase, Bank of America, HSBC"
            />
          </div>

          <div className="max-w-xs mx-auto mb-5 text-left flex items-center gap-2">
            <input
              type="checkbox"
              id="retain-file"
              checked={retainFile}
              onChange={(e) => setRetainFile(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="retain-file" className="text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
              Opt-in: Retain document in Vault (ephemeral by default)
            </label>
          </div>

          <input
            type="file"
            id="statement-input"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />

          <input
            type="file"
            id="statement-camera"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />

          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            <label
              htmlFor="statement-input"
              className="px-6 py-3.5 rounded-xl bg-gray-100 dark:bg-surface-dark text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 dark:hover:bg-white/10 cursor-pointer inline-flex items-center gap-2 transition-all min-h-[44px]"
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              {file ? file.name : 'Choose PDF / File'}
            </label>

            <label
              htmlFor="statement-camera"
              className="px-5 py-3.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-bold text-sm cursor-pointer inline-flex items-center gap-2 transition-all min-h-[44px]"
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              <span>Camera</span>
            </label>
          </div>

          {file && (
            <div>
              <button
                type="submit"
                disabled={parsing}
                className="px-8 py-3.5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center gap-2 mx-auto min-h-[44px]"
              >
                {parsing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing Statement...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">auto_awesome</span>
                    Parse & Reconcile
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      )}

      {/* ── Reconciled Celebration Banner (Post-Commit) ── */}
      {isCommitted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-8 text-center rounded-3xl mb-8 border border-emerald-500/20 bg-emerald-500/5 space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              task_alt
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Statement Successfully Reconciled & Committed
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 max-w-md mx-auto">
            All changes were verified and atomically written to your account ledger. Your net worth and balance charts have been updated.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setQueueItems([]);
                setActiveStatementId(null);
                setFile(null);
                setIsCommitted(false);
              }}
              className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-sm hover:bg-primary-hover transition-all min-h-[44px]"
            >
              Import Another Statement
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Active Reconciliation Queue Table & Controls ── */}
      {queueItems.length > 0 && !isCommitted && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-accent-amber" style={{ fontVariationSettings: "'FILL' 1" }}>
                compare_arrows
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Reconciliation Queue ({queueItems.length} transactions)
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {/* Dual View Toggle: Cards vs Table */}
              <div className="inline-flex rounded-xl bg-gray-100 dark:bg-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-surface-dark-2 text-primary shadow-sm'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">view_carousel</span>
                  <span>Card Queue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-surface-dark-2 text-primary shadow-sm'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">table_rows</span>
                  <span>List View</span>
                </button>
              </div>

              {highConfidenceCount > 0 && (
                <button
                  onClick={handleBulkMergeHighConfidence}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
                  Auto-select {highConfidenceCount} Duplicate{highConfidenceCount !== 1 ? 's' : ''} (≥92%)
                </button>
              )}
            </div>
          </div>

          {viewMode === 'cards' ? (
            <BankReconciliationCardQueue
              items={queueItems as any}
              batchId={activeStatementId}
              onResolve={handleSetResolution}
              onCommit={handleCommitBatch}
              committing={committing}
            />
          ) : (
            /* Queue Rows */
            <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {queueItems.map((item) => {
                const confidencePct = Math.round(item.matchConfidence * 100);
                const isHigh = item.matchConfidence >= 0.92;
                const isMed = item.matchConfidence >= 0.7 && item.matchConfidence < 0.92;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className={`glass-panel p-4 sm:p-5 rounded-2xl border transition-all ${
                      item.resolution === 'merged'
                        ? 'border-amber-500/30 bg-amber-500/[0.02]'
                        : item.resolution === 'kept_both'
                        ? 'border-primary/30 bg-primary/[0.02]'
                        : 'border-gray-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left info */}
                      <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                        {/* Confidence score badge */}
                        <div
                          className={`w-13 h-13 rounded-xl shrink-0 flex flex-col items-center justify-center ${
                            isHigh
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : isMed
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          <span className="text-base font-black leading-none">{confidencePct}%</span>
                          <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">
                            Match
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {item.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-slate-400">
                            <span>{item.date}</span>
                            <span>•</span>
                            <span>{item.category}</span>
                            {item.matchedExistingTransaction && (
                              <>
                                <span>•</span>
                                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">link</span>
                                  Matches TX #{item.matchedExistingTransaction.id} (
                                  {currencySymbol}
                                  {item.matchedExistingTransaction.amount.toFixed(2)})
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-base font-black text-gray-900 dark:text-white block">
                            {currencySymbol}
                            {item.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100 dark:border-slate-800">
                        {/* Compare side-by-side button */}
                        <button
                          type="button"
                          onClick={() => setSelectedSheetItem(item)}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px]">compare</span>
                          <span>Compare</span>
                        </button>

                        {/* 3-way Segmented Buttons */}
                        <div className="inline-flex rounded-xl bg-gray-100 dark:bg-slate-800/80 p-1 border border-gray-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => handleSetResolution(item.id, 'merged')}
                            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                              item.resolution === 'merged'
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">merge</span>
                            <span>Merge</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetResolution(item.id, 'kept_both')}
                            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                              item.resolution === 'kept_both'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">add</span>
                            <span>Create</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetResolution(item.id, 'discarded')}
                            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                              item.resolution === 'discarded'
                                ? 'bg-rose-500 text-white shadow-sm'
                                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                            <span>Skip</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          )}
        </div>
      )}

      {/* ── Sticky Bottom Bar (Only in table mode, since card mode has its own) ── */}
      {queueItems.length > 0 && !isCommitted && viewMode === 'table' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-gray-200 dark:border-slate-800 shadow-2xl p-4 sm:px-8 transition-all safe-bottom">
          <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Running counts summary */}
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="text-gray-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                Reconciliation Plan:
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Merge: {mergeCount}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary">
                Create: {createCount}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-500">
                Skip: {skipCount}
              </span>
            </div>

            {/* Primary Action Button (Standard 56px action height, >=44px touch targets) */}
            <button
              onClick={handleCommitBatch}
              disabled={committing || queueItems.length === 0}
              className="w-full sm:w-auto min-h-[56px] px-8 rounded-2xl bg-primary text-white text-sm font-extrabold shadow-lg shadow-primary/25 hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {committing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Atomically Committing...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">done_all</span>
                  Commit {queueItems.length} Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
