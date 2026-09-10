'use client';

/**
 * @fileoverview Module 13: AI Document Vault with Semantic Search & RAG Q&A.
 * Provides chunked semantic vector search, status badges, line-item accordions,
 * and conversational document interrogation.
 *
 * @module app/(app)/documents/page
 */

import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';

interface DocumentItem {
  id: string | number;
  documentId?: string;
  file_name?: string;
  fileName?: string;
  file_type?: string;
  fileType?: string;
  merchant_name?: string | null;
  merchantName?: string | null;
  amount?: number | null;
  totalAmount?: number | null;
  taxAmount?: number | null;
  extracted_text?: string | null;
  uploaded_at?: string;
  documentDate?: string;
  embeddingStatus?: 'PENDING' | 'EMBEDDING' | 'READY' | 'FAILED';
  relevanceScore?: number;
  matchSnippet?: string;
  matchedChunks?: string[];
  lineItems?: Array<{
    description: string;
    quantity?: number | null;
    unitPrice?: number | null;
    totalPrice: number;
  }>;
}

interface AskSource {
  documentId: string;
  fileName: string;
  merchantName: string;
  documentDate: string;
  totalAmount: number;
  snippet: string;
}

export default function DocumentsPage() {
  const { fmtRaw, symbol = '$' } = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState<DocumentItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [expandedLinesDocId, setExpandedLinesDocId] = useState<string | number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ask AI Drawer State
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askSources, setAskSources] = useState<AskSource[]>([]);

  // Debounced search fetcher
  const { data, isLoading } = useSWR<{ documents: DocumentItem[] }>(
    `/api/documents`
  );

  // Keyboard dismiss on mobile scroll
  useEffect(() => {
    const handleScroll = () => {
      if (searchInputRef.current && document.activeElement === searchInputRef.current) {
        searchInputRef.current.blur();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchmove', handleScroll);
    };
  }, []);

  // Debounce semantic search (400ms per Module 13 spec)
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      setSemanticResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch('/api/documents/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery }),
        });
        const d = await res.json();
        if (d.results) {
          setSemanticResults(d.results);
        }
      } catch (err) {
        console.error('Semantic search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const uploadedData = await res.json();
      await mutate('/api/documents');
      toast.success('Document uploaded to vault! Starting embedding...');

      // Background trigger embedding pipeline
      if (uploadedData?.document?.id || uploadedData?.id) {
        const docId = uploadedData?.document?.id || uploadedData?.id;
        fetch('/api/documents/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: String(docId) }),
        }).then(() => mutate('/api/documents'));
      }
    } catch {
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleRetryEmbedding = async (docId: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.info('Retrying vector embedding...');
    try {
      const res = await fetch('/api/documents/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: String(docId) }),
      });
      if (res.ok) {
        toast.success('Vector embedding complete!');
        await mutate('/api/documents');
      } else {
        toast.error('Embedding retry failed');
      }
    } catch {
      toast.error('Embedding retry failed');
    }
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuestion.trim()) return;

    setIsAsking(true);
    setAskAnswer(null);
    setAskSources([]);

    try {
      const res = await fetch('/api/documents/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: askQuestion }),
      });
      const d = await res.json();
      if (d.answer) {
        setAskAnswer(d.answer);
        setAskSources(d.sources || []);
      } else {
        setAskAnswer('Could not generate an answer from your documents.');
      }
    } catch {
      toast.error('Failed to query AI Coach');
      setAskAnswer('An error occurred while analyzing your document vault.');
    } finally {
      setIsAsking(false);
    }
  };

  const docs = semanticResults !== null ? semanticResults : (data?.documents || []);

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter pb-24">
      <Toaster position="top-center" richColors />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              folder_open
            </span>
            AI Document Vault
          </h1>
          <p className="text-gray-500 dark:text-text-muted text-sm mt-1">
            Semantic search & Q&A across receipts, bills, and tax statements
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsAskModalOpen(true)}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-primary text-white text-sm font-bold shadow-md shadow-primary/20 hover:brightness-110 transition-all flex items-center justify-center gap-2 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-lg">psychology</span>
            Ask AI
          </button>

          <label className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]">
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            {uploading ? 'Uploading...' : 'Upload'}
            <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {/* ── Sticky 56px Search Bar ── */}
      <div className="sticky top-2 z-30 mb-6 bg-white/80 dark:bg-surface-dark-2/80 backdrop-blur-xl p-2 rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg shadow-black/5">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-4 text-gray-400 text-xl">search</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Semantic search (e.g., 'Dining in Sylhet last March', 'Hardware repair bill')..."
            className="w-full pl-12 pr-28 py-3.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-primary/40 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            style={{ fontSize: '16px', minHeight: '56px' }}
          />

          <div className="absolute right-3 flex items-center gap-2">
            {isSearching && (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSemanticResults(null);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        </div>

        {semanticResults !== null && (
          <div className="mt-2 px-2 flex items-center justify-between text-xs text-gray-500">
            <span>Showing {semanticResults.length} semantic matches</span>
            <button
              onClick={() => {
                setSearchQuery('');
                setSemanticResults(null);
              }}
              className="text-primary hover:underline"
            >
              Reset to all documents
            </button>
          </div>
        )}
      </div>

      {/* ── Documents Grid / Semantic Results ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="glass-panel h-48 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl">
          <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-3 block">folder_open</span>
          <p className="text-gray-400 font-medium">No documents match your query.</p>
          <p className="text-gray-400 text-xs mt-1">Try natural-language keywords or upload a new statement.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {docs.map((doc) => {
            const docId = doc.documentId || doc.id;
            const title = doc.merchantName || doc.merchant_name || doc.fileName || doc.file_name || 'Document';
            const amount = doc.totalAmount ?? doc.amount;
            const status = doc.embeddingStatus || 'READY';
            const isLinesExpanded = expandedLinesDocId === docId;

            return (
              <motion.div
                key={String(docId)}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel p-5 rounded-2xl flex flex-col justify-between group hover:-translate-y-1 transition-all border border-gray-200 dark:border-white/10 cursor-pointer relative"
                onClick={() => setSelectedDoc(doc)}
              >
                <div>
                  {/* Top Bar: Icon + Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">description</span>
                    </div>

                    {/* Embedding Status Badge */}
                    <div className="flex items-center gap-1.5">
                      {status === 'READY' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          READY
                        </span>
                      )}
                      {status === 'EMBEDDING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                          EMBEDDING
                        </span>
                      )}
                      {status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          PENDING
                        </span>
                      )}
                      {status === 'FAILED' && (
                        <button
                          onClick={(e) => handleRetryEmbedding(docId, e)}
                          title="Retry vector indexing"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 min-h-[28px]"
                        >
                          <span className="material-symbols-outlined text-[12px]">refresh</span>
                          FAILED
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title & Date */}
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{title}</h3>
                  <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                    {doc.documentDate || (doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'Recent')}
                  </p>

                  {/* Semantic Relevance Score */}
                  {doc.relevanceScore !== undefined && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-primary/10 text-primary border border-primary/20">
                      <span>Cosine Match:</span>
                      <strong>{Math.round(doc.relevanceScore * 100)}%</strong>
                    </div>
                  )}

                  {/* Highlighted Match Snippet */}
                  {doc.matchSnippet && (
                    <p className="text-xs text-gray-400 line-clamp-2 mt-2 italic bg-gray-50 dark:bg-surface-dark p-2 rounded-lg font-mono">
                      "{doc.matchSnippet}"
                    </p>
                  )}
                </div>

                {/* Bottom Bar: Amount + Expand Accordion */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-gray-900 dark:text-white">
                      {amount !== null && amount !== undefined ? fmtRaw(amount) : ''}
                    </span>

                    {doc.lineItems && doc.lineItems.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedLinesDocId(isLinesExpanded ? null : docId);
                        }}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 min-h-[36px]"
                      >
                        {isLinesExpanded ? 'Hide lines' : 'Show me the lines'}
                        <span className="material-symbols-outlined text-xs">
                          {isLinesExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Inline Line Items Accordion */}
                  <AnimatePresence>
                    {isLinesExpanded && doc.lineItems && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pt-2 border-t border-gray-100 dark:border-white/5 space-y-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Line Items ({doc.lineItems.length})
                        </span>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                          {doc.lineItems.map((li, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-0.5 border-b border-white/5">
                              <span className="text-gray-300 truncate max-w-[120px]">{li.description}</span>
                              <span className="font-mono text-gray-200">{fmtRaw(li.totalPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Document Details Modal ── */}
      {selectedDoc && (
        <DocumentModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} fmt={fmtRaw} />
      )}

      {/* ── Natural Language Q&A Sheet (Feature 13.2) ── */}
      <AnimatePresence>
        {isAskModalOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center p-0 lg:p-4"
            onClick={() => setIsAskModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full lg:max-w-2xl bg-white dark:bg-surface-dark-2 rounded-t-[2.5rem] lg:rounded-3xl p-6 lg:p-8 shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto"
              style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-4 lg:hidden" />

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-2xl">psychology</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ask AI Vault Assistant</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Ask natural-language questions across your receipts and statements</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAskModalOpen(false)}
                  className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Question Input Form */}
              <form onSubmit={handleAskAI} className="space-y-4 mb-6">
                <div className="relative">
                  <input
                    type="text"
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
                    placeholder="e.g. 'What was my total dining spend in Sylhet last March?'"
                    className="w-full px-4 py-3.5 pr-28 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ fontSize: '16px', minHeight: '52px' }}
                  />
                  <button
                    type="submit"
                    disabled={isAsking || !askQuestion.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover disabled:opacity-50 transition-all min-h-[36px]"
                  >
                    {isAsking ? 'Thinking...' : 'Submit'}
                  </button>
                </div>
              </form>

              {/* Answer Box */}
              {isAsking && (
                <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium text-primary">Searching document vectors & synthesizing answer...</p>
                </div>
              )}

              {askAnswer && !isAsking && (
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 space-y-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      AI Vault Answer
                    </span>
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {askAnswer}
                    </p>
                  </div>

                  {/* Cited Sources */}
                  {askSources.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                        Referenced Sources ({askSources.length})
                      </span>
                      <div className="space-y-2">
                        {askSources.map((s, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 flex items-center justify-between text-xs"
                          >
                            <div>
                              <strong className="text-gray-900 dark:text-white block">{s.merchantName}</strong>
                              <span className="text-gray-500 dark:text-gray-400">{s.documentDate} • {fmtRaw(s.totalAmount)}</span>
                            </div>
                            <span className="text-[11px] text-gray-400 font-mono italic max-w-[200px] truncate">
                              "{s.snippet}"
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DocumentModal({
  doc,
  onClose,
  fmt,
}: {
  doc: DocumentItem;
  onClose: () => void;
  fmt: (n: number) => string;
}) {
  const title = doc.merchantName || doc.merchant_name || doc.fileName || doc.file_name || 'Document';
  const amount = doc.totalAmount ?? doc.amount;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div
        className="w-full lg:max-w-lg rounded-t-[2.5rem] lg:rounded-2xl bg-white dark:bg-surface-dark-2 p-6 shadow-2xl z-50 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-4 lg:hidden" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">description</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{title}</h2>
            <p className="text-xs text-gray-400">{doc.documentDate || 'Recent'}</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {amount !== null && amount !== undefined && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-dark flex justify-between items-center">
              <span className="text-xs text-gray-400 font-bold uppercase">Total Amount</span>
              <span className="text-base font-black text-gray-900 dark:text-white">{fmt(amount)}</span>
            </div>
          )}

          {doc.lineItems && doc.lineItems.length > 0 && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-dark space-y-2">
              <span className="text-xs text-gray-400 font-bold uppercase">Itemized Line Items</span>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {doc.lineItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1 border-b border-white/5">
                    <span className="text-gray-300">{item.description}</span>
                    <span className="font-mono text-gray-200">{fmt(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(doc.extracted_text || doc.matchSnippet) && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">Extracted Text</p>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-dark text-xs text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                {doc.extracted_text || doc.matchSnippet}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-hover transition-all min-h-[44px]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
