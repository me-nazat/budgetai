export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { RoundUpRepository } from '@/repositories/roundUp.repository';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const settings = await RoundUpRepository.getSettings(userId);
    return NextResponse.json({ settings });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { enabled, roundingTier, multiplier, targetGoalId } = body;

    const updated = await RoundUpRepository.saveSettings({
      userId,
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : undefined,
      roundingTier: roundingTier ? parseFloat(roundingTier) : undefined,
      multiplier: multiplier ? parseFloat(multiplier) : undefined,
      targetGoalId: targetGoalId ? parseInt(targetGoalId, 10) : null,
    });

    return NextResponse.json(updated);
  })
);
