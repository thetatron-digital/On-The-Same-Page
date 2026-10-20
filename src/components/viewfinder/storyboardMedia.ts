// Storyboard media helpers: image fitting, audio length, animated GIF
// (gifenc, MIT) and animatic video (browser MediaRecorder; free).
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import type { StoryboardFrame } from '../../types/screenplay';
import type { BoardPosition } from '../../engine/storyboard/boards';

export const readFileAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Scale an image to fit a board (letterboxed), as a transparent PNG */
export async function fitImageToBoard(src: string, width: number, height: number): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const scale = Math.min(width / img.width, height / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  canvas.getContext('2d')!.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
  return canvas.toDataURL('image/png');
}

/** Length of an audio clip in ms */
export const audioDurationMs = (src: string) =>
  new Promise<number>((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      // MediaRecorder WebM often reports Infinity until seeked
      if (Number.isFinite(audio.duration)) return resolve(Math.round(audio.duration * 1000));
      audio.currentTime = 1e7;
      audio.ontimeupdate = () => {
        audio.ontimeupdate = null;
        resolve(Math.round(audio.duration * 1000) || 0);
      };
    };
    audio.onerror = () => resolve(0);
    audio.src = src;
  });

/** Board length in the animatic: the longer of its duration and its audio (as Storyboarder) */
export const effectiveDurationMs = (frame: StoryboardFrame, defaultMs: number) =>
  Math.max(frame.durationMs && frame.durationMs > 0 ? frame.durationMs : defaultMs, frame.audio?.durationMs ?? 0);

async function boardImages(frames: StoryboardFrame[], width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const images: CanvasImageSource[] = [];
  for (const frame of frames) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    if (frame.image) ctx.drawImage(await loadImage(frame.image), 0, 0, width, height);
    images.push(await createImageBitmap(canvas));
  }
  return images;
}

/** Animated GIF of the boards, each held for its duration */
export async function exportGif(frames: StoryboardFrame[], positions: BoardPosition[], width = 640, height = 360): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const gif = GIFEncoder();
  const images = await boardImages(frames, width, height);
  images.forEach((image, i) => {
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: positions[i].durationMs });
  });
  gif.finish();
  return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' });
}

const VIDEO_TYPES = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export const supportedVideoType = () =>
  typeof MediaRecorder === 'undefined' ? null : VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;

/**
 * Record the animatic (boards + board audio) in real time with the
 * browser's MediaRecorder. Takes as long as the animatic runs.
 */
export async function exportVideo(
  frames: StoryboardFrame[],
  positions: BoardPosition[],
  onProgress: (fraction: number) => void,
  width = 1280,
  height = 720,
  fps = 24
): Promise<{ blob: Blob; extension: string }> {
  const type = supportedVideoType();
  if (!type) throw new Error('This browser cannot record video.');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const images = await boardImages(frames, width, height);

  const audioCtx = new AudioContext();
  const destination = audioCtx.createMediaStreamDestination();
  const stream = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...destination.stream.getAudioTracks()]);
  const recorder = new MediaRecorder(stream, { mimeType: type });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: type.split(';')[0] })); });

  const total = positions.reduce((sum, p) => sum + p.durationMs, 0);
  const players: HTMLAudioElement[] = [];
  ctx.drawImage(images[0], 0, 0);
  recorder.start();
  const start = performance.now();
  let current = -1;
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = performance.now() - start;
      if (t >= total) return resolve();
      let index = 0;
      while (index + 1 < positions.length && positions[index + 1].startMs <= t) index++;
      if (index !== current) {
        current = index;
        ctx.drawImage(images[index], 0, 0);
        const clip = frames[index].audio?.dataUrl;
        if (clip) {
          const audio = new Audio(clip);
          audioCtx.createMediaElementSource(audio).connect(destination);
          players.push(audio);
          void audio.play();
        }
      }
      onProgress(t / total);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  players.forEach((p) => p.pause());
  const blob = await done;
  await audioCtx.close();
  onProgress(1);
  return { blob, extension: type.startsWith('video/mp4') ? 'mp4' : 'webm' };
}

/**
 * Full-size flattened board from its layers (the stored `image` is a small
 * JPEG thumbnail). Falls back to that thumbnail for boards without layers.
 */
export async function renderBoardPng(frame: StoryboardFrame, layerOrder: readonly string[], width: number, height: number): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const layers = (frame.layers ?? {}) as Record<string, string | undefined>;
  const sources = layerOrder.filter((l) => layers[l]);
  if (!sources.length && frame.image) sources.push('__thumb');
  for (const layer of sources) {
    const img = await loadImage(layer === '__thumb' ? frame.image! : layers[layer]!);
    ctx.globalAlpha = layer === 'reference' ? frame.referenceOpacity ?? 0.5 : 1;
    ctx.drawImage(img, 0, 0, width, height);
  }
  ctx.globalAlpha = 1;
  return canvas.toDataURL('image/png');
}
