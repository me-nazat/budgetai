export const dynamic = 'force-dynamic';

/**
 * @fileoverview Round-up history and projected payoff timeline API (Module 15).
 *
 * GET /api/round-up/history — Returns all round-up micro-saves + projected
 *   payoff timeline calculated from 30-day rolling average.
 *
 * @module api/round-up/history
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { savingsGoals, roundUpTransfers } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { queryAll } from '@/lib/db';
import { RoundUpRepository } from '@/repositories/roundUp.repository';

interface RoundUpHistoryEntry {
  date: string;
  amount: number;
  goalName: string;
}

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const rule = await RoundUpRepository.getRule(userId);

    if (!rule || !rule.targetGoalId) {
      return NextResponse.json({
        history: [],
        projection: null,
        rule: null,
      });
    }

    const goalIdNum = parseInt(rule.targetGoalId, 10);

    // Get target goal details
    const [goal] = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, goalIdNum), eq(savingsGoals.userId, userId)));

    if (!goal) {
      return NextResponse.json({
        history: [],
        projection: null,
        rule,
      });
    }

    // Get milestones achieved from event log
    const milestones = await RoundUpRepository.getMilestones(goal.id);

    // Fetch swept transfers
    const sweptTransfers = await db
      .select()
      .from(roundUpTransfers)
      .where(
        and(
          eq(roundUpTransfers.ruleId, rule.id),
          eq(roundUpTransfers.status, 'SWEPT')
        )
      )
      .orderBy(desc(roundUpTransfers.createdAt))
      .limit(100);

    const history: RoundUpHistoryEntry[] = sweptTransfers.map((t) => ({
      date: t.sweptAt ? new Date(t.sweptAt * 1000).toISOString().split('T')[0] : 'Recent',
      amount: t.multipliedAmount,
      goalName: goal.name,
    }));

    // Calculate 30-day preview and payoff projection
    const preview = await RoundUpRepository.calculate30DayPreview(userId, rule.multiplier);
    const remaining = Math.max(0, goal.targetAmount - (goal.savedAmount || 0));

    let projection: { daysToGoal: number; projectedDate: string; averageDailyRoundUp: number } | null = null;
    const avgDailyRoundUp = preview.projectedMonthlySweep / 30;

    if (avgDailyRoundUp > 0 && remaining > 0) {
      const daysToGoal = Math.ceil(remaining / avgDailyRoundUp);
      const projectedDate = new Date();
      projectedDate.setDate(projectedDate.getDate() + daysToGoal);

      projection = {
        daysToGoal,
        projectedDate: projectedDate.toISOString().split('T')[0],
        averageDailyRoundUp: Math.round(avgDailyRoundUp * 100) / 100,
      };
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
      milestones: milestones.map((m) => ({
        percentage: m.milestonePercentage,
        reachedAt: m.achievedAt,
      })),
      rule,
    });
  }),
  { rateLimit: 'api' }
);
