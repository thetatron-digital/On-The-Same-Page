import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploads = vi.hoisted(() => ({ files: new Map<string, Blob>(), next: 1 }));
vi.mock('./driveMedia', () => ({
  uploadToDrive: vi.fn(async (file: Blob, _name: string, onProgress?: (p: { sent: number; total: number }) => void) => {
    const id = `d${uploads.next++}`;
    uploads.files.set(id, file);
    onProgress?.({ sent: file.size, total: file.size });
    return id;
  }),
  downloadFromDrive: vi.fn(async (id: string) => uploads.files.get(id)!),
  deleteFromDrive: vi.fn(async (id: string) => { uploads.files.delete(id); }),
}));

const { getClipBlob, isClipCached, removeClipMedia, setBlobCache, storeClipMedia } = await import('./mediaStore');
const { downloadFromDrive } = await import('./driveMedia');

const memory = new Map<string, Blob>();
const text = (b: Blob) => new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(b); });
const file = (name: string) => new File(['frames'], name, { type: 'video/mp4' });

beforeEach(() => {
  memory.clear();
  setBlobCache({
    get: async (k) => memory.get(k),
    put: async (k, b) => { memory.set(k, b); },
    delete: async (k) => { memory.delete(k); },
  });
});

describe('media store', () => {
  it('keeps local clips in the browser only', async () => {
    const ref = await storeClipMedia(file('a.mp4'), { toDrive: false });
    expect(ref).toMatchObject({ store: 'local', mime: 'video/mp4', size: 6, fileName: 'a.mp4' });
    expect(await text(await getClipBlob(ref))).toBe('frames');
    memory.clear();
    await expect(getClipBlob(ref)).rejects.toThrow(/another browser/);
  });

  it('uploads Drive clips, caches them, and downloads them elsewhere', async () => {
    const progress: number[] = [];
    const ref = await storeClipMedia(file('b.mp4'), { toDrive: true, onProgress: (p) => progress.push(p.sent) });
    expect(ref.store).toBe('drive');
    expect(progress.at(-1)).toBe(6);
    expect(await isClipCached(ref)).toBe(true);
    memory.clear(); // another browser
    expect(await text(await getClipBlob(ref))).toBe('frames');
    expect(downloadFromDrive).toHaveBeenCalledTimes(1);
    await getClipBlob(ref); // now cached
    expect(downloadFromDrive).toHaveBeenCalledTimes(1);
    await removeClipMedia(ref, true);
    expect(await isClipCached(ref)).toBe(false);
    expect(uploads.files.has(ref.id)).toBe(false);
  });
});
