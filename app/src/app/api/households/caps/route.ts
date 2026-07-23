export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { HouseholdRepository } from '@/repositories/household.repository';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const userHousehold = await HouseholdRepository.getHouseholdForUser(userId);
    if (!userHousehold) {
      return NextResponse.json({ caps: [] });
    }

    const caps = await HouseholdRepository.getCategoryCaps(userHousehold.household.id);
    return NextResponse.json({ caps });
  })
);

export const PUT = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { householdId, category, capAmount } = body;

    if (!householdId || !category || capAmount === undefined) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const cap = await HouseholdRepository.setCategoryCap({
      householdId: parseInt(householdId, 10),
      category: category.trim(),
      capAmount: parseFloat(capAmount),
      allocatedByUserId: userId,
    });

    return NextResponse.json(cap);
  })
);
