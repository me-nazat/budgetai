'use client';

import useSWR from 'swr';

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

interface AchievementsData {
    achievements: Achievement[];
    stats: {
        unlocked: number;
        total: number;
        points: number;
        savingsStreak: number;
        budgetStreak: number;
    };
}

const TIER_COLORS = {
    bronze: { bg: 'bg-amber-700/10 dark:bg-amber-700/20', border: 'border-amber-600/30', text: 'text-amber-600 dark:text-amber-400', glow: 'shadow-amber-500/20', icon: 'text-amber-600 dark:text-amber-400' },
    silver: { bg: 'bg-gray-300/10 dark:bg-gray-400/10', border: 'border-gray-400/30', text: 'text-gray-500 dark:text-gray-300', glow: 'shadow-gray-400/20', icon: 'text-gray-500 dark:text-gray-300' },
    gold: { bg: 'bg-yellow-400/10 dark:bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-600 dark:text-yellow-400', glow: 'shadow-yellow-500/20', icon: 'text-yellow-600 dark:text-yellow-400' },
    diamond: { bg: 'bg-cyan-400/10 dark:bg-cyan-500/15', border: 'border-cyan-400/30', text: 'text-cyan-600 dark:text-cyan-400', glow: 'shadow-cyan-400/30', icon: 'text-cyan-600 dark:text-cyan-400' },
};

const CATEGORY_LABELS = {
    tracking: { label: 'Tracking', icon: 'edit_note', color: 'text-blue-500' },
    saving: { label: 'Saving', icon: 'savings', color: 'text-emerald-500' },
    budget: { label: 'Budget', icon: 'account_balance', color: 'text-amber-500' },
    streak: { label: 'Streaks', icon: 'local_fire_department', color: 'text-rose-500' },
};

function AchievementsSkeleton() {
    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
            <div className="h-7 w-64 rounded-lg shimmer-skeleton mb-2" />
            <div className="h-4 w-96 rounded-lg shimmer-skeleton mb-8" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                {[0, 1, 2, 3].map(i => (<div key={i} className="skeleton-panel h-24 rounded-2xl" />))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[0, 1, 2, 3, 4, 5].map(i => (<div key={i} className="skeleton-panel h-40 rounded-2xl" />))}
            </div>
        </div>
    );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
    const tier = TIER_COLORS[achievement.tier];
    const progress = achievement.target > 0 ? (achievement.progress / achievement.target) * 100 : 0;

    return (
        <div className={`card-premium rounded-2xl p-5 relative overflow-hidden transition-all duration-300 group
            ${achievement.unlocked ? `border ${tier.border} ${tier.bg}` : 'opacity-70 grayscale-[30%]'}
            hover:scale-[1.02] hover:shadow-lg`}
        >
            {/* Unlocked glow effect */}
            {achievement.unlocked && (
                <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-30 ${tier.bg}`} />
            )}

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${achievement.unlocked ? `${tier.bg} border ${tier.border}` : 'bg-gray-100 dark:bg-[#21262d] border border-gray-200 dark:border-[#30363d]'} transition-all group-hover:scale-110`}>
                        <span className={`material-symbols-outlined text-xl ${achievement.unlocked ? tier.icon : 'text-gray-400 dark:text-gray-500'}`}
                            style={{ fontVariationSettings: achievement.unlocked ? "'FILL' 1" : "'FILL' 0" }}>
                            {achievement.icon}
                        </span>
                    </div>

                    {achievement.unlocked ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${tier.bg} ${tier.text} border ${tier.border}`}>
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                            Unlocked
                        </span>
                    ) : (
                        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 px-2 py-1 bg-gray-100 dark:bg-[#21262d] rounded-lg">
                            {Math.round(progress)}%
                        </span>
                    )}
                </div>

                {/* Content */}
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">{achievement.title}</h3>
                <p className="text-xs text-gray-500 dark:text-text-muted mb-4">{achievement.description}</p>

                {/* Progress bar */}
                <div className="space-y-1.5">
                    <div className="w-full h-2 bg-gray-100 dark:bg-[#21262d] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${achievement.unlocked ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-text-muted font-medium tabular-nums">
                        {achievement.progress} / {achievement.target}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function AchievementsPage() {
    const { data, isLoading } = useSWR<AchievementsData>('/api/achievements');

    if (isLoading || !data) return <AchievementsSkeleton />;

    const { achievements, stats } = data;
    const categories = ['tracking', 'saving', 'budget', 'streak'] as const;

    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                    <span className="material-symbols-outlined text-yellow-500 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                    Achievements
                </h1>
                <p className="text-sm text-gray-500 dark:text-text-muted mt-1">Track your financial milestones and earn badges</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                {[
                    { label: 'Badges Earned', value: `${stats.unlocked}/${stats.total}`, icon: 'workspace_premium', color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10' },
                    { label: 'Total Points', value: String(stats.points), icon: 'stars', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10' },
                    { label: 'Savings Streak', value: `${stats.savingsStreak} mo`, icon: 'local_fire_department', color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10' },
                    { label: 'Budget Streak', value: `${stats.budgetStreak} mo`, icon: 'shield', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
                ].map((s, i) => (
                    <div key={i} className="card-premium rounded-2xl p-4 lg:p-5" style={{ animation: `slideUp 0.4s ease-out ${i * 0.08}s both` }}>
                        <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider">{s.label}</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Overall progress */}
            <div className="card-premium rounded-2xl p-6 mb-8" style={{ animation: 'slideUp 0.4s ease-out 0.35s both' }}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Overall Progress</h3>
                    <span className="text-sm font-bold text-primary">{Math.round((stats.unlocked / stats.total) * 100)}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 dark:bg-[#161b22] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-500 to-cyan-500 transition-all duration-1000"
                        style={{ width: `${(stats.unlocked / stats.total) * 100}%` }} />
                </div>
                <p className="text-xs text-gray-400 dark:text-text-muted mt-2">{stats.unlocked} of {stats.total} badges unlocked</p>
            </div>

            {/* Achievements by category */}
            {categories.map(cat => {
                const catInfo = CATEGORY_LABELS[cat];
                const catAchievements = achievements.filter(a => a.category === cat);
                if (catAchievements.length === 0) return null;

                return (
                    <div key={cat} className="mb-8">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className={`material-symbols-outlined ${catInfo.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{catInfo.icon}</span>
                            {catInfo.label}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {catAchievements.map(a => <AchievementCard key={a.id} achievement={a} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
