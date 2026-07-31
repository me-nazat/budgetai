'use client';

/**
 * @fileoverview AI Bank Statement Importer with full duplicate-reconciliation queue.
 *
 * The review queue surfaces matchConfidence, possibleMatchTransactionId,
 * and all three resolution states (kept_both, merged, discarded) from the
 * bankImportReviewQueue schema — previously only a flat approve/reject
 * checkbox list was rendered, ignoring the backend's 3-way resolution model.
 *
 * @module app/(app)/bank-import/page
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';

/* ── Types ── */

interface ParsedRowData {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'expense' | 'earning';
}

interface MatchedTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: string;
}

interface ReviewItem {
  id: number;
  importBatchId: number | null;
  parsedRowData: string;
  possibleMatchTransactionId: number | null;
  matchConfidence: number;
  resolution: 'pending' | 'kept_both' | 'merged' | 'discarded';
  resolvedAt: string | null;
  createdAt: string;
}

interface ParsedReviewTx {
  tempId: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'expense' | 'earning';
  approved: boolean;
}

type ResolutionAction = 'kept_both' | 'merged' | 'discarded';

/* ── Constants ── */

const AUTO_RESOLVE_THRESHOLD = 0.95;

const RESOLUTION_CONFIG: Record<ResolutionAction, { label: string; icon: string; color: string; desc: string }> = {
  kept_both: {
    label: 'Keep Both',
    icon: 'library_add',
    color: 'text-primary',
    desc: 'Import as a new transaction alongside the existing one',
  },
  merged: {
    label: 'Merge (Duplicate)',
    icon: 'merge',
    color: 'text-accent-amber',
    desc: 'This is a duplicate — skip import, keep existing',
  },
  discarded: {
    label: 'Discard',
    icon: 'delete',
    color: 'text-rose-500',
    desc: 'Discard this imported row entirely',
  },
};

export default function BankImportPage() {
  const { fmtRaw } = useCurrency();

  /* ── Upload state ── */
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseQueue, setParseQueue] = useState<ParsedReviewTx[]>([]);
  const [committing, setCommitting] = useState(false);

  /* ── Review queue state ── */
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [matchedTxns, setMatchedTxns] = useState<Record<number, MatchedTransaction>>({});
  const [loadingReview, setLoadingReview] = useState(true);
  const [resolvingIds, setResolvingIds] = useState<Set<number>>(new Set());
  const [bulkResolving, setBulkResolving] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  /* ── Fetch pending review items ── */
  const fetchReviewQueue = useCallback(async () => {
    setLoadingReview(true);
    try {
      const res = await fetch('/api/bank-import/review');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const items: ReviewItem[] = data.items || [];
      setReviewItems(items);

      // Fetch matched transactions for items that have a possibleMatchTransactionId
      const matchIds = items
        .map((item) => item.possibleMatchTransactionId)
        .filter((id): id is number => id !== null && id > 0);

      if (matchIds.length > 0) {
        const uniqueIds = [...new Set(matchIds)];
        const txnMap: Record<number, MatchedTransaction> = {};
        for (const txId of uniqueIds) {
          try {
            const txRes = await fetch(`/api/transactions/${txId}`);
            if (txRes.ok) {
              const txData = await txRes.json();
              if (txData.transaction) txnMap[txId] = txData.transaction;
              else if (txData.id) txnMap[txId] = txData;
            }
          } catch {
            /* Non-critical: matched txn might have been deleted */
          }
        }
        setMatchedTxns(txnMap);
      }
    } catch {
      toast.error('Failed to load review queue');
    } finally {
      setLoadingReview(false);
    }
  }, []);

  useEffect(() => {
    fetchReviewQueue();
  }, [fetchReviewQueue]);

  /* ── Parse upload ── */
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setParsing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/bank-import/parse', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Parsing failed');

      const data = await res.json();
      const items: ParsedReviewTx[] = (data.transactions || []).map((t: any, i: number) => ({
        ...t,
        tempId: i,
        approved: true,
      }));

      setParseQueue(items);
      toast.success(`Parsed ${items.length} transactions from statement!`);
    } catch {
      toast.error('Failed to parse statement. Please check file format.');
    } finally {
      setParsing(false);
    }
  };

  /* ── Commit parsed transactions ── */
  const handleCommit = async () => {
    const approved = parseQueue.filter((t) => t.approved);
    if (approved.length === 0) return;

    setCommitting(true);
    try {
      const res = await fetch('/api/bank-import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: approved.map(({ date, description, amount, category, type }) => ({
            date, description, amount, category, type,
          })),
        }),
      });

      const d = await res.json();
      toast.success(d.message || `Imported ${approved.length} transactions`);
      setParseQueue([]);
      setFile(null);
      // Refresh review queue in case new items were added
      fetchReviewQueue();
    } catch {
      toast.error('Commit failed. Try again.');
    } finally {
      setCommitting(false);
    }
  };

  /* ── Resolve single review item ── */
  const resolveItem = async (reviewItemId: number, resolution: ResolutionAction) => {
    setResolvingIds((prev) => new Set(prev).add(reviewItemId));
    try {
      const res = await fetch('/api/bank-import/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewItemId, resolution }),
      });

      if (!res.ok) throw new Error('Resolution failed');

      setReviewItems((prev) => prev.filter((item) => item.id !== reviewItemId));
      toast.success(`Resolved as "${RESOLUTION_CONFIG[resolution].label}"`);
    } catch {
      toast.error('Failed to resolve item');
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(reviewItemId);
        return next;
      });
    }
  };

  /* ── Bulk auto-resolve high-confidence matches ── */
  const handleBulkAutoResolve = async () => {
    const highConfidenceItems = reviewItems.filter(
      (item) => item.matchConfidence >= AUTO_RESOLVE_THRESHOLD && item.possibleMatchTransactionId
    );

    if (highConfidenceItems.length === 0) {
      toast.info('No high-confidence matches to auto-resolve');
      return;
    }

    setBulkResolving(true);
    try {
      const res = await fetch('/api/bank-import/review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: AUTO_RESOLVE_THRESHOLD }),
      });

      if (!res.ok) throw new Error('Bulk resolve failed');

      const data = await res.json();
      toast.success(`Auto-resolved ${data.resolvedCount || highConfidenceItems.length} duplicates`);
      fetchReviewQueue();
    } catch {
      toast.error('Bulk auto-resolve failed');
    } finally {
      setBulkResolving(false);
    }
  };

  /* ── Helpers ── */
  const parseParsedRowData = (raw: string): ParsedRowData | null => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const formatConfidence = (score: number): string => `${Math.round(score * 100)}%`;

  const getConfidenceColor = (score: number): string => {
    if (score >= 0.9) return 'text-accent-emerald';
    if (score >= 0.7) return 'text-accent-amber';
    return 'text-rose-500';
  };

  const highConfidenceCount = reviewItems.filter(
    (item) => item.matchConfidence >= AUTO_RESOLVE_THRESHOLD && item.possibleMatchTransactionId
  ).length;

  /* ── Render ── */
  return (
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
      <Toaster position="top-center" richColors />

      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>upload_file</span>
          AI Bank Statement Importer
        </h1>
        <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Upload PDF or screenshot statements to extract and batch-import transactions</p>
      </div>

      {/* ── Upload Box ── */}
      {parseQueue.length === 0 && (
        <form onSubmit={handleUpload} className="glass-panel p-8 lg:p-12 text-center border-2 border-dashed border-gray-200 dark:border-white/10 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">upload_file</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Upload Bank Statement</h2>
          <p className="text-xs text-gray-400 mb-6 max-w-sm mx-auto">Supports PDF, PNG, JPG bank or credit card statements</p>

          <input
            type="file"
            id="statement-input"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />

          <label
            htmlFor="statement-input"
            className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-surface-dark text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 cursor-pointer inline-block mb-4"
          >
            {file ? file.name : 'Choose File'}
          </label>

          {file && (
            <div>
              <button
                type="submit"
                disabled={parsing}
                className="px-8 py-3 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-hover transition-all disabled:opacity-50"
              >
                {parsing ? 'Parsing with AI...' : 'Parse Statement'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* ── Parse Review (pre-commit, same as before) ── */}
      {parseQueue.length > 0 && (
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Parsed Transactions ({parseQueue.length})</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setParseQueue([])}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-gray-400"
              >
                Discard
              </button>
              <button
                onClick={handleCommit}
                disabled={committing}
                className="px-6 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-sm hover:bg-primary-hover transition-all"
              >
                {committing ? 'Importing...' : 'Approve & Import'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {parseQueue.map((item) => (
              <div
                key={item.tempId}
                className={`glass-panel p-4 flex items-center justify-between gap-4 border-l-4 ${
                  item.approved ? 'border-l-accent-emerald' : 'border-l-gray-300 opacity-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.approved}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setParseQueue((prev) => prev.map((x) => (x.tempId === item.tempId ? { ...x, approved: checked } : x)));
                    }}
                    className="w-5 h-5 rounded text-primary"
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{item.description}</p>
                    <p className="text-xs text-gray-400">{item.category} · {item.date}</p>
                  </div>
                </div>
                <span className="text-sm font-black text-gray-900 dark:text-white">{fmtRaw(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Duplicate-Reconciliation Review Queue ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-accent-amber" style={{ fontVariationSettings: "'FILL' 1" }}>compare_arrows</span>
            Reconciliation Queue
            {reviewItems.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber text-xs font-black">
                {reviewItems.length}
              </span>
            )}
          </h2>

          {highConfidenceCount > 0 && (
            <button
              onClick={handleBulkAutoResolve}
              disabled={bulkResolving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-emerald/10 text-accent-emerald text-xs font-bold hover:bg-accent-emerald/20 transition-all disabled:opacity-50"
            >
              {bulkResolving ? (
                <><div className="w-3.5 h-3.5 border-2 border-accent-emerald border-t-transparent rounded-full animate-spin" /> Resolving...</>
              ) : (
                <><span className="material-symbols-outlined text-[16px]">auto_fix_high</span> Auto-resolve {highConfidenceCount} high-confidence match{highConfidenceCount !== 1 ? 'es' : ''} (≥95%)</>
              )}
            </button>
          )}
        </div>

        {loadingReview ? (
          <div className="glass-panel p-12 text-center">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">Loading review queue...</p>
          </div>
        ) : reviewItems.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-accent-emerald mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">All clear!</p>
            <p className="text-xs text-gray-400">No pending items in the reconciliation queue.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {reviewItems.map((item) => {
                const parsed = parseParsedRowData(item.parsedRowData);
                const matchedTxn = item.possibleMatchTransactionId ? matchedTxns[item.possibleMatchTransactionId] : null;
                const isExpanded = expandedItemId === item.id;
                const isResolving = resolvingIds.has(item.id);

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                    className="glass-panel rounded-2xl overflow-hidden"
                  >
                    {/* ── Row header ── */}
                    <button
                      onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      className="w-full p-4 flex items-center gap-4 text-left hover:bg-white/5 transition-colors"
                    >
                      {/* Confidence badge */}
                      <div className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${
                        item.matchConfidence >= 0.9 ? 'bg-accent-emerald/10' :
                        item.matchConfidence >= 0.7 ? 'bg-accent-amber/10' : 'bg-rose-500/10'
                      }`}>
                        <span className={`text-lg font-black ${getConfidenceColor(item.matchConfidence)}`}>
                          {formatConfidence(item.matchConfidence)}
                        </span>
                        <span className="text-[9px] text-gray-400 font-bold uppercase">Match</span>
                      </div>

                      {/* Imported row info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {parsed?.description || 'Unknown Transaction'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {parsed?.category || 'Other'} · {parsed?.date || 'No date'}
                          {matchedTxn && <span className="text-accent-amber"> · Possible duplicate</span>}
                        </p>
                      </div>

                      {/* Amount */}
                      <span className="text-sm font-black text-gray-900 dark:text-white shrink-0">
                        {fmtRaw(parsed?.amount || 0)}
                      </span>

                      {/* Expand indicator */}
                      <span className={`material-symbols-outlined text-gray-400 text-[18px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </button>

                    {/* ── Expanded detail ── */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-4">
                            {/* Side-by-side comparison (stacked on mobile) */}
                            {matchedTxn && (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {/* Imported row */}
                                <div className="rounded-xl bg-primary/5 border border-primary/10 p-3">
                                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Imported Row</p>
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Description</span>
                                      <span className="text-gray-900 dark:text-white font-semibold">{parsed?.description}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Amount</span>
                                      <span className="text-gray-900 dark:text-white font-semibold">{fmtRaw(parsed?.amount || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Date</span>
                                      <span className="text-gray-900 dark:text-white font-semibold">{parsed?.date}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Category</span>
                                      <span className="text-gray-900 dark:text-white font-semibold">{parsed?.category}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Existing match */}
                                <div className="rounded-xl bg-accent-amber/5 border border-accent-amber/10 p-3">
                                  <p className="text-[10px] font-bold text-accent-amber uppercase tracking-wider mb-2">Existing Transaction</p>
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Description</span>
                                      <span className="text-gray-900 dark:text-white font-semibold">{matchedTxn.description}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Amount</span>
                                      <span className="text-gray-900 dark:text-white font-semibold">{fmtRaw(matchedTxn.amount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Date</span>
                                      <span className="text-gray-900 dark:text-white font-semibold">{matchedTxn.date}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Category</span>
                                      <span className="text-gray-900 dark:text-white font-semibold">{matchedTxn.category}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Resolution actions */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {(Object.keys(RESOLUTION_CONFIG) as ResolutionAction[]).map((action) => {
                                const config = RESOLUTION_CONFIG[action];
                                return (
                                  <button
                                    key={action}
                                    onClick={() => resolveItem(item.id, action)}
                                    disabled={isResolving}
                                    className={`flex items-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-white/5 transition-all disabled:opacity-50 text-left`}
                                  >
                                    <span className={`material-symbols-outlined text-[18px] ${config.color}`}>{config.icon}</span>
                                    <div className="min-w-0">
                                      <p className={`text-xs font-bold ${config.color}`}>{config.label}</p>
                                      <p className="text-[10px] text-gray-400 leading-tight">{config.desc}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
