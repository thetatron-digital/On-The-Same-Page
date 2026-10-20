import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./googleDrive', () => ({ googleDrive: { authHeader: async () => ({ Authorization: 'Bearer t' }), getAppFolder: async () => 'app' } }));
const { PART_SIZE, nextOffset, uploadToDrive } = await import('./driveMedia');

afterEach(() => vi.unstubAllGlobals());

describe('resumable Drive upload', () => {
  it('reads the next offset from Drive\'s Range header', () => {
    expect(nextOffset('bytes=0-8388607')).toBe(8388608);
    expect(nextOffset(null)).toBe(0);
  });

  it('sends parts, resumes after a dropped connection, and returns the file id', async () => {
    const size = PART_SIZE * 2 + 10;
    const blob = new Blob([new Uint8Array(size)]);
    let received = 0;
    let dropped = false;
    const ranges: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.includes('q=')) return new Response(JSON.stringify({ files: [{ id: 'media-folder' }] }));
      if (url.includes('uploadType=resumable')) return new Response('{}', { headers: { Location: 'https://upload/session' } });
      const range = (init.headers as Record<string, string>)['Content-Range'];
      ranges.push(range);
      if (range === `bytes */${size}`) return new Response(null, { status: 308, headers: { Range: `bytes=0-${received - 1}` } });
      if (!dropped && received === PART_SIZE) { dropped = true; throw new TypeError('network'); }
      received += (init.body as Blob).size;
      return received < size ? new Response(null, { status: 308, headers: { Range: `bytes=0-${received - 1}` } }) : new Response(JSON.stringify({ id: 'file-1' }));
    }));
    const progress: number[] = [];
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const run = uploadToDrive(blob, 'clip.mp4', (p) => progress.push(p.sent));
    await vi.runAllTimersAsync();
    expect(await run).toBe('file-1');
    vi.useRealTimers();
    expect(ranges).toEqual([
      `bytes 0-${PART_SIZE - 1}/${size}`,
      `bytes ${PART_SIZE}-${PART_SIZE * 2 - 1}/${size}`, // dropped
      `bytes */${size}`,                                  // where are we?
      `bytes ${PART_SIZE}-${PART_SIZE * 2 - 1}/${size}`,
      `bytes ${PART_SIZE * 2}-${size - 1}/${size}`,
    ]);
    expect(progress.at(-1)).toBe(size);
  });
});
