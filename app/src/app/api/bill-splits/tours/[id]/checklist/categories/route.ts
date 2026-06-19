import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryOne, run } from '@/lib/db';
import { broadcastTourUpdate } from '@/lib/tour-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getAuthorizedTour(tourId: number, userId: number) {
  return await queryOne<{ id: number; name: string }>(
    `SELECT DISTINCT t.id, t.name
     FROM tours t
     LEFT JOIN tour_participants tp ON tp.tour_id = t.id
     WHERE t.id = ?
       AND (t.created_by = ? OR tp.user_id = ?)`,
    [tourId, userId, userId]
  );
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const tourId = parseInt(id, 10);
  if (!Number.isFinite(tourId)) return NextResponse.json({ error: 'Invalid Tour ID' }, { status: 400 });

  const tour = await getAuthorizedTour(tourId, session.userId);
  if (!tour) return NextResponse.json({ error: 'Tour not found or access denied' }, { status: 403 });

  try {
    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if category already exists for this tour
    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM tour_checklist_categories WHERE tour_id = ? AND name = ?',
      [tourId, trimmedName]
    );

    if (existing) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 400 });
    }

    const result = await run(
      'INSERT INTO tour_checklist_categories (tour_id, name) VALUES (?, ?)',
      [tourId, trimmedName]
    );

    const createdCategory = {
      id: result.lastInsertRowid,
      tourId,
      name: trimmedName,
    };

    broadcastTourUpdate(tourId, { type: 'CATEGORY_CHANGE', data: createdCategory });

    return NextResponse.json({ success: true, category: createdCategory }, { status: 201 });
  } catch (error) {
    console.error('Failed to create checklist category', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
