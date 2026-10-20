// Review helpers: version stacks, comment threads, exports
import type { DailiesClip, DailiesComment } from '../../types/dailies';
import { REVIEW_STATUS_LABELS } from '../../types/dailies';
import { displayTimecode, frameAt, framesToTimecode, nominalFps, timecodeToFrames } from './timecode';

/** Each stack's versions, newest first */
export function stacks(clips: DailiesClip[]): Map<string, DailiesClip[]> {
  const map = new Map<string, DailiesClip[]>();
  for (const clip of clips) map.set(clip.stackId, [...(map.get(clip.stackId) ?? []), clip]);
  for (const list of map.values()) list.sort((a, b) => b.version - a.version);
  return map;
}

/** What the library shows: the newest version of every stack */
export const latestVersions = (clips: DailiesClip[]) => [...stacks(clips).values()].map((list) => list[0]);

export interface Thread {
  comment: DailiesComment;
  replies: DailiesComment[];
}

/**
 * A clip's comments as threads: timecoded ones in time order, then
 * general ones in the order they were left (as Frame.io lists them).
 */
export function threads(comments: DailiesComment[], clipId: string): Thread[] {
  const mine = comments.filter((c) => c.clipId === clipId);
  const byTime = (a: DailiesComment, b: DailiesComment) =>
    (a.time ?? Infinity) - (b.time ?? Infinity) || a.createdAt.getTime() - b.createdAt.getTime();
  return mine
    .filter((c) => !c.parentId)
    .sort(byTime)
    .map((comment) => ({
      comment,
      replies: mine.filter((r) => r.parentId === comment.id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    }));
}

export const openCount = (comments: DailiesComment[], clipId: string) =>
  comments.filter((c) => c.clipId === clipId && !c.parentId && !c.completed).length;

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** All comments on a set of clips, one row each (replies indented under their comment) */
export function commentsToCsv(clips: DailiesClip[], comments: DailiesComment[]): string {
  const rows = [['Clip', 'Version', 'Status', 'Timecode', 'Frame', 'Author', 'Comment', 'Done', 'Drawing', 'Date']];
  for (const clip of clips) {
    for (const { comment, replies } of threads(comments, clip.id)) {
      for (const c of [comment, ...replies]) {
        rows.push([
          clip.name, `V${clip.version}`, REVIEW_STATUS_LABELS[clip.status],
          c.time === undefined ? '' : displayTimecode(c.time, clip.fps, clip.startTimecode),
          c.time === undefined ? '' : String(frameAt(c.time, clip.fps)),
          c.author, c.parentId ? `↳ ${c.text}` : c.text, c.completed ? 'Yes' : '',
          c.drawing?.length ? 'Yes' : '', c.createdAt.toISOString(),
        ]);
      }
    }
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/**
 * Comments as an EDL with one marker per timecoded comment, which DaVinci
 * Resolve imports onto a timeline (Timeline > Import > Timeline Markers
 * from EDL). Times are in the clip's source timecode.
 */
export function commentsToEdl(clip: DailiesClip, comments: DailiesComment[]): string {
  const fps = clip.fps;
  const offset = (clip.startTimecode && timecodeToFrames(clip.startTimecode, fps)) || 0;
  const lines = [`TITLE: ${clip.name} V${clip.version}`, 'FCM: NON-DROP FRAME', ''];
  let n = 1;
  for (const { comment, replies } of threads(comments, clip.id)) {
    if (comment.time === undefined) continue;
    const start = frameAt(comment.time, fps) + offset;
    const end = comment.endTime !== undefined ? Math.max(start + 1, frameAt(comment.endTime, fps) + offset) : start + 1;
    const tcIn = framesToTimecode(start, fps);
    const tcOut = framesToTimecode(end, fps);
    const text = [comment.text, ...replies.map((r) => `${r.author}: ${r.text}`)].join(' / ').replace(/\s+/g, ' ');
    lines.push(`${String(n++).padStart(3, '0')}  001      V     C        ${tcIn} ${tcOut} ${tcIn} ${tcOut}`);
    lines.push(`${text} |C:ResolveColor${comment.completed ? 'Green' : 'Blue'} |M:${comment.author} |D:${end - start}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Rate shown for a clip: 23.976 keeps its decimals, 24 doesn't */
export const fpsLabel = (fps: number) => (Number.isInteger(fps) ? String(fps) : fps.toFixed(3).replace(/0+$/, ''));
export { nominalFps };
