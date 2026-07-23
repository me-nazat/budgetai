export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { HouseholdRepository } from '@/repositories/household.repository';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const households = await HouseholdRepository.findByUserId(userId);
    if (households.length === 0) {
      return NextResponse.json({ caps: [] });
    }

    const caps = await HouseholdRepository.findCategoryCaps(households[0].id);
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

    const cap = await HouseholdRepository.setCategoryCap(
      parseInt(householdId, 10),
      category.trim(),
      parseFloat(capAmount),
      userId
    );

    return NextResponse.json(cap);
  })
);
