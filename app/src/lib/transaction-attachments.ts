export const MAX_ATTACHMENT_FILES = 10;
export const MAX_ATTACHMENT_SIZE_BYTES = 100 * 1024 * 1024;

export type AttachmentPreviewKind = 'image' | 'video' | 'pdf' | 'unsupported';

export interface AttachmentRecord {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  modifiedTime: string | null;
}

export interface AttachmentsResponse {
  files: AttachmentRecord[];
  limit: {
    maxFiles: number;
    maxFileSizeBytes: number;
  };
}

export interface AttachmentTokenPayload {
  transactionId: number;
  fileId: string;
}

export interface AttachmentViewerMetadata extends AttachmentRecord {
  previewKind: AttachmentPreviewKind;
  printable: boolean;
  viewUrl: string;
  downloadUrl: string;
}

function encodeBase64Url(value: string) {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    const encoded = window.btoa(
      Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join('')
    );
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string) {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function encodeAttachmentToken(payload: AttachmentTokenPayload) {
  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeAttachmentToken(token: string): AttachmentTokenPayload | null {
  try {
    const parsed = JSON.parse(decodeBase64Url(token)) as Partial<AttachmentTokenPayload>;
    if (!parsed.transactionId || !parsed.fileId) return null;
    return { transactionId: parsed.transactionId, fileId: parsed.fileId };
  } catch {
    return null;
  }
}

export function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'receipt';
}

export function buildAttachmentViewerHref(description: string, transactionId: number, fileId: string) {
  const slug = slugifySegment(description);
  const fileToken = encodeAttachmentToken({ transactionId, fileId });
  return `/transactions/${slug}/file/${fileToken}`;
}

export function inferAttachmentPreviewKind(fileName: string, mimeType: string | null): AttachmentPreviewKind {
  const lower = fileName.toLowerCase();
  const mime = mimeType?.toLowerCase() ?? null;

  if (mime?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower)) return 'image';
  if (mime?.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(lower)) return 'video';
  if (mime?.includes('pdf') || /\.pdf$/i.test(lower)) return 'pdf';
  return 'unsupported';
}

export function isAttachmentPrintable(fileName: string, mimeType: string | null) {
  const kind = inferAttachmentPreviewKind(fileName, mimeType);
  return kind === 'image' || kind === 'pdf';
}

export function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}
