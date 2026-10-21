// ============================================
// DAILIES MEDIA STORE
// ============================================
// Clip bytes never go in the project file. They are kept in this
// browser's IndexedDB (always, as a cache) and, for Google Drive
// projects, uploaded to the uploader's Drive so collaborators can stream
// them. Free: browser storage + the user's own Drive quota.

import type { MediaRef } from '../types/dailies';
import { downloadFromDrive, deleteFromDrive, uploadToDrive, type UploadProgress } from './driveMedia';

export interface BlobCache {
  get(key: string): Promise<Blob | undefined>;
  put(key: string, blob: Blob): Promise<void>;
  delete(key: string): Promise<void>;
}

const DB = 'otsp-media';
const STORE = 'blobs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const idbCache: BlobCache = {
  async get(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
  },
  async put(key, blob) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Not enough browser storage for this clip'));
    });
  },
  async delete(key) {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },
};

let cache: BlobCache = idbCache;
/** Tests swap in an in-memory cache */
export const setBlobCache = (next: BlobCache) => { cache = next; urls.clear(); };

const cacheKey = (ref: Pick<MediaRef, 'store' | 'id'>) => (ref.store === 'drive' ? `drive:${ref.id}` : ref.id);
const newLocalId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Keep a new clip: in this browser, and in Drive when `toDrive`. Returns
 * the reference the project stores.
 */
export async function storeClipMedia(
  file: File,
  opts: { toDrive: boolean; onProgress?: (p: UploadProgress) => void; signal?: AbortSignal }
): Promise<MediaRef> {
  const base = { mime: file.type || 'application/octet-stream', size: file.size, fileName: file.name };
  if (opts.toDrive) {
    const id = await uploadToDrive(file, file.name, opts.onProgress, opts.signal);
    const ref: MediaRef = { store: 'drive', id, ...base };
    await cache.put(cacheKey(ref), file).catch(() => {}); // cache is best effort
    return ref;
  }
  const ref: MediaRef = { store: 'local', id: newLocalId(), ...base };
  await cache.put(cacheKey(ref), file);
  opts.onProgress?.({ sent: file.size, total: file.size });
  return ref;
}

/** The clip's bytes: from this browser, or downloaded from Drive (then cached) */
export async function getClipBlob(ref: MediaRef, onProgress?: (p: UploadProgress) => void, signal?: AbortSignal): Promise<Blob> {
  const cached = await cache.get(cacheKey(ref)).catch(() => undefined);
  if (cached) return cached;
  if (ref.store === 'local') throw new Error('This clip was added in another browser and only lives there. Re-add it here, or use a Google Drive project to share clips.');
  const blob = await downloadFromDrive(ref.id, onProgress, signal);
  await cache.put(cacheKey(ref), blob).catch(() => {});
  return blob;
}

const urls = new Map<string, string>();

/** An object URL for playing the clip (one per clip per page) */
export async function clipUrl(ref: MediaRef, onProgress?: (p: UploadProgress) => void, signal?: AbortSignal): Promise<string> {
  const key = cacheKey(ref);
  const existing = urls.get(key);
  if (existing) return existing;
  const url = URL.createObjectURL(await getClipBlob(ref, onProgress, signal));
  urls.set(key, url);
  return url;
}

/** The bytes kept in this browser, if any (never downloads) */
export async function getCachedBlob(ref: MediaRef): Promise<Blob | undefined> {
  return cache.get(cacheKey(ref)).catch(() => undefined);
}

/** Keep bytes for a reference in this browser (restoring a backup) */
export async function cacheBlob(ref: MediaRef, blob: Blob): Promise<void> {
  await cache.put(cacheKey(ref), blob);
}

export async function isClipCached(ref: MediaRef): Promise<boolean> {
  return !!(await cache.get(cacheKey(ref)).catch(() => undefined));
}

/** Forget a deleted clip here; trash it in Drive (recoverable there) */
export async function removeClipMedia(ref: MediaRef, trashInDrive: boolean): Promise<void> {
  const key = cacheKey(ref);
  const url = urls.get(key);
  if (url) URL.revokeObjectURL(url);
  urls.delete(key);
  await cache.delete(key).catch(() => {});
  if (trashInDrive && ref.store === 'drive') await deleteFromDrive(ref.id);
}
