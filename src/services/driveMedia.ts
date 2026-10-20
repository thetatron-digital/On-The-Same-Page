// ============================================
// DAILIES MEDIA ON GOOGLE DRIVE
// ============================================
// Clips go to "OTSP Projects/Dailies Media" in the uploader's Drive with
// a resumable upload, sent in parts like Frame.io's uploader (batch ->
// parts), so a dropped connection resumes instead of starting over.
// Free: the user's own Drive quota.

import { googleDrive } from './googleDrive';
import { GOOGLE_CONFIG } from '../types/user';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
export const PART_SIZE = 8 * 1024 * 1024; // multiple of 256 KiB, as Drive requires
const MEDIA_FOLDER = 'Dailies Media';

const folderIds = new Map<string, string>();

// A subfolder of "OTSP Projects" (created on first use)
async function getMediaFolder(name = MEDIA_FOLDER): Promise<string> {
  const known = folderIds.get(name);
  if (known) return known;
  const headers = await googleDrive.authHeader();
  const parent = await googleDrive.getAppFolder();
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parent}' in parents and mimeType='${GOOGLE_CONFIG.MIME_TYPES.FOLDER}' and trashed=false`;
  const found = await fetch(`${DRIVE_API}/files?` + new URLSearchParams({ q, fields: 'files(id)', spaces: 'drive' }), { headers });
  if (!found.ok) throw new Error('Could not find the dailies folder in Drive');
  const existing = (await found.json()).files?.[0]?.id as string | undefined;
  if (existing) { folderIds.set(name, existing); return existing; }
  const created = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: GOOGLE_CONFIG.MIME_TYPES.FOLDER, parents: [parent] }),
  });
  if (!created.ok) throw new Error(`Could not create the ${name} folder in Drive`);
  const id = (await created.json()).id as string;
  folderIds.set(name, id);
  return id;
}

export interface UploadProgress {
  sent: number;
  total: number;
}

/** Next byte Drive wants, from a 308 response's Range header ("bytes=0-1234") */
export const nextOffset = (range: string | null) => (range ? Number(range.split('-')[1]) + 1 : 0);

/**
 * Upload a file to Drive in parts. Resumes after network errors (up to a
 * few retries per part). Returns the Drive file id.
 */
export async function uploadToDrive(
  file: Blob,
  name: string,
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal,
  retries = 4,
  folderName = MEDIA_FOLDER
): Promise<string> {
  const headers = await googleDrive.authHeader();
  const folder = await getMediaFolder(folderName);
  const mime = file.type || 'application/octet-stream';
  const start = await fetch(`${UPLOAD_API}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(file.size) },
    body: JSON.stringify({ name, parents: [folder], mimeType: mime }),
    signal,
  });
  if (!start.ok) throw new Error('Drive would not start the upload');
  const session = start.headers.get('Location');
  if (!session) throw new Error('Drive did not return an upload session');

  let offset = 0;
  let failures = 0;
  onProgress?.({ sent: 0, total: file.size });
  for (;;) {
    const end = Math.min(offset + PART_SIZE, file.size);
    let response: Response;
    try {
      response = await fetch(session, {
        method: 'PUT',
        headers: { 'Content-Range': file.size ? `bytes ${offset}-${end - 1}/${file.size}` : 'bytes */0' },
        body: file.slice(offset, end),
        signal,
      });
    } catch (error) {
      if (signal?.aborted || ++failures > retries) throw error;
      // Ask Drive how much it has, then carry on from there
      await new Promise((r) => setTimeout(r, 500 * 2 ** failures));
      const status = await fetch(session, { method: 'PUT', headers: { 'Content-Range': `bytes */${file.size}` }, signal }).catch(() => null);
      if (status?.status === 308) offset = nextOffset(status.headers.get('Range'));
      continue;
    }
    if (response.status === 308) {
      offset = nextOffset(response.headers.get('Range'));
      failures = 0;
      onProgress?.({ sent: offset, total: file.size });
      continue;
    }
    if (response.ok) {
      onProgress?.({ sent: file.size, total: file.size });
      return (await response.json()).id as string;
    }
    if (response.status >= 500 && ++failures <= retries) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** failures));
      continue;
    }
    throw new Error(`Upload failed (${response.status})`);
  }
}

/** Download a Drive file, reporting progress */
export async function downloadFromDrive(fileId: string, onProgress?: (p: UploadProgress) => void, signal?: AbortSignal): Promise<Blob> {
  const headers = await googleDrive.authHeader();
  const response = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers, signal });
  if (response.status === 403 || response.status === 404) throw new MediaAccessError(fileId);
  if (!response.ok || !response.body) throw new Error('Could not download the clip from Drive');
  const total = Number(response.headers.get('Content-Length')) || 0;
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    received += value.length;
    onProgress?.({ sent: received, total });
  }
  return new Blob(parts as BlobPart[], { type: response.headers.get('Content-Type') || '' });
}

/** A clip in someone else's Drive that OTSP hasn't been given access to */
export class MediaAccessError extends Error {
  fileId: string;
  constructor(fileId: string) {
    super('OTSP needs access to this clip in Google Drive.');
    this.fileId = fileId;
  }
}

/** Let everyone on the project watch these clips (read-only, no email) */
export async function shareMediaWith(fileIds: string[], emails: string[]): Promise<void> {
  const headers = await googleDrive.authHeader();
  await Promise.all(fileIds.flatMap((id) => emails.map((emailAddress) =>
    fetch(`${DRIVE_API}/files/${id}/permissions?sendNotificationEmail=false`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'user', role: 'reader', emailAddress }),
    }).catch(() => null)
  )));
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const headers = await googleDrive.authHeader();
  // Trash, not delete: recoverable from Drive's bin
  await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  }).catch(() => null);
}

/** Replace a Drive file's content (same file id and link; no email to anyone) */
export async function replaceDriveFile(fileId: string, blob: Blob): Promise<void> {
  const headers = await googleDrive.authHeader();
  const response = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  });
  if (!response.ok) throw new Error('Could not update the file in Drive');
}

/** Share a file with one person; Google emails them `message` when `notify` */
export async function shareFileWith(fileId: string, email: string, role: 'reader' | 'commenter', message: string, notify: boolean): Promise<void> {
  const headers = await googleDrive.authHeader();
  const params = new URLSearchParams({ sendNotificationEmail: String(notify), ...(notify ? { emailMessage: message } : {}) });
  const response = await fetch(`${DRIVE_API}/files/${fileId}/permissions?${params}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'user', role, emailAddress: email }),
  });
  if (!response.ok) throw new Error(`Could not send to ${email}`);
}

/** Link that opens the file in Drive */
export async function driveFileLink(fileId: string): Promise<string> {
  const headers = await googleDrive.authHeader();
  const response = await fetch(`${DRIVE_API}/files/${fileId}?fields=webViewLink`, { headers });
  if (!response.ok) return `https://drive.google.com/file/d/${fileId}/view`;
  return (await response.json()).webViewLink as string;
}

/** Comments people left on a file (newest first) */
export async function driveFileComments(fileId: string): Promise<{ author?: { displayName?: string; emailAddress?: string }; content?: string; createdTime?: string }[]> {
  const headers = await googleDrive.authHeader();
  const fields = 'comments(author(displayName,emailAddress),content,createdTime,replies(author(displayName,emailAddress),content,createdTime))';
  const response = await fetch(`${DRIVE_API}/files/${fileId}/comments?` + new URLSearchParams({ fields, pageSize: '100' }), { headers });
  if (!response.ok) throw new Error('Could not read comments on the call sheet');
  const { comments = [] } = await response.json();
  // Replies count too ("Confirmed" as a reply to the AD's comment)
  return comments.flatMap((c: { replies?: unknown[] } & Record<string, unknown>) => [c, ...((c.replies ?? []) as Record<string, unknown>[])]);
}
