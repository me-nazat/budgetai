export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryOne, run } from '@/lib/db';

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

export const PUT = apiHandler(
  withAuth<{ params: Promise<{ id: string }> }>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await (routeContext as { params: Promise<{ id: string }> }).params;
    const { participantId, paid } = await request.json();

    if (!id || !participantId || typeof paid !== 'boolean') {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const splitRow = await queryOne(
      'SELECT participants_json FROM bill_splits WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!splitRow) {
      return NextResponse.json({ error: 'Split not found' }, { status: 404 });
    }

    let participants: any[] = [];
    try {
      participants = JSON.parse(splitRow.participants_json as string || '[]');
    } catch {
      participants = [];
    }

    let found = false;
    participants = participants.map((p: any) => {
      if (p.id === participantId) {
        found = true;
        return { ...p, paid };
      }
      return p;
    });

    if (!found) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    await run(
      'UPDATE bill_splits SET participants_json = ? WHERE id = ? AND user_id = ?',
      [JSON.stringify(participants), id, userId]
    );

    return NextResponse.json({ success: true, participants });
  })
);
