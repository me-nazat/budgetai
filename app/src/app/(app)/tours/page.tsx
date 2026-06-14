'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import PageTransition from '@/components/PageTransition';

interface Tour {
    id: number;
    name: string;
    participants: { id: number; name: string }[];
    createdAt: string;
}

export default function ToursPage() {
    const [tours, setTours] = useState<Tour[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetch('/api/bill-splits/tours')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setTours(data.tours);
                }
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    }, []);

    return (
        <PageTransition>
            <div className="p-4 lg:p-8 max-w-7xl mx-auto min-h-screen">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary mb-2">Shared Expenses</p>
                        <h1 className="text-4xl lg:text-6xl font-black uppercase tracking-tight text-gray-900 dark:text-white">
                            Tour Budget Manager
                        </h1>
                        <p className="text-lg font-medium text-gray-500 mt-2">Create trips, add friends, split expenses.</p>
                    </div>
                    <Link
                        href="/tours/new"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Create New Tour
                    </Link>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-48 rounded-3xl bg-gray-100 dark:bg-white/5 animate-pulse" />
                        ))}
                    </div>
                ) : tours.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-3xl glass-panel">
                        <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">flight_takeoff</span>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">No tours yet</h3>
                        <p className="text-gray-500 mt-2">Start your journey by creating a new tour budget.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tours.map((tour, index) => (
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: index * 0.1, ease: [0.34, 1.56, 0.64, 1] }}
                                key={tour.id}
                                onClick={() => router.push(`/tours/${tour.id}`)}
                                className="glass-panel p-6 rounded-3xl text-left border border-gray-200 dark:border-white/5 hover:border-primary/50 transition-colors group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex justify-between items-start mb-6 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                        <span className="material-symbols-outlined">map</span>
                                    </div>
                                    <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full">
                                        {new Date(tour.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 relative z-10">{tour.name}</h3>
                                <p className="text-sm font-medium text-gray-500 flex items-center gap-2 relative z-10">
                                    <span className="material-symbols-outlined text-[16px]">group</span>
                                    {tour.participants.length} Participants
                                </p>
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>
        </PageTransition>
    );
}
