import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryOne } from '@/lib/db';
import { getAttachmentContent } from '@/lib/google-drive';
import { decodeAttachmentToken } from '@/lib/transaction-attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function buildContentDisposition(fileName: string, mode: 'inline' | 'attachment') {
  const encoded = encodeURIComponent(fileName);
  return `${mode}; filename*=UTF-8''${encoded}`;
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const tourId = parseInt(id, 10);
  if (!Number.isFinite(tourId)) {
    return NextResponse.json({ error: 'Invalid Tour ID' }, { status: 400 });
  }

  // Enforce server-side route guarding checking user authentication against the Tour participant array
  const tour = await queryOne<{ id: number; name: string }>(
    `SELECT DISTINCT t.id, t.name
     FROM tours t
     LEFT JOIN tour_participants tp ON tp.tour_id = t.id
     WHERE t.id = ?
       AND (t.created_by = ? OR tp.user_id = ?)`,
    [tourId, session.userId, session.userId]
  );

  if (!tour) {
    return NextResponse.json({ error: 'Access denied: Tour participant roster mismatch.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const attachmentToken = searchParams.get('attachmentToken') ?? searchParams.get('fileId');
  const type = searchParams.get('type') || 'itinerary'; // 'itinerary' or 'checklist'
  const isDownload = searchParams.get('download') === '1';

  if (!attachmentToken) {
    return NextResponse.json({ error: 'Attachment token is required' }, { status: 400 });
  }

  const decoded = decodeAttachmentToken(attachmentToken);
  if (!decoded?.fileId || decoded.tourId !== tourId || decoded.itemType !== type || !decoded.itemId) {
    return NextResponse.json({ error: 'Invalid attachment token' }, { status: 400 });
  }

  const ownerRow = type === 'checklist'
    ? await queryOne<{ attachment_id: string | null }>(
      'SELECT attachment_id FROM tour_checklist_items WHERE id = ? AND tour_id = ?',
      [decoded.itemId, tourId],
    )
    : await queryOne<{ attachment_id: string | null }>(
      'SELECT attachment_id FROM tour_itinerary_items WHERE id = ? AND tour_id = ?',
      [decoded.itemId, tourId],
    );

  if (!ownerRow?.attachment_id || ownerRow.attachment_id !== decoded.fileId) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  const folderLabel = `Tour: ${tour.name} — ${type === 'checklist' ? 'Checklist' : 'Itinerary'}`;

  try {
    const user = await queryOne<{ name: string; email: string }>(
      'SELECT name, email FROM users WHERE id = ?',
      [session.userId]
    );

    const content = await getAttachmentContent({
      userId: session.userId,
      userName: user?.name ?? null,
      userEmail: user?.email ?? session.email,
      folderLabel,
      fileId: decoded.fileId,
      range: request.headers.get('range'),
      tourId,
    });

    const headers = new Headers();
    headers.set('Cache-Control', 'private, no-store, max-age=0');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Type', content.contentType);
    headers.set('Content-Disposition', buildContentDisposition(content.file.name, isDownload ? 'attachment' : 'inline'));

    if (content.contentLength) headers.set('Content-Length', content.contentLength);
    if (content.contentRange) headers.set('Content-Range', content.contentRange);
    if (content.etag) headers.set('ETag', content.etag);
    if (content.lastModified) headers.set('Last-Modified', content.lastModified);

    return new Response(Readable.toWeb(content.stream) as ReadableStream, {
      status: content.status,
      headers,
    });
  } catch (error) {
    console.error('Failed to serve tour attachment', error);
    return NextResponse.json({ error: 'Unable to load file' }, { status: 500 });
  }
}
