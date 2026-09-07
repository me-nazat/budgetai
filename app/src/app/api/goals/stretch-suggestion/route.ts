export const dynamic = 'force-dynamic';

/**
 * @fileoverview Stretch Goal Suggestions Route (Module 15).
 * Allows users to accept 1.5x stretch goals after achieving 100% completion.
 *
 * GET /api/goals/stretch-suggestion
 * POST /api/goals/stretch-suggestion
 *
 * @module api/goals/stretch-suggestion
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  savingsGoals,
  module25StretchGoalSuggestions,
} from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const suggestions = await db
      .select()
      .from(module25StretchGoalSuggestions)
      .where(
        and(
          eq(module25StretchGoalSuggestions.userId, userId),
          isNull(module25StretchGoalSuggestions.acceptedAt),
          isNull(module25StretchGoalSuggestions.dismissedAt)
        )
      );

    return NextResponse.json({ suggestions });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { suggestionId, action } = body;

    if (!suggestionId || !['accept', 'dismiss'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid suggestionId and action (accept|dismiss) required' },
        { status: 400 }
      );
    }

    const [suggestion] = await db
      .select()
      .from(module25StretchGoalSuggestions)
      .where(
        and(
          eq(module25StretchGoalSuggestions.id, suggestionId),
          eq(module25StretchGoalSuggestions.userId, userId)
        )
      )
      .limit(1);

    if (!suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    const now = Math.floor(Date.now() / 1000);

    if (action === 'dismiss') {
      await db
        .update(module25StretchGoalSuggestions)
        .set({ dismissedAt: now })
        .where(eq(module25StretchGoalSuggestions.id, suggestionId));

      return NextResponse.json({ success: true, status: 'dismissed' });
    }

    // Action === 'accept'
    // 1. Fetch source goal to replicate name
    const [sourceGoal] = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.id, suggestion.sourceGoalId))
      .limit(1);

    const goalName = sourceGoal ? `Stretch: ${sourceGoal.name}` : 'Extended Stretch Goal';

    // 2. Create new stretch goal
    const [newGoal] = await db
      .insert(savingsGoals)
      .values({
        userId,
        name: goalName,
        targetAmount: suggestion.suggestedTarget,
        savedAmount: 0,
        deadline: suggestion.suggestedDeadline,
      })
      .returning();

    // 3. Mark suggestion accepted
    await db
      .update(module25StretchGoalSuggestions)
      .set({ acceptedAt: now })
      .where(eq(module25StretchGoalSuggestions.id, suggestionId));

    return NextResponse.json({
      success: true,
      status: 'accepted',
      newGoal,
    });
  })
);
