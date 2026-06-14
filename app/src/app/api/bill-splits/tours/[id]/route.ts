import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { deleteTour, getTour } from '../tour-controller';

export const dynamic = 'force-dynamic';

type TourRouteContext = { params: Promise<{ id: string }> };

export const GET = apiHandler(
  withAuth<TourRouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    return getTour(request, userId, routeContext);
  })
);

export const DELETE = apiHandler(
  withAuth<TourRouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    return deleteTour(request, userId, routeContext);
  })
);
