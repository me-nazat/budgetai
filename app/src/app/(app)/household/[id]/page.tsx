'use client';

/**
 * @fileoverview Module 10: Advanced Multi-Member Household Budgeting & Automated Split Settlements Workspace.
 * Deep-linked workspace at /household/[id] offering:
 * - Tab 1: Allocations (HouseholdAllocationWheel with circular arc & vertical stacked bar parity)
 * - Tab 2: Recurring Bills (HouseholdRecurringBillsModal with Equal / Percentage / Fixed split editor)
 * - Tab 3: Settlements (HouseholdSettlementsCardStack with minimal debt flow & one-tap confirmations)
 *
 * @module app/(app)/household/[id]/page
 */

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import { HouseholdAllocationWheel } from '@/components/household/HouseholdAllocationWheel';
import { HouseholdRecurringBillsModal } from '@/components/household/HouseholdRecurringBillsModal';
import { HouseholdSettlementsCardStack } from '@/components/household/HouseholdSettlementsCardStack';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function HouseholdWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { symbol = '$' } = useCurrency();
  const idStr = Array.isArray(params.id) ? params.id[0] : params.id;
  const householdId = parseInt(idStr || '0', 10);

  const [activeTab, setActiveTab] = useState<'allocations' | 'bills' | 'settlements'>('allocations');

  const { data, error, isLoading } = useSWR<{ households: Array<{ id: number; name: string; inviteCode: string }> }>(
    '/api/households',
    fetcher
  );

  const currentHousehold = data?.households?.find((h) => h.id === householdId);

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-content-muted mb-1">
            <Link href="/household" className="hover:text-content-primary transition-colors">
              Households
            </Link>
            <span>/</span>
            <span className="text-emerald-400">{currentHousehold?.name || `Household #${householdId}`}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-content-primary tracking-tight">
            {currentHousehold?.name || 'Family Finance Workspace'}
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-0.5">
            Unified budget caps, recurring auto-splits, and minimal debt settlements
          </p>
        </div>

        <Link
          href="/household"
          className="min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl bg-surface-secondary border border-border-subtle hover:bg-surface-tertiary transition-colors flex items-center gap-1.5 text-content-primary"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          All Households
        </Link>
      </div>

      {/* 3 Premium Module 10 Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-surface-primary border border-border-subtle max-w-md">
        {(
          [
            { id: 'allocations', label: 'Allocations', icon: 'pie_chart' },
            { id: 'bills', label: 'Recurring Bills', icon: 'autorenew' },
            { id: 'settlements', label: 'Settlements', icon: 'handshake' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-content-muted hover:text-content-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab View */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'allocations' && (
            <HouseholdAllocationWheel householdId={householdId} currencySymbol={symbol} />
          )}
          {activeTab === 'bills' && (
            <HouseholdRecurringBillsModal householdId={householdId} currencySymbol={symbol} />
          )}
          {activeTab === 'settlements' && (
            <HouseholdSettlementsCardStack householdId={householdId} currencySymbol={symbol} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
