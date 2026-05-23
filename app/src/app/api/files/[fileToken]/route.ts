import { Readable } from 'node:stream';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryOne } from '@/lib/db';
import { getAttachmentContent, getAttachmentMetadata } from '@/lib/google-drive';
import { decodeAttachmentToken } from '@/lib/transaction-attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ fileToken: string }>;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function buildContentDisposition(fileName: string, mode: 'inline' | 'attachment') {
  const encoded = encodeURIComponent(fileName);
  return `${mode}; filename*=UTF-8''${encoded}`;
}

function buildFolderLabel(tx: { category: string; description?: string | null; date: string }) {
  const parts = [tx.category];
  if (tx.description && tx.description !== tx.category) parts.push(tx.description);
  parts.push(tx.date.slice(0, 7));
  return parts.join(' — ');
}

async function getAuthorizedContext(transactionId: number, userId: number) {
  const tx = await queryOne<{
    id: number;
    user_id: number;
    category: string;
    description: string;
    date: string;
  }>('SELECT id, user_id, category, description, date FROM transactions WHERE id = ? AND user_id = ?', [
    transactionId,
    userId,
  ]);

  if (!tx) return null;

  const user = await queryOne<{ id: number; name: string; email: string }>(
    'SELECT id, name, email FROM users WHERE id = ?',
    [tx.user_id],
  );

  return {
    tx,
    owner: {
      userId: tx.user_id,
      name: user?.name ?? null,
      email: user?.email ?? null,
    },
  };
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return jsonError('Please sign in to view files.', 401);

  const { fileToken } = await context.params;
  const decoded = decodeAttachmentToken(fileToken);
  if (!decoded) return jsonError('Invalid file link.', 400);

  const ctx = await getAuthorizedContext(decoded.transactionId, session.userId);
  if (!ctx) return jsonError('File not found.', 404);

  const { searchParams } = new URL(request.url);
  const isMeta = searchParams.get('meta') === '1';
  const isDownload = searchParams.get('download') === '1';

  try {
    if (isMeta) {
      const metadata = await getAttachmentMetadata({
        userId: ctx.owner.userId,
        userName: ctx.owner.name,
        userEmail: ctx.owner.email ?? session.email,
        folderLabel: buildFolderLabel(ctx.tx),
        fileId: decoded.fileId,
      });

      return NextResponse.json({
        id: metadata.file.id,
        name: metadata.file.name,
        mimeType: metadata.file.mimeType,
        size: metadata.file.size,
        modifiedTime: metadata.file.modifiedTime,
        previewKind: metadata.previewKind,
        printable: metadata.printable,
        viewUrl: `/api/files/${fileToken}`,
        downloadUrl: `/api/files/${fileToken}?download=1`,
      });
    }

    const content = await getAttachmentContent({
      userId: ctx.owner.userId,
      userName: ctx.owner.name,
      userEmail: ctx.owner.email ?? session.email,
      folderLabel: buildFolderLabel(ctx.tx),
      fileId: decoded.fileId,
      range: request.headers.get('range'),
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
    console.error('Failed to serve attachment', error);
    return jsonError(error instanceof Error ? error.message : 'Unable to load this file right now.', 500);
  }
}
