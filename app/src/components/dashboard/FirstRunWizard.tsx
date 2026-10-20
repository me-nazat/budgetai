'use client';

/**
 * @fileoverview 3-Step, 60-Second First-Run Setup Wizard.
 *
 * Automatically triggered when a new user logs in with zero accounts
 * or when onboarding is incomplete. Seeds:
 * 1. Base Currency & Interface Language
 * 2. Primary Account (Bank, Mobile Wallet, Cash, Savings) + Opening Balance
 * 3. Monthly Income & Fixed Envelopes (Housing, Groceries, Transport, Utilities)
 *
 * Submits in parallel to /api/settings, /api/accounts, and /api/budgets,
 * and seamlessly reveals a fully populated Command Center dashboard.
 *
 * @module components/dashboard/FirstRunWizard
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { useLanguage } from '@/contexts/LanguageContext';
import { CURRENCIES, CurrencyCode } from '@/lib/currency';

interface FirstRunWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

interface AccountDraft {
  name: string;
  type: 'bank' | 'mobile_wallet' | 'cash' | 'card' | 'other';
  balance: number | string;
  colorTag: string;
}

const ACCOUNT_PRESETS = [
  { label: 'Bank Checking Account', name: 'Main Checking', type: 'bank' as const, colorTag: '#10b981', icon: 'account_balance' },
  { label: 'Mobile Wallet (bKash / Nagad)', name: 'bKash Personal', type: 'mobile_wallet' as const, colorTag: '#06b6d4', icon: 'smartphone' },
  { label: 'Cash Wallet', name: 'Cash in Hand', type: 'cash' as const, colorTag: '#f59e0b', icon: 'payments' },
  { label: 'Savings Account', name: 'High-Yield Savings', type: 'bank' as const, colorTag: '#3b82f6', icon: 'savings' },
];

export function FirstRunWizard({ onComplete, onSkip }: FirstRunWizardProps) {
  const { currency, setCurrency } = useCurrency();
  const { locale, setLocale } = useLanguage();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Regional Preferences
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>((currency as CurrencyCode) || 'BDT');
  const [selectedLocale, setSelectedLocale] = useState<'en' | 'bn'>(locale || 'en');

  // Step 2: Primary Account(s)
  const [accounts, setAccounts] = useState<AccountDraft[]>([
    { name: 'Main Checking', type: 'bank', balance: '50000', colorTag: '#10b981' }
  ]);

  // Step 3: Income & Essential Envelopes
  const [monthlyIncome, setMonthlyIncome] = useState<number | string>('80000');
  const [envelopes, setEnvelopes] = useState<{ [category: string]: number | string }>({
    'Rent / Housing': '25000',
    'Groceries & Dining': '15000',
    'Transport': '5000',
    'Utilities & Subscriptions': '6000',
  });

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#10B981', '#06B6D4', '#3B82F6', '#F59E0B']
      });
    } catch {
      // Non-critical celebration
    }
  };

  const applyPreset = (preset: typeof ACCOUNT_PRESETS[0], index = 0) => {
    const updated = [...accounts];
    updated[index] = {
      name: preset.name,
      type: preset.type,
      balance: updated[index]?.balance || '0',
      colorTag: preset.colorTag,
    };
    setAccounts(updated);
  };

  const addAnotherAccount = () => {
    setAccounts([
      ...accounts,
      { name: 'Cash in Hand', type: 'cash', balance: '5000', colorTag: '#f59e0b' }
    ]);
  };

  const removeAccount = (index: number) => {
    if (accounts.length <= 1) return;
    setAccounts(accounts.filter((_, i) => i !== index));
  };

  const handleLaunchCommandCenter = async () => {
    setSubmitting(true);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    try {
      // 1. Sync regional settings
      setCurrency(selectedCurrency);
      setLocale(selectedLocale);
      const settingsPromise = fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: selectedCurrency }),
      });

      // 2. Create accounts
      const accountsPromises = accounts.map(acc =>
        fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: acc.name.trim() || 'Primary Account',
            type: acc.type,
            currency: selectedCurrency,
            openingBalance: Number(acc.balance) || 0,
            colorTag: acc.colorTag || '#10b981',
          }),
        })
      );

      // 3. Create initial budget envelopes
      const budgetPromises = Object.entries(envelopes)
        .filter(([_, limit]) => Number(limit) > 0)
        .map(([category, limit]) =>
          fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category,
              monthlyLimit: Number(limit),
              month: currentMonth,
              year: currentYear,
            }),
          })
        );

      // 4. If monthly income entered, record an initial monthly income transaction for positive liquidity
      let incomePromise = Promise.resolve();
      if (Number(monthlyIncome) > 0) {
        incomePromise = fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'earning',
            amount: Number(monthlyIncome),
            category: 'Salary',
            description: 'Initial Monthly Net Income',
            date: now.toISOString().split('T')[0],
          }),
        }).then(() => {});
      }

      await Promise.all([settingsPromise, ...accountsPromises, ...budgetPromises, incomePromise]);

      if (typeof window !== 'undefined') {
        localStorage.setItem('wealth-ai-onboarding-completed', 'true');
      }

      triggerConfetti();
      toast.success(selectedLocale === 'bn' ? 'কমান্ড সেন্টার প্রস্তুত!' : 'Your Command Center is live!');
      onComplete();
    } catch (err) {
      console.error('[FirstRunWizard] Setup error:', err);
      toast.error('Setup encountered an issue. Launching dashboard with defaults.');
      if (typeof window !== 'undefined') {
        localStorage.setItem('wealth-ai-onboarding-completed', 'true');
      }
      onComplete();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wealth-ai-onboarding-completed', 'true');
    }
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl p-6 sm:p-8 text-slate-100 relative overflow-hidden"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />

        {/* Wizard Header & Progress Bar */}
        <div className="relative mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs uppercase tracking-wider font-bold text-emerald-400">
                60-Second Onboarding Wizard
              </span>
            </div>
            <button
              onClick={handleSkip}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-slate-800"
            >
              Skip setup →
            </button>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  s <= step ? 'bg-emerald-400' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Dynamic Wizard Steps */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Step 1: Currency & Language</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Confirm your base financial denomination and interface language.
                </p>
              </div>

              {/* Currency Grid */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Base Currency</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['BDT', 'USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'] as CurrencyCode[]).map((c) => {
                    const info = CURRENCIES[c];
                    const isSelected = selectedCurrency === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedCurrency(c)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base">{info.flag}</span>
                          <span className="font-mono font-bold text-xs">{info.symbol}</span>
                        </div>
                        <p className="font-bold text-xs mt-1 text-white">{info.code}</p>
                        <p className="text-[10px] text-slate-400 truncate">{info.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interface Language */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Interface Language</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedLocale('en')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedLocale === 'en'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="font-bold text-xs text-white">English (US)</p>
                    <p className="text-[10px] text-slate-400">Default global currency & formatting</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLocale('bn')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedLocale === 'bn'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="font-bold text-xs text-white">বাংলা (Bengali)</p>
                    <p className="text-[10px] text-slate-400">লাখ/কোটি ও স্থানীয় মুদ্রা ফরম্যাটিং</p>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                >
                  <span>Continue to Accounts</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Step 2: Add Your Primary Account</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Connect your liquid cash accounts to calibrate your Safe-to-Spend balance.
                </p>
              </div>

              {/* Presets Row */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400">Quick Presets</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ACCOUNT_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyPreset(preset, 0)}
                      className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 text-left transition-all"
                    >
                      <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                        <span className="material-symbols-outlined text-[16px]">{preset.icon}</span>
                        <span className="text-[10px] font-bold truncate">{preset.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 capitalize">{preset.type.replace('_', ' ')}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Accounts Input List */}
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {accounts.map((acc, index) => (
                  <div key={index} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 relative group">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={acc.name}
                          onChange={(e) => {
                            const updated = [...accounts];
                            updated[index].name = e.target.value;
                            setAccounts(updated);
                          }}
                          placeholder="Account Name"
                          className="w-full bg-transparent font-bold text-xs text-white outline-none placeholder-slate-600 focus:border-b focus:border-emerald-500"
                        />
                      </div>
                      {accounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAccount(index)}
                          className="text-slate-500 hover:text-rose-400 transition-colors"
                          title="Remove account"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Account Type</label>
                        <select
                          value={acc.type}
                          onChange={(e) => {
                            const updated = [...accounts];
                            updated[index].type = e.target.value as any;
                            setAccounts(updated);
                          }}
                          className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2 py-1.5 text-xs text-slate-300 outline-none"
                        >
                          <option value="bank">Bank Account</option>
                          <option value="mobile_wallet">Mobile Wallet</option>
                          <option value="cash">Cash Wallet</option>
                          <option value="card">Credit / Debit Card</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                          Current Balance ({selectedCurrency})
                        </label>
                        <input
                          type="number"
                          value={acc.balance}
                          onChange={(e) => {
                            const updated = [...accounts];
                            updated[index].balance = e.target.value;
                            setAccounts(updated);
                          }}
                          placeholder="0.00"
                          className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-emerald-400 outline-none tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={addAnotherAccount}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  <span>+ Add another account</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                  >
                    <span>Continue to Envelopes</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Step 3: Income & Essential Envelopes</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Establish monthly net income and recurring envelopes to lock in your Daily Safe-to-Spend.
                </p>
              </div>

              {/* Monthly Income Input */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Estimated Monthly Net Income ({selectedCurrency})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-emerald-400 text-xs">
                    {CURRENCIES[selectedCurrency]?.symbol || '$'}
                  </span>
                  <input
                    type="number"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white outline-none focus:border-emerald-500 tabular-nums"
                  />
                </div>
              </div>

              {/* Envelopes Grid */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Monthly Essential Envelopes</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(envelopes).map(([category, amount]) => (
                    <div key={category} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-300 truncate block">{category}</span>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
                          {CURRENCIES[selectedCurrency]?.symbol || '$'}
                        </span>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setEnvelopes({ ...envelopes, [category]: e.target.value })}
                          className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-slate-200 outline-none tabular-nums"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all disabled:opacity-50"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleLaunchCommandCenter}
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-xl shadow-emerald-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Configuring Command Center...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                      <span>Launch My Command Center</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default FirstRunWizard;
