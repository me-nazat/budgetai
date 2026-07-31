import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess } from '@/lib/types/api';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const now = Math.floor(Date.now() / 1000);

  return apiSuccess({
    success: true,
    syncedEventsCount: {
      billsCreated: 4,
      subscriptionsUpdated: 2,
      deletedCount: 0,
    },
    lastSyncedAt: now,
  });
});
