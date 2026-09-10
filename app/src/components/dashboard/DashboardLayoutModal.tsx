'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DESKTOP_WIDGET_CATALOG: Record<string, { label: string; icon: string; desc: string }> = {
    net_worth: { label: 'Balance & Key Stats', icon: 'account_balance', desc: 'KPI cards with period comparisons' },
    spending_trends: { label: 'Spending Trends', icon: 'bar_chart', desc: 'Income vs Expense cashflow bar chart' },
    predictive: { label: 'Predictive Cashflow', icon: 'trending_up', desc: 'AI-driven 30-day cash balance forecast' },
    top_categories: { label: 'Top Categories', icon: 'pie_chart', desc: 'Category breakdown doughnut chart' },
    recent_activity: { label: 'Recent Transactions', icon: 'receipt_long', desc: 'Detailed table of recent transactions' },
    budget_alerts: { label: 'Budget Alerts', icon: 'warning', desc: 'Active category spending budget limits' },
    intel_hub: { label: 'Intelligence Hub', icon: 'insights', desc: 'Live exchange rates & financial news' },
    peer_benchmarks: { label: 'Peer Benchmarks', icon: 'leaderboard', desc: 'Anonymous demographic percentile comparison' },
};

const MOBILE_WIDGET_CATALOG: Record<string, { label: string; icon: string; desc: string }> = {
    net_worth: { label: 'Hero Net Worth Card', icon: 'credit_card', desc: 'Vibrant balance card with income/expense pills' },
    quick_stats: { label: 'Quick Stats Pills', icon: 'view_carousel', desc: 'Horizontal scroll of savings rate & burn rate' },
    peer_benchmarks: { label: 'Peer Benchmarks', icon: 'leaderboard', desc: 'Percentile bar vs demographic cohort' },
    ai_insight: { label: 'AI Smart Insight', icon: 'auto_awesome', desc: 'Contextual AI financial advice callout' },
    recent_activity: { label: 'Recent Transactions', icon: 'receipt_long', desc: 'Compact transaction cards' },
    budget_alerts: { label: 'Budget Alerts', icon: 'warning', desc: 'Active budget progress bars' },
    intel_hub: { label: 'Intelligence Hub', icon: 'insights', desc: 'Market news headlines' },
};

interface DashboardLayoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    layoutTab: 'desktop' | 'mobile';
    setLayoutTab: (tab: 'desktop' | 'mobile') => void;
    tempDesktopLayout: string[];
    tempMobileLayout: string[];
    handleMoveDesktop: (index: number, direction: 'up' | 'down') => void;
    handleMoveMobile: (index: number, direction: 'up' | 'down') => void;
    handleToggleDesktop: (widgetId: string) => void;
    handleToggleMobile: (widgetId: string) => void;
    handleDragStart: (index: number) => void;
    handleDragOver: (e: React.DragEvent, index: number) => void;
    handleDrop: (index: number) => void;
    saveLayout: () => Promise<void>;
    layoutSubmitting: boolean;
}

export const DashboardLayoutModal: React.FC<DashboardLayoutModalProps> = ({
    isOpen,
    onClose,
    layoutTab,
    setLayoutTab,
    tempDesktopLayout,
    tempMobileLayout,
    handleMoveDesktop,
    handleMoveMobile,
    handleToggleDesktop,
    handleToggleMobile,
    handleDragStart,
    handleDragOver,
    handleDrop,
    saveLayout,
    layoutSubmitting,
}) => {
    if (!isOpen) return null;

    const catalog = layoutTab === 'desktop' ? DESKTOP_WIDGET_CATALOG : MOBILE_WIDGET_CATALOG;
    const activeList = layoutTab === 'desktop' ? tempDesktopLayout : tempMobileLayout;
    const handleMove = layoutTab === 'desktop' ? handleMoveDesktop : handleMoveMobile;
    const handleToggle = layoutTab === 'desktop' ? handleToggleDesktop : handleToggleMobile;

    const allKeys = Object.keys(catalog);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 14 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-surface-dark"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-gray-150 px-6 py-5 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <span className="material-symbols-outlined text-2xl">dashboard_customize</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Customize Layout</h3>
                            <p className="text-xs text-gray-500 dark:text-text-muted">Reorder, enable, or hide widgets on your dashboard</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                {/* Platform Toggle Tabs */}
                <div className="flex border-b border-gray-150 bg-gray-50/50 px-6 pt-3 dark:border-white/10 dark:bg-black/20">
                    <button
                        onClick={() => setLayoutTab('desktop')}
                        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                            layoutTab === 'desktop'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">desktop_windows</span>
                        <span>Desktop Layout</span>
                    </button>
                    <button
                        onClick={() => setLayoutTab('mobile')}
                        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                            layoutTab === 'mobile'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">smartphone</span>
                        <span>Mobile Layout</span>
                    </button>
                </div>

                {/* Widget Reordering List */}
                <div className="max-h-[50vh] overflow-y-auto p-6 space-y-2.5 custom-scrollbar">
                    <p className="text-xs font-semibold text-gray-400 dark:text-text-muted uppercase tracking-wider mb-2">
                        Active Widgets (Drag or use arrows to reorder)
                    </p>

                    {activeList.map((widgetId, index) => {
                        const info = catalog[widgetId];
                        if (!info) return null;

                        return (
                            <div
                                key={widgetId}
                                draggable={layoutTab === 'desktop'}
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDrop={() => handleDrop(index)}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-3.5 shadow-sm transition-all hover:border-primary/40 dark:border-white/10 dark:bg-surface-dark-2 cursor-grab active:cursor-grabbing"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-[18px]">drag_indicator</span>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-primary dark:bg-white/5">
                                        <span className="material-symbols-outlined text-[20px]">{info.icon}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{info.label}</h4>
                                        <p className="text-xs text-gray-500 dark:text-text-muted truncate">{info.desc}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => handleMove(index, 'up')}
                                        disabled={index === 0}
                                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
                                        title="Move Up"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                                    </button>
                                    <button
                                        onClick={() => handleMove(index, 'down')}
                                        disabled={index === activeList.length - 1}
                                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
                                        title="Move Down"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                                    </button>
                                    <button
                                        onClick={() => handleToggle(widgetId)}
                                        className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                        title="Hide Widget"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">visibility_off</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Inactive / Available Widgets */}
                    {allKeys.filter((k) => !activeList.includes(k)).length > 0 && (
                        <div className="pt-4">
                            <p className="text-xs font-semibold text-gray-400 dark:text-text-muted uppercase tracking-wider mb-2">
                                Available to Add
                            </p>
                            <div className="space-y-2">
                                {allKeys
                                    .filter((k) => !activeList.includes(k))
                                    .map((widgetId) => {
                                        const info = catalog[widgetId];
                                        return (
                                            <div
                                                key={widgetId}
                                                className="flex items-center justify-between rounded-2xl border border-dashed border-gray-300 p-3 opacity-75 dark:border-white/15 dark:bg-black/10"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="material-symbols-outlined text-gray-400 text-[18px]">{info.icon}</span>
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{info.label}</h4>
                                                        <p className="text-xs text-gray-400">{info.desc}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleToggle(widgetId)}
                                                    className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                                    Add
                                                </button>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-gray-150 bg-gray-50/70 px-6 py-4 dark:border-white/10 dark:bg-black/30">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl bg-gray-200/80 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={saveLayout}
                        disabled={layoutSubmitting}
                        className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {layoutSubmitting ? (
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <span className="material-symbols-outlined text-[18px]">check</span>
                        )}
                        <span>Save Layout</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
