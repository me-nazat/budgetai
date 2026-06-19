import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryOne } from '@/lib/db';
import {
  listTransactionAttachments,
  uploadFilesToTransaction,
} from '@/lib/google-drive';
import {
  encodeAttachmentToken,
  MAX_ATTACHMENT_FILES,
  MAX_ATTACHMENT_SIZE_BYTES,
  decodeAttachmentToken,
  type AttachmentsResponse,
  type AttachmentRecord,
} from '@/lib/transaction-attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ transactionId: string }>;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function buildFolderLabel(tx: { category: string; description?: string | null; date: string }) {
  const parts = [tx.category];
  if (tx.description && tx.description !== tx.category) parts.push(tx.description);
  parts.push(tx.date.slice(0, 7)); // YYYY-MM
  return parts.join(' — ');
}

async function getAuthorizedTransaction(transactionId: number, userId: number) {
  const tx = await queryOne<{
    id: number;
    user_id: number;
    type: string;
    category: string;
    description: string;
    date: string;
  }>('SELECT id, user_id, type, category, description, date FROM transactions WHERE id = ? AND user_id = ?', [
    transactionId,
    userId,
  ]);
  return tx ?? null;
}

async function getUser(userId: number) {
  const user = await queryOne<{ id: number; name: string; email: string }>(
    'SELECT id, name, email FROM users WHERE id = ?',
    [userId],
  );
  return user ?? null;
}

function toClientAttachment(txId: number, file: AttachmentRecord): AttachmentRecord {
  return {
    ...file,
    id: encodeAttachmentToken({ transactionId: txId, fileId: file.id }),
  };
}

function decodeRouteAttachmentToken(token: string, txId: number) {
  const decoded = decodeAttachmentToken(token);
  if (!decoded?.fileId) return null;
  if (decoded.transactionId && decoded.transactionId !== txId) return null;
  return decoded.fileId;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return jsonError('Please sign in to view attachments.', 401);

  const { transactionId } = await context.params;
  const txId = parseInt(transactionId, 10);
  if (!Number.isFinite(txId) || txId < 1) return jsonError('Invalid transaction.', 400);

  const tx = await getAuthorizedTransaction(txId, session.userId);
  if (!tx) return jsonError('Transaction not found.', 404);

  const user = await getUser(session.userId);

  try {
    const result = await listTransactionAttachments({
      userId: session.userId,
      userName: user?.name ?? null,
      userEmail: user?.email ?? session.email,
      folderLabel: buildFolderLabel(tx),
    });

    const payload: AttachmentsResponse = { files: result.files.map((file) => toClientAttachment(txId, file)), limit: result.limit };
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to list attachments', error);
    return jsonError(error instanceof Error ? error.message : 'Unable to load attachments right now.', 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return jsonError('Please sign in to attach files.', 401);

  const { transactionId } = await context.params;
  const txId = parseInt(transactionId, 10);
  if (!Number.isFinite(txId) || txId < 1) return jsonError('Invalid transaction.', 400);

  const tx = await getAuthorizedTransaction(txId, session.userId);
  if (!tx) return jsonError('Transaction not found.', 404);

  const formData = await request.formData();
  const files = formData.getAll('files').filter((v): v is File => v instanceof File);

  if (files.length === 0) return jsonError('Choose at least one file to upload.', 400);

  const oversized = files.find((f) => f.size > MAX_ATTACHMENT_SIZE_BYTES);
  if (oversized) return jsonError(`"${oversized.name}" exceeds the 100MB limit.`, 400);

  const user = await getUser(session.userId);
  const folderLabel = buildFolderLabel(tx);

  try {
    const existing = await listTransactionAttachments({
      userId: session.userId,
      userName: user?.name ?? null,
      userEmail: user?.email ?? session.email,
      folderLabel,
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
    });

    return NextResponse.json({
      files: result.files.map((file) => toClientAttachment(txId, file)),
      limit: { maxFiles: MAX_ATTACHMENT_FILES, maxFileSizeBytes: MAX_ATTACHMENT_SIZE_BYTES },
    });
  } catch (error) {
    console.error('Failed to upload attachments', error);
    return jsonError(error instanceof Error ? error.message : 'Unable to upload files right now.', 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return jsonError('Please sign in to delete files.', 401);

  const { transactionId } = await context.params;
  const txId = parseInt(transactionId, 10);
  if (!Number.isFinite(txId) || txId < 1) return jsonError('Invalid transaction.', 400);

  const tx = await getAuthorizedTransaction(txId, session.userId);
  if (!tx) return jsonError('Transaction not found.', 404);

  const url = new URL(request.url);
  const attachmentToken = url.searchParams.get('attachmentToken') ?? url.searchParams.get('fileId');
  if (!attachmentToken) return jsonError('Attachment token is required.', 400);
  const fileId = decodeRouteAttachmentToken(attachmentToken, txId);
  if (!fileId) return jsonError('Invalid attachment token.', 400);

  const user = await getUser(session.userId);
  const folderLabel = buildFolderLabel(tx);

  try {
    const { deleteTransactionAttachment } = await import('@/lib/google-drive');
    await deleteTransactionAttachment({
      userId: session.userId,
      userName: user?.name ?? null,
      userEmail: user?.email ?? session.email,
      folderLabel,
      fileId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete attachment', error);
    return jsonError(error instanceof Error ? error.message : 'Unable to delete file right now.', 500);
  }
}
