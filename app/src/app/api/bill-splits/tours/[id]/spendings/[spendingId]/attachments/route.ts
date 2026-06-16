import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryOne } from '@/lib/db';
import {
  listTransactionAttachments,
  uploadFilesToTransaction,
} from '@/lib/google-drive';
import {
  MAX_ATTACHMENT_FILES,
  MAX_ATTACHMENT_SIZE_BYTES,
  type AttachmentsResponse,
} from '@/lib/transaction-attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExtendedRouteContext {
  params: Promise<{ id: string; spendingId: string }>;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function buildFolderLabel(tourName: string, tx: { category: string; description?: string | null; date: string }) {
  const parts = [`Tour: ${tourName}`, tx.category];
  if (tx.description && tx.description !== tx.category) parts.push(tx.description);
  parts.push(tx.date.slice(0, 7)); // YYYY-MM
  return parts.join(' — ');
}

async function getAuthorizedTourSpending(spendingId: number, tourId: number, userId: number) {
  // First verify user is the creator of the tour or a participant.
  const tour = await queryOne<{ id: number; name: string }>(
    `SELECT DISTINCT t.id, t.name
     FROM tours t
     LEFT JOIN tour_participants tp ON tp.tour_id = t.id
     WHERE t.id = ?
       AND (t.created_by = ? OR tp.user_id = ?)`,
    [tourId, userId, userId]
  );

  if (!tour) return null;

  const tx = await queryOne<{
    id: number;
    category: string;
    description: string;
    date: string;
  }>(
    'SELECT id, category, description, date FROM tour_spendings WHERE id = ? AND tour_id = ?',
    [spendingId, tourId]
  );
  
  return tx ? { ...tx, tourName: tour.name } : null;
}

async function getUser(userId: number) {
  const user = await queryOne<{ id: number; name: string; email: string }>(
    'SELECT id, name, email FROM users WHERE id = ?',
    [userId],
  );
  return user ?? null;
}

export async function GET(_request: Request, context: ExtendedRouteContext) {
  const session = await getSession();
  if (!session) return jsonError('Please sign in to view attachments.', 401);

  const { id, spendingId } = await context.params;
  const tourId = parseInt(id, 10);
  const txId = parseInt(spendingId, 10);
  if (!Number.isFinite(tourId) || tourId < 1 || !Number.isFinite(txId) || txId < 1) {
      return jsonError('Invalid request parameters.', 400);
  }

  const tx = await getAuthorizedTourSpending(txId, tourId, session.userId);
  if (!tx) return jsonError('Transaction not found.', 404);

  const user = await getUser(session.userId);

  try {
    const result = await listTransactionAttachments({
      userId: session.userId,
      userName: user?.name ?? null,
      userEmail: user?.email ?? session.email,
      folderLabel: buildFolderLabel(tx.tourName, tx),
      tourId,
    });

    const payload: AttachmentsResponse = { files: result.files, limit: result.limit };
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to list attachments', error);
    return jsonError(error instanceof Error ? error.message : 'Unable to load attachments right now.', 500);
  }
}

export async function POST(request: Request, context: ExtendedRouteContext) {
  const session = await getSession();
  if (!session) return jsonError('Please sign in to attach files.', 401);

  const { id, spendingId } = await context.params;
  const tourId = parseInt(id, 10);
  const txId = parseInt(spendingId, 10);
  if (!Number.isFinite(tourId) || tourId < 1 || !Number.isFinite(txId) || txId < 1) {
      return jsonError('Invalid request parameters.', 400);
  }

  const tx = await getAuthorizedTourSpending(txId, tourId, session.userId);
  if (!tx) return jsonError('Transaction not found.', 404);

  const formData = await request.formData();
  const files = formData.getAll('files').filter((v): v is File => v instanceof File);

  if (files.length === 0) return jsonError('Choose at least one file to upload.', 400);

  const oversized = files.find((f) => f.size > MAX_ATTACHMENT_SIZE_BYTES);
  if (oversized) return jsonError(`"${oversized.name}" exceeds the 100MB limit.`, 400);

  const user = await getUser(session.userId);
  const folderLabel = buildFolderLabel(tx.tourName, tx);

  try {
    const existing = await listTransactionAttachments({
      userId: session.userId,
      userName: user?.name ?? null,
      userEmail: user?.email ?? session.email,
      folderLabel,
      tourId,
    });

    if (existing.files.length + files.length > MAX_ATTACHMENT_FILES) {
      return jsonError(`You can attach up to ${MAX_ATTACHMENT_FILES} files per transaction.`, 400);
    }

    const result = await uploadFilesToTransaction({
      userId: session.userId,
      userName: user?.name ?? null,
      userEmail: user?.email ?? session.email,
      folderLabel,
      files,
      tourId,
    });

    return NextResponse.json({
      files: result.files,
      limit: { maxFiles: MAX_ATTACHMENT_FILES, maxFileSizeBytes: MAX_ATTACHMENT_SIZE_BYTES },
    });
  } catch (error) {
    console.error('Failed to upload attachments', error);
    return jsonError(error instanceof Error ? error.message : 'Unable to upload files right now.', 500);
  }
}

export async function DELETE(request: Request, context: ExtendedRouteContext) {
  const session = await getSession();
  if (!session) return jsonError('Please sign in to delete files.', 401);

  const { id, spendingId } = await context.params;
  const tourId = parseInt(id, 10);
  const txId = parseInt(spendingId, 10);
  if (!Number.isFinite(tourId) || tourId < 1 || !Number.isFinite(txId) || txId < 1) {
      return jsonError('Invalid request parameters.', 400);
  }

  const tx = await getAuthorizedTourSpending(txId, tourId, session.userId);
  if (!tx) return jsonError('Transaction not found.', 404);

  const url = new URL(request.url);
  const fileId = url.searchParams.get('fileId');
  if (!fileId) return jsonError('File ID is required.', 400);

  const user = await getUser(session.userId);
  const folderLabel = buildFolderLabel(tx.tourName, tx);

  try {
    const { deleteTransactionAttachment } = await import('@/lib/google-drive');
    await deleteTransactionAttachment({
      userId: session.userId,
      userName: user?.name ?? null,
      userEmail: user?.email ?? session.email,
      folderLabel,
      fileId,
      tourId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete attachment', error);
    return jsonError(error instanceof Error ? error.message : 'Unable to delete file right now.', 500);
  }
}
