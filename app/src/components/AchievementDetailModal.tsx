import { motion, AnimatePresence } from 'framer-motion';

interface Achievement {
    id: string;
    icon: string;
    title: string;
    description: string;
    progress: number;
    target: number;
    unlocked: boolean;
    category: 'tracking' | 'saving' | 'budget' | 'streak';
    tier: 'bronze' | 'silver' | 'gold' | 'diamond';
}

const TIER_COLORS = {
    bronze: { bg: 'bg-amber-700/10 dark:bg-amber-700/20', border: 'border-amber-600/30', text: 'text-amber-600 dark:text-amber-400', icon: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-600 to-amber-400' },
    silver: { bg: 'bg-gray-300/10 dark:bg-gray-400/10', border: 'border-gray-400/30', text: 'text-gray-500 dark:text-gray-300', icon: 'text-gray-500 dark:text-gray-300', gradient: 'from-gray-500 to-gray-300' },
    gold: { bg: 'bg-yellow-400/10 dark:bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-600 dark:text-yellow-400', icon: 'text-yellow-600 dark:text-yellow-400', gradient: 'from-yellow-600 to-yellow-400' },
    diamond: { bg: 'bg-cyan-400/10 dark:bg-cyan-500/15', border: 'border-cyan-400/30', text: 'text-cyan-600 dark:text-cyan-400', icon: 'text-cyan-600 dark:text-cyan-400', gradient: 'from-cyan-600 to-cyan-400' },
};

export default function AchievementDetailModal({ achievement, isOpen, onClose }: { achievement: Achievement | null; isOpen: boolean; onClose: () => void }) {
    if (!achievement) return null;

    const tier = TIER_COLORS[achievement.tier];
    const progressPercent = achievement.target > 0 ? (achievement.progress / achievement.target) * 100 : 0;
    const isUnlocked = achievement.unlocked;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-[10vh] pb-20 sm:p-0">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-white dark:bg-[#111827] rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10"
                    >
                        {/* Header Background */}
                        <div className={`h-32 w-full bg-gradient-to-br ${isUnlocked ? tier.gradient : 'from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800'} opacity-20`} />
                        
                        <div className="px-6 pb-8 -mt-16 text-center relative z-10">
                            {/* Icon */}
                            <div className={`mx-auto w-24 h-24 rounded-3xl flex items-center justify-center mb-4 border-4 border-white dark:border-[#111827] shadow-xl ${isUnlocked ? tier.bg : 'bg-gray-100 dark:bg-gray-800'} transition-transform hover:scale-105`}>
                                <span className={`material-symbols-outlined text-5xl ${isUnlocked ? tier.icon : 'text-gray-400 dark:text-gray-500'}`} style={{ fontVariationSettings: isUnlocked ? "'FILL' 1" : "'FILL' 0" }}>
                                    {achievement.icon}
                                </span>
                            </div>

                            {/* Title & Badge */}
                            <div className="flex flex-col items-center gap-2 mb-2">
                                {isUnlocked ? (
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${tier.bg} ${tier.text} border ${tier.border}`}>
                                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                                        Unlocked
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                                        <span className="material-symbols-outlined text-[14px]">lock</span>
                                        Locked
                                    </span>
                                )}
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{achievement.title}</h2>
                            </div>
                            
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">{achievement.description}</p>

                            {/* Progress Section */}
                            <div className="text-left bg-gray-50 dark:bg-[#1f2937] rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
                                <div className="flex justify-between items-end mb-3">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Current Progress</p>
                                        <p className="text-lg font-black text-gray-900 dark:text-white">
                                            {achievement.progress} <span className="text-sm font-medium text-gray-500">/ {achievement.target}</span>
                                        </p>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{Math.round(progressPercent)}%</span>
                                </div>
                                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${isUnlocked ? `bg-gradient-to-r ${tier.gradient}` : 'bg-gray-400 dark:bg-gray-500'}`}
                                        style={{ width: `${Math.min(progressPercent, 100)}%` }} 
                                    />
                                </div>
                                {!isUnlocked && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 flex items-start gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] shrink-0 text-primary">info</span>
                                        Keep tracking your finances to reach the target and unlock this {achievement.tier} tier badge!
                                    </p>
                                )}
                                {isUnlocked && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-4 flex items-center gap-1.5 font-medium">
                                        <span className="material-symbols-outlined text-[16px] shrink-0">celebration</span>
                                        Congratulations! You have completed this milestone based on your real financial data.
                                    </p>
                                )}
                            </div>
                            
                            <button 
                                onClick={onClose}
                                className="mt-6 w-full py-3.5 px-4 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-xl transition-all shadow-md active:scale-95"
                            >
                                Awesome
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
