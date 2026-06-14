import React from 'react';

export default function Loading() {
    return (
        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto min-h-[60vh] flex flex-col">
            <div className="mb-8 flex items-center justify-between gap-4">
                <div className="space-y-3">
                    <div className="h-8 w-64 rounded-xl shimmer-skeleton bg-gray-200 dark:bg-white/5" />
                    <div className="h-4 w-96 max-w-full rounded-xl shimmer-skeleton bg-gray-200 dark:bg-white/5" />
                </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8 stagger-children">
                {[0, 1, 2, 3].map(item => (
                    <div key={item} className="p-6 rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-surface-dark/50 shadow-sm glass-panel breathe">
                        <div className="mb-6 h-12 w-12 rounded-2xl shimmer-skeleton bg-gray-200 dark:bg-white/5" />
                        <div className="h-3 w-24 rounded-full shimmer-skeleton bg-gray-200 dark:bg-white/5 mb-3" />
                        <div className="h-8 w-36 rounded-full shimmer-skeleton bg-gray-200 dark:bg-white/5" />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 flex-1 stagger-children">
                <div className="lg:col-span-2 rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-surface-dark/50 p-6 min-h-[360px] shimmer-skeleton glass-panel breathe" style={{ animationDelay: '100ms' }} />
                <div className="rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-surface-dark/50 p-6 min-h-[360px] shimmer-skeleton glass-panel breathe" style={{ animationDelay: '200ms' }} />
            </div>
        </div>
    );
}
