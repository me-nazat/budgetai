import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { generateInviteCode, getInviteCode } from '../../tour-controller';

export const dynamic = 'force-dynamic';

type InviteRouteContext = { params: Promise<{ id: string }> };

export const GET = apiHandler(
  withAuth<InviteRouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    return getInviteCode(request, userId, routeContext);
  })
);

export const POST = apiHandler(
  withAuth<InviteRouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    return generateInviteCode(request, userId, routeContext);
  })
);
