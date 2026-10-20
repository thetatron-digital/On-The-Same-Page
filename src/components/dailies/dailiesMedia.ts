// Reading new clips in the browser: kind, length, size and a thumbnail
import type { DailiesClip } from '../../types/dailies';

export interface Probe {
  kind: DailiesClip['kind'];
  durationS: number;
  width?: number;
  height?: number;
  thumbnail?: string;
}

const THUMB_W = 320;

function snapshot(source: CanvasImageSource, w: number, h: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W;
  canvas.height = Math.round((THUMB_W * h) / Math.max(1, w));
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

export const kindOf = (file: File): DailiesClip['kind'] | null =>
  file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : null;

export async function probeMedia(file: File): Promise<Probe> {
  const kind = kindOf(file);
  if (!kind) throw new Error(`${file.name} isn't a video, audio or image file.`);
  const url = URL.createObjectURL(file);
  try {
    if (kind === 'image') {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { kind, durationS: 0, width: img.naturalWidth, height: img.naturalHeight, thumbnail: snapshot(img, img.naturalWidth, img.naturalHeight) };
    }
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.preload = 'auto';
    el.muted = true;
    el.src = url;
    await new Promise<void>((resolve, reject) => {
      el.onloadedmetadata = () => resolve();
      el.onerror = () => reject(new Error(`${file.name} can't be played in this browser. Export an H.264 MP4 proxy (for example from Resolve) and add that.`));
    });
    const durationS = Number.isFinite(el.duration) ? el.duration : 0;
    if (kind === 'audio') return { kind, durationS };
    const video = el as HTMLVideoElement;
    // A frame a little way in makes a better thumbnail than black frame 0
    video.currentTime = Math.min(durationS * 0.1, 2);
    await new Promise<void>((resolve) => { video.onseeked = () => resolve(); setTimeout(resolve, 3000); });
    let thumbnail: string | undefined;
    try { thumbnail = snapshot(video, video.videoWidth, video.videoHeight); } catch { /* no frame yet */ }
    return { kind, durationS, width: video.videoWidth, height: video.videoHeight, thumbnail };
  } finally {
    URL.revokeObjectURL(url);
  }
}
