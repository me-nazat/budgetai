'use client';

import YearlyHeatmap from '@/components/YearlyHeatmap';

export default function SpendingHeatmapPage() {
    return (
        <div className="p-4 lg:p-8 max-w-[1500px] mx-auto page-enter pb-24">
            <header className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Analytics</p>
                <h1 className="mt-2 text-2xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">Activity Heatmap</h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-text-muted">
                    Visualize your daily financial activity across the entire year, inspired by GitHub's contribution graph.
                </p>
            </header>

            <div className="card-premium rounded-3xl p-2 sm:p-6 border border-gray-100 dark:border-white/5 bg-surface dark:bg-surface-dark shadow-sm">
                <YearlyHeatmap />
            </div>
        </div>
    );
}
