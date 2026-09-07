export const dynamic = 'force-dynamic';

/**
 * @fileoverview Goal Milestones API Route (Module 15).
 * Returns achieved milestones (25, 50, 75, 100%) for a given savings goal.
 *
 * GET /api/goals/[id]/milestones
 *
 * @module api/goals/[id]/milestones
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { savingsGoals, goalMilestones } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const GET = apiHandler(
  withAuth<{ params: Promise<{ id: string }> }>(async (_request: NextRequest, { userId }, routeContext) => {
    const rawId = (await routeContext.params)?.id;
    const goalId = parseInt(rawId, 10);

    if (isNaN(goalId)) {
      return NextResponse.json({ error: 'Valid goalId required' }, { status: 400 });
    }

    // Verify ownership
    const [goal] = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)))
      .limit(1);

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const milestones = await db
      .select()
      .from(goalMilestones)
      .where(eq(goalMilestones.goalId, goalId))
      .orderBy(desc(goalMilestones.milestonePercentage));

    const currentPercentage = Math.min(
      100,
      Math.floor(((goal.savedAmount || 0) / goal.targetAmount) * 100)
    );

    return NextResponse.json({
      goalId: goal.id,
      goalName: goal.name,
      currentPercentage,
      savedAmount: goal.savedAmount,
      targetAmount: goal.targetAmount,
      milestones,
      streakAfterCompletion: goal.streakAfterCompletion || 0,
    });
  })
);
