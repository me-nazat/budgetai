'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import Link from 'next/link';
import PageTransition from '@/components/PageTransition';
import { useCurrency } from '@/hooks/useCurrency';

interface TourParticipant {
    id: number;
    name: string;
    userId: string;
}

interface TourTransaction {
    id: number;
    amount: number;
    category: string;
    description: string;
    date: string;
    paidBy: number;
    splitType: string;
}

interface Tour {
    id: number;
    name: string;
    createdAt: string;
}

export default function TourDashboard({ params }: { params: { id: string } }) {
    const [tour, setTour] = useState<Tour | null>(null);
    const [participants, setParticipants] = useState<TourParticipant[]>([]);
    const [transactions, setTransactions] = useState<TourTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { fmt } = useCurrency();
    const router = useRouter();

    // 3D Tilt Effect Values
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useTransform(y, [-100, 100], [10, -10]);
    const rotateY = useTransform(x, [-100, 100], [-10, 10]);

    useEffect(() => {
        fetch(`/api/bill-splits/tours/${params.id}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setTour(data.tour);
                    setParticipants(data.participants);
                    setTransactions(data.transactions);
                } else {
                    router.push('/tours');
                }
                setIsLoading(false);
            })
            .catch(() => {
                setIsLoading(false);
                router.push('/tours');
            });
    }, [params.id, router]);

    if (isLoading) {
        return (
            <div className="p-8 max-w-7xl mx-auto min-h-screen flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!tour) return null;

    // Analytics Math
    const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const perPerson = participants.length > 0 ? totalSpent / participants.length : 0;
    
    // Calculate balances (who owes whom) - Simplified equal split model
    const balances = participants.map(p => {
        const paid = transactions.filter(tx => tx.paidBy === p.id).reduce((sum, tx) => sum + tx.amount, 0);
        return { ...p, paid, balance: paid - perPerson };
    });

    return (
        <PageTransition>
            <div className="p-4 lg:p-8 max-w-7xl mx-auto min-h-screen pb-24">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                    <div>
                        <Link href="/tours" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors w-fit">
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            Back to Tours
                        </Link>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary mb-2">Tour Dashboard</p>
                        <h1 className="text-4xl lg:text-6xl font-black uppercase tracking-tight text-gray-900 dark:text-white">
                            {tour.name}
                        </h1>
                    </div>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Total Spent Card */}
                    <div className="glass-panel p-8 rounded-[2rem] md:col-span-2 border border-gray-200 dark:border-white/5 relative overflow-hidden flex flex-col justify-between group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="relative z-10">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Total Trip Expenses</p>
                            <h2 className="text-6xl font-black text-gray-900 dark:text-white">{fmt(totalSpent)}</h2>
                        </div>
                        <div className="relative z-10 mt-8 flex gap-8">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Per Person ({participants.length})</p>
                                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{fmt(perPerson)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Transactions</p>
                                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{transactions.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* 3D Spendings Portal */}
                    <motion.div
                        style={{ perspective: 1000 }}
                        onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const xVal = e.clientX - rect.left - rect.width / 2;
                            const yVal = e.clientY - rect.top - rect.height / 2;
                            x.set(xVal);
                            y.set(yVal);
                        }}
                        onMouseLeave={() => { x.set(0); y.set(0); }}
                        className="h-full"
                    >
                        <motion.div
                            style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
                            className="h-full rounded-[2rem] bg-gradient-to-br from-primary to-cyan-600 p-[2px] shadow-2xl cursor-pointer"
                            onClick={() => router.push(`/tours/${tour.id}/spendings`)}
                        >
                            <div className="h-full w-full rounded-[2rem] bg-[#0d1117] relative overflow-hidden flex flex-col items-center justify-center p-8 group">
                                {/* Portal Effect Background */}
                                <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent opacity-50" />
                                <motion.div 
                                    className="absolute w-32 h-32 bg-primary/30 rounded-full blur-3xl group-hover:bg-primary/50 transition-colors"
                                    style={{ translateZ: 50 }}
                                />
                                
                                <span className="material-symbols-outlined text-5xl text-white mb-4 relative z-10 group-hover:scale-110 transition-transform" style={{ transform: 'translateZ(30px)' }}>receipt_long</span>
                                <h3 className="text-xl font-bold text-white relative z-10" style={{ transform: 'translateZ(20px)' }}>View Spendings</h3>
                                <p className="text-sm font-medium text-gray-400 mt-2 text-center relative z-10" style={{ transform: 'translateZ(10px)' }}>Manage transactions and add new expenses</p>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Balances / Settlement Card */}
                    <div className="glass-panel p-8 rounded-[2rem] md:col-span-3 border border-gray-200 dark:border-white/5">
                        <div className="mb-6 flex justify-between items-end">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Balances</h3>
                                <p className="text-sm font-medium text-gray-500 mt-1">Who paid what & who owes whom.</p>
                            </div>
                            <button className="text-sm font-bold text-primary hover:underline">Settle Up</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {balances.map(p => (
                                <div key={p.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white truncate">{p.name}</h4>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-2">Paid Total: {fmt(p.paid)}</p>
                                    <div className={`mt-3 text-lg font-black ${p.balance > 0 ? 'text-emerald-500' : p.balance < 0 ? 'text-rose-500' : 'text-gray-500'}`}>
                                        {p.balance > 0 ? `Gets back ${fmt(p.balance)}` : p.balance < 0 ? `Owes ${fmt(Math.abs(p.balance))}` : 'Settled'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
}
