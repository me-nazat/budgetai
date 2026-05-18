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
} from '@/lib/transaction-attachments';

const DRIVE_SCOPE = ['https://www.googleapis.com/auth/drive'];
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const APP_PROP_TYPE = 'budgetAiType';
const APP_PROP_USER_ID = 'budgetAiUserId';
const USER_FOLDER_TYPE = 'user-folder';
const LOCAL_ENV_FILES = ['.env.local', '.env'];

type DriveAppProperties = Record<string, string>;

interface DriveFolderRecord {
  folderId: string;
  folderUrl: string;
  folderName: string;
  appProperties: DriveAppProperties | null;
}

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
  const msg = extractGoogleApiMessage(error) ?? 'Unable to reach Google Drive right now.';
  if (msg.includes('Google Drive API has not been used') || msg.includes('drive.googleapis.com'))
    return new Error('Google Drive API is disabled. Enable drive.googleapis.com in Google Cloud Console.');
  if (msg.includes('Service Usage API has not been used'))
    return new Error('Enable serviceusage.googleapis.com first, then Google Drive API.');
  if (msg.includes('File not found') || msg.includes('insufficientFilePermissions'))
    return new Error('Drive folder is not accessible. Share the root folder with the service account email.');
  if (msg.includes('Service Accounts do not have storage quota'))
    return new Error('Use OAuth credentials for personal Drive uploads. Service accounts cannot store files in personal drives.');
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
      'Google Drive is not configured. Set OAuth credentials (GOOGLE_DRIVE_OAUTH_CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN) or service account credentials.'
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
  const existing = rootFolders.find((f) => getFolderUserId(f.appProperties) === String(identity.userId));

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
) {
  const userFolder = await resolveUserFolder(drive, identity, create);
  if (!userFolder) return { folderId: null, folderUrl: null };
  const normalized = normalizeFolderName(folderLabel, 'Receipts');
  const txFolder = await ensureSubFolder(drive, userFolder.folderId, normalized, create);
  if (!txFolder) return { folderId: null, folderUrl: userFolder.folderUrl };
  return { folderId: txFolder.folderId, folderUrl: txFolder.folderUrl };
}

// ────── Public API ──────

export async function listTransactionAttachments(params: {
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  folderLabel: string;
}) {
  const drive = await getDriveClient();
  const folder = await resolveTransactionFolder(
    drive,
    { userId: params.userId, name: params.userName, email: params.userEmail },
    params.folderLabel,
    false,
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
}) {
  const drive = await getDriveClient();
  const folder = await resolveTransactionFolder(
    drive,
    { userId: params.userId, name: params.userName, email: params.userEmail },
    params.folderLabel,
    true,
  );

  if (!folder.folderId || !folder.folderUrl) throw new Error('Unable to resolve the Drive folder.');

  const uploaded: AttachmentRecord[] = [];
  try {
    for (const file of params.files) {
      const mimeType = file.type || 'application/octet-stream';
      const res = await drive.files.create({
        requestBody: { name: file.name, parents: [folder.folderId] },
        media: { mimeType, body: Readable.fromWeb(file.stream() as any) },
        fields: 'id,name,mimeType,size,modifiedTime',
        supportsAllDrives: true,
      });
      uploaded.push(mapDriveFile(res.data));
    }
  } catch (error) { throw toFriendlyError(error); }

  return { files: uploaded, folderUrl: folder.folderUrl };
}

async function resolveAttachment(
  drive: drive_v3.Drive,
  identity: DriveUserIdentity,
  folderLabel: string,
  fileId: string,
) {
  const folder = await resolveTransactionFolder(drive, identity, folderLabel, false);
  if (!folder.folderId) throw new Error('This transaction does not have an attachment folder.');

  try {
    const res = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,size,modifiedTime,parents',
      supportsAllDrives: true,
    });

    const parents = res.data.parents ?? [];
    if (!parents.includes(folder.folderId)) throw new Error('File does not belong to this transaction.');

    return { file: mapDriveFile(res.data), folderId: folder.folderId };
  } catch (error) { throw toFriendlyError(error); }
}

export async function getAttachmentMetadata(params: {
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  folderLabel: string;
  fileId: string;
}) {
  const drive = await getDriveClient();
  const attachment = await resolveAttachment(
    drive,
    { userId: params.userId, name: params.userName, email: params.userEmail },
    params.folderLabel,
    params.fileId,
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
}): Promise<AttachmentContentResult> {
  const drive = await getDriveClient();
  const attachment = await resolveAttachment(
    drive,
    { userId: params.userId, name: params.userName, email: params.userEmail },
    params.folderLabel,
    params.fileId,
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
