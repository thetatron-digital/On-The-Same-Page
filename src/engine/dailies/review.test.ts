import { describe, expect, it } from 'vitest';
import type { DailiesClip, DailiesComment } from '../../types/dailies';
import { commentsToCsv, commentsToEdl, fpsLabel, latestVersions, openCount, threads } from './review';

const clip = (id: string, stackId: string, version: number, extra: Partial<DailiesClip> = {}): DailiesClip => ({
  id, stackId, version, name: `Clip ${stackId}`, kind: 'video', durationS: 60, fps: 24, status: 'needs-review',
  uploadedAt: new Date(0), media: { store: 'local', id, mime: 'video/mp4', size: 1, fileName: 'x.mp4' }, ...extra,
});
let t = 0;
const comment = (id: string, extra: Partial<DailiesComment>): DailiesComment => ({
  id, clipId: 'a2', text: id, author: 'Ana', createdAt: new Date(++t * 1000), ...extra,
});

const comments = [
  comment('general', {}),
  comment('late', { time: 30 }),
  comment('early', { time: 1.5, endTime: 3, drawing: [{ tool: 'pen', color: '#f00', size: 0.01, points: [[0, 0]] }] }),
  comment('reply', { parentId: 'early', author: 'Ben', text: 'Fixed in V3, "promise"' }),
  comment('done', { time: 10, completed: true }),
];

describe('review helpers', () => {
  it('shows the newest version of each stack', () => {
    const list = latestVersions([clip('a1', 'a', 1), clip('a2', 'a', 2), clip('b1', 'b', 1)]);
    expect(list.map((c) => c.id).sort()).toEqual(['a2', 'b1']);
  });

  it('threads comments: timed in order, general last, replies nested', () => {
    expect(threads(comments, 'a2').map((th) => `${th.comment.id}(${th.replies.map((r) => r.id)})`)).toEqual([
      'early(reply)', 'done()', 'late()', 'general()',
    ]);
    expect(openCount(comments, 'a2')).toBe(3);
  });

  it('exports CSV with source timecode and escaped text', () => {
    const csv = commentsToCsv([clip('a2', 'a', 2, { startTimecode: '01:00:00:00' })], comments);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Clip,Version,Status,Timecode,Frame,Author,Comment,Done,Drawing,Date');
    expect(lines[1]).toContain('Clip a,V2,Needs Review,01:00:01:12,36,Ana,early,,Yes,');
    expect(lines[2]).toContain('"↳ Fixed in V3, ""promise"""');
    expect(lines).toHaveLength(6);
  });

  it('exports EDL markers for timed comments', () => {
    const edl = commentsToEdl(clip('a2', 'a', 2, { startTimecode: '01:00:00:00' }), comments);
    expect(edl).toContain('001  001      V     C        01:00:01:12 01:00:03:00 01:00:01:12 01:00:03:00');
    expect(edl).toContain('early / Ben: Fixed in V3, "promise" |C:ResolveColorBlue |M:Ana |D:36');
    expect(edl).toContain('|C:ResolveColorGreen'); // completed
    expect(edl).not.toContain('general');
    expect(fpsLabel(23.976)).toBe('23.976');
    expect(fpsLabel(25)).toBe('25');
  });
});
