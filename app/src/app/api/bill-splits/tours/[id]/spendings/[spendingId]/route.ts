import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { updateTourSpending, deleteTourSpending } from '../../../tour-controller';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function PUT(
  request: NextRequest,
  context: any & { params: Promise<{ spendingId: string }> }
) {
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);

  try {
    return await updateTourSpending(request, session.userId, context);
  } catch (error) {
    if (error instanceof Error && error.message === 'Tour not found') {
      return jsonError('Tour not found', 404);
    }
    console.error('Failed to update tour spending:', error);
    return jsonError('Failed to update tour spending', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: any & { params: Promise<{ spendingId: string }> }
) {
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);

  try {
    return await deleteTourSpending(request, session.userId, context);
  } catch (error) {
    if (error instanceof Error && error.message === 'Tour not found') {
      return jsonError('Tour not found', 404);
    }
    console.error('Failed to delete tour spending:', error);
    return jsonError('Failed to delete tour spending', 500);
  }
}
