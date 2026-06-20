import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryOne, queryAll, run } from '@/lib/db';
import { uploadFilesToTransaction, deleteTransactionAttachment } from '@/lib/google-drive';
import { broadcastTourUpdate } from '@/lib/tour-sync';
import { encodeAttachmentToken } from '@/lib/transaction-attachments';

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

function toClientItineraryItem(item: any, tourId: number) {
  const mapped = { ...item };
  if (mapped.attachmentId) {
    mapped.attachmentId = encodeAttachmentToken({
      fileId: mapped.attachmentId,
      tourId,
      itemId: Number(mapped.id),
      itemType: 'itinerary',
    });
  }
  return mapped;
}

// ────────────────────────────────────────────
// GET — list all itinerary items for a tour
// ────────────────────────────────────────────
export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const tourId = parseInt(id, 10);
  if (!Number.isFinite(tourId)) return NextResponse.json({ error: 'Invalid Tour ID' }, { status: 400 });

  const tour = await getAuthorizedTour(tourId, session.userId);
  if (!tour) return NextResponse.json({ error: 'Tour not found or access denied' }, { status: 403 });

  try {
    const items = await queryAll(
      `SELECT id, tour_id as tourId, day, time, time_end as timeEnd, title, location,
              cost, cost_display as costDisplay, type, notes, group_title as groupTitle,
              attachment_id as attachmentId, attachment_name as attachmentName, status
       FROM tour_itinerary_items
       WHERE tour_id = ?
       ORDER BY day ASC, time ASC`,
      [tourId]
    );

    return NextResponse.json({
      success: true,
      itinerary: items.map((item: any) => toClientItineraryItem(item, tourId)),
    });
  } catch (error) {
    console.error('Failed to get itinerary', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ────────────────────────────────────────────
// POST — create a new itinerary item
// ────────────────────────────────────────────
export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const tourId = parseInt(id, 10);
  if (!Number.isFinite(tourId)) return NextResponse.json({ error: 'Invalid Tour ID' }, { status: 400 });

  const tour = await getAuthorizedTour(tourId, session.userId);
  if (!tour) return NextResponse.json({ error: 'Tour not found or access denied' }, { status: 403 });

  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const day = parseInt(formData.get('day') as string, 10);
    const time = formData.get('time') as string;
    const timeEnd = (formData.get('timeEnd') as string) || null;
    const location = (formData.get('location') as string) || '';
    // costDisplay stores text like "250", "250-300" for range display
    const costDisplay = (formData.get('costDisplay') as string) || null;
    const costVal = formData.get('cost') as string;
    const cost = costVal ? parseFloat(costVal) : null;
    const type = (formData.get('type') as string) || 'activity';
    const notes = (formData.get('notes') as string) || '';
    const status = (formData.get('status') as string) || 'Planned';

    let groupTitle = formData.get('groupTitle') as string;
    groupTitle = groupTitle?.trim() || 'General Activities';

    if (!title || isNaN(day) || !time) {
      return NextResponse.json({ error: 'Missing required fields (title, day, time)' }, { status: 400 });
    }

    // Optional file upload
    const file = formData.get('file') as File | null;
    let attachmentId: string | null = null;
    let attachmentName: string | null = null;

    if (file && file instanceof File && file.size > 0) {
      const user = await queryOne<{ name: string; email: string }>(
        'SELECT name, email FROM users WHERE id = ?',
        [session.userId]
      );
      const folderLabel = `Tour: ${tour.name} — Itinerary`;
      const uploadResult = await uploadFilesToTransaction({
        userId: session.userId,
        userName: user?.name ?? null,
        userEmail: user?.email ?? session.email,
        folderLabel,
        files: [file],
        tourId,
      });
      if (uploadResult.files.length > 0) {
        attachmentId = uploadResult.files[0].id;
        attachmentName = uploadResult.files[0].name;
      }
    }

    const result = await run(
      `INSERT INTO tour_itinerary_items
         (tour_id, day, time, time_end, title, location, cost, cost_display, type, notes, group_title, attachment_id, attachment_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tourId, day, time, timeEnd, title, location, cost, costDisplay, type, notes, groupTitle, attachmentId, attachmentName, status]
    );

    const createdItem = {
      id: result.lastInsertRowid,
      tourId,
      day,
      time,
      timeEnd,
      title,
      location,
      cost,
      costDisplay,
      type,
      notes,
      groupTitle,
      attachmentId,
      attachmentName,
      status,
    };

    broadcastTourUpdate(tourId, { type: 'ITINERARY_CHANGE', data: createdItem });

    return NextResponse.json({ success: true, item: toClientItineraryItem(createdItem, tourId) });
  } catch (error) {
    console.error('Failed to create itinerary item', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ────────────────────────────────────────────
// PATCH — edit an existing itinerary item
// Query param: ?id=<itemId>
// ────────────────────────────────────────────
export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const tourId = parseInt(id, 10);
  if (!Number.isFinite(tourId)) return NextResponse.json({ error: 'Invalid Tour ID' }, { status: 400 });

  const tour = await getAuthorizedTour(tourId, session.userId);
  if (!tour) return NextResponse.json({ error: 'Tour not found or access denied' }, { status: 403 });

  try {
    const url = new URL(request.url);
    const itemId = parseInt(url.searchParams.get('id') || '', 10);
    if (!Number.isFinite(itemId)) {
      return NextResponse.json({ error: 'Missing or invalid item ID' }, { status: 400 });
    }

    const existing = await queryOne<{ id: number; attachment_id: string | null; attachment_name: string | null; status: string }>(
      'SELECT id, attachment_id, attachment_name, status FROM tour_itinerary_items WHERE id = ? AND tour_id = ?',
      [itemId, tourId]
    );
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const day = parseInt(formData.get('day') as string, 10);
    const time = formData.get('time') as string;
    // timeEnd: empty string means "clear it", absent means "keep existing" — but for simplicity we always send it
    const timeEnd = (formData.get('timeEnd') as string) || null;
    const location = (formData.get('location') as string) || '';
    const costDisplay = (formData.get('costDisplay') as string) || null;
    const costVal = formData.get('cost') as string;
    const cost = costVal ? parseFloat(costVal) : null;
    const type = (formData.get('type') as string) || 'activity';
    const notes = (formData.get('notes') as string) || '';
    const status = (formData.get('status') as string) || existing.status;
    let groupTitle = (formData.get('groupTitle') as string) || '';
    groupTitle = groupTitle.trim() || 'General Activities';

    if (!title || isNaN(day) || !time) {
      return NextResponse.json({ error: 'Missing required fields (title, day, time)' }, { status: 400 });
    }

    // Optional replacement file upload
    const file = formData.get('file') as File | null;
    let newAttachmentId: string | null = existing.attachment_id;
    let newAttachmentName: string | null = existing.attachment_name;

    if (file && file instanceof File && file.size > 0) {
      const user = await queryOne<{ name: string; email: string }>(
        'SELECT name, email FROM users WHERE id = ?',
        [session.userId]
      );
      const folderLabel = `Tour: ${tour.name} — Itinerary`;
      const uploadResult = await uploadFilesToTransaction({
        userId: session.userId,
        userName: user?.name ?? null,
        userEmail: user?.email ?? session.email,
        folderLabel,
        files: [file],
        tourId,
      });
      if (uploadResult.files.length > 0) {
        newAttachmentId = uploadResult.files[0].id;
        newAttachmentName = uploadResult.files[0].name;
      }
    }

    await run(
      `UPDATE tour_itinerary_items
       SET title = ?, day = ?, time = ?, time_end = ?,
           location = ?, cost = ?, cost_display = ?,
           type = ?, notes = ?, group_title = ?,
           attachment_id = ?, attachment_name = ?,
           status = ?
       WHERE id = ? AND tour_id = ?`,
      [
        title, day, time, timeEnd,
        location, cost, costDisplay,
        type, notes, groupTitle,
        newAttachmentId, newAttachmentName,
        status,
        itemId, tourId,
      ]
    );

    const updatedItem = {
      id: itemId,
      tourId,
      day,
      time,
      timeEnd,
      title,
      location,
      cost,
      costDisplay,
      type,
      notes,
      groupTitle,
      attachmentId: newAttachmentId,
      attachmentName: newAttachmentName,
      status,
    };

    broadcastTourUpdate(tourId, { type: 'ITINERARY_CHANGE', data: updatedItem });

    return NextResponse.json({ success: true, item: toClientItineraryItem(updatedItem, tourId) });
  } catch (error) {
    console.error('Failed to update itinerary item', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ────────────────────────────────────────────
// DELETE — remove an itinerary item
// Query param: ?id=<itemId>
// ────────────────────────────────────────────
export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const tourId = parseInt(id, 10);
  if (!Number.isFinite(tourId)) return NextResponse.json({ error: 'Invalid Tour ID' }, { status: 400 });

  const tour = await getAuthorizedTour(tourId, session.userId);
  if (!tour) return NextResponse.json({ error: 'Tour not found or access denied' }, { status: 403 });

  try {
    const url = new URL(request.url);
    const itemId = parseInt(url.searchParams.get('id') || '', 10);
    if (!Number.isFinite(itemId)) {
      return NextResponse.json({ error: 'Missing or invalid item ID' }, { status: 400 });
    }

    const item = await queryOne<{ attachment_id: string | null }>(
      'SELECT attachment_id FROM tour_itinerary_items WHERE id = ? AND tour_id = ?',
      [itemId, tourId]
    );
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    await run('DELETE FROM tour_itinerary_items WHERE id = ? AND tour_id = ?', [itemId, tourId]);

    if (item.attachment_id) {
      const user = await queryOne<{ name: string; email: string }>(
        'SELECT name, email FROM users WHERE id = ?',
        [session.userId]
      );
      const folderLabel = `Tour: ${tour.name} — Itinerary`;
      try {
        await deleteTransactionAttachment({
          userId: session.userId,
          userName: user?.name ?? null,
          userEmail: user?.email ?? session.email,
          folderLabel,
          fileId: item.attachment_id,
          tourId,
        });
      } catch (err) {
        console.error('Failed to delete attachment from drive', err);
      }
    }

    broadcastTourUpdate(tourId, { type: 'ITINERARY_CHANGE' });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete itinerary item', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
