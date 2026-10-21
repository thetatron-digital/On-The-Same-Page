import { describe, expect, it } from 'vitest';
import { useScreenplayStore } from '../store/screenplayStore';
import type { MediaRef } from '../types/dailies';
import { createBackup, readBackup } from './projectBackup';

const store = () => useScreenplayStore.getState();
const ref = (store_: 'local' | 'drive', id: string): MediaRef => ({ store: store_, id, mime: 'video/mp4', size: 5, fileName: `${id}.mp4` });
const text = (b: Blob) => new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(b); });

describe('project backup', () => {
  it('round-trips the project and the media that lives only in this browser', async () => {
    store().resetToNew();
    store().addDailiesClip({ name: 'Local clip', media: ref('local', 'local-1'), kind: 'video', durationS: 1, fps: 24, status: 'none', uploadedAt: new Date('2026-10-20T10:00:00Z') });
    store().addDailiesClip({ name: 'Drive clip', media: ref('drive', 'drive-1'), kind: 'video', durationS: 1, fps: 24, status: 'none', uploadedAt: new Date('2026-10-20T10:00:00Z') });
    store().addDailiesClip({ name: 'Gone clip', media: ref('local', 'local-2'), kind: 'video', durationS: 1, fps: 24, status: 'none', uploadedAt: new Date('2026-10-20T10:00:00Z') });
    const blobs: Record<string, Blob> = { 'local-1': new Blob(['frames']) };
    const { blob, mediaIncluded, mediaMissing } = await createBackup(store().getProjectData(), 'Test', async (r) => blobs[r.id]);
    expect([mediaIncluded, mediaMissing]).toEqual([1, 1]); // drive media skipped, one local clip missing here
    const restored = await readBackup(blob);
    expect(restored.data.dailies!.clips.map((c) => c.name)).toEqual(['Local clip', 'Drive clip', 'Gone clip']);
    expect(restored.data.dailies!.clips[0].uploadedAt).toBeInstanceOf(Date);
    expect(restored.media.map((m) => m.ref.id)).toEqual(['local-1']);
    expect(await text(restored.media[0].blob)).toBe('frames');
  });

  it('rejects files that are not backups', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('other.txt', 'x');
    await expect(readBackup(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow(/isn't an OTSP backup/);
  });
});
