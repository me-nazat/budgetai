'use client';

import { useState } from 'react';
import { RecurringContent } from '@/components/RecurringContent';
import { SubscriptionsContent } from '@/components/SubscriptionsContent';

export default function RecurringSubscriptionsPage() {
    const [activeTab, setActiveTab] = useState<'recurring' | 'subscriptions'>('recurring');

    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
            {/* Header */}
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-xs font-bold uppercase tracking-wider mb-3">
                    <span className="material-symbols-outlined text-[16px]">repeat</span>
                    Automated Finances
                </div>
                <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                    Recurring & Subscriptions
                </h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-xl">
                    Manage your regular income, bills, and subscription services all in one place.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 dark:bg-[#161b22] p-1 rounded-xl mb-8 w-fit border border-gray-200 dark:border-[#30363d]">
                <button
                    onClick={() => setActiveTab('recurring')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'recurring'
                            ? 'bg-white dark:bg-[#21262d] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-[#30363d]'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Recurring Transactions
                </button>
                <button
                    onClick={() => setActiveTab('subscriptions')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'subscriptions'
                            ? 'bg-white dark:bg-[#21262d] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-[#30363d]'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Subscriptions
                </button>
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in" key={activeTab}>
                {activeTab === 'recurring' && <RecurringContent />}
                {activeTab === 'subscriptions' && <SubscriptionsContent />}
            </div>
        </div>
    );
}
