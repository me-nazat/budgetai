'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import FinancialMandala from '@/components/generative/FinancialMandala';
import DataRiverChart from '@/components/generative/DataRiverChart';
import GenerativeExporter from '@/components/generative/GenerativeExporter';
import { useDashboard } from '@/hooks/useApi';

export default function GenerativeArtPage() {
    const { data, isLoading: loading, error } = useDashboard('this-month', 'all');
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-rose-500">Error loading data.</p>
            </div>
        );
    }

    const { categorySpending, dailySpending, earnings, expenses } = data;
    const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/70 dark:bg-[#0d1117]/70 backdrop-blur-xl border-b border-gray-200 dark:border-[#30363d] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="w-10 h-10 rounded-full bg-gray-100 dark:bg-surface-dark flex items-center justify-center hover:bg-gray-200 dark:hover:bg-[#30363d] transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500">
                            Generative Studio
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-text-muted">Data-driven SVG storytelling</p>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-12">
                <section>
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Financial Mandala</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Your spending habits, visualized as unique generative geometry.</p>
                        </div>
                        <GenerativeExporter targetId="mandala-export" filename="my-financial-mandala" />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div id="mandala-export" className="relative w-full aspect-square max-w-lg mx-auto bg-white dark:bg-[#161b22] rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center border border-gray-100 dark:border-[#30363d]">
                            <FinancialMandala data={categorySpending} width={400} height={400} />
                            
                            <div className="absolute inset-0 pointer-events-none rounded-3xl border inset-ring ring-black/5 dark:ring-white/5" />
                        </div>
                        
                        <div className="flex flex-col justify-center space-y-4">
                            <h3 className="font-semibold text-lg">Your Unique Pattern</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                This mandala is generated dynamically from your spending data. 
                                The number of nodes, shapes, and color gradients shift based on 
                                your highest expenditure categories. 
                            </p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {categorySpending.slice(0, 5).map((cat, i) => (
                                    <div key={i} className="px-3 py-1 bg-gray-100 dark:bg-surface-dark rounded-full text-xs font-medium border border-gray-200 dark:border-[#30363d]">
                                        {cat.category}: ${cat.total.toFixed(2)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Data River</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Cashflow momentum rendered as fluid wave topologies.</p>
                        </div>
                        <GenerativeExporter targetId="river-export" filename="my-data-river" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="flex flex-col justify-center space-y-4 order-2 lg:order-1">
                            <h3 className="font-semibold text-lg">Cashflow Momentum</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                The fluid background waveform visualizes the balance between your earnings and expenses over time. 
                                A higher savings rate produces smoother, calmer waves, while higher expenses increase volatility.
                            </p>
                            <div className="flex gap-6 mt-4">
                                <div>
                                    <p className="text-xs text-gray-500">Earnings</p>
                                    <p className="font-bold text-emerald-500">${earnings.current.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Expenses</p>
                                    <p className="font-bold text-rose-500">${expenses.current.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        <div id="river-export" className="relative w-full h-[400px] bg-white dark:bg-[#161b22] rounded-3xl overflow-hidden shadow-2xl border border-gray-100 dark:border-[#30363d] order-1 lg:order-2">
                            <DataRiverChart 
                                data={dailySpending}
                                height={400}
                            />
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
