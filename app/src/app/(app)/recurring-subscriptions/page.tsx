'use client';

import { useState } from 'react';
import { RecurringContent } from '@/components/RecurringContent';
import { SubscriptionsContent } from '@/components/SubscriptionsContent';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RecurringSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'recurring'>('subscriptions');
  const { t } = useLanguage();

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
      {/* Page Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
          <span className="material-symbols-outlined text-[16px]">autorenew</span>
          {t('subscriptionsPage.title')}
        </div>
        <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          Recurring & Subscription Intelligence
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
          Automated subscription renewal tracking, anomalous price-hike detection, free-trial countdowns, and 30-day bill forecasting.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-surface-dark p-1 rounded-xl mb-8 w-fit border border-gray-200 dark:border-[#30363d]">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'subscriptions'
              ? 'bg-white dark:bg-[#1a202c] text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200 dark:border-white/10'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">credit_card</span>
          Subscriptions & Memberships
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'recurring'
              ? 'bg-white dark:bg-[#1a202c] text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200 dark:border-white/10'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">repeat</span>
          Recurring Ledger & Income
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === 'subscriptions' && <SubscriptionsContent />}
        {activeTab === 'recurring' && <RecurringContent />}
      </div>
    </div>
  );
}
