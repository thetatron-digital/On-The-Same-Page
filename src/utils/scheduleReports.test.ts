import { describe, expect, it } from 'vitest';
import type { Breakdown, Schedule, SceneStrip } from '../types/screenplay';
import { buildScheduleReport, dayBreakLine, oneLineToCsv } from './scheduleReports';
import { formatEighths } from './breakdown';

const strip = (id: string, scene: string, eighths: number, extra: Partial<SceneStrip> = {}): SceneStrip => ({
  id, sceneId: `sc-${id}`, sceneNumber: scene, intExt: 'INT', location: 'KITCHEN', timeOfDay: 'DAY',
  description: 'desc', pageCount: eighths / 8, color: 'White', castIds: [], castNumbers: [],
  isLocked: false, hasStunts: false, hasVFX: false, hasSpecialEquipment: false, ...extra,
});

const schedule = {
  id: 's', projectName: 'Test Film', strips: [
    strip('a', '1', 12, { castIds: ['e-ada'], castNumbers: [1] }),
    strip('b', '2', 4, { location: 'PARK', intExt: 'EXT' }),
    strip('c', '3', 20),
  ],
  unscheduledStrips: [], shotPackages: [], unscheduledPackages: [],
  shootDays: [
    { id: 'd1', dayNumber: 1, date: new Date('2026-03-02T12:00:00'), strips: ['a', 'b'], shotPackages: [], callTime: '7:00 AM', estimatedWrap: '7:00 PM', isLocked: false, hasNightWork: false,
      banners: [{ id: 'bn', text: 'COMPANY MOVE', beforeStripId: 'b' }] },
    { id: 'd2', dayNumber: 2, strips: ['c'], shotPackages: [], callTime: '7:00 AM', estimatedWrap: '7:00 PM', isLocked: false, hasNightWork: false },
  ],
  dayBreaks: [], companyMoves: [], dood: [], totalShootDays: 2, defaultCallTime: '7:00 AM', defaultLunchDuration: 30,
  showLunchOnBoard: true, createdAt: new Date(), updatedAt: new Date(),
} as Schedule;

const breakdown = {
  elements: [
    { id: 't1', text: 'revolver', category: 'Props', sceneId: 'sc-a', sourceElementId: 'x', startOffset: 0, endOffset: 8, elementRefId: 'e-rev' },
    { id: 't2', text: 'Ada', category: 'Cast Members', sceneId: 'sc-a', sourceElementId: 'x', startOffset: 0, endOffset: 3, elementRefId: 'e-ada' },
    { id: 't3', text: 'police car', category: 'Vehicles', sceneId: 'sc-a', sourceElementId: 'x', startOffset: 0, endOffset: 10 },
  ],
  elementList: [
    { id: 'e-rev', name: 'REVOLVER', category: 'Props', lockBoardId: false, excludeFromStripboard: false },
    { id: 'e-ada', name: 'ADA', category: 'Cast Members', boardId: '1', lockBoardId: false, excludeFromStripboard: false },
  ],
  sheets: { 'sc-a': { synopsis: 'Breakfast argument' } },
} as unknown as Breakdown;

describe('schedule reports', () => {
  it('lays strips out day by day with day-break page totals', () => {
    const report = buildScheduleReport(schedule, { breakdown, people: [] });
    expect(report.days.map((d) => [d.dayNumber, d.items.length, d.totalPages])).toEqual([[1, 2, '2'], [2, 1, '2 4/8']]);
    expect(report.totalPages).toBe('4 4/8');
    expect(dayBreakLine(report.days[0])).toBe('End Day 1 -- Mon, Mar 2, 2026 -- 2 Pages');
  });

  it('carries synopsis, cast IDs and elements by category in category order', () => {
    const [first] = buildScheduleReport(schedule, { breakdown, people: [] }).days[0].items;
    expect(first).toMatchObject({
      kind: 'strip', sceneNumber: '1', set: 'KITCHEN', pages: '1 4/8', synopsis: 'Breakfast argument',
      castIds: '1', cast: ['1. ADA'],
      elements: [{ category: 'Vehicles', names: ['POLICE CAR'] }, { category: 'Props', names: ['REVOLVER'] }],
    });
  });

  it('includes banners only when asked', () => {
    const withBanners = buildScheduleReport(schedule, { breakdown, people: [], includeBanners: true });
    expect(withBanners.days[0].items.map((i) => (i.kind === 'banner' ? i.text : i.sceneNumber))).toEqual(['1', 'COMPANY MOVE', '2']);
  });

  it('exports the one-liner as CSV', () => {
    const csv = oneLineToCsv(buildScheduleReport(schedule, { breakdown, people: [] })).trim().split('\n');
    expect(csv[0]).toBe('Shoot Day,Date,Scene,I/E,Set,D/N,Pages,Cast IDs,Synopsis');
    expect(csv[1]).toBe('1,2026-03-02,1,INT,KITCHEN,DAY,1 4/8,1,Breakfast argument');
    expect(csv[3]).toBe('1,2026-03-02,,,"End Day 1 -- Mon, Mar 2, 2026 -- 2 Pages",,2,,');
  });

  it('formats pages the script way', () => {
    expect([formatEighths(0), formatEighths(3), formatEighths(8), formatEighths(19)]).toEqual(['0', '3/8', '1', '2 3/8']);
  });
});

describe('schedule report PDF', () => {
  it('renders both reports, paging long schedules', async () => {
    const { scheduleReportPdf } = await import('./scheduleReportPdf');
    const report = buildScheduleReport(schedule, { breakdown, people: [], includeBanners: true });
    for (const kind of ['oneLine', 'shooting'] as const) {
      const doc = scheduleReportPdf(report, kind);
      expect(doc.getNumberOfPages()).toBe(1);
      expect(doc.output()).toContain(kind === 'oneLine' ? 'One Line Schedule' : 'Shooting Schedule');
    }
    const long = { ...report, days: Array.from({ length: 30 }, (_, i) => ({ ...report.days[0], dayNumber: i + 1 })) };
    expect(scheduleReportPdf(long, 'shooting').getNumberOfPages()).toBeGreaterThan(1);
  });
});
