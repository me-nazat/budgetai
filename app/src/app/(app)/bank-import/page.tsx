'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';

interface ReviewTx {
  tempId: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'expense' | 'earning';
  approved: boolean;
}

export default function BankImportPage() {
  const { fmtRaw } = useCurrency();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<ReviewTx[]>([]);
  const [committing, setCommitting] = useState(false);

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
      const items: ReviewTx[] = (data.transactions || []).map((t: any) => ({
        ...t,
        approved: true,
      }));

      setReviewQueue(items);
      toast.success(`Parsed ${items.length} transactions from statement!`);
    } catch {
      toast.error('Failed to parse statement. Please check file format.');
    } finally {
      setParsing(false);
    }
  };

  const handleCommit = async () => {
    const approved = reviewQueue.filter(t => t.approved);
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
      toast.success(d.message);
      setReviewQueue([]);
      setFile(null);
    } catch {
      toast.error('Commit failed. Try again.');
    } finally {
      setCommitting(false);
    }
  };

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
      {reviewQueue.length === 0 ? (
        <form onSubmit={handleUpload} className="glass-panel p-8 lg:p-12 text-center border-2 border-dashed border-gray-200 dark:border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">upload_file</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Upload Bank Statement</h2>
          <p className="text-xs text-gray-400 mb-6 max-w-sm mx-auto">Supports PDF, PNG, JPG bank or credit card statements</p>

          <input
            type="file"
            id="statement-input"
            accept="image/*,.pdf"
            onChange={e => setFile(e.target.files?.[0] || null)}
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
      ) : (
        /* ── Review Queue ── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Review Queue ({reviewQueue.length})</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setReviewQueue([])}
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
            {reviewQueue.map(item => (
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
                    onChange={e => {
                      const checked = e.target.checked;
                      setReviewQueue(prev => prev.map(x => x.tempId === item.tempId ? { ...x, approved: checked } : x));
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
    </div>
  );
}
