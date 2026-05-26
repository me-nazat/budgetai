import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll, queryOne } from '@/lib/db';

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

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const currentEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;

    // Total transaction count
    const txCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions WHERE user_id = ?',
      [userId]
    );
    const total = txCount?.count || 0;

    // Consecutive months with positive savings (streak)
    let savingsStreak = 0;
    for (let i = 0; i < 24; i++) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const ms = `${y}-${String(m).padStart(2, '0')}-01`;
      const me = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;

      const earnings = await queryOne<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'earning' AND date >= ? AND date <= ?",
        [userId, ms, me]
      );
      const expenses = await queryOne<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?",
        [userId, ms, me]
      );

      const earn = earnings?.total || 0;
      const exp = expenses?.total || 0;

      if (earn > 0 && earn > exp) {
        savingsStreak++;
      } else {
        break;
      }
    }

    // Budget adherence streak (months where all budgets were met)
    let budgetStreak = 0;
    for (let i = 0; i < 12; i++) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const ms = `${y}-${String(m).padStart(2, '0')}-01`;
      const me = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;

      const budgets = await queryAll<{ category: string; monthly_limit: number }>(
        'SELECT category, monthly_limit FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
        [userId, m, y]
      );

      if (budgets.length === 0) break;

      let allKept = true;
      for (const b of budgets) {
        const spent = await queryOne<{ total: number }>(
          "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ? AND LOWER(category) = LOWER(?)",
          [userId, ms, me, b.category]
        );
        if ((spent?.total || 0) > b.monthly_limit) {
          allKept = false;
          break;
        }
      }

      if (allKept) budgetStreak++;
      else break;
    }

    // Distinct categories used
    const catCount = await queryOne<{ count: number }>(
      'SELECT COUNT(DISTINCT LOWER(category)) as count FROM transactions WHERE user_id = ?',
      [userId]
    );

    // Days with at least one transaction in current month
    const activeDays = await queryOne<{ count: number }>(
      "SELECT COUNT(DISTINCT date) as count FROM transactions WHERE user_id = ? AND date >= ? AND date <= ?",
      [userId, currentStart, currentEnd]
    );

    // Current month savings rate
    const curEarnings = await queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'earning' AND date >= ? AND date <= ?",
      [userId, currentStart, currentEnd]
    );
    const curExpenses = await queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?",
      [userId, currentStart, currentEnd]
    );
    const savingsRate = (curEarnings?.total || 0) > 0
      ? (((curEarnings?.total || 0) - (curExpenses?.total || 0)) / (curEarnings?.total || 1)) * 100
      : 0;

    const achievements: Achievement[] = [
      // Tracking milestones
      { id: 'first-step', icon: 'flag', title: 'First Step', description: 'Log your first transaction', progress: Math.min(total, 1), target: 1, unlocked: total >= 1, category: 'tracking', tier: 'bronze' },
      { id: 'getting-started', icon: 'trending_up', title: 'Getting Started', description: 'Log 10 transactions', progress: Math.min(total, 10), target: 10, unlocked: total >= 10, category: 'tracking', tier: 'bronze' },
      { id: 'dedicated-tracker', icon: 'monitoring', title: 'Dedicated Tracker', description: 'Log 50 transactions', progress: Math.min(total, 50), target: 50, unlocked: total >= 50, category: 'tracking', tier: 'silver' },
      { id: 'centurion', icon: 'military_tech', title: 'Centurion', description: 'Log 100 transactions', progress: Math.min(total, 100), target: 100, unlocked: total >= 100, category: 'tracking', tier: 'gold' },
      { id: 'finance-master', icon: 'emoji_events', title: 'Finance Master', description: 'Log 500 transactions', progress: Math.min(total, 500), target: 500, unlocked: total >= 500, category: 'tracking', tier: 'diamond' },

      // Saving achievements
      { id: 'saver', icon: 'savings', title: 'Saver', description: 'Save more than you spend this month', progress: Math.min(Math.max(savingsRate, 0), 100), target: 100, unlocked: savingsRate > 0, category: 'saving', tier: 'bronze' },
      { id: 'super-saver', icon: 'rocket_launch', title: 'Super Saver', description: 'Save 20%+ of your income', progress: Math.min(Math.max(savingsRate, 0), 20), target: 20, unlocked: savingsRate >= 20, category: 'saving', tier: 'silver' },
      { id: 'savings-streak', icon: 'local_fire_department', title: 'Savings Streak', description: 'Save for 3 consecutive months', progress: Math.min(savingsStreak, 3), target: 3, unlocked: savingsStreak >= 3, category: 'streak', tier: 'silver' },
      { id: 'savings-champion', icon: 'workspace_premium', title: 'Savings Champion', description: 'Save for 6 consecutive months', progress: Math.min(savingsStreak, 6), target: 6, unlocked: savingsStreak >= 6, category: 'streak', tier: 'gold' },

      // Budget achievements
      { id: 'budget-keeper', icon: 'verified', title: 'Budget Keeper', description: 'Stay within all budgets this month', progress: budgetStreak > 0 ? 1 : 0, target: 1, unlocked: budgetStreak >= 1, category: 'budget', tier: 'bronze' },
      { id: 'budget-hero', icon: 'shield', title: 'Budget Hero', description: 'Keep all budgets for 3 months straight', progress: Math.min(budgetStreak, 3), target: 3, unlocked: budgetStreak >= 3, category: 'budget', tier: 'gold' },

      // Variety
      { id: 'diverse-tracker', icon: 'category', title: 'Category Explorer', description: 'Use 5 different categories', progress: Math.min(catCount?.count || 0, 5), target: 5, unlocked: (catCount?.count || 0) >= 5, category: 'tracking', tier: 'silver' },
      { id: 'daily-habit', icon: 'calendar_today', title: 'Daily Habit', description: 'Track expenses on 20+ days this month', progress: Math.min(activeDays?.count || 0, 20), target: 20, unlocked: (activeDays?.count || 0) >= 20, category: 'streak', tier: 'gold' },
    ];

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const totalPoints = achievements.reduce((s, a) => s + (a.unlocked ? ({ bronze: 10, silver: 25, gold: 50, diamond: 100 }[a.tier]) : 0), 0);

    return NextResponse.json({
      achievements,
      stats: {
        unlocked: unlockedCount,
        total: achievements.length,
        points: totalPoints,
        savingsStreak,
        budgetStreak,
      }
    });
  })
);
