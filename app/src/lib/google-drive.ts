import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import { google, drive_v3 } from 'googleapis';

import {
  MAX_ATTACHMENT_FILES,
  MAX_ATTACHMENT_SIZE_BYTES,
  type AttachmentRecord,
  inferAttachmentPreviewKind,
  isAttachmentPrintable,
  encryptScopeTag,
  decryptScopeTag,
} from '@/lib/transaction-attachments';
import { queryAll, queryOne } from '@/lib/db';

const DRIVE_SCOPE = ['https://www.googleapis.com/auth/drive'];
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const APP_PROP_TYPE = 'budgetAiType';
const APP_PROP_USER_ID = 'budgetAiUserId';
const APP_PROP_TOUR_ID = 'budgetAiTourId';
const USER_FOLDER_TYPE = 'user-folder';
const TOUR_FOLDER_TYPE = 'tour-folder';
const LOCAL_ENV_FILES = ['.env.local', '.env'];
const FOLDER_CACHE_TTL_MS = 5 * 60 * 1000;

type DriveAppProperties = Record<string, string>;

interface DriveFolderRecord {
  folderId: string;
  folderUrl: string;
  folderName: string;
  appProperties: DriveAppProperties | null;
}

const transactionFolderCache = new Map<string, { folderId: string; folderUrl: string; expiresAt: number }>();

export interface AttachmentContentResult {
  file: AttachmentRecord;
  contentType: string;
  contentLength: string | null;
  contentRange: string | null;
  etag: string | null;
  lastModified: string | null;
  status: number;
  stream: Readable;
}

export interface DriveUserIdentity {
  userId: number;
  name?: string | null;
  email?: string | null;
}

// ────── Error Helpers ──────

function extractGoogleApiMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null) {
    const e = error as {
      response?: { data?: { error?: { message?: string } } };
      errors?: Array<{ message?: string }>;
    };
    if (e.response?.data?.error?.message) return e.response.data.error.message;
    if (e.errors?.[0]?.message) return e.errors[0].message;
  }
  return null;
}

function toFriendlyError(error: unknown) {
  const msg = extractGoogleApiMessage(error) ?? 'Unable to reach the storage server right now.';
  console.error('[Storage Error]', msg, error);
  
  if (msg.includes('Google Drive API has not been used') || msg.includes('drive.googleapis.com'))
    return new Error('Storage API is disabled. Please contact support.');
  if (msg.includes('Service Usage API has not been used'))
    return new Error('Storage services are not fully enabled. Please contact support.');
  if (msg.includes('File not found') || msg.includes('insufficientFilePermissions'))
    return new Error('Storage folder is not accessible. Please check permissions.');
  if (msg.includes('Service Accounts do not have storage quota'))
    return new Error('Storage accounts do not have sufficient quota.');
  return new Error(msg);
}

// ────── Config Helpers ──────

function readConfigValue(key: string) {
  return process.env[key]?.trim();
}

async function loadLocalEnvValues() {
  const values: Record<string, string> = {};
  for (const fileName of LOCAL_ENV_FILES) {
    try {
      const content = await readFile(path.join(process.cwd(), fileName), 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const sep = trimmed.indexOf('=');
        if (sep === -1) continue;
        const key = trimmed.slice(0, sep).trim();
        let val = trimmed.slice(sep + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        if (!key || key in values) continue;
        values[key] = val;
      }
    } catch { continue; }
  }
  return values;
}

async function readConfigAsync(key: string) {
  const v = process.env[key]?.trim();
  if (v) return v;
  const locals = await loadLocalEnvValues();
  return locals[key]?.trim();
}

function getDriveRootFolderId() {
  const raw = readConfigValue('GOOGLE_DRIVE_ROOT_FOLDER_ID');
  if (!raw) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID is not set.');
  const match = raw.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1];
  return match ?? raw;
}

// ────── Auth ──────

async function getDriveClient() {
  const oauthClientId = await readConfigAsync('GOOGLE_DRIVE_OAUTH_CLIENT_ID');
  const oauthClientSecret = await readConfigAsync('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET');
  const oauthRefreshToken = await readConfigAsync('GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN');

  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    const auth = new google.auth.OAuth2(oauthClientId, oauthClientSecret);
    auth.setCredentials({ refresh_token: oauthRefreshToken });
    return google.drive({ version: 'v3', auth });
  }

  // Service Account fallback
  const rawJson = await readConfigAsync('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
  let credentials: { client_email?: string; private_key?: string; project_id?: string } = {};

  if (rawJson) {
    credentials = JSON.parse(rawJson);
  } else {
    const saFile = await readConfigAsync('GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE');
    if (saFile) {
      try {
        credentials = JSON.parse(await readFile(saFile, 'utf8'));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT')
          throw new Error(`Service account file not found: "${saFile}".`);
        throw e;
      }
    } else {
      credentials = {
        client_email: await readConfigAsync('GOOGLE_DRIVE_CLIENT_EMAIL'),
        private_key: (await readConfigAsync('GOOGLE_DRIVE_PRIVATE_KEY'))?.replace(/\\n/g, '\n'),
      };
    }
  }

  if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error(
      'Secure storage is not configured. Please check environment variables.'
    );
  }

  const auth = new google.auth.GoogleAuth({ credentials, scopes: DRIVE_SCOPE });
  return google.drive({ version: 'v3', auth });
}

// ────── Folder Operations ──────

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeFolderName(value: string | null | undefined, fallback: string) {
  const t = value?.trim();
  return t && t.length > 0 ? t : fallback;
}

function normalizeFolderKey(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildFolderUrl(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function getTransactionFolderCacheKey(identity: DriveUserIdentity, folderLabel: string, tourId?: number) {
  return `${tourId ? `tour:${tourId}` : `user:${identity.userId}`}::${normalizeFolderKey(folderLabel)}`;
}

function getCachedTransactionFolder(key: string) {
  const cached = transactionFolderCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    transactionFolderCache.delete(key);
    return null;
  }
  return { folderId: cached.folderId, folderUrl: cached.folderUrl };
}

function setCachedTransactionFolder(key: string, folderId: string, folderUrl: string) {
  transactionFolderCache.set(key, {
    folderId,
    folderUrl,
    expiresAt: Date.now() + FOLDER_CACHE_TTL_MS,
  });
}

function mapDriveFile(file: drive_v3.Schema$File): AttachmentRecord {
  return {
    id: file.id ?? '',
    name: file.name ?? 'Untitled file',
    mimeType: file.mimeType ?? null,
    size: Number(file.size ?? 0),
    modifiedTime: file.modifiedTime ?? null,
  };
}

function mapDriveFolder(file: drive_v3.Schema$File): DriveFolderRecord {
  const folderId = file.id;
  if (!folderId) throw new Error('Drive returned a folder without an ID.');
  return {
    folderId,
    folderUrl: buildFolderUrl(folderId),
    folderName: file.name ?? 'Untitled Folder',
    appProperties: (file.appProperties as DriveAppProperties | undefined) ?? null,
  };
}

async function listFoldersIn(drive: drive_v3.Drive, parentId: string) {
  try {
    const folders: DriveFolderRecord[] = [];
    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: [
          `'${escapeDriveQuery(parentId)}' in parents`,
          `mimeType = '${DRIVE_FOLDER_MIME}'`,
          'trashed = false',
        ].join(' and '),
        fields: 'nextPageToken, files(id,name,appProperties)',
        pageSize: 1000,
        pageToken,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
      folders.push(...(res.data.files ?? []).map(mapDriveFolder));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return folders;
  } catch (error) { throw toFriendlyError(error); }
}

async function createFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
  appProperties?: DriveAppProperties,
): Promise<DriveFolderRecord> {
  try {
    const res = await drive.files.create({
      requestBody: {
        name,
        mimeType: DRIVE_FOLDER_MIME,
        parents: [parentId],
        ...(appProperties ? { appProperties } : {}),
      },
      fields: 'id,name,appProperties',
      supportsAllDrives: true,
    });
    return mapDriveFolder(res.data);
  } catch (error) { throw toFriendlyError(error); }
}

async function updateFolderProps(drive: drive_v3.Drive, folder: DriveFolderRecord, props: DriveAppProperties) {
  try {
    const res = await drive.files.update({
      fileId: folder.folderId,
      requestBody: { appProperties: { ...(folder.appProperties ?? {}), ...props } },
      fields: 'id,name,appProperties',
      supportsAllDrives: true,
    });
    return mapDriveFolder(res.data);
  } catch (error) { throw toFriendlyError(error); }
}

function buildUserFolderProps(userId: number): DriveAppProperties {
  return { [APP_PROP_TYPE]: USER_FOLDER_TYPE, [APP_PROP_USER_ID]: String(userId) };
}

function getFolderUserId(props: DriveAppProperties | null | undefined) {
  return props?.[APP_PROP_USER_ID] ?? null;
}

function resolveCollisionSafeName(folders: DriveFolderRecord[], preferred: string, userId: number) {
  const collides = folders.some((f) => {
    const existingId = getFolderUserId(f.appProperties);
    return normalizeFolderKey(f.folderName) === normalizeFolderKey(preferred) && existingId !== String(userId);
  });
  return collides ? `${preferred} (${userId})` : preferred;
}

function resolveDriveUsername(identity: DriveUserIdentity) {
  const name = identity.name?.trim();
  if (name) return name;
  const emailPrefix = identity.email?.split('@')[0]?.trim();
  if (emailPrefix) return emailPrefix;
  return `WealthAI-${identity.userId}`;
}

async function resolveUserFolder(drive: drive_v3.Drive, identity: DriveUserIdentity, create: boolean) {
  const rootId = getDriveRootFolderId();
  const rootFolders = await listFoldersIn(drive, rootId);
  const existing = rootFolders.find((f) => getFolderUserId(f.appProperties) === String(identity.userId) && f.appProperties?.[APP_PROP_TYPE] === USER_FOLDER_TYPE);

  if (existing) return existing;

  if (!create) return null;

  const preferredName = resolveDriveUsername(identity);
  const safeName = resolveCollisionSafeName(rootFolders, preferredName, identity.userId);

  // Check if an unclaimed folder with that name exists
  const unclaimed = rootFolders.find(
    (f) => normalizeFolderKey(f.folderName) === normalizeFolderKey(safeName) && !getFolderUserId(f.appProperties)
  );
  if (unclaimed) return await updateFolderProps(drive, unclaimed, buildUserFolderProps(identity.userId));

  return await createFolder(drive, rootId, safeName, buildUserFolderProps(identity.userId));
}

function buildTourFolderProps(tourId: number): DriveAppProperties {
  return { [APP_PROP_TYPE]: TOUR_FOLDER_TYPE, [APP_PROP_TOUR_ID]: String(tourId) };
}

async function resolveTourFolder(drive: drive_v3.Drive, tourId: number, create: boolean) {
  const rootId = getDriveRootFolderId();
  const rootFolders = await listFoldersIn(drive, rootId);
  const existing = rootFolders.find((f) => f.appProperties?.[APP_PROP_TOUR_ID] === String(tourId) && f.appProperties?.[APP_PROP_TYPE] === TOUR_FOLDER_TYPE);

  if (existing) return existing;

  if (!create) return null;

  const folderName = `Tour ${tourId} Attachments`;
  return await createFolder(drive, rootId, folderName, buildTourFolderProps(tourId));
}

async function ensureSubFolder(drive: drive_v3.Drive, parentId: string, name: string, create: boolean) {
  const siblings = await listFoldersIn(drive, parentId);
  const match = siblings.find((f) => normalizeFolderKey(f.folderName) === normalizeFolderKey(name));
  if (match) return match;
  if (!create) return null;
  return await createFolder(drive, parentId, name);
}

async function resolveTransactionFolder(
  drive: drive_v3.Drive,
  identity: DriveUserIdentity,
  folderLabel: string,
  create: boolean,
  tourId?: number,
) {
  const cacheKey = getTransactionFolderCacheKey(identity, folderLabel, tourId);
  const cached = getCachedTransactionFolder(cacheKey);
  if (cached) return cached;

  let parentFolder: DriveFolderRecord | null = null;
  
  if (tourId) {
    parentFolder = await resolveTourFolder(drive, tourId, create);
  } else {
    parentFolder = await resolveUserFolder(drive, identity, create);
  }
  
  if (!parentFolder) return { folderId: null, folderUrl: null };
  const normalized = normalizeFolderName(folderLabel, 'Receipts');
  const txFolder = await ensureSubFolder(drive, parentFolder.folderId, normalized, create);
  if (!txFolder) return { folderId: null, folderUrl: parentFolder.folderUrl };
  setCachedTransactionFolder(cacheKey, txFolder.folderId, txFolder.folderUrl);
  return { folderId: txFolder.folderId, folderUrl: txFolder.folderUrl };
}

// Helper to verify if user is part of a tour's roster
async function verifyTourRoster(tourId: number, userId: number): Promise<void> {
  const tourRow = await queryOne<{ created_by: number }>('SELECT created_by FROM tours WHERE id = ?', [tourId]);
  if (!tourRow) {
    throw new Error('Access denied: Tour not found.');
  }
  const creatorId = tourRow.created_by;

  const participantRows = await queryAll<{ user_id: number | null }>(
    'SELECT user_id FROM tour_participants WHERE tour_id = ?',
    [tourId]
  );

  const userIds = new Set<number>();
  userIds.add(creatorId);
  participantRows.forEach(p => {
    if (p.user_id !== null && p.user_id !== undefined) {
      userIds.add(p.user_id);
    }
  });

  if (!userIds.has(userId)) {
    throw new Error('Access denied: User not in authorized roster.');
  }
}

// ────── Public API ──────

export async function listTransactionAttachments(params: {
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  folderLabel: string;
  tourId?: number;
}) {
  if (params.tourId) {
    await verifyTourRoster(params.tourId, params.userId);
  }

  const drive = await getDriveClient();
  const folder = await resolveTransactionFolder(
    drive,
    { userId: params.userId, name: params.userName, email: params.userEmail },
    params.folderLabel,
    false,
    params.tourId,
  );

  if (!folder.folderId) {
    return {
      files: [] as AttachmentRecord[],
      limit: { maxFiles: MAX_ATTACHMENT_FILES, maxFileSizeBytes: MAX_ATTACHMENT_SIZE_BYTES },
    };
  }

  try {
    const res = await drive.files.list({
      q: [
        `'${escapeDriveQuery(folder.folderId)}' in parents`,
        `mimeType != '${DRIVE_FOLDER_MIME}'`,
        'trashed = false',
      ].join(' and '),
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: MAX_ATTACHMENT_FILES,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    return {
      files: (res.data.files ?? []).map(mapDriveFile),
      limit: { maxFiles: MAX_ATTACHMENT_FILES, maxFileSizeBytes: MAX_ATTACHMENT_SIZE_BYTES },
    };
  } catch (error) { throw toFriendlyError(error); }
}

export async function uploadFilesToTransaction(params: {
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  folderLabel: string;
  files: File[];
  tourId?: number;
}) {
  if (params.tourId) {
    await verifyTourRoster(params.tourId, params.userId);
  }

  const drive = await getDriveClient();
  const folder = await resolveTransactionFolder(
    drive,
    { userId: params.userId, name: params.userName, email: params.userEmail },
    params.folderLabel,
    true,
    params.tourId,
  );

  if (!folder.folderId || !folder.folderUrl) throw new Error('Unable to resolve the Drive folder.');

  let appProperties: DriveAppProperties = {};
  if (params.tourId) {
    const tourRow = await queryOne<{ created_by: number }>('SELECT created_by FROM tours WHERE id = ?', [params.tourId]);
    const creatorId = tourRow?.created_by;

    const participantRows = await queryAll<{ user_id: number | null }>(
      'SELECT user_id FROM tour_participants WHERE tour_id = ?',
      [params.tourId]
    );

    const userIds = new Set<number>();
    if (creatorId !== undefined) userIds.add(creatorId);
    participantRows.forEach(p => {
      if (p.user_id !== null && p.user_id !== undefined) {
        userIds.add(p.user_id);
      }
    });

    const scopeTagRaw = Array.from(userIds).sort().join(',');
    const encryptedScopeTag = encryptScopeTag(scopeTagRaw);

    appProperties = {
      tourId: String(params.tourId),
      scopeTag: encryptedScopeTag,
    };
  }

  try {
    const uploaded = await Promise.all(params.files.map(async (file) => {
      const mimeType = file.type || 'application/octet-stream';
      const res = await drive.files.create({
        requestBody: { 
          name: file.name, 
          parents: [folder.folderId],
          ...(Object.keys(appProperties).length > 0 ? { appProperties } : {})
        },
        media: { mimeType, body: Readable.fromWeb(file.stream() as any) },  
        fields: 'id,name,mimeType,size,modifiedTime,appProperties',
        supportsAllDrives: true,
      });
      return mapDriveFile(res.data);
    }));
    return { files: uploaded, folderUrl: folder.folderUrl };
  } catch (error) { throw toFriendlyError(error); }
}

async function resolveAttachment(
  drive: drive_v3.Drive,
  identity: DriveUserIdentity,
  folderLabel: string,
  fileId: string,
  tourId?: number,
) {
  if (tourId) {
    await verifyTourRoster(tourId, identity.userId);
  }

  const folder = await resolveTransactionFolder(drive, identity, folderLabel, false, tourId);
  if (!folder.folderId) throw new Error('This transaction does not have an attachment folder.');

  try {
    const res = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,size,modifiedTime,parents,appProperties',
      supportsAllDrives: true,
    });

    const parents = res.data.parents ?? [];
    if (!parents.includes(folder.folderId)) throw new Error('File does not belong to this transaction.');

    const appProps = (res.data.appProperties as Record<string, string> | undefined) || {};
    const fileTourId = appProps.tourId ? parseInt(appProps.tourId, 10) : undefined;

    if (tourId) {
      if (fileTourId !== tourId) {
        throw new Error('Access denied: Tour ID mismatch.');
      }
      if (appProps.scopeTag) {
        const decryptedUsers = decryptScopeTag(appProps.scopeTag);
        const allowedUserIds = decryptedUsers.split(',').map(id => parseInt(id, 10));
        if (!allowedUserIds.includes(identity.userId)) {
          throw new Error('Access denied: User not in authorized roster.');
        }
      }
    } else {
      if (fileTourId !== undefined) {
        throw new Error('Access denied: Tour attachments cannot be accessed globally.');
      }
    }

    return { file: mapDriveFile(res.data), folderId: folder.folderId };
  } catch (error) { throw toFriendlyError(error); }
}

export async function getAttachmentMetadata(params: {
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  folderLabel: string;
  fileId: string;
  tourId?: number;
}) {
  const drive = await getDriveClient();
  const attachment = await resolveAttachment(
    drive,
    { userId: params.userId, name: params.userName, email: params.userEmail },
    params.folderLabel,
    params.fileId,
    params.tourId,
  );

  return {
    ...attachment,
    previewKind: inferAttachmentPreviewKind(attachment.file.name, attachment.file.mimeType),
    printable: isAttachmentPrintable(attachment.file.name, attachment.file.mimeType),
  };
}

export async function getAttachmentContent(params: {
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  folderLabel: string;
  fileId: string;
  range?: string | null;
  tourId?: number;
}): Promise<AttachmentContentResult> {
  const drive = await getDriveClient();
  const attachment = await resolveAttachment(
    drive,
    { userId: params.userId, name: params.userName, email: params.userEmail },
    params.folderLabel,
    params.fileId,
    params.tourId,
  );

  try {
    const response = await drive.files.get(
      { fileId: params.fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream', headers: params.range ? { Range: params.range } : undefined },
    );

    return {
      file: attachment.file,
      contentType: response.headers['content-type'] ?? attachment.file.mimeType ?? 'application/octet-stream',
      contentLength: response.headers['content-length'] ?? null,
      contentRange: response.headers['content-range'] ?? null,
      etag: response.headers.etag ?? null,
      lastModified: response.headers['last-modified'] ?? null,
      status: response.status ?? (params.range ? 206 : 200),
      stream: response.data as Readable,
    };
  } catch (error) { throw toFriendlyError(error); }
}

export async function deleteTransactionAttachment(params: {
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  folderLabel: string;
  fileId: string;
  tourId?: number;
}): Promise<void> {
  const drive = await getDriveClient();
  // Ensure the user actually owns the file via resolveAttachment
  await resolveAttachment(
    drive,
    { userId: params.userId, name: params.userName, email: params.userEmail },
    params.folderLabel,
    params.fileId,
    params.tourId,
  );

  try {
    await drive.files.delete({
      fileId: params.fileId,
      supportsAllDrives: true,
    });
  } catch (error) { throw toFriendlyError(error); }
}

export async function uploadChatAttachmentsToGemini(params: {
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  sessionId: string;
  files: File[];
}) {
  const drive = await getDriveClient();
  
  // 1. Ensure "Gemini" folder inside Root
  const driveRootId = getDriveRootFolderId();
  const geminiFolder = await ensureSubFolder(drive, driveRootId, 'Gemini', true);
  if (!geminiFolder) throw new Error('Could not resolve Gemini folder');

  // 2. Ensure User folder inside Gemini
  const identity = { userId: params.userId, name: params.userName, email: params.userEmail };
  const preferredName = resolveDriveUsername(identity);
  const userFolder = await ensureSubFolder(drive, geminiFolder.folderId, preferredName, true);
  if (!userFolder) throw new Error('Could not resolve User folder in Gemini');

  // 3. Ensure Session folder inside User folder
  const sessionFolder = await ensureSubFolder(drive, userFolder.folderId, params.sessionId, true);
  if (!sessionFolder) throw new Error('Could not resolve Session folder');

  // 4. Upload files
  const uploaded: AttachmentRecord[] = [];
  try {
    for (const file of params.files) {
      const mimeType = file.type || 'application/octet-stream';
      const res = await drive.files.create({
        requestBody: { name: file.name, parents: [sessionFolder.folderId] },
        media: { mimeType, body: Readable.fromWeb(file.stream() as any) },  
        fields: 'id,name,mimeType,size,modifiedTime',
        supportsAllDrives: true,
      });
      uploaded.push(mapDriveFile(res.data));
    }
  } catch (error) { throw toFriendlyError(error); }

  return { files: uploaded, folderUrl: sessionFolder.folderUrl };
}
