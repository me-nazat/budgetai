'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface Transaction {
  id: number;
  type: 'expense' | 'earning';
  amount: number;
  category: string;
  description: string;
  date: string;
  taxRelevant?: number;
  taxCategory?: string;
}

interface TaxSummary {
  totalDeductible: number;
  byCategory: Record<string, number>;
  taggedCount: number;
  totalTransactions: number;
}

const TAX_CATEGORIES = ['Business', 'Medical', 'Charity', 'Education', 'Home Office', 'Other'] as const;
type TaxCategory = typeof TAX_CATEGORIES[number];

/* ═══════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════ */

function TaxSkeleton() {
  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
      <div className="mb-8 space-y-3">
        <div className="h-5 w-56 rounded-full shimmer-skeleton" />
        <div className="h-3 w-72 max-w-full rounded-full shimmer-skeleton" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[0, 1, 2].map(i => <div key={i} className="skeleton-panel h-28" />)}
      </div>
      <div className="skeleton-panel h-[500px]" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function TaxCenterPage() {
  const { fmtRaw } = useCurrency();
  const [activeFilter, setActiveFilter] = useState<'all' | 'tagged' | 'untagged'>('all');
  const [selectedTaxCat, setSelectedTaxCat] = useState<TaxCategory | 'All'>('All');
  const [showExportModal, setShowExportModal] = useState(false);
  const [taggingId, setTaggingId] = useState<number | null>(null);

  // Fetch all transactions for the current fiscal year
  const now = new Date();
  const fiscalStart = `${now.getFullYear()}-01-01`;
  const fiscalEnd = `${now.getFullYear()}-12-31`;
  const { data, isLoading } = useSWR<{ transactions: Transaction[] }>(
    `/api/transactions?start=${fiscalStart}&end=${fiscalEnd}&limit=2000`
  );

  const transactions = data?.transactions || [];

  const filtered = useMemo(() => {
    let list = transactions;
    if (activeFilter === 'tagged') list = list.filter(t => t.taxRelevant === 1);
    if (activeFilter === 'untagged') list = list.filter(t => !t.taxRelevant);
    if (selectedTaxCat !== 'All') list = list.filter(t => t.taxCategory === selectedTaxCat);
    return list;
  }, [transactions, activeFilter, selectedTaxCat]);

  const summary: TaxSummary = useMemo(() => {
    const tagged = transactions.filter(t => t.taxRelevant === 1);
    const byCategory: Record<string, number> = {};
    tagged.forEach(t => {
      const cat = t.taxCategory || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + t.amount;
    });
    return {
      totalDeductible: tagged.reduce((sum, t) => sum + t.amount, 0),
      byCategory,
      taggedCount: tagged.length,
      totalTransactions: transactions.length,
    };
  }, [transactions]);

  const handleTagToggle = async (id: number, currentlyTagged: boolean, taxCat?: TaxCategory) => {
    try {
      await fetch('/api/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: id,
          taxRelevant: currentlyTagged ? 0 : 1,
          taxCategory: taxCat || 'Other',
        }),
      });
      await mutate((key: string) => typeof key === 'string' && key.startsWith('/api/transactions'), undefined, { revalidate: true });
      toast.success(currentlyTagged ? 'Unmarked as tax-relevant' : 'Marked as tax-relevant');
    } catch {
      toast.error('Failed to update');
    }
    setTaggingId(null);
  };

  if (isLoading) return <TaxSkeleton />;

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
      <Toaster position="top-center" richColors />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>receipt</span>
            Tax Center
          </h1>
          <p className="text-gray-500 dark:text-text-muted text-sm mt-1">
            Tag deductible expenses and export for filing · {now.getFullYear()} Fiscal Year
          </p>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-hover transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="glass-panel p-4 lg:p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent-emerald/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-accent-emerald text-xl">savings</span>
            </div>
            <span className="text-xs font-bold text-gray-500 dark:text-text-muted uppercase tracking-wider">Total Deductible</span>
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{fmtRaw(summary.totalDeductible)}</p>
        </div>
        <div className="glass-panel p-4 lg:p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">label</span>
            </div>
            <span className="text-xs font-bold text-gray-500 dark:text-text-muted uppercase tracking-wider">Tagged</span>
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white">
            {summary.taggedCount}<span className="text-sm font-medium text-gray-400 ml-1">/ {summary.totalTransactions}</span>
          </p>
        </div>
        <div className="glass-panel p-4 lg:p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-accent-amber text-xl">category</span>
            </div>
            <span className="text-xs font-bold text-gray-500 dark:text-text-muted uppercase tracking-wider">Categories</span>
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{Object.keys(summary.byCategory).length}</p>
        </div>
      </div>

      {/* ── Category Breakdown ── */}
      {Object.keys(summary.byCategory).length > 0 && (
        <div className="glass-panel p-4 lg:p-5 mb-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Deductions by Category</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.byCategory).sort(([, a], [, b]) => b - a).map(([cat, amount]) => (
              <div key={cat} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-surface-dark border border-gray-200/50 dark:border-white/5">
                <p className="text-xs font-bold text-gray-600 dark:text-gray-400">{cat}</p>
                <p className="text-sm font-black text-gray-900 dark:text-white">{fmtRaw(amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filter Chips ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'tagged', 'untagged'] as const).map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold capitalize transition-all ${
              activeFilter === f
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-gray-100 dark:bg-surface-dark text-gray-600 dark:text-gray-400 border border-transparent hover:bg-gray-200 dark:hover:bg-surface-hover'
            }`}
          >
            {f} {f === 'tagged' ? `(${summary.taggedCount})` : f === 'untagged' ? `(${summary.totalTransactions - summary.taggedCount})` : ''}
          </button>
        ))}
        <div className="w-px bg-gray-200 dark:bg-white/10 mx-1" />
        {['All', ...TAX_CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedTaxCat(cat as TaxCategory | 'All')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
              selectedTaxCat === cat
                ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20'
                : 'bg-gray-100 dark:bg-surface-dark text-gray-600 dark:text-gray-400 border border-transparent hover:bg-gray-200 dark:hover:bg-surface-hover'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Transaction List ── */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3 block">receipt_long</span>
            <p className="text-gray-400 text-sm">No transactions match your filters.</p>
          </div>
        ) : (
          filtered.map(tx => (
            <div
              key={tx.id}
              className={`glass-panel p-3 lg:p-4 flex items-center gap-3 group transition-all hover:-translate-y-0.5 ${
                tx.taxRelevant === 1 ? 'border-l-[3px] border-l-accent-emerald' : ''
              }`}
            >
              {/* Tax badge */}
              <button
                onClick={() => {
                  if (tx.taxRelevant === 1) {
                    handleTagToggle(tx.id, true);
                  } else {
                    setTaggingId(taggingId === tx.id ? null : tx.id);
                  }
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                  tx.taxRelevant === 1
                    ? 'bg-accent-emerald/10 text-accent-emerald'
                    : 'bg-gray-100 dark:bg-surface-dark text-gray-400 hover:bg-primary/10 hover:text-primary'
                }`}
                title={tx.taxRelevant === 1 ? 'Click to untag' : 'Click to tag as tax-relevant'}
              >
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: tx.taxRelevant === 1 ? "'FILL' 1" : "'FILL' 0" }}>
                  {tx.taxRelevant === 1 ? 'check_circle' : 'add_circle'}
                </span>
              </button>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{tx.description || tx.category}</p>
                <p className="text-xs text-gray-500 dark:text-text-muted">
                  {tx.category} · {new Date(tx.date).toLocaleDateString()}
                  {tx.taxCategory && <span className="ml-2 px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber text-[10px] font-bold">{tx.taxCategory}</span>}
                </p>
              </div>

              {/* Amount */}
              <div className="text-right shrink-0">
                <p className={`text-sm font-black ${tx.type === 'earning' ? 'text-accent-emerald' : 'text-gray-900 dark:text-white'}`}>
                  {tx.type === 'earning' ? '+' : '-'}{fmtRaw(tx.amount)}
                </p>
              </div>

              {/* Inline tax category picker */}
              <AnimatePresence>
                {taggingId === tx.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-surface-dark-2 rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 p-2 min-w-[160px]"
                    onClick={e => e.stopPropagation()}
                  >
                    <p className="text-xs font-bold text-gray-500 px-2 py-1">Tax Category</p>
                    {TAX_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => handleTagToggle(tx.id, false, cat)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors"
                      >
                        {cat}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      {/* ── Disclaimer ── */}
      <div className="mt-6 glass-panel p-4 border-l-[3px] border-l-accent-amber">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-accent-amber text-lg shrink-0">warning</span>
          <p className="text-xs text-gray-500 dark:text-text-muted leading-relaxed">
            <strong className="text-gray-700 dark:text-gray-300">Disclaimer:</strong> This tool helps organize your expense data for filing. It is not tax advice. Consult a qualified tax professional for tax planning and filing.
          </p>
        </div>
      </div>

      {/* ── Export Modal ── */}
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} summary={summary} year={now.getFullYear()} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT MODAL
   ═══════════════════════════════════════════════════════════════ */

function ExportModal({ isOpen, onClose, summary, year }: { isOpen: boolean; onClose: () => void; summary: TaxSummary; year: number }) {
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [exporting, setExporting] = useState(false);
  const { fmtRaw } = useCurrency();

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/tax/export?format=${format}&year=${year}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-report-${year}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded!');
      onClose();
    } catch {
      toast.error('Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:flex lg:items-center lg:justify-center" onClick={onClose}>
      <div
        className="fixed bottom-0 left-0 right-0 lg:static lg:w-full lg:max-w-md rounded-t-[2rem] lg:rounded-2xl bg-white dark:bg-surface-dark-2 p-6 shadow-2xl z-50"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-4 lg:hidden" />

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Export Tax Report</h2>
        <p className="text-sm text-gray-500 dark:text-text-muted mb-4">
          {summary.taggedCount} tagged transactions · {fmtRaw(summary.totalDeductible)} total deductions
        </p>

        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setFormat('pdf')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              format === 'pdf' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-gray-50 dark:bg-surface-dark text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            PDF
          </button>
          <button
            onClick={() => setFormat('excel')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              format === 'excel' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-gray-50 dark:bg-surface-dark text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            Excel
          </button>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold transition-colors hover:bg-gray-50 dark:hover:bg-surface-hover">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || summary.taggedCount === 0}
            className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-sm hover:bg-primary-hover transition-all disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
