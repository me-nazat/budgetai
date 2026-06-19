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
  fileId: string;
  transactionId?: number;
  scopeTag?: string;
  tourId?: number;
  itemId?: number;
  itemType?: 'itinerary' | 'checklist';
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

function getAttachmentTokenKey() {
  const crypto = getCrypto();
  if (!crypto) return null;
  const secret = process.env.ATTACHMENT_TOKEN_SECRET || process.env.JWT_SECRET || 'fallback_attachment_token_secret_1234567890';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encodeAttachmentToken(payload: AttachmentTokenPayload) {
  const crypto = getCrypto();
  const key = getAttachmentTokenKey();
  if (crypto && key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('wealth-ai-attachment-token-v2', 'utf8'));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify({ ...payload, v: 2 }), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `att_${encodeBase64Url(JSON.stringify({
      iv: iv.toString('base64url'),
      tag: tag.toString('base64url'),
      data: encrypted.toString('base64url'),
    }))}`;
  }

  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeAttachmentToken(token: string): AttachmentTokenPayload | null {
  try {
    if (token.startsWith('att_')) {
      const crypto = getCrypto();
      const key = getAttachmentTokenKey();
      if (!crypto || !key) return null;

      const envelope = JSON.parse(decodeBase64Url(token.slice(4))) as {
        iv?: string;
        tag?: string;
        data?: string;
      };
      if (!envelope.iv || !envelope.tag || !envelope.data) return null;

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(envelope.iv, 'base64url'),
      );
      decipher.setAAD(Buffer.from('wealth-ai-attachment-token-v2', 'utf8'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(envelope.data, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      const parsed = JSON.parse(decrypted) as Partial<AttachmentTokenPayload>;
      if (!parsed.fileId) return null;
      return {
        fileId: parsed.fileId,
        transactionId: parsed.transactionId,
        scopeTag: parsed.scopeTag,
        tourId: parsed.tourId,
        itemId: parsed.itemId,
        itemType: parsed.itemType,
      };
    }

    const parsed = JSON.parse(decodeBase64Url(token)) as Partial<AttachmentTokenPayload>;
    if (!parsed.fileId) return null;
    return {
      fileId: parsed.fileId,
      transactionId: parsed.transactionId,
      scopeTag: parsed.scopeTag,
      tourId: parsed.tourId,
      itemId: parsed.itemId,
      itemType: parsed.itemType,
    };
  } catch {
    return null;
  }
}

// Dynamically require Node's crypto module to prevent client-side Next.js/Webpack bundler errors
const getCrypto = () => {
  if (typeof window === 'undefined') {
    return eval("require('crypto')");
  }
  return null;
};

export function encryptScopeTag(text: string): string {
  const crypto = getCrypto();
  if (!crypto) return '';
  const secret = process.env.JWT_SECRET || 'fallback_secret_key_1234567890123456';
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptScopeTag(encryptedText: string): string {
  const crypto = getCrypto();
  if (!crypto) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return '';
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const secret = process.env.JWT_SECRET || 'fallback_secret_key_1234567890123456';
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Decryption failed:', e);
    return '';
  }
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
