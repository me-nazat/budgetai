'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlocked: boolean;
    color: string;
}

interface TrophyRoomProps {
    transactionsCount: number;
    savingsRate: number; // percentage 0-100
    monthsActive: number;
    budgetAlertsAvoided: boolean;
}

export default function TrophyRoom({ transactionsCount, savingsRate, monthsActive, budgetAlertsAvoided }: TrophyRoomProps) {
    const achievements: Achievement[] = useMemo(() => [
        {
            id: 'first_step',
            title: 'First Step',
            description: 'Log your first 10 transactions',
            icon: 'directions_walk',
            unlocked: transactionsCount >= 10,
            color: 'bg-blue-500',
        },
        {
            id: 'saver_pro',
            title: 'Super Saver',
            description: 'Achieve a 20%+ savings rate',
            icon: 'savings',
            unlocked: savingsRate >= 20,
            color: 'bg-emerald-500',
        },
        {
            id: 'budget_master',
            title: 'Budget Master',
            description: 'Stay under budget for all categories',
            icon: 'verified_user',
            unlocked: budgetAlertsAvoided,
            color: 'bg-amber-500',
        },
        {
            id: 'veteran',
            title: 'Financial Veteran',
            description: 'Use Budget AI for 3+ months',
            icon: 'workspace_premium',
            unlocked: monthsActive >= 3,
            color: 'bg-cyan-500',
        },
        {
            id: 'hundred_club',
            title: '100 Club',
            description: 'Log 100 total transactions',
            icon: '123',
            unlocked: transactionsCount >= 100,
            color: 'bg-rose-500',
        },
        {
            id: 'fire',
            title: 'FIRE Achiever',
            description: 'Hit a 50%+ savings rate',
            icon: 'local_fire_department',
            unlocked: savingsRate >= 50,
            color: 'bg-orange-500',
        }
    ], [transactionsCount, savingsRate, monthsActive, budgetAlertsAvoided]);

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    return (
        <div className="card-premium rounded-2xl p-6 overflow-hidden relative">
            {/* Background elements */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                            emoji_events
                        </span>
                        Trophy Room
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {unlockedCount} of {achievements.length} achievements unlocked
                    </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center border border-amber-200 dark:border-amber-500/20">
                    <span className="text-amber-600 dark:text-amber-400 font-black text-sm">{unlockedCount}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
                {achievements.map((a, i) => (
                    <motion.div
                        key={a.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1, type: 'spring' }}
                        className={`relative p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
                            a.unlocked 
                                ? 'bg-white dark:bg-[#161b22] border-gray-200 dark:border-white/10 hover:shadow-lg hover:-translate-y-1' 
                                : 'bg-gray-50/50 dark:bg-white/5 border-dashed border-gray-200 dark:border-white/10 opacity-60 grayscale'
                        }`}
                    >
                        <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center text-white shadow-inner ${a.unlocked ? a.color : 'bg-gray-300 dark:bg-gray-700'}`}>
                            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: a.unlocked ? "'FILL' 1" : "'FILL' 0" }}>
                                {a.icon}
                            </span>
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{a.title}</h4>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                            {a.description}
                        </p>
                        
                        {a.unlocked && (
                            <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#161b22] flex items-center justify-center">
                                <span className="material-symbols-outlined text-[10px] text-white font-bold">check</span>
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
