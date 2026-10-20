import { describe, expect, it } from 'vitest';
import type { OnSet, Schedule, SceneStrip, ShootDay, SuperVisor, TakeEntry } from '../../types/screenplay';
import { createCalendar } from './calendar';
import { buildProductionReport, productionReportText } from './productionReport';
import { formatEighths } from '../../utils/breakdown';

const strip = (id: string, sceneNumber: string, pageCount: number): SceneStrip =>
  ({ id, sceneId: id, sceneNumber, intExt: 'INT', location: 'KITCHEN', timeOfDay: 'DAY', description: '', pageCount, castIds: [], castNumbers: [], isLocked: false } as unknown as SceneStrip);
const day = (id: string, dayNumber: number, strips: string[]): ShootDay =>
  ({ id, dayNumber, strips, shotPackages: [], callTime: '7:00 AM', estimatedWrap: '7:00 PM', isLocked: false, hasNightWork: false } as unknown as ShootDay);
const take = (sceneNumber: string, camera: string, circled = false, rating: TakeEntry['rating'] = ''): TakeEntry =>
  ({ id: Math.random().toString(36), sceneNumber, shotId: '', shotNumber: '1', takeNumber: 1, camera, circled, rating, createdAt: new Date() });

const schedule = {
  id: 's', projectName: 'Test', strips: [strip('a', '1', 2), strip('b', '2', 1.5), strip('c', '3', 1), strip('d', '4', 0.5)],
  unscheduledStrips: ['d'], shootDays: [day('d1', 1, ['a', 'b']), day('d2', 2, ['c'])],
  calendar: createCalendar('2026-11-02'),
  productionReports: [{ dayId: 'd1', times: { cameraWrap: '6:45 PM' }, sceneStatus: { b: 'partial' }, notes: 'Rain cover used' }],
} as unknown as Schedule;

const superVisor = {
  sessions: [
    { id: 's1', shootDayId: 'd1', date: new Date(), takes: [take('1', 'A', true), take('1', 'B'), take('2', 'A', false, 'NG')], coverage: [], totalSetups: 4, totalTakes: 3, totalPrints: 1 },
    { id: 's2', shootDayId: 'd2', date: new Date(), takes: [take('3', 'A', true)], coverage: [], totalSetups: 2, totalTakes: 1, totalPrints: 1 },
  ],
} as unknown as SuperVisor;

const onSet = {
  productionStatus: { currentDayId: 'd2', completedStrips: ['c'], actualTimes: [{ id: 't', type: 'strip', referenceId: 'c', startedAt: new Date('2026-11-03T08:12:00'), estimatedMinutes: 60 }], aheadBehind: 0, lastUpdated: new Date(), currentStripIndex: 0, currentShotPackageIndex: 0, completedPackages: [] },
  delays: [{ id: 'x', reason: 'Generator', category: 'Technical', startedAt: new Date('2026-11-03T10:00:00'), duration: 25 }],
  lunchStatus: null, isLive: true,
} as unknown as OnSet;

describe('daily production report', () => {
  it('derives scene status, honours the AD, and counts takes by camera', () => {
    const r = buildProductionReport(schedule, 'd1', { superVisor, onSet })!;
    expect(r.date).toBe('2026-11-02');
    expect(r.scenes.map((s) => `${s.sceneNumber}:${s.status}:${s.derived}`)).toEqual(['1:partial:true', '2:partial:false']);
    expect(r.supervisor).toMatchObject({ setups: 4, takes: 3, prints: 1, ng: 1, byCamera: [{ camera: 'A', takes: 2, prints: 1 }, { camera: 'B', takes: 1, prints: 0 }] });
    expect(r.times).toMatchObject({ crewCall: '7:00 AM', cameraWrap: '6:45 PM' });
    expect(r.delays).toEqual([]); // delay was on day 2
  });

  it('rolls progress forward and reads OnSet for the live day', () => {
    const r = buildProductionReport(schedule, 'd2', { superVisor, onSet })!;
    expect(r.scenes[0]).toMatchObject({ sceneNumber: '3', status: 'complete', derived: true });
    expect(r.scenesProgress).toEqual({ previous: 0, today: 1, toDate: 1, remaining: 3, total: 4 });
    expect(r.pagesProgress).toEqual({ previous: 0, today: 8, toDate: 8, remaining: 32, total: 40 });
    expect(r.setupsProgress).toMatchObject({ previous: 4, today: 2, toDate: 6 });
    expect(r.aheadBehindEighths).toBe(8 - 36); // scheduled 2 + 1.5 + 1 pages, shot 1
    expect(r.times.firstShot).toMatch(/8:12/);
    expect(r.delays.map((d) => d.reason)).toEqual(['Generator']);
    expect(r.delayMinutes).toBe(25);
  });

  it('renders a plain-text report', () => {
    const text = productionReportText(buildProductionReport(schedule, 'd1', { superVisor, onSet })!, 'Test', formatEighths);
    expect(text).toContain('Day 1 of 2 · 2026-11-02');
    expect(text).toContain('Sc 2  INT. KITCHEN DAY  1 4/8 pgs  PARTIAL');
    expect(text).toContain('Notes:\nRain cover used');
    expect(text).toContain('Takes 3 · Prints 1 · NG 1');
  });

  it('returns null for an unknown day', () => {
    expect(buildProductionReport(schedule, 'nope')).toBeNull();
  });
});
