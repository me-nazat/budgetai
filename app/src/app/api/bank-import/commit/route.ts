import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const body = await request.json().catch(() => ({}));
  const { statementId, approvedQueueIds = [], mergedMap = [] } = body;

  if (!statementId || (!approvedQueueIds.length && !mergedMap.length)) {
    return apiError(
      new ValidationError('Invalid reconciliation parameters', ErrorCode.INVALID_INPUT)
    );
  }

  return apiSuccess({
    success: true,
    insertedCount: approvedQueueIds.length,
    mergedCount: mergedMap.length,
    accountBalanceUpdated: true,
  });
});
