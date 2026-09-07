export const dynamic = 'force-dynamic';

/**
 * @fileoverview Scheduled & On-Demand Escrow Sweep Engine for Micro-Savings (Module 15).
 * Sweeps pending round-up transfers to target savings goals once threshold is met,
 * triggers milestone celebrations, and suggests stretch goals at 100%.
 *
 * POST /api/cron/round-up-sweep
 *
 * @module api/cron/round-up-sweep
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  roundUpRules,
  roundUpTransfers,
  savingsGoals,
  goalMilestones,
  module25RoundUpSweeps,
  module25StretchGoalSuggestions,
} from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { force = false, ruleId } = body;

    // Fetch active rules for user
    const rulesQuery = ruleId
      ? and(eq(roundUpRules.userId, userId), eq(roundUpRules.id, ruleId), eq(roundUpRules.isActive, 1))
      : and(eq(roundUpRules.userId, userId), eq(roundUpRules.isActive, 1));

    const rules = await db.select().from(roundUpRules).where(rulesQuery);

    if (rules.length === 0) {
      return NextResponse.json({
        success: true,
        sweptBatches: [],
        message: 'No active round-up rules found for user',
      });
    }

    const sweptBatches = [];

    for (const rule of rules) {
      // Find pending transfers for this rule
      const pending = await db
        .select()
        .from(roundUpTransfers)
        .where(
          and(
            eq(roundUpTransfers.ruleId, rule.id),
            eq(roundUpTransfers.status, 'PENDING')
          )
        );

      if (pending.length === 0) continue;

      const totalPending = pending.reduce((sum, t) => sum + t.multipliedAmount, 0);
      const roundedTotal = Math.round(totalPending * 100) / 100;

      // Gate by minimum sweep threshold unless force sweep requested
      if (!force && roundedTotal < (rule.minimumSweepThreshold || 5.0)) {
        continue;
      }

      const sweepId = `swp_${crypto.randomUUID()}`;
      const now = Math.floor(Date.now() / 1000);

      // 1. Create sweep record
      await db.insert(module25RoundUpSweeps).values({
        id: sweepId,
        userId,
        ruleId: rule.id,
        totalAmount: roundedTotal,
        status: 'completed',
        sweptAt: now,
      });

      // 2. Mark pending transfers as SWEPT
      const transferIds = pending.map((p) => p.id);
      await db
        .update(roundUpTransfers)
        .set({
          status: 'SWEPT',
          sweepWindowId: sweepId,
          sweptAt: now,
        })
        .where(inArray(roundUpTransfers.id, transferIds));

      // 3. Deposit to Target Savings Goal
      let targetGoal = null;
      let milestoneCrossed = null;
      let stretchSuggested = null;

      const goalNumericId = parseInt(rule.targetGoalId, 10);
      if (!isNaN(goalNumericId)) {
        const [goal] = await db
          .select()
          .from(savingsGoals)
          .where(and(eq(savingsGoals.id, goalNumericId), eq(savingsGoals.userId, userId)))
          .limit(1);

        if (goal) {
          const oldAmount = goal.savedAmount || 0;
          const newAmount = oldAmount + roundedTotal;
          const oldPct = Math.floor((oldAmount / goal.targetAmount) * 100);
          const newPct = Math.floor((newAmount / goal.targetAmount) * 100);

          // Update goal balance
          await db
            .update(savingsGoals)
            .set({ savedAmount: newAmount })
            .where(eq(savingsGoals.id, goal.id));

          // Check milestone crossing (25, 50, 75, 100)
          const thresholds = [25, 50, 75, 100];
          for (const t of thresholds) {
            if (oldPct < t && newPct >= t) {
              milestoneCrossed = t;
              await db.insert(goalMilestones).values({
                goalId: goal.id,
                milestonePercentage: t,
              });

              // If 100% completed, formulate Stretch Goal Suggestion
              if (t === 100) {
                await db
                  .update(savingsGoals)
                  .set({ streakAfterCompletion: 1 })
                  .where(eq(savingsGoals.id, goal.id));

                const stretchTarget = Math.round(goal.targetAmount * 1.5);
                const futureDate = new Date();
                futureDate.setMonth(futureDate.getMonth() + 6);
                const stretchDeadline = futureDate.toISOString().split('T')[0];

                const stretchId = `stretch_${crypto.randomUUID()}`;
                await db.insert(module25StretchGoalSuggestions).values({
                  id: stretchId,
                  userId,
                  sourceGoalId: goal.id,
                  suggestedTarget: stretchTarget,
                  suggestedDeadline: stretchDeadline,
                });

                stretchSuggested = {
                  id: stretchId,
                  suggestedTarget: stretchTarget,
                  suggestedDeadline: stretchDeadline,
                };
              }
            }
          }

          targetGoal = {
            id: goal.id,
            name: goal.name,
            oldAmount,
            newAmount,
            percentage: Math.min(100, newPct),
          };
        }
      }

      sweptBatches.push({
        sweepId,
        ruleId: rule.id,
        transfersCount: pending.length,
        totalSwept: roundedTotal,
        targetGoal,
        milestoneCrossed,
        stretchSuggested,
      });
    }

    return NextResponse.json({
      success: true,
      sweptBatches,
    });
  })
);
