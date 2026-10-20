// Layered Photoshop files for storyboards, like Storyboarder's "Edit in
// Photoshop": each board layer becomes a named PSD layer, and a PSD
// edited elsewhere (Photoshop, Krita, GIMP, Photopea) comes back layer
// by layer. Uses ag-psd (MIT).
import { readPsd, writePsd, type Layer, type Psd } from 'ag-psd';
import type { StoryboardFrame, StoryboardLayer } from '../../types/screenplay';
import { LAYERS } from './storyboardTools';

const LAYER_LABELS: Record<StoryboardLayer, string> = {
  reference: 'Reference',
  fill: 'Fill',
  tone: 'Tone',
  pencil: 'Pencil',
  ink: 'Ink',
  notes: 'Notes',
};

/** Board layer for a PSD layer name ("Pencil", "pencil copy" -> pencil) */
export function boardLayerForName(name: string | undefined): StoryboardLayer | null {
  const n = (name ?? '').trim().toLowerCase();
  return LAYERS.find((l) => n === l || n.startsWith(`${l} `)) ?? null;
}

/**
 * Which board layer each PSD layer goes to. Visible layers only, bottom to
 * top; layers whose names don't match a board layer flatten into Fill.
 */
export function planPsdImport(layers: { name?: string; hidden?: boolean }[]): { index: number; target: StoryboardLayer }[] {
  return layers.flatMap((layer, index) => (layer.hidden ? [] : [{ index, target: boardLayerForName(layer.name) ?? 'fill' }]));
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const blankCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

/** Board -> layered PSD (bottom to top: Reference ... Notes) */
export async function boardToPsd(frame: StoryboardFrame, width: number, height: number): Promise<Blob> {
  const composite = blankCanvas(width, height);
  const cctx = composite.getContext('2d')!;
  cctx.fillStyle = '#ffffff';
  cctx.fillRect(0, 0, width, height);
  const children: Layer[] = [];
  for (const layer of LAYERS) {
    const canvas = blankCanvas(width, height);
    const src = frame.layers?.[layer];
    if (src) canvas.getContext('2d')!.drawImage(await loadImage(src), 0, 0, width, height);
    const opacity = layer === 'reference' ? frame.referenceOpacity ?? 0.5 : 1;
    children.push({ name: LAYER_LABELS[layer], canvas, opacity, left: 0, top: 0 });
    cctx.globalAlpha = opacity;
    cctx.drawImage(canvas, 0, 0);
  }
  cctx.globalAlpha = 1;
  const psd: Psd = { width, height, children: [{ name: 'Background', canvas: (() => {
    const bg = blankCanvas(width, height);
    const ctx = bg.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    return bg;
  })() }, ...children], canvas: composite };
  return new Blob([writePsd(psd, { generateThumbnail: true })], { type: 'image/vnd.adobe.photoshop' });
}

// Group layers flatten to their leaves, keeping bottom-to-top order
const leaves = (layers: Layer[] = [], hidden = false): Layer[] =>
  layers.flatMap((l) => (l.children ? leaves(l.children, hidden || !!l.hidden) : [{ ...l, hidden: hidden || l.hidden }]));

/** PSD -> board layers (PNG data URLs fitted to the board) and reference opacity */
export async function psdToBoardLayers(
  buffer: ArrayBuffer,
  width: number,
  height: number
): Promise<{ layers: Partial<Record<StoryboardLayer, string>>; referenceOpacity?: number }> {
  const psd = readPsd(buffer, { skipThumbnail: true });
  // Flat PSDs (no layers) come in as one image on the Fill layer
  const all = leaves(psd.children).filter((l) => l.canvas && (l.name ?? '').toLowerCase() !== 'background');
  const sources: Layer[] = all.length ? all : psd.canvas ? [{ name: 'fill', canvas: psd.canvas, left: 0, top: 0 }] : [];
  const scaleX = width / psd.width;
  const scaleY = height / psd.height;
  const targets = new Map<StoryboardLayer, HTMLCanvasElement>();
  let referenceOpacity: number | undefined;
  for (const { index, target } of planPsdImport(sources)) {
    const layer = sources[index];
    let canvas = targets.get(target);
    if (!canvas) targets.set(target, (canvas = blankCanvas(width, height)));
    const ctx = canvas.getContext('2d')!;
    // The reference layer keeps its opacity as the board's light-box setting
    if (target === 'reference' && boardLayerForName(layer.name) === 'reference') referenceOpacity = layer.opacity ?? 1;
    else ctx.globalAlpha = layer.opacity ?? 1;
    ctx.drawImage(layer.canvas!, (layer.left ?? 0) * scaleX, (layer.top ?? 0) * scaleY, layer.canvas!.width * scaleX, layer.canvas!.height * scaleY);
    ctx.globalAlpha = 1;
  }
  // Empty layers stay empty rather than storing a blank image
  const isBlank = (canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, width, height);
    for (let i = 3; i < data.length; i += 4) if (data[i]) return false;
    return true;
  };
  const layers: Partial<Record<StoryboardLayer, string>> = {};
  for (const layer of LAYERS) {
    const canvas = targets.get(layer);
    layers[layer] = canvas && !isBlank(canvas) ? canvas.toDataURL('image/png') : undefined;
  }
  return { layers, referenceOpacity };
}
