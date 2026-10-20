'use client';

import React, { useState } from 'react';
import MonthlyHeatmap from '@/components/MonthlyHeatmap';
import YearlyHeatmap from '@/components/YearlyHeatmap';

interface UnifiedHeatmapCardProps {
    year: number;
    month: number;
    dailySpending: Array<{
        date: string;
        earnings: number;
        expenses: number;
        count?: number;
    }>;
}

export function UnifiedHeatmapCard({ year, month, dailySpending }: UnifiedHeatmapCardProps) {
    const [activeTab, setActiveTab] = useState<'month' | 'year'>('month');

    return (
        <div className="glass-panel p-6 rounded-3xl mb-8 border border-gray-200 dark:border-white/5 bg-white dark:bg-surface-dark shadow-sm">
            {/* Top Bar with Section Title and Tab Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-150 dark:border-white/5">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">calendar_month</span>
                        <span>Activity Heatmaps & Day Drilldown</span>
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                        Inspect discretionary daily spend density, zero-spend days, and outliers
                    </p>
                </div>

                {/* Tab Switcher */}
                <div className="inline-flex items-center p-1 rounded-xl bg-gray-150/70 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setActiveTab('month')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                            activeTab === 'month'
                                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[15px]">calendar_view_month</span>
                        <span>Month Grid</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('year')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                            activeTab === 'year'
                                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[15px]">timeline</span>
                        <span>12-Month Activity</span>
                    </button>
                </div>
            </div>

            {/* Active View Container */}
            <div className="min-h-[360px]">
                {activeTab === 'month' ? (
                    <MonthlyHeatmap
                        year={year}
                        month={month}
                        dailySpending={dailySpending}
                    />
                ) : (
                    <YearlyHeatmap />
                )}
            </div>
        </div>
    );
}

export default UnifiedHeatmapCard;
