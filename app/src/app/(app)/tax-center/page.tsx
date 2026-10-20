'use client';

/**
 * @fileoverview Unified Tax & Document Vault Center (Batch 9).
 * Consolidated high-performance tax deduction ledger, IRS/CPA compliance engine,
 * and deterministic document vault.
 *
 * Strict Purple Ban: zero purple/violet classes.
 *
 * @module app/(app)/tax-center/page
 */

import React, { useState, useMemo, useRef, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { AnnualReportGeneratorModal } from '@/components/tax/AnnualReportGeneratorModal';
import { TaxReviewQueueModal } from '@/components/tax/TaxReviewQueueModal';
import { InlineTaxTagPill } from '@/components/tax/InlineTaxTagPill';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface DeductionRow {
  id: number;
  transactionId: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  hasReceiptProof: boolean;
  receiptDocumentId?: number | null;
  attachments?: any[];
}

interface TaxDataResponse {
  success: boolean;
  data: {
    year: number;
    totalDeductible: number;
    estimatedTaxSavings: number;
    effectiveTaxRate: number;
    auditReadinessPercent: number;
    byCategory: Record<string, number>;
    taggedCount: number;
    totalTransactions: number;
    deductions: DeductionRow[];
  };
}

interface ReviewQueueItem {
  id: number;
  transactionId: number;
  description: string;
  amount: number;
  date: string;
  originalCategory: string;
  suggestedTaxCategoryId: string;
  suggestedTaxCategoryName: string;
  deductiblePercentage: number;
  estimatedDeductibleAmount: number;
  aiReason: string;
}

interface DocumentItem {
  id: string | number;
  documentId?: string;
  file_name?: string;
  fileName?: string;
  file_type?: string;
  fileType?: string;
  fileSize?: number;
  merchant_name?: string | null;
  merchantName?: string | null;
  amount?: number | null;
  totalAmount?: number | null;
  taxAmount?: number | null;
  taxYear?: number | null;
  extracted_text?: string | null;
  ocrRawText?: string | null;
  uploaded_at?: string;
  createdAt?: string;
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

const TAX_CATEGORIES = [
  'All',
  'Business',
  'Medical',
  'Charity',
  'Education',
  'Home Office',
  'Other',
] as const;

const AVAILABLE_YEARS = [2026, 2025, 2024, 2023];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/* ═══════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════ */

function TaxSkeleton() {
  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
      <div className="mb-8 space-y-3">
        <div className="h-6 w-64 rounded-full shimmer-skeleton" />
        <div className="h-4 w-96 max-w-full rounded-full shimmer-skeleton" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-panel h-28" />
        ))}
      </div>
      <div className="skeleton-panel h-[500px]" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAX & VAULT MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function TaxCenterContent() {
  const { fmtRaw } = useCurrency();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab & Year states
  const currentTab = (searchParams.get('tab') === 'vault' ? 'vault' : 'deductions') as 'deductions' | 'vault';
  const [taxYear, setTaxYear] = useState<number>(2026);
  const [effectiveTaxRate, setEffectiveTaxRate] = useState<number>(20);

  // Tab 1 (Deductions) Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [deductionSearch, setDeductionSearch] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showReviewQueueModal, setShowReviewQueueModal] = useState<boolean>(false);
  const [processingQueueId, setProcessingQueueId] = useState<number | null>(null);

  // Receipt attachment modal state
  const [attachingTxId, setAttachingTxId] = useState<number | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<boolean>(false);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);

  // Tab 2 (Vault) State
  const [vaultSearchQuery, setVaultSearchQuery] = useState<string>('');
  const [vaultSemanticResults, setVaultSemanticResults] = useState<DocumentItem[] | null>(null);
  const [isSearchingVault, setIsSearchingVault] = useState<boolean>(false);
  const [uploadingDoc, setUploadingDoc] = useState<boolean>(false);
  const [isDraggingDoc, setIsDraggingDoc] = useState<boolean>(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [expandedDocLinesId, setExpandedDocLinesId] = useState<string | number | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | number | null>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // Ask AI Modal State
  const [isAskModalOpen, setIsAskModalOpen] = useState<boolean>(false);
  const [askQuestion, setAskQuestion] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askSources, setAskSources] = useState<AskSource[]>([]);

  // Switch Tab Helper
  const handleTabChange = (tab: 'deductions' | 'vault') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`);
  };

  /* ── SWR Data Fetching ── */
  const taxSWRKey = `/api/tax?year=${taxYear}`;
  const { data: taxResponse, isLoading: isTaxLoading } = useSWR<TaxDataResponse>(taxSWRKey, fetcher);

  const reviewQueueKey = `/api/tax/review-queue?year=${taxYear}`;
  const { data: reviewQueueResponse, mutate: mutateReviewQueue } = useSWR<{
    success: boolean;
    data: {
      items: ReviewQueueItem[];
      totalCandidates: number;
    };
  }>(reviewQueueKey, fetcher);

  const documentsKey = `/api/documents`;
  const { data: documentsResponse, isLoading: isDocsLoading, mutate: mutateDocuments } = useSWR<{
    documents: DocumentItem[];
  }>(documentsKey, fetcher);

  const taxData = taxResponse?.data;
  const reviewQueueItems = reviewQueueResponse?.data?.items || [];
  const topCandidate = reviewQueueItems.length > 0 ? reviewQueueItems[0] : null;

  const totalDeductible = taxData?.totalDeductible || 0;
  const estimatedTaxSavings = useMemo(() => {
    return Math.round(totalDeductible * (effectiveTaxRate / 100));
  }, [totalDeductible, effectiveTaxRate]);

  const auditReadinessPercent = taxData?.auditReadinessPercent ?? 0;
  const deductionsList = useMemo(() => taxData?.deductions || [], [taxData?.deductions]);

  // Filtered Deductions
  const filteredDeductions = useMemo(() => {
    return deductionsList.filter((d) => {
      const matchesCat =
        selectedCategory === 'All' ||
        d.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesSearch =
        !deductionSearch.trim() ||
        d.description.toLowerCase().includes(deductionSearch.toLowerCase()) ||
        d.category.toLowerCase().includes(deductionSearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [deductionsList, selectedCategory, deductionSearch]);

  const verifiedReceiptCount = useMemo(() => {
    return deductionsList.filter((d) => d.hasReceiptProof).length;
  }, [deductionsList]);

  /* ── 1-Click Inline Review Queue Actions ── */
  const handleInlineReviewAction = async (transactionId: number, action: 'verify' | 'reject') => {
    setProcessingQueueId(transactionId);
    try {
      const res = await fetch('/api/tax/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, action }),
      });
      if (!res.ok) throw new Error('Action failed');
      toast.success(action === 'verify' ? 'Deduction approved & tagged!' : 'Excluded from deductions');
      await Promise.all([
        mutate(taxSWRKey),
        mutateReviewQueue(),
      ]);
    } catch {
      toast.error('Failed to process review item');
    } finally {
      setProcessingQueueId(null);
    }
  };

  /* ── Bulk-Tag Patterns ── */
  const handleBulkTag = async () => {
    try {
      const res = await fetch('/api/tax/bulk-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply: true }),
      });
      const data = await res.json();
      if (data.appliedCount > 0) {
        toast.success(`Tagged ${data.appliedCount} eligible deductions based on recurring patterns`);
        await Promise.all([
          mutate(taxSWRKey),
          mutateReviewQueue(),
        ]);
      } else {
        toast.info('All qualifying transactions are already tagged');
      }
    } catch {
      toast.error('Bulk tagging failed');
    }
  };

  /* ── Attach Receipt File Directly to Deduction ── */
  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !attachingTxId) return;

    setUploadingReceipt(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Upload to Document Vault
      const uploadRes = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Receipt upload failed');
      const uploadData = await uploadRes.json();
      const docId = uploadData?.document?.id || uploadData?.id;

      // 2. Link Document to Deduction
      if (docId) {
        await fetch('/api/tax/deductions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: attachingTxId,
            receiptDocumentId: docId,
            notes: `Receipt attached: ${file.name}`,
          }),
        });

        // Trigger background embedding
        fetch('/api/documents/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: String(docId) }),
        }).then(() => mutateDocuments());
      }

      toast.success('Receipt attached & verified!');
      await mutate(taxSWRKey);
      await mutateDocuments();
    } catch {
      toast.error('Failed to attach receipt');
    } finally {
      setUploadingReceipt(false);
      setAttachingTxId(null);
      if (receiptFileInputRef.current) receiptFileInputRef.current.value = '';
    }
  };

  /* ── Document Vault Handlers ── */
  const allVaultDocs = documentsResponse?.documents || [];
  const displayedVaultDocs = vaultSemanticResults !== null ? vaultSemanticResults : allVaultDocs;

  // Vault Debounced Search
  useEffect(() => {
    if (!vaultSearchQuery.trim() || vaultSearchQuery.trim().length < 2) {
      setVaultSemanticResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingVault(true);
      try {
        const res = await fetch('/api/documents/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: vaultSearchQuery.trim(), limit: 50 }),
        });
        if (res.ok) {
          const data = await res.json();
          setVaultSemanticResults(data.results || []);
        }
      } catch (err) {
        console.error('Vault search error:', err);
      } finally {
        setIsSearchingVault(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [vaultSearchQuery]);

  // Upload to Vault
  const handleVaultUpload = useCallback(
    async (file: File) => {
      setUploadingDoc(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Document upload failed');
        const uploadData = await res.json();
        const docId = uploadData?.document?.id || uploadData?.id;

        toast.success(`Uploaded ${file.name}! Extracting structured metadata...`);
        await mutateDocuments();

        if (docId) {
          fetch('/api/documents/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: String(docId) }),
          }).then(() => mutateDocuments());
        }
      } catch {
        toast.error('Failed to upload document');
      } finally {
        setUploadingDoc(false);
      }
    },
    [mutateDocuments]
  );

  // Vault Drop Handler
  const handleDropDoc = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingDoc(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleVaultUpload(file);
    },
    [handleVaultUpload]
  );

  // Delete Document
  const handleDeleteDoc = async (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this document from your vault?')) return;

    setDeletingDocId(id);
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Document deleted from vault');
      await mutateDocuments();
      if (selectedDoc && (selectedDoc.id === id || selectedDoc.documentId === String(id))) {
        setSelectedDoc(null);
      }
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  // Ask AI Vault Q&A
  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuestion.trim() || isAsking) return;

    setIsAsking(true);
    setAskAnswer(null);
    setAskSources([]);

    try {
      const res = await fetch('/api/documents/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: askQuestion.trim() }),
      });
      const data = await res.json();
      if (data.answer) {
        setAskAnswer(data.answer);
        setAskSources(data.sources || []);
      } else {
        setAskAnswer('No relevant financial records found to answer your question.');
      }
    } catch {
      toast.error('Failed to query AI Vault Assistant');
      setAskAnswer('An error occurred while analyzing your document vault.');
    } finally {
      setIsAsking(false);
    }
  };

  if (isTaxLoading && !taxData) return <TaxSkeleton />;

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter pb-24 font-sans">
      <Toaster position="top-center" richColors />

      {/* Hidden input for attaching receipts to deductions */}
      <input
        ref={receiptFileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleReceiptFileChange}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              IRS & CPA Audit Shield
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Tax Year {taxYear}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <span
              className="material-symbols-outlined text-emerald-500 text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              receipt_long
            </span>
            Tax & Document Vault
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Deterministic receipt search, audit-proof write-off ledgers, and institutional reporting
          </p>
        </div>

        {/* Top Controls: Year Switcher & Quick Export Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Tax Year Switcher */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200/80 dark:border-white/10">
            <span className="material-symbols-outlined text-gray-400 text-base ml-2 mr-1">
              calendar_today
            </span>
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-gray-900 dark:text-white pr-3 py-1.5 focus:outline-none cursor-pointer"
            >
              {AVAILABLE_YEARS.map((y) => (
                <option key={y} value={y} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                  FY {y}
                </option>
              ))}
            </select>
          </div>

          {/* Quick CSV Export */}
          <a
            href={`/api/tax/export?year=${taxYear}&format=csv`}
            download
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200/80 dark:border-white/10 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all flex items-center gap-1.5"
            title="Download clean RFC-4180 CSV ledger"
          >
            <span className="material-symbols-outlined text-[17px] text-emerald-500">
              table_chart
            </span>
            CSV Export
          </a>

          {/* Pattern Bulk-Tag */}
          <button
            onClick={handleBulkTag}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold transition-all flex items-center gap-1.5"
            title="Automatically tag recurring subscriptions and vendor patterns"
          >
            <span className="material-symbols-outlined text-[17px]">auto_fix_high</span>
            Bulk-Tag
          </button>

          {/* Generate Annual Report & Share */}
          <button
            onClick={() => setShowExportModal(true)}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[17px]">file_download</span>
            Report & Share
          </button>
        </div>
      </div>

      {/* ── Main Tab Navigation Bar ── */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 mb-6">
        <button
          onClick={() => handleTabChange('deductions')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all -mb-px ${
            currentTab === 'deductions'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 rounded-t-xl'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <span
            className="material-symbols-outlined text-xl"
            style={currentTab === 'deductions' ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            receipt
          </span>
          Tax Deductions & Filing
          {taxData && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {taxData.taggedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('vault')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all -mb-px ${
            currentTab === 'vault'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 rounded-t-xl'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <span
            className="material-symbols-outlined text-xl"
            style={currentTab === 'vault' ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            folder_open
          </span>
          Receipts & Document Vault
          {allVaultDocs.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300">
              {allVaultDocs.length}
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: TAX DEDUCTIONS & FILING
          ═══════════════════════════════════════════════════════════ */}
      {currentTab === 'deductions' && (
        <div className="space-y-6">
          {/* ── 4 KPI Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Approved Deductions */}
            <div className="glass-panel p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Approved Deductions
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">savings</span>
                </div>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white tabular-nums">
                  {fmtRaw(totalDeductible)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {taxData?.taggedCount ?? 0} qualified write-offs in FY {taxYear}
                </p>
              </div>
            </div>

            {/* Card 2: Estimated Tax Savings with Interactive Slider */}
            <div className="glass-panel p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Est. Tax Shield ({effectiveTaxRate}%)
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">shield</span>
                </div>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {fmtRaw(estimatedTaxSavings)}
                </p>
                <div className="mt-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                    <span>Tax Bracket:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{effectiveTaxRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="45"
                    step="1"
                    value={effectiveTaxRate}
                    onChange={(e) => setEffectiveTaxRate(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-gray-200 dark:bg-white/10 rounded-lg"
                    aria-label="Effective tax rate slider"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Audit Readiness Score */}
            <div className="glass-panel p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Audit Readiness
                </span>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    auditReadinessPercent >= 80
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">verified_user</span>
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white tabular-nums">
                    {auditReadinessPercent}%
                  </p>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    proof rate
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-white/10 h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full transition-all duration-500 ${
                      auditReadinessPercent >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(auditReadinessPercent, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                  {verifiedReceiptCount} of {taxData?.taggedCount ?? 0} with attached proof
                </p>
              </div>
            </div>

            {/* Card 4: Pending Review Queue */}
            <div className="glass-panel p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  AI Review Queue
                </span>
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                </div>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white tabular-nums">
                  {reviewQueueItems.length}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    potential write-offs
                  </span>
                  {reviewQueueItems.length > 0 && (
                    <button
                      onClick={() => setShowReviewQueueModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-bold transition-all"
                    >
                      Open Queue →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Inline Review Strip ── */}
          {topCandidate ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 sm:p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-xl">auto_awesome</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      AI Deduction Recommendation (1 of {reviewQueueItems.length})
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {topCandidate.date}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                    {topCandidate.description}{' '}
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black ml-1">
                      {fmtRaw(topCandidate.amount)}
                    </span>
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    Suggests{' '}
                    <strong className="text-gray-900 dark:text-white">
                      {topCandidate.suggestedTaxCategoryName}
                    </strong>{' '}
                    ({Math.round(topCandidate.deductiblePercentage * 100)}% deductible) — {topCandidate.aiReason}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                <button
                  onClick={() => handleInlineReviewAction(topCandidate.transactionId, 'reject')}
                  disabled={processingQueueId === topCandidate.transactionId}
                  className="flex-1 md:flex-initial min-h-[40px] px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 text-xs font-bold transition-all disabled:opacity-50"
                >
                  Skip
                </button>
                <button
                  onClick={() => handleInlineReviewAction(topCandidate.transactionId, 'verify')}
                  disabled={processingQueueId === topCandidate.transactionId}
                  className="flex-1 md:flex-initial min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Approve Write-Off
                </button>
                <button
                  onClick={() => setShowReviewQueueModal(true)}
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 text-xs font-bold transition-all hidden sm:flex items-center gap-1"
                >
                  <span>All ({reviewQueueItems.length})</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-surface-dark border border-gray-200/60 dark:border-white/5 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
                <span>All candidate transactions for FY {taxYear} have been reviewed.</span>
              </div>
              <button
                onClick={handleBulkTag}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Scan for new patterns
              </button>
            </div>
          )}

          {/* ── Deductions Ledger Section ── */}
          <div className="glass-panel rounded-2xl border border-gray-200/80 dark:border-white/10 overflow-hidden">
            {/* Table Search & Category Filter Header */}
            <div className="p-4 border-b border-gray-200/80 dark:border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                {TAX_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Deductions Search Input */}
              <div className="relative min-w-[240px]">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter write-offs..."
                  value={deductionSearch}
                  onChange={(e) => setDeductionSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200/80 dark:border-white/10 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider bg-gray-50/50 dark:bg-surface-dark/50">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description / Merchant</th>
                    <th className="py-3 px-4">Tax Category</th>
                    <th className="py-3 px-4">Receipt Status</th>
                    <th className="py-3 px-4 text-right">Deductible Amount</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filteredDeductions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        <span className="material-symbols-outlined text-4xl block mb-2 text-gray-300 dark:text-gray-600">
                          receipt
                        </span>
                        No deductible transactions found for FY {taxYear}.
                      </td>
                    </tr>
                  ) : (
                    filteredDeductions.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-gray-50/60 dark:hover:bg-white/5 transition-colors"
                      >
                        {/* Date */}
                        <td className="py-3.5 px-4 font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {row.date}
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white max-w-[280px] truncate">
                          {row.description}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300">
                              {row.category}
                            </span>
                            <InlineTaxTagPill
                              transactionId={row.transactionId}
                              amount={row.amount}
                              category={row.category}
                              isTagged={true}
                              onTagged={() => mutate(taxSWRKey)}
                            />
                          </div>
                        </td>

                        {/* Receipt Status Pill */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {row.hasReceiptProof ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                              title="Verified proof attached"
                            >
                              <span className="material-symbols-outlined text-[13px]">verified</span>
                              Receipt Attached
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setAttachingTxId(row.transactionId);
                                receiptFileInputRef.current?.click();
                              }}
                              disabled={uploadingReceipt && attachingTxId === row.transactionId}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
                              title="Upload and link receipt"
                            >
                              <span className="material-symbols-outlined text-[13px]">add_a_photo</span>
                              {uploadingReceipt && attachingTxId === row.transactionId
                                ? 'Attaching...'
                                : '+ Attach Receipt'}
                            </button>
                          )}
                        </td>

                        {/* Deductible Amount */}
                        <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900 dark:text-white tabular-nums">
                          {fmtRaw(row.amount)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={async () => {
                              try {
                                await fetch('/api/tax/deductions', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    transactionId: row.transactionId,
                                    action: 'remove',
                                  }),
                                });
                                toast.success('Removed from deductions');
                                await mutate(taxSWRKey);
                              } catch {
                                toast.error('Failed to remove deduction');
                              }
                            }}
                            className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Unmark deduction"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: RECEIPTS & DOCUMENT VAULT
          ═══════════════════════════════════════════════════════════ */}
      {currentTab === 'vault' && (
        <div className="space-y-6">
          {/* Top Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingDoc(true);
            }}
            onDragLeave={() => setIsDraggingDoc(false)}
            onDrop={handleDropDoc}
            onClick={() => docFileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
              isDraggingDoc
                ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
                : 'border-gray-300 dark:border-white/10 hover:border-emerald-500/40 hover:bg-gray-50 dark:hover:bg-white/5'
            }`}
          >
            <input
              ref={docFileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleVaultUpload(f);
              }}
              className="hidden"
            />
            <div className="max-w-md mx-auto space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">
                  {uploadingDoc ? 'hourglass_top' : 'cloud_upload'}
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {uploadingDoc ? 'Uploading & Indexing Receipt...' : 'Drop receipts, invoices, or statements here'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Supports PDF, JPG, PNG, WebP up to 50MB. AI extracts merchant, date, amount, and items automatically.
              </p>
            </div>
          </div>

          {/* Sticky 56px Search & Ask AI Bar */}
          <div className="sticky top-2 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-2 rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg shadow-black/5 flex items-center gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                search
              </span>
              <input
                type="text"
                value={vaultSearchQuery}
                onChange={(e) => setVaultSearchQuery(e.target.value)}
                placeholder="Deterministic vault search (e.g. 'Stripe invoice', 'Apple Store', '>100')..."
                className="w-full pl-12 pr-28 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-emerald-500/40 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:outline-none transition-all"
                style={{ minHeight: '52px' }}
              />

              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {isSearchingVault && (
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                )}
                {vaultSearchQuery && (
                  <button
                    onClick={() => {
                      setVaultSearchQuery('');
                      setVaultSemanticResults(null);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsAskModalOpen(true)}
              className="min-h-[52px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-2 shrink-0 shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">smart_toy</span>
              <span className="hidden sm:inline">Ask AI Vault</span>
            </button>
          </div>

          {/* Documents Grid / Cards */}
          {isDocsLoading && allVaultDocs.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="glass-panel h-48 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : displayedVaultDocs.length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-2xl border border-gray-200/80 dark:border-white/10">
              <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-3 block">
                folder_open
              </span>
              <p className="text-gray-400 font-medium">No documents found matching your search.</p>
              <p className="text-gray-400 text-xs mt-1">
                Drop receipts into the box above to index them automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayedVaultDocs.map((doc) => {
                const docId = doc.documentId || doc.id;
                const title =
                  doc.merchantName || doc.merchant_name || doc.fileName || doc.file_name || 'Document';
                const amount = doc.totalAmount ?? doc.amount;
                const status = doc.embeddingStatus || 'READY';
                const isLinesExpanded = expandedDocLinesId === docId;

                return (
                  <motion.div
                    key={String(docId)}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel p-5 rounded-2xl flex flex-col justify-between group hover:-translate-y-1 transition-all border border-gray-200 dark:border-white/10 cursor-pointer relative"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <div>
                      {/* Top Bar: Icon + Status Badge + Delete */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-xl">
                            {doc.fileType?.includes('pdf') || doc.fileName?.endsWith('.pdf')
                              ? 'picture_as_pdf'
                              : 'receipt'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {status === 'READY' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              READY
                            </span>
                          )}
                          {status === 'EMBEDDING' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                              INDEXING
                            </span>
                          )}
                          {status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              PENDING
                            </span>
                          )}
                          {status === 'FAILED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                              FAILED
                            </span>
                          )}

                          {/* Delete document button */}
                          <button
                            onClick={(e) => handleDeleteDoc(docId, e)}
                            disabled={deletingDocId === docId}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete document"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Title & Date */}
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>
                          {doc.documentDate ||
                            (doc.createdAt
                              ? new Date(doc.createdAt).toLocaleDateString()
                              : 'Recent')}
                        </span>
                        {doc.taxYear && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              FY {doc.taxYear}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Highlighted Match Snippet (Search) */}
                      {doc.matchSnippet && (
                        <p className="text-xs text-gray-400 line-clamp-2 mt-2 italic bg-gray-50 dark:bg-white/5 p-2 rounded-lg font-mono">
                          "{doc.matchSnippet}"
                        </p>
                      )}
                    </div>

                    {/* Bottom Bar: Amount + Line items toggle */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                          {amount !== null && amount !== undefined ? fmtRaw(amount) : ''}
                        </span>

                        {doc.lineItems && doc.lineItems.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDocLinesId(isLinesExpanded ? null : docId);
                            }}
                            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                          >
                            {isLinesExpanded ? 'Hide items' : `${doc.lineItems.length} items`}
                            <span className="material-symbols-outlined text-xs">
                              {isLinesExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Expandable Line Items Accordion */}
                      <AnimatePresence>
                        {isLinesExpanded && doc.lineItems && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-2 border-t border-gray-100 dark:border-white/5 space-y-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                              {doc.lineItems.map((li, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs py-0.5 border-b border-gray-100 dark:border-white/5"
                                >
                                  <span className="text-gray-600 dark:text-gray-300 truncate max-w-[120px]">
                                    {li.description}
                                  </span>
                                  <span className="font-mono text-gray-900 dark:text-gray-200">
                                    {fmtRaw(li.totalPrice)}
                                  </span>
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
        </div>
      )}

      {/* ── Annual Report & Share Modal ── */}
      <AnnualReportGeneratorModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        defaultYear={taxYear}
      />

      {/* ── Tax Review Queue Modal ── */}
      <TaxReviewQueueModal
        isOpen={showReviewQueueModal}
        onClose={() => setShowReviewQueueModal(false)}
        onItemProcessed={() => {
          mutate(taxSWRKey);
          mutateReviewQueue();
        }}
      />

      {/* ── Document Details Modal ── */}
      {selectedDoc && (
        <DocumentDetailModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          fmt={fmtRaw}
        />
      )}

      {/* ── Ask AI Vault Assistant Modal ── */}
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
              className="w-full lg:max-w-2xl bg-white dark:bg-slate-900 rounded-t-[2.5rem] lg:rounded-3xl p-6 lg:p-8 shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90vh] overflow-y-auto"
              style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-4 lg:hidden" />

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">smart_toy</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Ask AI Vault Assistant
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Query across all indexed receipts, invoices, and tax statements
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAskModalOpen(false)}
                  className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAskAI} className="space-y-4 mb-6">
                <div className="relative">
                  <input
                    type="text"
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
                    placeholder="e.g. 'What was my total business software expense last quarter?'"
                    className="w-full px-4 py-3.5 pr-28 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    style={{ fontSize: '16px', minHeight: '52px' }}
                  />
                  <button
                    type="submit"
                    disabled={isAsking || !askQuestion.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-50 transition-all min-h-[36px]"
                  >
                    {isAsking ? 'Thinking...' : 'Submit'}
                  </button>
                </div>
              </form>

              {/* Answer Box */}
              {isAsking && (
                <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Scanning documents & synthesizing answer...
                  </p>
                </div>
              )}

              {askAnswer && !isAsking && (
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 space-y-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
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
                              <strong className="text-gray-900 dark:text-white block">
                                {s.merchantName || s.fileName}
                              </strong>
                              <span className="text-gray-500 dark:text-gray-400">
                                {s.documentDate} • {fmtRaw(s.totalAmount)}
                              </span>
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

/* ═══════════════════════════════════════════════════════════════
   DOCUMENT DETAIL MODAL
   ═══════════════════════════════════════════════════════════════ */

function DocumentDetailModal({
  doc,
  onClose,
  fmt,
}: {
  doc: DocumentItem;
  onClose: () => void;
  fmt: (n: number) => string;
}) {
  const title =
    doc.merchantName || doc.merchant_name || doc.fileName || doc.file_name || 'Document';
  const amount = doc.totalAmount ?? doc.amount;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center p-0 lg:p-4"
      onClick={onClose}
    >
      <div
        className="w-full lg:max-w-lg rounded-t-[2.5rem] lg:rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-200 dark:border-white/10 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-4 lg:hidden" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">
              {doc.fileType?.includes('pdf') || doc.fileName?.endsWith('.pdf')
                ? 'picture_as_pdf'
                : 'receipt'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{title}</h2>
            <p className="text-xs text-gray-400">
              {doc.documentDate ||
                (doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'Recent')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {amount !== null && amount !== undefined && (
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-surface-dark flex justify-between items-center">
              <span className="text-xs text-gray-400 font-bold uppercase">Total Amount</span>
              <span className="text-base font-black text-gray-900 dark:text-white font-mono">
                {fmt(amount)}
              </span>
            </div>
          )}

          {doc.lineItems && doc.lineItems.length > 0 && (
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-surface-dark space-y-2">
              <span className="text-xs text-gray-400 font-bold uppercase">Itemized Line Items</span>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {doc.lineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between text-xs py-1 border-b border-gray-100 dark:border-white/5"
                  >
                    <span className="text-gray-700 dark:text-gray-300">{item.description}</span>
                    <span className="font-mono text-gray-900 dark:text-gray-200">
                      {fmt(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(doc.extracted_text || doc.ocrRawText || doc.matchSnippet) && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">OCR Raw Text Preview</p>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-dark text-xs text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                {doc.extracted_text || doc.ocrRawText || doc.matchSnippet}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-all min-h-[44px]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT DEFAULT WITH SUSPENSE (NEXT.JS APP ROUTER)
   ═══════════════════════════════════════════════════════════════ */

export default function TaxCenterPage() {
  return (
    <Suspense fallback={<TaxSkeleton />}>
      <TaxCenterContent />
    </Suspense>
  );
}
