export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { HouseholdRepository } from '@/repositories/household.repository';
import { HouseholdService } from '@/services/household.service';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const households = await HouseholdRepository.findByUserId(userId);
    if (households.length === 0) {
      return NextResponse.json({ recommendations: [], householdId: null, memberBalances: [] });
    }

    const primaryHousehold = households[0];
    const { memberBalances, suggestedSettlements } = await HouseholdService.calculateBalances(primaryHousehold.id);

    return NextResponse.json({
      householdId: primaryHousehold.id,
      householdName: primaryHousehold.name,
      memberBalances,
      recommendations: suggestedSettlements,
    });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { householdId, payerId, payeeId, amount } = body;

    if (!householdId || !payerId || !payeeId || !amount) {
      return NextResponse.json({ error: 'Missing required settlement parameters' }, { status: 400 });
    }

    const settlement = await HouseholdService.settleUp(
      parseInt(householdId, 10),
      parseInt(payerId, 10),
      parseInt(payeeId, 10),
      parseFloat(amount)
    );

    return NextResponse.json(settlement, { status: 201 });
  })
);
