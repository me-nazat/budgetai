import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { addTourSpending, listTourSpendings } from '../../tour-controller';

export const dynamic = 'force-dynamic';

type TourRouteContext = { params: Promise<{ id: string }> };

export const GET = apiHandler(
  withAuth<TourRouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    return listTourSpendings(request, userId, routeContext);
  })
);

export const POST = apiHandler(
  withAuth<TourRouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    return addTourSpending(request, userId, routeContext);
  })
);
