export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { DebtService } from '@/services/debt.service';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const strategyParam = searchParams.get('strategy') || 'avalanche';
    const strategy = strategyParam === 'snowball' ? 'snowball' : strategyParam === 'baseline' ? 'baseline' : 'avalanche';
    const extraPayment = Math.max(0, parseFloat(searchParams.get('extraPayment') || '0') || 0);

    const simulation = await DebtService.simulateForUser(userId, strategy, extraPayment);
    return NextResponse.json(simulation);
  })
);
