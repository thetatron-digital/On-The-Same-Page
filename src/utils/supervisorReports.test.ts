import { describe, expect, it } from 'vitest';
import type { TakeEntry } from '../types/screenplay';
import { editorsLog, editorsLogCsv, generateALE } from './supervisorReports';

const take = (scene: string, shot: string, n: number, camera: string, extra: Partial<TakeEntry> = {}): TakeEntry =>
  ({ id: `${scene}${shot}${n}${camera}`, sceneNumber: scene, shotId: '', shotNumber: shot, takeNumber: n, camera, circled: false, rating: '', createdAt: new Date(), ...extra });

const takes = [
  take('12', '12A', 2, 'A', { circled: true, rating: 'Print', timecodeIn: '14:02:10:00', timecodeOut: '14:03:01:12', duration: 51, editorNotes: 'Best\tperformance\nuse end' }),
  take('2', 'B', 1, 'B', { rating: 'NG', technicalNotes: 'Boom in shot' }),
  take('12', '12A', 1, 'A'),
  take('2', 'B', 1, 'A', { directorNotes: 'Faster' }),
];

describe('supervisor reports', () => {
  it('orders the editor\'s log by scene, setup, take and camera', () => {
    expect(editorsLog(takes).map((r) => `${r.scene}/${r.setup}/${r.take}/${r.camera}/${r.rating}`)).toEqual([
      '2/B/1/A/', '2/B/1/B/NG', '12/12A/1/A/', '12/12A/2/A/Print',
    ]);
    const csv = editorsLogCsv(editorsLog(takes));
    expect(csv.split('\n')[0]).toBe('Scene,Setup,Take,Camera,TC In,TC Out,Duration,Rating,Notes');
    expect(csv).toContain('12,12A,2,A,14:02:10:00,14:03:01:12,0:51,Print,"Best\tperformance\nuse end"');
  });

  it('writes a clean ALE: one line per take, slate names, real frame rate', () => {
    const ale = generateALE(takes, { fps: 23.976 });
    const lines = ale.split('\n');
    expect(lines).toContain('FPS\t23.976');
    const cols = lines[lines.indexOf('Column') + 1].split('\t');
    const data = lines.slice(lines.indexOf('Data') + 1).filter(Boolean);
    expect(data).toHaveLength(4);
    expect(data.every((l) => l.split('\t').length === cols.length)).toBe(true);
    expect(data[0].split('\t').slice(0, 2)).toEqual(['2B-1_A', 'VA1A2']);
    expect(data[3]).toContain('12A-2_A\tVA1A2\t14:02:10:00\t14:03:01:12\t12A\t2\tA\tY\tPrint\t0:51\tBest performance use end');
    expect(data[1]).toContain('Tech: Boom in shot');
  });
});
