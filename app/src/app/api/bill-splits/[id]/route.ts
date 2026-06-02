import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { run } from '@/lib/db';

export const DELETE = apiHandler(
  withAuth<{ params: Promise<{ id: string }> }>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await (routeContext as { params: Promise<{ id: string }> }).params;

    if (!id) {
      return NextResponse.json({ error: 'Missing bill split ID' }, { status: 400 });
    }

    const { rowsAffected } = await run(
      'DELETE FROM bill_splits WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (rowsAffected === 0) {
      return NextResponse.json({ error: 'Bill split not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Bill split deleted' });
  })
);
