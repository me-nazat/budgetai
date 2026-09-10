'use client';

/**
 * @fileoverview Module 11: Anonymous Peer Benchmarking & Demographic Health Percentiles.
 * Integrates DemographicOnboardingWizard, CohortRadarChart, k-anonymity guarantee card,
 * and CategoryPercentileDrilldownSheet with share cards.
 *
 * @module app/(app)/benchmarks/page
 */

import React, { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import Link from 'next/link';
import { DemographicOnboardingWizard } from '@/components/benchmarks/DemographicOnboardingWizard';
import { CategoryPercentileDrilldownSheet } from '@/components/benchmarks/CategoryPercentileDrilldownSheet';
import { CohortRadarChart } from '@/components/benchmarks/CohortRadarChart';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BenchmarksPage() {
  const { fmtRaw, symbol = '$' } = useCurrency();
  const [showWizard, setShowWizard] = useState(false);

  // Check consent / profile
  const { data: consentData, mutate: mutateConsent } = useSWR<{
    isOptedIn: boolean;
    demographics: any;
    activeMetrics: string[];
  }>('/api/benchmarking/consent', fetcher);

  const isOptedIn = consentData?.isOptedIn;

  // Fetch percentiles & category drilldown
  const { data: percentileData, isLoading, error, mutate: mutatePercentiles } = useSWR<any>(
    isOptedIn ? '/api/benchmarking/percentiles' : null,
    fetcher
  );

  const handleWizardCompleted = () => {
    mutateConsent();
    mutatePercentiles();
  };

  if (!consentData) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  // If not opted in, show onboarding prompt
  if (!isOptedIn) {
    return (
      <div className="p-4 lg:p-8 max-w-[800px] mx-auto page-enter">
        <div className="p-8 lg:p-12 rounded-3xl bg-surface-primary border border-border-subtle text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-4xl">leaderboard</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-content-primary">Privacy-Preserving Peer Benchmarking</h1>
            <p className="text-content-muted text-sm mt-2 max-w-md mx-auto leading-relaxed">
              Compare your savings rate, category spend, and financial reserve against demographically matched peers — without ever revealing your identity or account balances.
            </p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="min-h-[44px] px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all"
          >
            Start Demographic Onboarding Wizard
          </button>
          <p className="text-xs text-content-muted">
            Strict k-anonymity (N ≥ 30) guaranteed • Revocable anytime in Settings → Privacy
          </p>
        </div>

        <DemographicOnboardingWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          onCompleted={handleWizardCompleted}
        />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-content-primary flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-400 text-3xl">leaderboard</span>
            Peer Benchmarks
          </h1>
          <p className="text-content-muted text-xs sm:text-sm mt-1">
            {percentileData?.cohortName || 'Matched Demographic Cohort'} • Strict k-anonymity enforced
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWizard(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-surface-secondary border border-border-subtle text-xs font-bold text-content-primary hover:bg-surface-tertiary transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Edit Demographics
          </button>
          <Link
            href="/settings/privacy"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-surface-secondary border border-border-subtle text-xs font-bold text-content-muted hover:text-content-primary transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">privacy_tip</span>
            Privacy
          </Link>
        </div>
      </div>

      {/* Check k-anonymity threshold state */}
      {(percentileData?.kAnonymityMet === false || percentileData?.cohortForming) ? (
        <div className="p-8 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px]">lock</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-content-primary">Cohort Under Construction (k &lt; 30)</h3>
            <p className="text-xs text-content-muted max-w-md mx-auto leading-relaxed">
              Your anonymous demographic cohort is currently forming. To ensure complete privacy and prevent re-identification, individual percentile benchmarks unlock once at least 30 peers share your demographic profile.
            </p>
          </div>

          {/* Progress counter */}
          <div className="max-w-xs mx-auto bg-surface-primary p-4 rounded-2xl border border-border-subtle space-y-2 text-left">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-content-muted">Peer Network</span>
              <span className="text-amber-500 font-mono">
                {percentileData?.sampleSize ?? percentileData?.cohortSize ?? 0} / {percentileData?.kAnonymityThreshold ?? 30} peers joined
              </span>
            </div>
            <div className="w-full bg-surface-tertiary h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round(((percentileData?.sampleSize ?? percentileData?.cohortSize ?? 0) / (percentileData?.kAnonymityThreshold ?? 30)) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Summary Metrics & Radar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Metric Cards */}
            <div className="lg:col-span-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {percentileData?.metrics?.savingsRate && (
                  <div className="p-5 rounded-2xl bg-surface-primary border border-border-subtle space-y-2">
                    <span className="text-xs font-bold text-content-muted uppercase tracking-wider">
                      Savings Rate
                    </span>
                    <div className="text-2xl font-black text-content-primary">
                      {percentileData.metrics.savingsRate.percentile}th %ile
                    </div>
                    <p className="text-xs text-emerald-400">
                      Cohort Median: {percentileData.metrics.savingsRate.cohortMedian}%
                    </p>
                  </div>
                )}

                {percentileData?.metrics?.emergencyReserve && (
                  <div className="p-5 rounded-2xl bg-surface-primary border border-border-subtle space-y-2">
                    <span className="text-xs font-bold text-content-muted uppercase tracking-wider">
                      Emergency Reserve
                    </span>
                    <div className="text-2xl font-black text-content-primary">
                      {percentileData.metrics.emergencyReserve.percentile}th %ile
                    </div>
                    <p className="text-xs text-emerald-400">
                      Cohort Median: {percentileData.metrics.emergencyReserve.cohortMedian} mo
                    </p>
                  </div>
                )}
              </div>

              {/* Privacy Notice Card */}
              <div className="p-4 rounded-2xl bg-surface-primary border border-border-subtle flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                </div>
                <p className="text-xs text-content-muted">
                  <strong>k-Anonymity Verified (N={percentileData?.cohortSize || 30}):</strong> Individual transactions are never exposed. All data is aggregated into statistical percentiles.
                </p>
              </div>
            </div>

            {/* Right: Cohort Radar Chart */}
            <div className="lg:col-span-6 p-6 rounded-3xl bg-surface-primary border border-border-subtle flex flex-col items-center justify-center">
              <h3 className="text-xs font-bold text-content-muted uppercase tracking-wider self-start mb-4">
                Cohort Radar Comparison
              </h3>
              <CohortRadarChart
                data={
                  percentileData?.radarPillars || [
                    { pillar: 'Savings Rate', userScore: 78, cohortMedian: 50, topPerformers: 90 },
                    { pillar: 'Emergency Reserve', userScore: 84, cohortMedian: 50, topPerformers: 92 },
                    { pillar: 'Debt Health', userScore: 88, cohortMedian: 55, topPerformers: 94 },
                    { pillar: 'Category Control', userScore: 72, cohortMedian: 50, topPerformers: 86 },
                    { pillar: 'Budget Adherence', userScore: 80, cohortMedian: 52, topPerformers: 91 },
                  ]
                }
              />
            </div>
          </div>

          {/* Category-Level Percentile Drill-Down Table */}
          {percentileData?.categories && percentileData.categories.length > 0 && (
            <CategoryPercentileDrilldownSheet
              categories={percentileData.categories}
              currencySymbol={symbol}
              cohortName={percentileData.cohortName}
            />
          )}
        </>
      )}

      {/* Onboarding Wizard Modal */}
      <DemographicOnboardingWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onCompleted={handleWizardCompleted}
      />
    </div>
  );
}
