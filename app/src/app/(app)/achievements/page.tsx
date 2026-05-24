'use client';

import useSWR from 'swr';
import { motion } from 'framer-motion';

interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    unlocked: boolean;
}

interface Stats {
    totalTransactions: number;
    totalSavingsGoalsMet: number;
    netWorth: number;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AchievementsPage() {
    const { data, isLoading } = useSWR<{ badges: Badge[], stats: Stats }>('/api/badges', fetcher);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const badges = data?.badges || [];
    const unlockedCount = badges.filter(b => b.unlocked).length;
    const progress = (unlockedCount / (badges.length || 1)) * 100;

    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
            {/* Header */}
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-500 text-xs font-bold uppercase tracking-wider mb-3">
                    <span className="material-symbols-outlined text-[16px]">emoji_events</span>
                    Achievements
                </div>
                <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">Your Milestones</h1>
                <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">Unlock badges by reaching financial milestones and maintaining healthy habits.</p>
            </div>

            {/* Progress */}
            <div className="card-premium rounded-3xl p-6 mb-8 border border-gray-100 dark:border-white/5">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Badge Progress</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            You've unlocked {unlockedCount} of {badges.length} badges
                        </p>
                    </div>
                    <span className="text-2xl font-black text-fuchsia-500">{Math.round(progress)}%</span>
                </div>
                <div className="h-4 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-fuchsia-500 to-primary rounded-full shadow-[0_0_10px_rgba(217,70,239,0.5)]"
                    />
                </div>
            </div>

            {/* Badges Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {badges.map((badge, i) => (
                    <motion.div
                        key={badge.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`card-premium rounded-3xl p-6 border-2 transition-all flex flex-col items-center text-center ${
                            badge.unlocked 
                                ? `border-${badge.color.split('-')[1]}-500/30 bg-gradient-to-b from-white to-${badge.color.split('-')[1]}-50 dark:from-[#1a1f2e] dark:to-${badge.color.split('-')[1]}-500/5 shadow-lg` 
                                : 'border-gray-100 dark:border-white/5 opacity-50 grayscale'
                        }`}
                    >
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-inner ${badge.unlocked ? badge.color : 'bg-gray-200 dark:bg-gray-800'}`}>
                            <span className="material-symbols-outlined text-4xl text-white drop-shadow-md">
                                {badge.icon}
                            </span>
                        </div>
                        <h3 className={`text-lg font-black mb-2 ${badge.unlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                            {badge.name}
                        </h3>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {badge.description}
                        </p>
                        {badge.unlocked && (
                            <div className="mt-4 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                                Unlocked
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
