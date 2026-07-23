'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';

interface DocumentItem {
  id: number;
  file_name: string;
  file_type: string;
  drive_file_id: string | null;
  merchant_name: string | null;
  amount: number | null;
  extracted_text: string | null;
  uploaded_at: string;
}

export default function DocumentsPage() {
  const { fmtRaw } = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState<DocumentItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { data, isLoading } = useSWR<{ documents: DocumentItem[] }>(
    `/api/documents${searchQuery && !semanticResults ? `?q=${encodeURIComponent(searchQuery)}` : ''}`
  );

  const handleAISearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSemanticResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      const d = await res.json();
      setSemanticResults(d.results || []);
    } catch {
      setSemanticResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  const docs = semanticResults !== null ? semanticResults : (data?.documents || []);

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>folder_open</span>
            AI Document Vault
          </h1>
          <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Search & manage synced receipts, tax invoices, and warranties</p>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <form onSubmit={handleAISearch} className="mb-6">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              if (!e.target.value) setSemanticResults(null);
            }}
            placeholder="Search by merchant, receipt content, or natural language (e.g. 'Laptop receipt from last month')..."
            className="w-full pl-12 pr-24 py-3.5 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover transition-all"
          >
            {isSearching ? 'Searching...' : 'AI Search'}
          </button>
        </div>
      </form>

      {/* ── Documents Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="glass-panel h-48 animate-pulse" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-3 block">folder_open</span>
          <p className="text-gray-400 font-medium">No documents in your vault yet.</p>
          <p className="text-gray-400 text-xs mt-1">Receipts scanned or uploaded from transactions will automatically show up here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {docs.map(doc => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel p-4 flex flex-col justify-between group hover:-translate-y-1 transition-all"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-xl">description</span>
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{doc.merchant_name || doc.file_name}</h3>
                <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                {doc.extracted_text && (
                  <p className="text-xs text-gray-400 line-clamp-2 mt-2 italic bg-gray-50 dark:bg-surface-dark p-2 rounded-lg">
                    "{doc.extracted_text}"
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-sm font-black text-gray-900 dark:text-white">{doc.amount ? fmtRaw(doc.amount) : ''}</span>
                <button className="text-xs font-bold text-primary hover:underline">View PDF</button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
