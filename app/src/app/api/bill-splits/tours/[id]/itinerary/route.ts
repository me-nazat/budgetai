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
  if (!item.attachmentId) return item;
  return {
    ...item,
    attachmentId: encodeAttachmentToken({
      fileId: item.attachmentId,
      tourId,
      itemId: Number(item.id),
      itemType: 'itinerary',
    }),
  };
}

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
      `SELECT id, tour_id as tourId, day, time, title, location, cost, type, notes, group_title as groupTitle, attachment_id as attachmentId, attachment_name as attachmentName
       FROM tour_itinerary_items
       WHERE tour_id = ?
       ORDER BY day ASC, time ASC`,
      [tourId]
    );

    return NextResponse.json({ success: true, itinerary: items.map((item: any) => toClientItineraryItem(item, tourId)) });
  } catch (error) {
    console.error('Failed to get itinerary', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const day = parseInt(formData.get('day') as string, 10);
    const time = formData.get('time') as string;
    const location = (formData.get('location') as string) || '';
    const costVal = formData.get('cost') as string;
    const cost = costVal ? parseFloat(costVal) : null;
    const type = (formData.get('type') as string) || 'activity';
    const notes = (formData.get('notes') as string) || '';
    
    // Group category title fallback
    let groupTitle = formData.get('groupTitle') as string;
    if (!groupTitle || !groupTitle.trim()) {
      groupTitle = 'General Activities';
    } else {
      groupTitle = groupTitle.trim();
    }

    if (!title || isNaN(day) || !time) {
      return NextResponse.json({ error: 'Missing required fields (title, day, time)' }, { status: 400 });
    }

    // Handle optional file upload
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
      `INSERT INTO tour_itinerary_items (
        tour_id, day, time, title, location, cost, type, notes, group_title, attachment_id, attachment_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tourId, day, time, title, location, cost, type, notes, groupTitle, attachmentId, attachmentName]
    );

    const createdItem = {
      id: result.lastInsertRowid,
      tourId,
      day,
      time,
      title,
      location,
      cost,
      type,
      notes,
      groupTitle,
      attachmentId,
      attachmentName,
    };
    const clientItem = toClientItineraryItem(createdItem, tourId);

    // Broadcast the update via SSE
    broadcastTourUpdate(tourId, { type: 'ITINERARY_CHANGE', data: clientItem });

    return NextResponse.json({ success: true, item: clientItem });
  } catch (error) {
    console.error('Failed to create itinerary item', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    if (!Number.isFinite(itemId)) return NextResponse.json({ error: 'Missing or invalid item ID' }, { status: 400 });

    // Find the item to see if it has an attachment to delete
    const item = await queryOne<{ attachment_id: string | null }>(
      'SELECT attachment_id FROM tour_itinerary_items WHERE id = ? AND tour_id = ?',
      [itemId, tourId]
    );

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    // Delete database record
    await run('DELETE FROM tour_itinerary_items WHERE id = ? AND tour_id = ?', [itemId, tourId]);

    // Clean up file in Google Drive if it exists
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

    // Broadcast the update via SSE
    broadcastTourUpdate(tourId, { type: 'ITINERARY_CHANGE' });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete itinerary item', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
