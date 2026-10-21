'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { CATEGORIES_EXPENSE, getCategoryHex } from '@/lib/categoryUtils';
import type { ExtractedLineItem } from '@/lib/ai/ocrPipeline';
import type { TransactionSplitItem } from '@/hooks/useApi';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete?: (data?: any) => void;
}

export function ReceiptScannerModal({ isOpen, onClose, onScanComplete }: ReceiptScannerModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);

  const [scannedData, setScannedData] = useState<{
    amount: number;
    date: string;
    description: string;
    category: string;
    taxAmount?: number;
    currency?: string;
    lineItems?: ExtractedLineItem[];
  } | null>(null);

  const [splits, setSplits] = useState<TransactionSplitItem[]>([]);
  const [splitsEnabled, setSplitsEnabled] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const invalidateFinancialData = useInvalidateFinancialData();

  const reset = () => {
    setLoading(false);
    setSaving(false);
    setPreviewUrl(null);
    setRawFile(null);
    setScannedData(null);
    setSplits([]);
    setSplitsEnabled(false);
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Please upload an image (JPG, PNG, WebP) or PDF receipt.');
      return;
    }

    try {
      setLoading(true);
      setRawFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      const formData = new FormData();
      formData.append('file', file);

      const apiRes = await fetch('/api/transactions/scan', {
        method: 'POST',
        body: formData,
      });

      if (!apiRes.ok) throw new Error('Failed to scan receipt');

      const json = await apiRes.json();
      const detectedAmount = Number(json.totalAmount || json.amount || 0);
      const detectedCategory = json.suggestedCategory || json.category || 'Other';
      const detectedMerchant = json.merchant || json.description || 'Receipt';
      const detectedDate = json.date || new Date().toISOString().split('T')[0];

      setScannedData({
        amount: detectedAmount,
        date: detectedDate,
        description: detectedMerchant,
        category: detectedCategory,
        taxAmount: json.taxAmount,
        currency: json.currency || 'BDT',
        lineItems: json.lineItems || [],
      });
      setSplits([]);
      setSplitsEnabled(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to process receipt with OCR. Please try a clearer image.');
      reset();
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Convert extracted OCR line items into split-category items
  const handleConvertToSplits = () => {
    if (!scannedData || !scannedData.lineItems || scannedData.lineItems.length === 0) return;

    // Group or map line items
    const generatedSplits: TransactionSplitItem[] = scannedData.lineItems.map((item, idx) => ({
      id: `split_${Date.now()}_${idx}`,
      category: item.category || scannedData.category || 'Other',
      amount: Number(item.totalPrice || item.amount || 0),
      note: item.description,
    }));

    // Check sum reconciliation
    const sum = generatedSplits.reduce((acc, s) => acc + s.amount, 0);
    if (Math.abs(sum - scannedData.amount) > 0.01 && generatedSplits.length > 0) {
      // Adjust last item to balance remainder
      const diff = scannedData.amount - sum;
      generatedSplits[generatedSplits.length - 1].amount = Math.round((generatedSplits[generatedSplits.length - 1].amount + diff) * 100) / 100;
    }

    setSplits(generatedSplits);
    setSplitsEnabled(true);
    toast.success(`Converted ${generatedSplits.length} line items into Category Splits!`);
  };

  const saveTransaction = async () => {
    if (!scannedData) return;
    try {
      setSaving(true);
      const payload: Record<string, any> = {
        type: 'expense',
        amount: scannedData.amount,
        category: splitsEnabled && splits.length > 0 ? 'Split Transaction' : scannedData.category,
        description: scannedData.description,
        date: scannedData.date,
        splits: splitsEnabled && splits.length > 0 ? splits : undefined,
      };

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Failed to save transaction');
      }

      const created = await response.json();
      const createdTx = created.transaction || created;

      // Automatically attach uploaded receipt document
      if (rawFile && createdTx.id) {
        try {
          const attachFormData = new FormData();
          attachFormData.append('files', rawFile);
          await fetch(`/api/transactions/${createdTx.id}/attachments`, {
            method: 'POST',
            body: attachFormData,
          });
        } catch (attErr) {
          console.error('[ReceiptScannerModal] Attachment upload error:', attErr);
        }
      }

      toast.success('Transaction saved with receipt attachment!');
      await invalidateFinancialData();
      onScanComplete?.(createdTx);
      closeModal();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={closeModal}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden border border-gray-200/80 dark:border-white/10 flex flex-col max-h-[90vh]"
      >
        <div className="p-5 border-b border-gray-200/80 dark:border-white/10 flex justify-between items-center bg-gray-50/60 dark:bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">document_scanner</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Smart Receipt Scanner</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI-powered OCR extraction with split category support</p>
            </div>
          </div>
          <button onClick={closeModal} className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {!previewUrl ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 dark:border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-gray-400">
                <span className="material-symbols-outlined text-3xl">upload_file</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Drag and drop receipt image or PDF
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, WebP, or PDF up to 10MB</p>
              </div>
              <div className="flex gap-3 w-full max-w-xs mt-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-semibold text-xs hover:bg-gray-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">folder</span>
                  Browse File
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-xs hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
                >
                  <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  Camera
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Receipt Preview Card */}
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-black/40 h-48 flex items-center justify-center group">
                {rawFile?.type === 'application/pdf' ? (
                  <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="material-symbols-outlined text-4xl text-rose-500">picture_as_pdf</span>
                    <span className="text-xs font-medium">{rawFile.name}</span>
                  </div>
                ) : (
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    className={`max-w-full max-h-full object-contain ${loading ? 'opacity-40 blur-sm' : ''}`}
                  />
                )}
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 backdrop-blur-sm text-white">
                    <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-semibold">Extracting fields with OCR...</p>
                  </div>
                )}
                {!loading && (
                  <button
                    onClick={reset}
                    className="absolute top-3 right-3 px-2.5 py-1 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-lg text-white text-xs font-medium flex items-center gap-1 transition-opacity opacity-0 group-hover:opacity-100"
                  >
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    <span>Change Image</span>
                  </button>
                )}
              </div>

              {/* Editable Scanned Fields */}
              {scannedData && !loading && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Merchant / Description
                      </label>
                      <input
                        type="text"
                        value={scannedData.description}
                        onChange={(e) => setScannedData({ ...scannedData, description: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm text-gray-900 dark:text-white font-medium outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Total Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                          {scannedData.currency || 'BDT'}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={scannedData.amount}
                          onChange={(e) =>
                            setScannedData({ ...scannedData, amount: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 pl-12 pr-3 text-sm font-mono font-bold tabular-nums text-gray-900 dark:text-white outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={scannedData.date}
                        onChange={(e) => setScannedData({ ...scannedData, date: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm text-gray-900 dark:text-white font-medium outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Category
                      </label>
                      <select
                        disabled={splitsEnabled}
                        value={splitsEnabled ? 'Split Transaction' : scannedData.category}
                        onChange={(e) => setScannedData({ ...scannedData, category: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm text-gray-900 dark:text-white font-medium outline-none focus:border-primary disabled:opacity-60"
                      >
                        {splitsEnabled && <option value="Split Transaction">Split Transaction</option>}
                        {CATEGORIES_EXPENSE.map((c) => (
                          <option key={c.label} value={c.label}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Line Items & Split Converter */}
                  {scannedData.lineItems && scannedData.lineItems.length > 0 && (
                    <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-black/30 border border-gray-200 dark:border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[18px]">receipt_long</span>
                          <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                            Detected Line Items ({scannedData.lineItems.length})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (splitsEnabled) {
                              setSplitsEnabled(false);
                              setSplits([]);
                            } else {
                              handleConvertToSplits();
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {splitsEnabled ? 'close' : 'call_split'}
                          </span>
                          <span>
                            {splitsEnabled ? 'Revert to Single Category' : 'Convert line items into Category Splits'}
                          </span>
                        </button>
                      </div>

                      {/* Line Items List */}
                      <div className="max-h-40 overflow-y-auto space-y-1.5 divide-y divide-gray-100 dark:divide-white/5">
                        {scannedData.lineItems.map((item, idx) => (
                          <div key={idx} className="pt-1.5 flex items-center justify-between text-xs">
                            <div className="truncate max-w-[240px]">
                              <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{item.description}</p>
                              <span className="text-[10px] text-gray-400 capitalize">{item.category || 'General'}</span>
                            </div>
                            <span className="font-mono font-bold tabular-nums text-gray-900 dark:text-white">
                              {(item.totalPrice || item.amount || 0).toLocaleString()} {scannedData.currency || 'BDT'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Active Split Items Preview */}
                      {splitsEnabled && splits.length > 0 && (
                        <div className="pt-2 border-t border-gray-200 dark:border-white/10 space-y-1">
                          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Ready to allocate as {splits.length} split categories
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={saveTransaction}
                    disabled={saving}
                    className="w-full py-3.5 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        <span>Save Transaction & Attach Receipt</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
