'use client';

/**
 * @fileoverview Streamlined 3-Second QuickAdd Transaction Modal (Batch 8 Part 4).
 * Radical minimalism & progressive disclosure:
 * - 3-Second Primary Entry: Type Pill, Hero Amount, Unified Merchant / Smart Description Input
 * - Compact Camera (Receipt OCR) and Mic (Voice) icons inside the input's right adornment
 * - Smart Auto-Defaults: Remembers lastUsedAccountId in localStorage, auto-matches category
 * - 1-Click Inline Automation Rule creation: "Always categorize [Merchant] as [Category]"
 * - Progressive Disclosure Drawer: "+ Split, Tax & Attachments"
 *
 * @module components/transactions/QuickAddTransactionModal
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useHaptics } from '@/hooks/useHaptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { ReceiptScannerModal } from './ReceiptScannerModal';
import {
  CATEGORIES_EXPENSE,
  CATEGORIES_INCOME,
} from '@/lib/categoryUtils';
import { MAX_ATTACHMENT_FILES } from '@/lib/transaction-attachments';
import type { TransactionSplitItem } from '@/hooks/useApi';

const LAST_ACCOUNT_KEY = 'wealth_last_used_account_id';

export interface CustomCategory {
  id: number;
  name: string;
  type: string;
  icon: string;
  color: string;
}

export interface QuickAddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTransaction?: any;
  initialDate?: string;
  onSaveSuccess?: () => void;

  // Optional controlled props for transactions/page.tsx
  qaType?: 'expense' | 'earning';
  setQaType?: (t: 'expense' | 'earning') => void;
  qaAmount?: string;
  setQaAmount?: (a: string) => void;
  qaCategory?: string;
  setQaCategory?: (c: string) => void;
  qaDesc?: string;
  setQaDesc?: (d: string) => void;
  qaDate?: string;
  setQaDate?: (d: string) => void;
  qaNotes?: string;
  setQaNotes?: (n: string) => void;
  qaAttachments?: File[];
  setQaAttachments?: React.Dispatch<React.SetStateAction<File[]>>;
  qaScanningId?: number | null;
  qaSubmitting?: boolean;
  submitQuickAdd?: () => Promise<void>;
  sym?: string;
  handleScanAttachment?: (file: File, index: number) => Promise<void>;
  customCategories?: any[];
  qaAddingCustomCategory?: boolean;
  setQaAddingCustomCategory?: (v: boolean) => void;
  qaCustomCategoryName?: string;
  setQaCustomCategoryName?: (n: string) => void;
  qaCustomIcon?: string;
  setQaCustomIcon?: (i: string) => void;
  qaCustomColor?: string;
  setQaCustomColor?: (c: string) => void;
  qaIconOptions?: string[];
  generateInlineIconOptions?: () => void;

  // Split Category props
  qaIsSplit?: boolean;
  setQaIsSplit?: (v: boolean) => void;
  qaSplits?: TransactionSplitItem[];
  setQaSplits?: React.Dispatch<React.SetStateAction<TransactionSplitItem[]>>;
}

/**
 * Reusable dynamic Split Category Builder component
 */
export function SplitCategoryBuilder({
  splits,
  onChange,
  totalAmount,
  sym = '$',
  categoryOptions,
}: {
  splits: TransactionSplitItem[];
  onChange: (splits: TransactionSplitItem[]) => void;
  totalAmount: number;
  sym?: string;
  categoryOptions: string[];
}) {
  const allocated = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const remaining = Math.round((totalAmount - allocated) * 100) / 100;
  const isBalanced = Math.abs(remaining) <= 0.01;

  const updateSplit = (id: string, field: keyof TransactionSplitItem, value: any) => {
    onChange(splits.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const removeSplit = (id: string) => {
    if (splits.length <= 1) return;
    onChange(splits.filter((s) => s.id !== id));
  };

  const addSplit = () => {
    const newAmount = remaining > 0 ? remaining : 0;
    const newCategory = categoryOptions[splits.length % categoryOptions.length] || 'Other';
    onChange([
      ...splits,
      {
        id: `split_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        category: newCategory,
        amount: newAmount,
        note: '',
      },
    ]);
  };

  return (
    <div className="space-y-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-300">Split Breakdown ({splits.length})</span>
        <span
          className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
            isBalanced
              ? 'bg-emerald-500/10 text-emerald-400'
              : remaining > 0
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-rose-500/10 text-rose-400'
          }`}
        >
          {isBalanced ? 'Balanced' : `Remaining: ${sym}${remaining}`}
        </span>
      </div>

      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {splits.map((row) => (
          <div key={row.id} className="flex items-center gap-1.5">
            <select
              value={row.category}
              onChange={(e) => updateSplit(row.id, 'category', e.target.value)}
              className="w-1/3 rounded-lg bg-slate-900 border border-slate-800 text-white p-1 text-xs"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              value={row.amount || ''}
              onChange={(e) => updateSplit(row.id, 'amount', parseFloat(e.target.value) || 0)}
              className="w-1/4 rounded-lg bg-slate-900 border border-slate-800 text-white p-1 text-xs font-mono"
            />
            <input
              type="text"
              placeholder="Note..."
              value={row.note || ''}
              onChange={(e) => updateSplit(row.id, 'note', e.target.value)}
              className="flex-1 rounded-lg bg-slate-900 border border-slate-800 text-white p-1 text-xs"
            />
            {splits.length > 1 && (
              <button
                type="button"
                onClick={() => removeSplit(row.id)}
                className="text-slate-500 hover:text-rose-400 p-1"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSplit}
        className="text-[11px] font-bold text-sky-400 hover:text-sky-300 pt-1"
      >
        + Add split row
      </button>
    </div>
  );
}

/**
 * Controlled mode for page-level integration
 */
function ControlledQuickAddPanel(props: QuickAddTransactionModalProps) {
  const {
    qaType = 'expense',
    setQaType,
    qaAmount = '',
    setQaAmount,
    qaCategory = '',
    setQaCategory,
    qaDesc = '',
    setQaDesc,
    qaDate = '',
    setQaDate,
    qaNotes = '',
    setQaNotes,
    submitQuickAdd,
    sym = '$',
  } = props;

  const [createRule, setCreateRule] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createRule && qaDesc.trim() && qaCategory) {
      try {
        await fetch('/api/automation-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Auto: ${qaDesc.trim()}`,
            triggerType: 'description_contains',
            triggerValue: qaDesc.trim(),
            actionType: 'set_category',
            actionValue: qaCategory,
          }),
        });
      } catch {}
    }
    submitQuickAdd?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md mb-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setQaType?.('expense')}
            className={`px-3 py-1 text-xs font-bold rounded-lg ${
              qaType === 'expense'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'text-slate-400'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setQaType?.('earning')}
            className={`px-3 py-1 text-xs font-bold rounded-lg ${
              qaType === 'earning'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400'
            }`}
          >
            Income
          </button>
        </div>
        <span className="text-xs font-mono text-slate-500">Quick Add Panel</span>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
        <span className="text-2xl font-bold text-slate-500">{sym}</span>
        <input
          type="number"
          step="any"
          required
          autoFocus
          placeholder="0.00"
          value={qaAmount}
          onChange={(e) => setQaAmount?.(e.target.value)}
          className="w-full bg-transparent text-2xl font-black text-white outline-none font-mono tabular-nums"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Merchant or description..."
          value={qaDesc}
          onChange={(e) => setQaDesc?.(e.target.value)}
          className="rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white outline-none focus:border-sky-500"
        />
        <input
          type="date"
          value={qaDate}
          onChange={(e) => setQaDate?.(e.target.value)}
          className="rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white outline-none focus:border-sky-500"
        />
      </div>

      {qaDesc.trim() && qaCategory && (
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={createRule}
            onChange={(e) => setCreateRule(e.target.checked)}
            className="rounded border-slate-800 text-emerald-500 focus:ring-0"
          />
          <span>
            Always categorize <strong className="text-slate-200">"{qaDesc.trim()}"</strong> as{' '}
            <strong className="text-emerald-400">{qaCategory}</strong>
          </span>
        </label>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all"
        >
          Save Transaction
        </button>
      </div>
    </form>
  );
}

/**
 * Autonomous Modal Component
 */
function AutonomousQuickAddModal({
  isOpen,
  onClose,
  initialTransaction,
  initialDate,
  onSaveSuccess,
}: QuickAddTransactionModalProps) {
  const { locale, t } = useLanguage();
  const { currency } = useCurrency();
  const sym = CURRENCIES[currency]?.symbol || '$';
  const { isOnline } = useNetworkStatus();
  const invalidateFinancialData = useInvalidateFinancialData();
  const { mutate } = useSWRConfig();
  const { success: hapticSuccess } = useHaptics();

  // Primary 3-second state
  const [type, setType] = useState<'expense' | 'earning' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  // Compact Chips & Auto-defaults
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  // Progressive Disclosure Drawer (+ Split, Tax & Attachments)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSplit, setIsSplit] = useState(false);
  const [splits, setSplits] = useState<TransactionSplitItem[]>([]);
  const [isTaxDeductible, setIsTaxDeductible] = useState(false);
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  // Inline Rule Creation state
  const [alwaysCategorize, setAlwaysCategorize] = useState(false);

  // Receipt Scanner modal
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Fetch accounts & automation rules
  const { data: accountsData } = useSWR('/api/accounts', (url) => fetch(url).then((r) => r.json()));
  const { data: rulesData } = useSWR('/api/automation-rules', (url) => fetch(url).then((r) => r.json()));
  const accounts = useMemo(() => accountsData?.accounts || [], [accountsData?.accounts]);
  const rules = useMemo(() => rulesData?.rules || [], [rulesData?.rules]);

  // Initialize and load defaults
  useEffect(() => {
    if (isOpen) {
      if (initialTransaction) {
        setType(initialTransaction.type || 'expense');
        setAmount(String(initialTransaction.amount || ''));
        setDescription(initialTransaction.description || '');
        setCategory(initialTransaction.category || '');
        setDate(initialTransaction.date || new Date().toISOString().split('T')[0]);
        setAccountId(String(initialTransaction.accountId || ''));
        setToAccountId(String(initialTransaction.toAccountId || ''));
        setNotes(initialTransaction.notes || '');
      } else {
        // Smart Auto-default account from localStorage
        const savedAccount = localStorage.getItem(LAST_ACCOUNT_KEY);
        if (savedAccount) {
          setAccountId(savedAccount);
        } else if (accounts.length > 0) {
          setAccountId(String(accounts[0].id));
        }
        if (initialDate) setDate(initialDate);
        setCategory(type === 'expense' ? 'Food' : 'Salary');
      }
      setTimeout(() => amountInputRef.current?.focus(), 100);
    }
  }, [isOpen, initialTransaction, initialDate, accounts, type]);

  // Smart merchant matching: check active rules as user types
  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    const lower = val.toLowerCase().trim();
    if (!lower) return;

    // Check automation rules
    for (const r of rules) {
      if (r.active === 1 && r.triggerType === 'description_contains') {
        if (lower.includes(r.triggerValue.toLowerCase())) {
          setCategory(r.actionValue);
          return;
        }
      }
    }
  };

  // Natural language parsing on Enter or Tab inside description
  const handleSmartInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      const text = description.trim();
      // Detect simple pattern e.g. "Coffee 450" or "Pathao 220"
      const match = text.match(/^(.*?)\s+([0-9]+(?:\.[0-9]+)?)$/);
      if (match) {
        e.preventDefault();
        const extractedMerchant = match[1].trim();
        const extractedAmount = match[2];
        setDescription(extractedMerchant);
        setAmount(extractedAmount);
        handleDescriptionChange(extractedMerchant);
        toast.info(`Parsed: ${extractedMerchant} • ${sym}${extractedAmount}`);
      }
    }
  };

  // Voice recognition
  const { isListening, startListening, stopListening, supported: voiceSupported } =
    useVoiceRecognition((transcript) => {
      handleDescriptionChange(transcript);
      // Attempt to extract amount if mentioned
      const match = transcript.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (match) {
        setAmount(match[1]);
      }
    });

  // Handle Receipt scan completion
  const handleScanComplete = (scanned: any) => {
    if (scanned?.amount) setAmount(String(scanned.amount));
    if (scanned?.description) {
      setDescription(scanned.description);
      handleDescriptionChange(scanned.description);
    }
    if (scanned?.category) setCategory(scanned.category);
    if (scanned?.date) setDate(scanned.date);
    setIsScannerOpen(false);
    toast.success('Receipt details loaded!');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!description.trim()) {
      toast.error('Please enter a merchant or description');
      return;
    }

    setSubmitting(true);
    const activeCat = type === 'transfer' ? 'Transfer' : isSplit ? 'Split Transaction' : category || 'Other';

    // Remember last used account
    if (accountId) {
      localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
    }

    // Inline rule creation if checked
    if (alwaysCategorize && description.trim() && category && type !== 'transfer') {
      try {
        await fetch('/api/automation-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Auto: ${description.trim()}`,
            triggerType: 'description_contains',
            triggerValue: description.trim(),
            actionType: 'set_category',
            actionValue: category,
          }),
        });
      } catch {}
    }

    const payload = {
      actionType: 'add' as const,
      type,
      amount: parsedAmount,
      category: activeCat,
      description: description.trim(),
      date,
      notes: notes.trim() || undefined,
      accountId: accountId ? parseInt(accountId, 10) : undefined,
      toAccountId: toAccountId ? parseInt(toAccountId, 10) : undefined,
      splits: isSplit && splits.length > 0 ? splits : undefined,
      isTaxDeductible: isTaxDeductible ? 1 : 0,
      clientMutationId: crypto.randomUUID(),
    };

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to record transaction');

      hapticSuccess();
      toast.success(locale === 'bn' ? 'লেনদেন সফলভাবে সংরক্ষিত' : 'Transaction saved!');
      await invalidateFinancialData();
      mutate((key: string) => typeof key === 'string' && key.startsWith('/api/transactions'));
      onSaveSuccess?.();
      onClose();
    } catch {
      toast.error('Failed to save transaction');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentCategoryList = type === 'expense' ? CATEGORIES_EXPENSE : CATEGORIES_INCOME;
  const activeAccountName = accounts.find((a: any) => String(a.id) === accountId)?.name || 'Account';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Surface */}
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 50, opacity: 0, scale: 0.98 }}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl p-5 sm:p-6 space-y-4 z-10 max-h-[92vh] overflow-y-auto"
      >
        {/* Top Header & Type Switcher */}
        <div className="flex items-center justify-between">
          {/* 3-Pill Type Selector */}
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['expense', 'earning', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  setCategory(t === 'expense' ? 'Food' : t === 'earning' ? 'Salary' : 'Transfer');
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all capitalize ${
                  type === t
                    ? t === 'expense'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : t === 'earning'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'earning' ? 'Income' : t}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Hero Amount Input (auto-focused, tabular-nums) */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
            <span className="text-3xl font-bold text-slate-500">{sym}</span>
            <input
              ref={amountInputRef}
              type="number"
              step="any"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent text-3xl sm:text-4xl font-black text-white outline-none font-mono tabular-nums placeholder:text-slate-700"
            />
          </div>

          {/* Unified Merchant / Smart Description Input with Inline Scanner & Mic */}
          <div className="relative">
            <input
              type="text"
              required
              placeholder="Merchant or phrase (e.g. Starbucks or Lunch 450)..."
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onKeyDown={handleSmartInputKeyDown}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 pr-20 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-500 transition-colors"
            />
            {/* Inline Right Adornment */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
                title="Scan Receipt (OCR)"
              >
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              </button>
              {voiceSupported && (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isListening
                      ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                      : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                  }`}
                  title="Voice Input"
                >
                  <span className="material-symbols-outlined text-[18px]">mic</span>
                </button>
              )}
            </div>
          </div>

          {/* Compact 1-Click Essential Chips (Category, Account, Date) */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Category Chip */}
            {type !== 'transfer' && (
              <button
                type="button"
                onClick={() => setShowCategoryPicker((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold"
              >
                <span className="material-symbols-outlined text-[14px] text-emerald-400">label</span>
                <span>{category || 'Select Category'}</span>
              </button>
            )}

            {/* Account Chip */}
            <button
              type="button"
              onClick={() => setShowAccountPicker((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold"
            >
              <span className="material-symbols-outlined text-[14px] text-sky-400">
                account_balance_wallet
              </span>
              <span>{activeAccountName}</span>
            </button>

            {/* Date Chip */}
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 font-semibold outline-none focus:border-slate-700"
              />
            </div>
          </div>

          {/* Category Picker Popover */}
          {showCategoryPicker && type !== 'transfer' && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {currentCategoryList.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    setCategory(c.label);
                    setShowCategoryPicker(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    category === c.label
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Account Picker Popover */}
          {showAccountPicker && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap gap-1.5">
              {accounts.map((acc: any) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    setAccountId(String(acc.id));
                    setShowAccountPicker(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    accountId === String(acc.id)
                      ? 'bg-sky-500 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {acc.name}
                </button>
              ))}
            </div>
          )}

          {/* Transfer Destination Account */}
          {type === 'transfer' && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="text-xs text-slate-400 font-bold">Transfer to Destination Account</label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2 text-xs text-white"
              >
                <option value="">Select destination account...</option>
                {accounts
                  .filter((a: any) => String(a.id) !== accountId)
                  .map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* 1-Click Subtle Inline Automation Rule Checkbox */}
          {description.trim() && category && type !== 'transfer' && (
            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={alwaysCategorize}
                onChange={(e) => setAlwaysCategorize(e.target.checked)}
                className="rounded border-slate-800 text-emerald-500 focus:ring-0"
              />
              <span>
                Always categorize <strong className="text-slate-200">"{description.trim()}"</strong> as{' '}
                <strong className="text-emerald-400">{category}</strong>
              </span>
            </label>
          )}

          {/* Progressive Disclosure Toggle (+ Split, Tax & Attachments) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsDrawerOpen((v) => !v)}
              className="text-xs font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isDrawerOpen ? 'expand_less' : 'expand_more'}
              </span>
              <span>{isDrawerOpen ? 'Hide advanced options' : '+ Split, Tax & Attachments'}</span>
            </button>
          </div>

          {/* Drawer Content */}
          <AnimatePresence>
            {isDrawerOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-2 overflow-hidden text-xs"
              >
                {/* Split Category Toggle & Builder */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Split Across Multiple Categories</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isSplit;
                        setIsSplit(next);
                        if (next && splits.length === 0) {
                          const half = Math.round(((parseFloat(amount) || 0) / 2) * 100) / 100;
                          const other = Math.round(((parseFloat(amount) || 0) - half) * 100) / 100;
                          setSplits([
                            { id: 'split_1', category: category || 'Food', amount: half, note: '' },
                            { id: 'split_2', category: 'Shopping', amount: other, note: '' },
                          ]);
                        }
                      }}
                      className="text-sky-400 font-bold"
                    >
                      {isSplit ? 'Disable Split' : 'Enable Split'}
                    </button>
                  </div>
                  {isSplit && (
                    <SplitCategoryBuilder
                      splits={splits}
                      onChange={setSplits}
                      totalAmount={parseFloat(amount) || 0}
                      sym={sym}
                      categoryOptions={currentCategoryList.map((c) => c.label)}
                    />
                  )}
                </div>

                {/* Tax Deductible Tag */}
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={isTaxDeductible}
                    onChange={(e) => setIsTaxDeductible(e.target.checked)}
                    className="rounded border-slate-800 text-sky-500 focus:ring-0"
                  />
                  <span>Mark as Tax Deductible (Schedule C / Form 1040)</span>
                </label>

                {/* Notes Input */}
                <div>
                  <input
                    type="text"
                    placeholder="Memo or notes (e.g. client meeting dinner)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white outline-none focus:border-slate-700"
                  />
                </div>

                {/* Attachment File Input */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white cursor-pointer">
                    <span className="material-symbols-outlined text-[16px]">attach_file</span>
                    <span>Attach receipt file</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          setAttachments(Array.from(e.target.files).slice(0, MAX_ATTACHMENT_FILES));
                        }
                      }}
                    />
                  </label>
                  {attachments.length > 0 && (
                    <span className="text-slate-400">{attachments.length} file(s) selected</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{submitting ? 'Saving...' : 'Record Transaction'}</span>
              <span className="material-symbols-outlined text-[18px]">check</span>
            </button>
          </div>
        </form>
      </motion.div>

      {/* Embedded Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={handleScanComplete}
      />
    </div>
  );
}

export const QuickAddTransactionModal: React.FC<QuickAddTransactionModalProps> = (props) => {
  if (props.submitQuickAdd && props.qaAmount !== undefined) {
    return <ControlledQuickAddPanel {...props} />;
  }
  return <AutonomousQuickAddModal {...props} />;
};

export default QuickAddTransactionModal;
