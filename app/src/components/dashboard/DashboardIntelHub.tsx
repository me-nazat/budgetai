'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function HubSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="mb-3 h-3 w-24 rounded-full shimmer-skeleton" />
                    <div className="h-3 w-full rounded-full shimmer-skeleton" />
                    <div className="mt-2 h-2.5 w-2/3 rounded-full shimmer-skeleton" />
                </div>
            ))}
        </div>
    );
}

interface DashboardIntelHubProps {
    currency: string;
    exchangeRates: any;
    marketNews: Array<{ id: number | string; sentiment: string; time: string; title: string; source: string }>;
    fmt: (val: number) => string;
    activeTab: 'currency' | 'news' | 'calculator';
    setActiveTab: (tab: 'currency' | 'news' | 'calculator') => void;
    calcAmount: number;
    setCalcAmount: (val: number) => void;
    calcYears: number;
    setCalcYears: (val: number) => void;
    calcRate: number;
    setCalcRate: (val: number) => void;
}

export const DashboardIntelHub: React.FC<DashboardIntelHubProps> = ({
    currency,
    exchangeRates,
    marketNews,
    fmt,
    activeTab,
    setActiveTab,
    calcAmount,
    setCalcAmount,
    calcYears,
    setCalcYears,
    calcRate,
    setCalcRate,
}) => {
    return (
        <div className="glass-panel rounded-3xl flex flex-col overflow-hidden ambient-glow border border-gray-100 dark:border-white/5">
            <div className="p-5 border-b border-gray-200 dark:border-[#30363d] bg-gradient-to-r from-blue-500/10 to-transparent flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500 text-[22px]">insights</span>
                    Intelligence Hub
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-primary border border-blue-500/20">
                    Live Data
                </span>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-50/70 dark:bg-[#161b22] border-b border-gray-200 dark:border-[#30363d] text-sm">
                <button
                    onClick={() => setActiveTab('currency')}
                    className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${
                        activeTab === 'currency'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    Rates
                </button>
                <button
                    onClick={() => setActiveTab('news')}
                    className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${
                        activeTab === 'news'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    News
                </button>
                <button
                    onClick={() => setActiveTab('calculator')}
                    className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${
                        activeTab === 'calculator'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    Growth
                </button>
            </div>

            {/* Tab Content */}
            <div className="p-5 flex-1 bg-white dark:bg-surface-dark overflow-y-auto max-h-[350px] custom-scrollbar">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, filter: 'blur(4px)', y: 6 }}
                        animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                        exit={{ opacity: 0, filter: 'blur(4px)', y: -6 }}
                        transition={{ duration: 0.18 }}
                        className={`space-y-3.5 ${activeTab === 'calculator' ? 'flex flex-col h-full' : ''}`}
                    >
                        {activeTab === 'currency' ? (
                            <>
                                {!exchangeRates ? (
                                    <HubSkeleton rows={5} />
                                ) : (
                                    <>
                                        <p className="text-xs text-gray-500 dark:text-text-muted mb-2 font-medium">1 {currency} equals:</p>
                                        <div className="space-y-2">
                                            {['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'].map((c) => {
                                                if (c === currency) return null;
                                                const rate = exchangeRates.rates?.[c];
                                                if (!rate) return null;
                                                return (
                                                    <div
                                                        key={c}
                                                        className="flex justify-between items-center group p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors border border-gray-100/50 dark:border-white/5"
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                                {c.slice(0, 2)}
                                                            </div>
                                                            <span className="font-semibold text-gray-900 dark:text-white text-sm">{c}</span>
                                                        </div>
                                                        <span className="font-mono font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary transition-colors text-sm">
                                                            {rate.toFixed(4)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </>
                        ) : activeTab === 'news' ? (
                            <>
                                {marketNews.length === 0 ? (
                                    <HubSkeleton rows={4} />
                                ) : (
                                    marketNews.map((news) => (
                                        <div
                                            key={news.id}
                                            className="block p-3.5 rounded-2xl hover:bg-gray-50 dark:hover:bg-surface-hover border border-gray-150 dark:border-white/5 transition-all hover:scale-[1.01] hover:shadow-sm"
                                        >
                                            <div className="flex justify-between items-start mb-1.5">
                                                <span
                                                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                                        news.sentiment === 'positive'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                                            : news.sentiment === 'negative'
                                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                                                            : 'bg-gray-100 text-gray-700 dark:bg-[#21262d] dark:text-gray-300'
                                                    }`}
                                                >
                                                    {news.sentiment}
                                                </span>
                                                <span className="text-xs text-gray-400 dark:text-text-muted">{news.time}</span>
                                            </div>
                                            <h4 className="text-xs font-bold text-gray-900 dark:text-white leading-snug mb-1 group-hover:text-blue-500 transition-colors">
                                                {news.title}
                                            </h4>
                                            <p className="text-[11px] text-gray-500 dark:text-text-muted font-medium">{news.source}</p>
                                        </div>
                                    ))
                                )}
                            </>
                        ) : activeTab === 'calculator' ? (
                            <>
                                <p className="text-xs text-gray-500 dark:text-text-muted mb-2">
                                    Simulate how systematic savings compound over time.
                                </p>

                                <div className="space-y-3 flex-1">
                                    <div>
                                        <label htmlFor="calcAmount" className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex justify-between">
                                            Monthly Deposit <span>{fmt(calcAmount)}</span>
                                        </label>
                                        <input
                                            id="calcAmount"
                                            type="range"
                                            min="50"
                                            max="5000"
                                            step="50"
                                            value={calcAmount}
                                            onChange={(e) => setCalcAmount(Number(e.target.value))}
                                            className="w-full accent-primary"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="calcYears" className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex justify-between">
                                            Duration <span>{calcYears} yrs</span>
                                        </label>
                                        <input
                                            id="calcYears"
                                            type="range"
                                            min="1"
                                            max="40"
                                            step="1"
                                            value={calcYears}
                                            onChange={(e) => setCalcYears(Number(e.target.value))}
                                            className="w-full accent-primary"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="calcRate" className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex justify-between">
                                            Est. Annual Return <span>{calcRate}%</span>
                                        </label>
                                        <input
                                            id="calcRate"
                                            type="range"
                                            min="1"
                                            max="15"
                                            step="0.5"
                                            value={calcRate}
                                            onChange={(e) => setCalcRate(Number(e.target.value))}
                                            className="w-full accent-primary"
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-center">
                                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                                        Projected Future Value
                                    </p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                                        {fmt(calcAmount * 12 * ((Math.pow(1 + calcRate / 100, calcYears) - 1) / (calcRate / 100)))}
                                    </p>
                                </div>
                            </>
                        ) : null}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};
