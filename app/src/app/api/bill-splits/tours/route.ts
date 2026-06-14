import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { createTour, listTours } from './tour-controller';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    return listTours(request, userId);
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    return createTour(request, userId);
  })
);
