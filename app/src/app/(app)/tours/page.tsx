'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface Tour {
    id: number;
    name: string;
    created_at: string;
}

export default function ToursPage() {
    const [tours, setTours] = useState<Tour[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTours = async () => {
            try {
                const res = await fetch('/api/bill-splits/tours');
                if (res.ok) {
                    const data = await res.json();
                    setTours(data.tours || []);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchTours();
    }, []);

    if (loading) {
        return (
            <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-pulse">
                <div className="h-10 w-48 bg-gray-200 dark:bg-white/10 rounded-xl" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 glass-panel" />
                    ))}
                </div>
            </div>
        );
    }

    const springTransition = { type: "spring" as const, stiffness: 400, damping: 30 };

    return (
        <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-heading tracking-tight">Trip Budgets</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage shared expenses seamlessly</p>
                </div>
                <Link href="/tours/new">
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-primary text-white px-5 py-2.5 rounded-2xl font-semibold shadow-lg shadow-primary/25 hover:bg-blue-600 transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        New Trip
                    </motion.button>
                </Link>
            </div>

            {tours.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 glass-panel text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>flight_takeoff</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No trips yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">Create your first trip budget to split expenses and track shared spending.</p>
                    <Link href="/tours/new">
                        <button className="text-primary font-semibold hover:underline">Create a Trip →</button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tours.map((tour, idx) => (
                        <Link key={tour.id} href={`/tours/${tour.id}`}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ ...springTransition, delay: idx * 0.05 } as any}
                                className="glass-panel p-6 h-full flex flex-col justify-between group hover:border-primary/50 transition-all cursor-pointer"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                            <span className="material-symbols-outlined text-gray-600 dark:text-gray-300 group-hover:text-primary transition-colors">travel</span>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
                                        {tour.name}
                                    </h3>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10 flex items-center justify-between">
                                    <span className="text-xs text-gray-500 font-medium">
                                        {new Date(tour.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className="material-symbols-outlined text-[18px] text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all">
                                        arrow_forward
                                    </span>
                                </div>
                            </motion.div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
