export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { BenchmarkRepository } from '@/repositories/benchmark.repository';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const ageTier = searchParams.get('ageTier') || undefined;
    const regionCode = searchParams.get('regionCode') || undefined;
    const incomeBracket = searchParams.get('incomeBracket') || undefined;

    const data = await BenchmarkRepository.getPeerBenchmarks(userId, {
      ageTier,
      regionCode,
      incomeBracket,
    });

    return NextResponse.json(data);
  })
);

export const PATCH = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { benchmarkOptIn, demographicAgeTier, demographicRegion } = body;

    const updated = await BenchmarkRepository.updateUserBenchmarkProfile(userId, {
      benchmarkOptIn: benchmarkOptIn !== undefined ? (benchmarkOptIn ? 1 : 0) : undefined,
      demographicAgeTier,
      demographicRegion,
    });

    return NextResponse.json(updated);
  })
);
