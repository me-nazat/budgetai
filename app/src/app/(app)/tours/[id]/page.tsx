'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TiltCard } from '@/components/ui/TiltCard';

interface Participant {
    id: number;
    name: string;
}

interface Tour {
    id: number;
    name: string;
    created_at: string;
}

interface DashboardData {
    tour: Tour;
    participants: Participant[];
    totalCost: number;
    perPersonAverage: number;
}

export default function TourDashboard({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await fetch(`/api/bill-splits/tours/${params.id}`);
                if (res.ok) {
                    const result = await res.json();
                    setData(result);
                } else {
                    router.push('/tours');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, [params.id, router]);

    const springTransition = { type: "spring" as const, stiffness: 400, damping: 30 };

    if (loading || !data) {
        return (
            <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-pulse">
                <div className="h-10 w-48 bg-gray-200 dark:bg-white/10 rounded-xl" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 h-40 glass-panel" />
                    <div className="h-40 glass-panel" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
            <div className="flex items-center gap-4 mb-8">
                <button 
                    onClick={() => router.push('/tours')}
                    className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-heading tracking-tight">{data.tour.name}</h1>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <span className="material-symbols-outlined text-[16px]">group</span>
                        <span>{data.participants.length} Participants</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Total Cost Bento Box */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springTransition as any}
                    className="md:col-span-2 glass-panel p-8 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-8xl" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Total Trip Cost</h2>
                        <div className="text-5xl font-bold text-gray-900 dark:text-white font-mono tracking-tight mb-4">
                            ${data.totalCost.toFixed(2)}
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-sm font-medium text-gray-600 dark:text-gray-300">
                            <span className="material-symbols-outlined text-[18px]">calculate</span>
                            Per Person Average: ${data.perPersonAverage.toFixed(2)}
                        </div>
                    </div>
                </motion.div>

                {/* Spendings Portal Card */}
                <TiltCard>
                    <Link href={`/tours/${params.id}/spendings`}>
                        <motion.div 
                            layoutId={`tour-spendings-${params.id}`}
                            className="h-full glass-panel p-8 flex flex-col justify-center items-center text-center cursor-pointer relative overflow-hidden group border border-transparent hover:border-primary/30 transition-colors"
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary relative z-10 group-hover:scale-110 transition-transform duration-500">
                                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white relative z-10 mb-1">View Expenses</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 relative z-10">Add and split shared costs</p>
                        </motion.div>
                    </Link>
                </TiltCard>

                {/* Settlement Overview */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springTransition, delay: 0.1 } as any}
                    className="md:col-span-3 glass-panel p-8"
                >
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">handshake</span>
                        Settlement Overview
                    </h2>
                    
                    {data.totalCost === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">payments</span>
                            <p>No expenses logged yet. Add some costs to see who owes whom.</p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-12 text-gray-500 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
                            <p className="text-sm font-medium">Settlement algorithm will calculate balances based on transactions.</p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
