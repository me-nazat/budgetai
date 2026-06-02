'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { CATEGORIES_EXPENSE } from '@/lib/categoryUtils';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptScannerModal({ isOpen, onClose }: ReceiptScannerModalProps) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  
  const [scannedData, setScannedData] = useState<{
    amount: number;
    date: string;
    description: string;
    category: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const invalidateFinancialData = useInvalidateFinancialData();

  const reset = () => {
    setLoading(false);
    setPreviewUrl(null);
    setBase64Image(null);
    setScannedData(null);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file.');
        return;
    }
    
    try {
        setLoading(true);
        const compressedBase64 = await compressImage(file);
        setPreviewUrl(compressedBase64);
        setBase64Image(compressedBase64); // Save to put in DB
        
        // Convert base64 back to blob for the existing FormData API
        const res = await fetch(compressedBase64);
        const blob = await res.blob();
        const formData = new FormData();
        formData.append('file', blob, 'receipt.jpg');

        const apiRes = await fetch('/api/transactions/scan', {
            method: 'POST',
            body: formData
        });

        if (!apiRes.ok) throw new Error('Failed to scan receipt');

        const json = await apiRes.json();
        setScannedData({
            amount: json.amount || 0,
            date: json.date || new Date().toISOString().split('T')[0],
            description: json.description || 'Receipt',
            category: json.category || 'Other'
        });

    } catch (error) {
        console.error(error);
        toast.error('Failed to process receipt.');
        reset();
    } finally {
        setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
  }, []);

  const saveTransaction = async () => {
      if (!scannedData) return;
      try {
          setLoading(true);
          const response = await fetch('/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  type: 'expense',
                  amount: scannedData.amount,
                  category: scannedData.category,
                  description: scannedData.description,
                  date: scannedData.date,
                  receipt_image: base64Image // Now DB handles this
              }),
          });
          
          if (!response.ok) throw new Error('Failed to save');
          
          toast.success('Transaction saved!');
          await invalidateFinancialData();
          closeModal();
      } catch (err) {
          toast.error('Failed to save transaction');
      } finally {
          setLoading(false);
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeModal}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-surface dark:bg-[#161b22] rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-[#30363d] flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-gray-200 dark:border-[#30363d] flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">document_scanner</span>
            Smart Receipt Scanner
          </h2>
          <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {!previewUrl ? (
            <div 
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 dark:border-[#30363d] rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <div className="w-16 h-16 bg-gray-100 dark:bg-surface-dark rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-gray-400">upload_file</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Drag and drop your receipt</p>
                <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-surface-dark text-gray-900 dark:text-white font-semibold text-sm hover:bg-gray-200 dark:hover:bg-surface-hover transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">folder</span>
                  Browse
                </button>
                <button onClick={() => cameraInputRef.current?.click()} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  Camera
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-[#30363d] bg-gray-100 dark:bg-black/50 aspect-video md:aspect-[4/3] flex items-center justify-center group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Receipt preview" className={`max-w-full max-h-full object-contain ${loading ? 'opacity-50 blur-sm' : ''}`} />
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm font-bold text-gray-900 shadow-white drop-shadow-md">Analyzing receipt...</p>
                  </div>
                )}
                {!loading && (
                  <button onClick={reset} className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>

              {scannedData && !loading && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                      <input 
                        type="number" 
                        value={scannedData.amount} 
                        onChange={e => setScannedData({...scannedData, amount: parseFloat(e.target.value) || 0})}
                        className="w-full bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-[#30363d] rounded-xl py-3 pl-8 pr-4 text-gray-900 dark:text-white font-bold outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                    <input 
                      type="text" 
                      value={scannedData.description} 
                      onChange={e => setScannedData({...scannedData, description: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-[#30363d] rounded-xl py-3 px-4 text-gray-900 dark:text-white font-medium outline-none focus:border-primary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
                      <input 
                        type="date" 
                        value={scannedData.date} 
                        onChange={e => setScannedData({...scannedData, date: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-[#30363d] rounded-xl py-3 px-4 text-gray-900 dark:text-white font-medium outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                      <select 
                        value={scannedData.category}
                        onChange={e => setScannedData({...scannedData, category: e.target.value})}
                        className="w-full bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-[#30363d] rounded-xl py-3 px-4 text-gray-900 dark:text-white font-medium outline-none focus:border-primary"
                      >
                        {CATEGORIES_EXPENSE.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={saveTransaction} className="w-full py-4 mt-2 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    Save Transaction
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
