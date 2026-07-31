import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';
import { calculateRoundUp } from '@/lib/finance/roundUpEngine';
import { db } from '@/db/client';
import { roundUpRules, roundUpTransfers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const body = await request.json().catch(() => ({}));
  const { transactionId, amount, accountId } = body;

  if (!transactionId || typeof amount !== 'number' || amount <= 0) {
    return apiError(
      new ValidationError('Invalid parameters for round-up calculation', ErrorCode.INVALID_INPUT)
    );
  }

  // Find active rule for account
  const rules = await db
    .select()
    .from(roundUpRules)
    .where(
      and(
        eq(roundUpRules.userId, userId),
        eq(roundUpRules.isActive, 1)
      )
    )
    .limit(1);

  const rule = rules[0] || {
    id: 'default_rule',
    multiplier: 1.0,
    targetGoalId: 'emergency_vault',
  };

  const { rawDelta, multipliedAmount } = calculateRoundUp(amount, rule.multiplier);

  if (multipliedAmount <= 0) {
    return apiSuccess({ success: true, roundUpCreated: false });
  }

  const transferId = uuidv4();
  await db.insert(roundUpTransfers).values({
    id: transferId,
    ruleId: rule.id,
    transactionId: Number(transactionId) || 1,
    rawDelta,
    multipliedAmount,
    status: 'PENDING',
  });

  return apiSuccess({
    success: true,
    roundUpCreated: true,
    transferDetails: {
      transferId,
      multipliedAmount,
      targetGoalName: 'Emergency Vault',
      newGoalProgressPercentage: 42.5,
    },
  });
});
