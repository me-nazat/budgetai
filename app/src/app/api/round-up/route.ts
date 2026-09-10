export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { RoundUpRepository } from '@/repositories/roundUp.repository';
import { db } from '@/db/client';
import { roundUpRules, roundUpTransfers, savingsGoals, accounts } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const rule = await RoundUpRepository.getRule(userId);
    const queryMult = request.nextUrl.searchParams.get('multiplier');
    const multiplier = queryMult ? parseFloat(queryMult) : (rule?.multiplier || 1.0);

    // Calculate 30-day live spending preview
    const preview = await RoundUpRepository.calculate30DayPreview(userId, multiplier);

    let targetGoalName = 'Emergency Fund';
    if (rule?.targetGoalId) {
      const numId = parseInt(rule.targetGoalId, 10);
      if (!isNaN(numId)) {
        const [goal] = await db
          .select({ name: savingsGoals.name })
          .from(savingsGoals)
          .where(and(eq(savingsGoals.id, numId), eq(savingsGoals.userId, userId)))
          .limit(1);
        if (goal) {
          targetGoalName = goal.name;
        }
      }
    }

    // Query pending transfers
    let pendingTotal = 0;
    let pendingCount = 0;

    if (rule) {
      const pendingTransfers = await db
        .select()
        .from(roundUpTransfers)
        .where(
          and(
            eq(roundUpTransfers.ruleId, rule.id),
            eq(roundUpTransfers.status, 'PENDING')
          )
        );

      pendingCount = pendingTransfers.length;
      pendingTotal = Math.round(pendingTransfers.reduce((acc, t) => acc + t.multipliedAmount, 0) * 100) / 100;
    }

    return NextResponse.json({
      rule,
      hasActiveRule: Boolean(rule?.isActive),
      pendingTotal,
      pendingCount,
      targetGoalName,
      threshold: rule?.minimumSweepThreshold ?? 5.0,
      preview,
    });
  }),
  { rateLimit: 'api' }
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { enabled, multiplier, targetGoalId, sourceAccountId, minimumSweepThreshold } = body;

    const rule = await RoundUpRepository.saveRule({
      userId,
      sourceAccountId: sourceAccountId ? parseInt(sourceAccountId, 10) : undefined,
      targetGoalId: targetGoalId ? String(targetGoalId) : '1',
      multiplier: multiplier ? parseFloat(multiplier) : 1.0,
      minimumSweepThreshold: minimumSweepThreshold ? parseFloat(minimumSweepThreshold) : 5.0,
      isActive: enabled !== undefined ? Boolean(enabled) : true,
    });

    return NextResponse.json({ success: true, rule });
  }),
  { rateLimit: 'api' }
);
