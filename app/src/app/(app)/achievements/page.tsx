'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Flame, Target, Brain, TrendingUp, Star, Lock,
  Sparkles, Zap, Shield, Globe, PiggyBank,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  category: string;
}

const achievements: Achievement[] = [
  { id: '1', title: 'First Steps', description: 'Log your first transaction', icon: Zap, unlocked: true, progress: 1, maxProgress: 1, tier: 'bronze', category: 'Getting Started' },
  { id: '2', title: 'Budget Master', description: 'Stay under budget for 3 months', icon: Target, unlocked: true, progress: 3, maxProgress: 3, tier: 'silver', category: 'Budgeting' },
  { id: '3', title: 'Net Worth 1L', description: 'Reach 100,000 BDT net worth', icon: TrendingUp, unlocked: true, progress: 100000, maxProgress: 100000, tier: 'gold', category: 'Milestones' },
  { id: '4', title: 'Net Worth 10L', description: 'Reach 1,000,000 BDT net worth', icon: Trophy, unlocked: false, progress: 650000, maxProgress: 1000000, tier: 'platinum', category: 'Milestones' },
  { id: '5', title: 'AI Whisperer', description: 'Chat with AI Coach 50 times', icon: Brain, unlocked: false, progress: 32, maxProgress: 50, tier: 'silver', category: 'AI Coach' },
  { id: '6', title: 'Streak King', description: 'Log transactions for 30 days straight', icon: Flame, unlocked: true, progress: 30, maxProgress: 30, tier: 'gold', category: 'Streaks' },
  { id: '7', title: 'Globetrotter', description: 'Create 5 tours', icon: Globe, unlocked: false, progress: 3, maxProgress: 5, tier: 'bronze', category: 'Tours' },
  { id: '8', title: 'Savings Guru', description: 'Save 50% of income for 6 months', icon: PiggyBank, unlocked: false, progress: 4, maxProgress: 6, tier: 'platinum', category: 'Savings' },
  { id: '9', title: 'Security First', description: 'Enable 2FA and passkey', icon: Shield, unlocked: true, progress: 2, maxProgress: 2, tier: 'silver', category: 'Security' },
  { id: '10', title: 'Star Collector', description: 'Unlock 10 achievements', icon: Star, unlocked: false, progress: 5, maxProgress: 10, tier: 'gold', category: 'Special' },
];

const tierConfig = {
  bronze: { gradient: 'from-amber-700 to-amber-600', glow: 'shadow-amber-500/20', text: 'text-amber-400' },
  silver: { gradient: 'from-slate-400 to-slate-300', glow: 'shadow-slate-400/20', text: 'text-slate-300' },
  gold: { gradient: 'from-amber-400 to-yellow-300', glow: 'shadow-amber-400/30', text: 'text-amber-300' },
  platinum: { gradient: 'from-emerald-400 to-cyan-300', glow: 'shadow-emerald-400/30', text: 'text-emerald-300' },
};

export default function AchievementsPage() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Achievements</h1>
          <p className="text-sm text-text-secondary mt-1">{unlockedCount} of {totalCount} unlocked</p>
        </div>
        {/* Level Badge */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl glass border border-border-default">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 flex items-center justify-center shadow-glow-amber">
            <Trophy size={18} className="text-amber-900" />
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Current Level</p>
            <p className="text-sm font-semibold text-amber-300">Gold</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Progress to Platinum</span>
          <span className="text-text-primary font-mono">{Math.round((unlockedCount / totalCount) * 100)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(unlockedCount / totalCount) * 100}%` }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400"
          />
        </div>
      </div>

      {/* Achievement Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {achievements.map((achievement, index) => {
          const tier = tierConfig[achievement.tier];
          const Icon = achievement.icon;
          const progressPercent = (achievement.progress / achievement.maxProgress) * 100;
          const isHovered = hoveredId === achievement.id;

          return (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              onMouseEnter={() => setHoveredId(achievement.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <GlassCard
                hover={achievement.unlocked}
                className={`relative overflow-hidden ${!achievement.unlocked ? 'opacity-60' : ''}`}
              >
                {/* Shimmer effect for unlocked */}
                {achievement.unlocked && isHovered && (
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                    className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-12 pointer-events-none"
                  />
                )}

                <div className="relative z-10 space-y-4">
                  {/* Badge Icon */}
                  <div className="flex items-start justify-between">
                    <motion.div
                      whileHover={achievement.unlocked ? { rotateY: 360 } : undefined}
                      transition={{ duration: 0.6 }}
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tier.gradient} flex items-center justify-center shadow-lg ${tier.glow}`}
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      {achievement.unlocked ? (
                        <Icon size={24} className="text-white" />
                      ) : (
                        <Lock size={20} className="text-white/50" />
                      )}
                    </motion.div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/[0.05] ${tier.text}`}>
                      {achievement.tier}
                    </span>
                  </div>

                  {/* Info */}
                  <div>
                    <h3 className={`text-sm font-semibold ${achievement.unlocked ? 'text-text-primary' : 'text-text-tertiary'}`}>
                      {achievement.title}
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">{achievement.description}</p>
                  </div>

                  {/* Progress Ring */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10">
                      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="3"
                        />
                        <motion.path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke={achievement.unlocked ? '#10B981' : '#64748B'}
                          strokeWidth="3"
                          strokeLinecap="round"
                          initial={{ strokeDasharray: '0 100' }}
                          animate={{ strokeDasharray: `${progressPercent} 100` }}
                          transition={{ duration: 1, delay: 0.3 + index * 0.05 }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-text-tertiary">
                        {Math.round(progressPercent)}%
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 1, delay: 0.3 + index * 0.05 }}
                          className={`h-full rounded-full ${achievement.unlocked ? 'bg-emerald-500' : 'bg-text-muted'}`}
                        />
                      </div>
                      <p className="text-[10px] text-text-muted mt-1">
                        {achievement.progress.toLocaleString()} / {achievement.maxProgress.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
