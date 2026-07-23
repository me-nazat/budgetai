export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { HouseholdRepository } from '@/repositories/household.repository';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const userHousehold = await HouseholdRepository.getHouseholdForUser(userId);
    if (!userHousehold) {
      return NextResponse.json({ recommendations: [], householdId: null });
    }

    const recommendations = await HouseholdRepository.calculateNetSettlements(
      userHousehold.household.id
    );

    return NextResponse.json({
      householdId: userHousehold.household.id,
      householdName: userHousehold.household.name,
      recommendations,
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

    const settlement = await HouseholdRepository.recordSettlement({
      householdId: parseInt(householdId, 10),
      payerId: parseInt(payerId, 10),
      payeeId: parseInt(payeeId, 10),
      amount: parseFloat(amount),
    });

    return NextResponse.json(settlement, { status: 201 });
  })
);
