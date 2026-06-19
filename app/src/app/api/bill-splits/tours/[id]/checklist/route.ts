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

function toClientChecklistItem(item: any, tourId: number) {
  if (!item.attachmentId) return item;
  return {
    ...item,
    attachmentId: encodeAttachmentToken({
      fileId: item.attachmentId,
      tourId,
      itemId: Number(item.id),
      itemType: 'checklist',
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
    const checklistItems = await queryAll(
      `SELECT id, tour_id as tourId, name, category, assigned_to as assignedTo, completed, description, attachment_id as attachmentId, attachment_name as attachmentName
       FROM tour_checklist_items
       WHERE tour_id = ?
       ORDER BY created_at ASC`,
      [tourId]
    );

    // Normalize completed field as boolean
    const normalizedChecklist = checklistItems.map((item: any) => toClientChecklistItem({
      ...item,
      completed: !!item.completed,
    }, tourId));

    const customCategories = await queryAll(
      'SELECT id, name FROM tour_checklist_categories WHERE tour_id = ? ORDER BY name ASC',
      [tourId]
    );

    return NextResponse.json({
      success: true,
      checklist: normalizedChecklist,
      categories: customCategories,
    });
  } catch (error) {
    console.error('Failed to get checklist items', error);
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
    const itemIdVal = formData.get('id') as string | null;
    const itemId = itemIdVal ? parseInt(itemIdVal, 10) : null;
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;
    const assignedTo = (formData.get('assignedTo') as string) || 'Everyone';
    const completedVal = formData.get('completed') as string | null;
    const completed = completedVal === 'true' || completedVal === '1' ? 1 : 0;
    const description = (formData.get('description') as string) || '';

    // Handle updates
    if (itemId !== null && Number.isFinite(itemId)) {
      const existing = await queryOne<{ id: number }>(
        'SELECT id FROM tour_checklist_items WHERE id = ? AND tour_id = ?',
        [itemId, tourId]
      );
      if (!existing) return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });

      // We might toggle completion only, or update fields
      if (formData.has('completed') && formData.keys().next().value === 'completed') {
        // Just completion toggle
        await run(
          'UPDATE tour_checklist_items SET completed = ? WHERE id = ? AND tour_id = ?',
          [completed, itemId, tourId]
        );
        broadcastTourUpdate(tourId, {
          type: 'TOGGLE_PACKED',
          data: { id: itemId, completed: !!completed },
        });
      } else {
        // Full update
        await run(
          `UPDATE tour_checklist_items 
           SET name = COALESCE(?, name), 
               category = COALESCE(?, category), 
               assigned_to = COALESCE(?, assigned_to), 
               completed = COALESCE(?, completed), 
               description = COALESCE(?, description)
           WHERE id = ? AND tour_id = ?`,
          [name, category, assignedTo, completed, description, itemId, tourId]
        );
        
        broadcastTourUpdate(tourId, {
          type: 'ITEM_MUTATE',
          data: { id: itemId, name, category, assignedTo, completed: !!completed, description },
        });
      }

      return NextResponse.json({ success: true });
    }

    // Handle new item creation
    if (!name || !category) {
      return NextResponse.json({ error: 'Missing name or category' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    let attachmentId: string | null = null;
    let attachmentName: string | null = null;

    if (file && file instanceof File && file.size > 0) {
      const user = await queryOne<{ name: string; email: string }>(
        'SELECT name, email FROM users WHERE id = ?',
        [session.userId]
      );
      
      const folderLabel = `Tour: ${tour.name} — Checklist`;
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
      `INSERT INTO tour_checklist_items (
        tour_id, name, category, assigned_to, completed, description, attachment_id, attachment_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tourId, name, category, assignedTo, completed, description, attachmentId, attachmentName]
    );

    const createdItem = {
      id: result.lastInsertRowid,
      tourId,
      name,
      category,
      assignedTo,
      completed: !!completed,
      description,
      attachmentId,
      attachmentName,
    };
    const clientItem = toClientChecklistItem(createdItem, tourId);

    broadcastTourUpdate(tourId, { type: 'ITEM_CREATE', data: clientItem });

    return NextResponse.json({ success: true, item: clientItem });
  } catch (error) {
    console.error('Failed to create/update checklist item', error);
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

    const item = await queryOne<{ attachment_id: string | null }>(
      'SELECT attachment_id FROM tour_checklist_items WHERE id = ? AND tour_id = ?',
      [itemId, tourId]
    );

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    await run('DELETE FROM tour_checklist_items WHERE id = ? AND tour_id = ?', [itemId, tourId]);

    // Clean up file in Google Drive if it exists
    if (item.attachment_id) {
      const user = await queryOne<{ name: string; email: string }>(
        'SELECT name, email FROM users WHERE id = ?',
        [session.userId]
      );
      
      const folderLabel = `Tour: ${tour.name} — Checklist`;
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

    broadcastTourUpdate(tourId, { type: 'CHECKLIST_CHANGE' });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete checklist item', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
