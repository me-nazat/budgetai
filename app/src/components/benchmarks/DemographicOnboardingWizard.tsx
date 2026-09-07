'use client';

/**
 * @fileoverview Feature 11.1: Demographic Opt-In Wizard & Granular Consent.
 * 4-Step Stepper modal collecting age, region, income bracket, and granular metric consents
 * with strict privacy explanation and 44px+ touch targets.
 *
 * @module components/benchmarks/DemographicOnboardingWizard
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

type MetricKey = 'SAVINGS_RATE' | 'NET_WORTH' | 'EMERGENCY_FUND_MONTHS' | 'CATEGORY_SPEND';

export function DemographicOnboardingWizard({ isOpen, onClose, onCompleted }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [ageBracket, setAgeBracket] = useState<'18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+'>('25-34');
  const [regionCode, setRegionCode] = useState('US');
  const [incomeBracket, setIncomeBracket] = useState<'0-30k' | '30k-60k' | '60k-100k' | '100k-150k' | '150k+'>('60k-100k');
  const [employmentSector, setEmploymentSector] = useState('Technology');
  const [selectedMetrics, setSelectedMetrics] = useState<Record<MetricKey, boolean>>({
    SAVINGS_RATE: true,
    NET_WORTH: true,
    EMERGENCY_FUND_MONTHS: true,
    CATEGORY_SPEND: true,
  });

  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleComplete = async () => {
    const activeKeys = Object.entries(selectedMetrics)
      .filter(([_, v]) => v)
      .map(([k]) => k as MetricKey);

    if (activeKeys.length === 0) {
      return toast.error('Please select at least one metric to compare');
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/benchmarking/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ageBracket,
          regionCode,
          incomeBracket,
          employmentSector,
          metrics: activeKeys,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save preferences');
      }

      toast.success('Demographic benchmark profile saved');
      onCompleted();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full sm:max-w-lg bg-surface-primary border border-border-subtle rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === step ? 'w-8 bg-emerald-500' : s < step ? 'w-4 bg-emerald-500/50' : 'w-4 bg-surface-tertiary'
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
            Step {step} of 4
          </span>
        </div>

        {/* Step 1: Welcome & Guarantee */}
        {step === 1 && (
          <div className="space-y-4 text-center py-2">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <span className="material-symbols-outlined text-[36px]">shield</span>
            </div>
            <h3 className="text-xl font-black text-content-primary">Privacy-Preserving Peer Benchmarks</h3>
            <p className="text-xs text-content-muted leading-relaxed max-w-md mx-auto">
              Compare your savings rate, emergency reserve, and category spending against anonymous peers matched by age,
              region, and income bracket.
            </p>

            <div className="p-4 rounded-2xl bg-surface-secondary border border-border-subtle text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                <span>Our Privacy Guarantee</span>
              </div>
              <p className="text-[11px] text-content-muted leading-normal">
                • <strong>Strict k-anonymity:</strong> Comparisons only unlock when at least 30 peers share your cohort.
                <br />
                • <strong>No Raw Numbers Shared:</strong> We share that your savings rate is 22% — never your income, balance, or transactions.
                <br />
                • <strong>Revocable Anytime:</strong> Withdraw consent in 1 tap from Settings.
              </p>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full min-h-[44px] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-colors"
            >
              Continue to Demographics
            </button>
          </div>
        )}

        {/* Step 2: Demographics */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div>
              <h3 className="text-lg font-black text-content-primary">Demographic Profile</h3>
              <p className="text-xs text-content-muted">Matched cohorts ensure comparisons are realistic and relevant</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-content-muted block mb-1">Age Bracket</label>
                <select
                  value={ageBracket}
                  onChange={(e: any) => setAgeBracket(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary focus:ring-2 focus:ring-emerald-500"
                >
                  {['18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map((a) => (
                    <option key={a} value={a}>{a} years old</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-content-muted block mb-1">Region</label>
                  <select
                    value={regionCode}
                    onChange={(e) => setRegionCode(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="US">United States</option>
                    <option value="EU">European Union</option>
                    <option value="UK">United Kingdom</option>
                    <option value="CA">Canada</option>
                    <option value="GLOBAL">Global / Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-content-muted block mb-1">Annual Household Income</label>
                  <select
                    value={incomeBracket}
                    onChange={(e: any) => setIncomeBracket(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary focus:ring-2 focus:ring-emerald-500"
                  >
                    {['0-30k', '30k-60k', '60k-100k', '100k-150k', '150k+'].map((inc) => (
                      <option key={inc} value={inc}>${inc}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 min-h-[44px] py-3 rounded-xl bg-surface-secondary border border-border-subtle text-content-muted text-xs font-bold"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-2 min-h-[44px] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs"
              >
                Next: Granular Consent
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Granular Consent */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div>
              <h3 className="text-lg font-black text-content-primary">Granular Consent Control</h3>
              <p className="text-xs text-content-muted">Choose exactly which metrics you wish to anonymously benchmark</p>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  key: 'SAVINGS_RATE',
                  title: 'Savings Rate (%)',
                  desc: 'Compares your savings percentage of income with peers.',
                },
                {
                  key: 'NET_WORTH',
                  title: 'Net Worth Tier',
                  desc: 'Compares broad financial progress without exposing assets.',
                },
                {
                  key: 'EMERGENCY_FUND_MONTHS',
                  title: 'Emergency Reserve Coverage',
                  desc: 'Months of living expenses held in reserve.',
                },
                {
                  key: 'CATEGORY_SPEND',
                  title: 'Category Spending Distribution',
                  desc: 'Rent, groceries, and dining percentiles.',
                },
              ].map((item) => (
                <div
                  key={item.key}
                  onClick={() => toggleMetric(item.key as MetricKey)}
                  className="p-3.5 rounded-xl bg-surface-secondary border border-border-subtle flex items-center justify-between cursor-pointer hover:border-emerald-500/40 transition-all"
                >
                  <div className="pr-3">
                    <span className="text-xs font-bold text-content-primary block">{item.title}</span>
                    <span className="text-[11px] text-content-muted leading-tight">{item.desc}</span>
                  </div>
                  {/* 56x32 Switch */}
                  <div
                    className={`w-14 h-8 rounded-full p-1 transition-colors flex items-center ${
                      selectedMetrics[item.key as MetricKey] ? 'bg-emerald-500' : 'bg-surface-tertiary'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-white transition-transform ${
                        selectedMetrics[item.key as MetricKey] ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(2)}
                className="flex-1 min-h-[44px] py-3 rounded-xl bg-surface-secondary border border-border-subtle text-content-muted text-xs font-bold"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-2 min-h-[44px] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs"
              >
                Review & Confirm
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="space-y-4 py-2 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <span className="material-symbols-outlined text-[32px]">task_alt</span>
            </div>
            <h3 className="text-xl font-black text-content-primary">Ready to Join Peer Benchmarking</h3>
            <p className="text-xs text-content-muted leading-relaxed">
              Your anonymous profile is assigned to cohort:
            </p>

            <div className="p-4 rounded-xl bg-surface-secondary border border-border-subtle font-mono text-xs text-emerald-400 font-bold">
              {ageBracket} • {regionCode} • {incomeBracket}
            </div>

            <p className="text-[11px] text-content-muted">
              You can revoke any or all sharing at any time from Privacy Settings.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(3)}
                className="flex-1 min-h-[44px] py-3 rounded-xl bg-surface-secondary border border-border-subtle text-content-muted text-xs font-bold"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="flex-2 min-h-[44px] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Confirm & Enable Benchmarking'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
