// Reading an image's look from its pixels: a small palette (median cut),
// colour temperature, saturation, contrast and brightness. Pure functions
// over RGBA pixel data, so they run in tests and on a canvas alike.
import type { ImageLook } from '../../types/references';

type RGB = [number, number, number];

const hex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
export const hexToRgb = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

const luminance = ([r, g, b]: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Median-cut palette of up to `count` colours, most populous first */
export function palette(pixels: RGB[], count = 5): string[] {
  if (!pixels.length) return [];
  let boxes: RGB[][] = [pixels];
  while (boxes.length < count) {
    // Split the box with the widest channel range
    let best = -1, bestRange = -1, bestChannel = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255, hi = 0;
        for (const p of box) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
        if (hi - lo > bestRange) { bestRange = hi - lo; best = i; bestChannel = c; }
      }
    });
    if (best < 0 || bestRange < 8) break;
    // Split at the middle of the colour range, so distinct colours don't
    // blend into one muddy swatch
    const box = boxes[best];
    let lo = 255, hi = 0;
    for (const p of box) { if (p[bestChannel] < lo) lo = p[bestChannel]; if (p[bestChannel] > hi) hi = p[bestChannel]; }
    const cut = (lo + hi) / 2;
    const left = box.filter((p) => p[bestChannel] <= cut);
    const right = box.filter((p) => p[bestChannel] > cut);
    boxes = [...boxes.slice(0, best), left, right, ...boxes.slice(best + 1)];
  }
  return boxes
    .filter((b) => b.length)
    .sort((a, b) => b.length - a.length)
    .map((box) => hex(box.reduce<RGB>((acc, p) => [acc[0] + p[0] / box.length, acc[1] + p[1] / box.length, acc[2] + p[2] / box.length], [0, 0, 0])));
}

/** Sample every nth pixel of RGBA data (skipping transparent ones) */
export function samplePixels(data: Uint8ClampedArray, maxSamples = 4000): RGB[] {
  const total = data.length / 4;
  const step = Math.max(1, Math.floor(total / maxSamples));
  const out: RGB[] = [];
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    out.push([data[o], data[o + 1], data[o + 2]]);
  }
  return out;
}

export function analyzeLook(data: Uint8ClampedArray): ImageLook {
  const pixels = samplePixels(data);
  const n = Math.max(1, pixels.length);
  let warm = 0, sat = 0, lum = 0, lum2 = 0;
  for (const p of pixels) {
    const [, s, l] = rgbToHsl(p);
    warm += (p[0] - p[2]) / 255;
    sat += s * (1 - Math.abs(2 * l - 1)); // ignore saturation of near-black/near-white
    const y = luminance(p);
    lum += y;
    lum2 += y * y;
  }
  const meanWarm = warm / n;
  const meanSat = sat / n;
  const meanLum = lum / n;
  const sd = Math.sqrt(Math.max(0, lum2 / n - meanLum * meanLum));
  return {
    palette: palette(pixels),
    temperature: meanWarm > 0.06 ? 'warm' : meanWarm < -0.06 ? 'cool' : 'neutral',
    saturation: meanSat < 0.04 ? 'b&w' : meanSat < 0.15 ? 'muted' : meanSat < 0.35 ? 'natural' : 'vivid',
    contrast: sd < 0.12 ? 'low' : sd < 0.25 ? 'medium' : 'high',
    key: meanLum < 0.3 ? 'low' : meanLum > 0.6 ? 'high' : 'medium',
  };
}

/** Perceptual-ish distance between two colours (0 = same, ~1 = opposite) */
export function colourDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const rm = (r1 + r2) / 2;
  const d = Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2);
  return d / 765;
}
