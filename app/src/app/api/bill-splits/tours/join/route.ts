import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { getTourByInviteCode, joinTour } from '../tour-controller';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (!code || typeof code !== 'string' || code.length < 6) {
      return NextResponse.json({ success: false, error: 'Invalid invite code' }, { status: 400 });
    }

    const tourInfo = await getTourByInviteCode(code, userId);

    if (!tourInfo) {
      return NextResponse.json({ success: false, error: 'Tour not found for this invite code' }, { status: 404 });
    }

    return NextResponse.json({ success: true, tour: tourInfo });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    return joinTour(request, userId);
  })
);
