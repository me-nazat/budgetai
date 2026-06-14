'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import PageTransition from '@/components/PageTransition';
import { useCurrency } from '@/hooks/useCurrency';
import TourAddCostModal from '@/components/TourAddCostModal';

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

export default function TourSpendingsPage({ params }: { params: { id: string } }) {
    const [tour, setTour] = useState<Tour | null>(null);
    const [participants, setParticipants] = useState<TourParticipant[]>([]);
    const [transactions, setTransactions] = useState<TourTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const { fmt } = useCurrency();
    const router = useRouter();

    const fetchTourData = () => {
        fetch(`/api/bill-splits/tours/${params.id}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setTour(data.tour);
                    setParticipants(data.participants);
                    // Sort transactions newest first
                    setTransactions(data.transactions.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                } else {
                    router.push('/tours');
                }
                setIsLoading(false);
            })
            .catch(() => {
                setIsLoading(false);
                router.push('/tours');
            });
    };

    useEffect(() => {
        fetchTourData();
    }, [params.id, router]);

    if (isLoading) {
        return (
            <div className="p-8 max-w-7xl mx-auto min-h-screen flex items-center justify-center bg-[#0d1117]">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!tour) return null;

    const getParticipantName = (id: number) => {
        return participants.find(p => p.id === id)?.name || 'Unknown';
    };

    return (
        <PageTransition>
            <div className="p-4 lg:p-8 max-w-4xl mx-auto min-h-screen pb-24 bg-[#0d1117] text-white">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                    <div>
                        <Link href={`/tours/${tour.id}`} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-white mb-4 transition-colors w-fit">
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            Back to Dashboard
                        </Link>
                        <h1 className="text-3xl lg:text-5xl font-black uppercase tracking-tight text-white">
                            Tour Spendings
                        </h1>
                        <p className="text-sm font-medium text-gray-400 mt-2">{tour.name}</p>
                    </div>
                    
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Add Expense
                    </button>
                </div>

                {/* Transactions List */}
                <div className="space-y-4">
                    {transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/10 bg-[#161b22] rounded-3xl">
                            <span className="material-symbols-outlined text-5xl text-gray-600 mb-3">receipt_long</span>
                            <h3 className="text-lg font-bold text-white">No spendings yet</h3>
                            <p className="text-sm text-gray-500 mt-1">Add the first expense for this trip.</p>
                        </div>
                    ) : (
                        transactions.map((tx, index) => (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                key={tx.id}
                                className="bg-[#161b22] p-5 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/20 transition-colors shadow-lg"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-[#0d1117] border border-white/5 flex items-center justify-center text-gray-400">
                                        <span className="material-symbols-outlined">
                                            {tx.category.toLowerCase().includes('flight') || tx.category.toLowerCase().includes('travel') ? 'flight' :
                                             tx.category.toLowerCase().includes('food') || tx.category.toLowerCase().includes('dinner') ? 'restaurant' :
                                             tx.category.toLowerCase().includes('hotel') ? 'hotel' : 'receipt'}
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white">{tx.description}</h4>
                                        <p className="text-xs font-medium text-gray-400">
                                            Paid by <span className="font-bold text-gray-300">{getParticipantName(tx.paidBy)}</span> • {new Date(tx.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-rose-500">-{fmt(tx.amount)}</p>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-white/5 px-2 py-1 rounded-md mt-1 inline-block">
                                        {tx.splitType} split
                                    </span>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            <TourAddCostModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                participants={participants}
                tourId={tour.id}
                onSaveSuccess={() => {
                    fetchTourData(); // Refresh list
                }}
            />
        </PageTransition>
    );
}
