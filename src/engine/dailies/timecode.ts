// Frames, seconds and SMPTE-style timecode (non-drop-frame) for dailies.
// Fractional rates (23.976, 29.97) count frames at the rounded rate, as
// non-drop timecode does.

export const nominalFps = (fps: number) => Math.round(fps) || 24;

/** Frame number of a time, snapped to the frame the picture shows */
export const frameAt = (seconds: number, fps: number) => Math.floor(seconds * fps + 1e-6);

/** Time to seek to for a frame: the middle of the frame avoids rounding into the previous one */
export const timeOfFrame = (frame: number, fps: number) => (frame + 0.5) / fps;

export function framesToTimecode(frames: number, fps: number): string {
  const base = nominalFps(fps);
  const sign = frames < 0 ? '-' : '';
  let f = Math.abs(Math.round(frames));
  const ff = f % base; f = Math.floor(f / base);
  const ss = f % 60; f = Math.floor(f / 60);
  const mm = f % 60; const hh = Math.floor(f / 60);
  return sign + [hh, mm, ss, ff].map((n) => String(n).padStart(2, '0')).join(':');
}

export function timecodeToFrames(tc: string, fps: number): number | null {
  const m = /^(-)?(\d{1,2}):(\d{2}):(\d{2})[:;.](\d{2})$/.exec(tc.trim());
  if (!m) return null;
  const base = nominalFps(fps);
  const [, neg, hh, mm, ss, ff] = m;
  if (Number(mm) > 59 || Number(ss) > 59 || Number(ff) >= base) return null;
  const frames = ((Number(hh) * 60 + Number(mm)) * 60 + Number(ss)) * base + Number(ff);
  return neg ? -frames : frames;
}

/** Display time for a position in a clip, offset by the clip's source timecode */
export function displayTimecode(seconds: number, fps: number, startTimecode?: string): string {
  const offset = (startTimecode && timecodeToFrames(startTimecode, fps)) || 0;
  return framesToTimecode(frameAt(seconds, fps) + offset, fps);
}

/** m:ss for comment chips (Frame.io shows short times) */
export function shortTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

const COMMON_RATES = [23.976, 24, 25, 29.97, 30, 47.952, 48, 50, 59.94, 60];

/**
 * Frame rate from the gaps between presented frames (from
 * requestVideoFrameCallback's mediaTime): the median gap, snapped to the
 * nearest common rate.
 */
export function detectFps(mediaTimes: number[]): number | null {
  const gaps = mediaTimes.slice(1).map((t, i) => t - mediaTimes[i]).filter((g) => g > 0.004 && g < 0.2).sort((a, b) => a - b);
  if (gaps.length < 5) return null;
  const median = gaps[Math.floor(gaps.length / 2)];
  const raw = 1 / median;
  return COMMON_RATES.reduce((best, r) => (Math.abs(r - raw) < Math.abs(best - raw) ? r : best), COMMON_RATES[0]);
}
