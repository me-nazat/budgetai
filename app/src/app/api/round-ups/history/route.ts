export const dynamic = 'force-dynamic';

/**
 * @fileoverview Round-up history and projected payoff timeline API.
 *
 * GET /api/round-ups/history — Returns all round-up micro-saves + projected
 *   payoff timeline calculated from the 30-day rolling average.
 *
 * @module api/round-ups/history
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { goalMilestones, savingsGoals } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { queryAll, queryOne } from '@/lib/db';
import { RoundUpRepository } from '@/repositories/roundUp.repository';

interface RoundUpHistoryEntry {
  date: string;
  amount: number;
  goalName: string;
}

/**
 * GET — Round-up history with projected payoff timeline.
 */
export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const settings = await RoundUpRepository.getSettings(userId);

    if (!settings?.targetGoalId) {
      return NextResponse.json({
        history: [],
        projection: null,
        settings: { enabled: Boolean(settings?.enabled), targetGoalId: null },
      });
    }

    // Get target goal details
    const [goal] = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, settings.targetGoalId), eq(savingsGoals.userId, userId)));

    if (!goal) {
      return NextResponse.json({
        history: [],
        projection: null,
        settings: { enabled: Boolean(settings?.enabled), targetGoalId: settings.targetGoalId },
      });
    }

    // Get milestones achieved
    const milestones = await RoundUpRepository.getMilestones(goal.id);

    // Calculate 30-day rolling average of round-up contributions
    // Using the transactions table to find round-up-sourced micro-saves
    const recentContributions = await queryAll<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM transactions
       WHERE user_id = ? AND category = 'Round-Up Savings' AND type = 'earning'
       AND date >= date('now', '-30 days')`,
      [userId]
    );

    const allHistory = await queryAll<{ date: string; amount: number }>(
      `SELECT date, amount
       FROM transactions
       WHERE user_id = ? AND category = 'Round-Up Savings' AND type = 'earning'
       ORDER BY date DESC
       LIMIT 200`,
      [userId]
    );

    const history: RoundUpHistoryEntry[] = allHistory.map(entry => ({
      date: entry.date,
      amount: entry.amount,
      goalName: goal.name,
    }));

    // Projected payoff
    const remaining = Math.max(0, goal.targetAmount - (goal.savedAmount || 0));
    let projection: { daysToGoal: number; projectedDate: string; averageDailyRoundUp: number } | null = null;

    if (recentContributions[0] && recentContributions[0].count > 0) {
      const avgDailyRoundUp = recentContributions[0].total / 30;

      if (avgDailyRoundUp > 0) {
        const daysToGoal = Math.ceil(remaining / avgDailyRoundUp);
        const projectedDate = new Date();
        projectedDate.setDate(projectedDate.getDate() + daysToGoal);

        projection = {
          daysToGoal,
          projectedDate: projectedDate.toISOString().split('T')[0],
          averageDailyRoundUp: Math.round(avgDailyRoundUp * 100) / 100,
        };
      }
    }

    return NextResponse.json({
      history,
      projection,
      goal: {
        id: goal.id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        savedAmount: goal.savedAmount,
        percentComplete: goal.targetAmount > 0 ? Math.round((goal.savedAmount / goal.targetAmount) * 100) : 0,
      },
      milestones: milestones.map(m => ({
        percentage: m.milestonePercentage,
        reachedAt: m.achievedAt,
      })),
      settings: {
        enabled: Boolean(settings.enabled),
        roundingTier: settings.roundingTier,
        multiplier: settings.multiplier,
        targetGoalId: settings.targetGoalId,
      },
    });
  })
);
