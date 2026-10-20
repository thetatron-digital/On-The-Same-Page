import { beforeEach, describe, expect, it } from 'vitest';
import { useScreenplayStore } from '../screenplayStore';
import type { SceneStrip } from '../../types/screenplay';
import { createCalendar } from '../../engine/schedule/calendar';
import { buildScheduleDOOD, doodToCsv, toYMD } from '../../utils/doodReport';

const store = () => useScreenplayStore.getState();

const strip = (id: string, sceneNumber: string, pages: number, castIds: string[] = [], extra: Partial<SceneStrip> = {}): SceneStrip => ({
  id,
  sceneId: `scene-${id}`,
  sceneNumber,
  intExt: 'INT',
  location: 'HOUSE',
  timeOfDay: 'DAY',
  description: '',
  pageCount: pages,
  color: 'Yellow',
  castIds,
  castNumbers: castIds.map((c) => Number(c.replace('cast-', ''))),
  isLocked: false,
  hasStunts: false,
  hasVFX: false,
  hasSpecialEquipment: false,
  ...extra,
});

// Five strips on one shoot day, nothing unscheduled
const setUpBoard = () => {
  store().resetToNew();
  store().initializeSchedule();
  const dayId = store().addShootDay();
  const strips = [
    strip('a', '3', 2, ['cast-1']),
    strip('b', '1', 3, ['cast-1', 'cast-2']),
    strip('c', '10', 1.5, ['cast-2']),
    strip('d', '2', 4, ['cast-1']),
    strip('e', '9', 0.5, []),
  ].map((s, i) => ({ ...s, scheduledDayId: dayId, orderInDay: i }));
  const schedule = store().schedule!;
  useScreenplayStore.setState({
    schedule: {
      ...schedule,
      strips,
      shootDays: schedule.shootDays.map((d) => ({ ...d, strips: strips.map((s) => s.id) })),
    },
  });
};

const dayStrips = () => store().schedule!.shootDays.map((d) => d.strips);

describe('BaseCamp board tools', () => {
  beforeEach(setUpBoard);

  it('Auto Day Breaks spreads scheduled strips over days by max pages', () => {
    expect(store().autoAssignDayBreaks({ maxPagesPerDay: 5 })).toBeNull();
    expect(dayStrips()).toEqual([['a', 'b'], ['c'], ['d', 'e']]); // c + d = 5 4/8 pages
    const schedule = store().schedule!;
    expect(schedule.shootDays.map((d) => d.dayNumber)).toEqual([1, 2, 3]);
    expect(schedule.strips.find((s) => s.id === 'd')).toMatchObject({ scheduledDayId: schedule.shootDays[2].id, orderInDay: 0 });
  });

  it('Auto Day Breaks removes days it no longer needs', () => {
    store().autoAssignDayBreaks({ maxPagesPerDay: 2 });
    expect(store().schedule!.shootDays.length).toBe(5);
    store().autoAssignDayBreaks({ maxPagesPerDay: 20 });
    expect(dayStrips()).toEqual([['a', 'b', 'c', 'd', 'e']]);
  });

  it('refuses to move locked strips', () => {
    store().lockStrip('c', true);
    expect(store().autoAssignDayBreaks({ maxPagesPerDay: 5 })).toMatch(/Unlock/);
    expect(store().sortScheduledStrips([{ field: 'sceneNumber', direction: 'asc' }])).toMatch(/Unlock/);
  });

  it('Sort orders strips and, like Movie Magic, clears day breaks', () => {
    store().autoAssignDayBreaks({ maxPagesPerDay: 5 });
    expect(store().sortScheduledStrips([{ field: 'sceneNumber', direction: 'asc' }])).toBeNull();
    expect(dayStrips()).toEqual([['b', 'd', 'a', 'e', 'c']]);
  });

  it('dates shoot days from the calendar, skipping weekends', () => {
    store().autoAssignDayBreaks({ maxPagesPerDay: 5 });
    store().setScheduleCalendar(createCalendar('2026-03-05')); // Thursday
    expect(store().schedule!.shootDays.map((d) => toYMD(d.date))).toEqual(['2026-03-05', '2026-03-06', '2026-03-09']);
    store().addShootDay();
    expect(toYMD(store().schedule!.shootDays[3].date)).toBe('2026-03-10');
  });
});

describe('Day Out of Days report', () => {
  beforeEach(setUpBoard);

  it('builds Cast rows from the board, ordered by cast number', () => {
    store().autoAssignDayBreaks({ maxPagesPerDay: 5 }); // days: [a b] [c] [d e]
    store().setScheduleCalendar(createCalendar('2026-03-02'));
    const report = buildScheduleDOOD(store().schedule!, 'Cast Members', { breakdown: null, people: [] });
    expect(report.rows.map((r) => [r.boardId, r.cells.map((c) => c.code)])).toEqual([
      ['1', ['SW', 'H', 'WF']],
      ['2', ['SW', 'WF', '']],
    ]);
  });

  it('applies hold rules from DOOD settings', () => {
    store().autoAssignDayBreaks({ maxPagesPerDay: 5 });
    // Cast 2 loses strip c (day 2) and gains strip e (day 3): works days 1 and 3
    useScreenplayStore.setState((s) => ({
      schedule: {
        ...s.schedule!,
        strips: s.schedule!.strips.map((st) => (st.id === 'e' ? { ...st, castIds: ['cast-2'], castNumbers: [2] } : st.id === 'c' ? { ...st, castIds: [], castNumbers: [] } : st)),
      },
    }));
    const row = () => buildScheduleDOOD(store().schedule!, 'Cast Members', { breakdown: null, people: [] }).rows.find((r) => r.boardId === '2')!;
    expect(row().cells.map((c) => c.code)).toEqual(['SW', 'H', 'WF']);
    store().updateDOODSettings({ elementOptions: { 'cast-2': { allowHold: false } } });
    expect(row().cells.map((c) => c.code)).toEqual(['SW', '', 'WF']);
  });

  it('exports CSV with the Movie Magic header rows and totals', () => {
    store().autoAssignDayBreaks({ maxPagesPerDay: 5 });
    store().setScheduleCalendar(createCalendar('2026-03-02'));
    const csv = doodToCsv(buildScheduleDOOD(store().schedule!, 'Cast Members', { breakdown: null, people: [] }));
    const lines = csv.trim().split('\n');
    expect(lines[0]).toMatch(/^Month,Mar,Mar,Mar/);
    expect(lines[2]).toMatch(/^Day of Week,Mon,Tue,Wed/);
    expect(lines[3]).toBe('Shooting Day,1,2,3,Co. Travel,Work,Hold,Holiday,Start,Finish,TOTAL');
    expect(lines[4]).toBe('1. cast-1,SW,H,WF,0,2,1,0,2026-03-02,2026-03-04,3');
  });
});

describe('Import from Breakdown', () => {
  const bScene = (id: string, n: string, tod = 'DAY') => ({
    id, sceneNumber: n, intExt: 'INT' as const, location: 'KITCHEN', timeOfDay: tod, dayNight: (tod === 'NIGHT' ? 'Night' : 'Day') as 'Day' | 'Night',
    eighths: 12, pageStart: 1, pageEnd: 1, description: 'They talk.', elements: [], castIds: [],
  });
  const btag = (id: string, text: string, category: string, sceneId: string) => ({
    id, text, category, sceneId, sourceElementId: 'x', startOffset: 0, endOffset: text.length,
  });

  beforeEach(() => {
    store().resetToNew();
    const scenes = [bScene('k1', '1'), bScene('k2', '2', 'NIGHT')];
    useScreenplayStore.setState({
      breakdownScenes: scenes,
      breakdown: {
        id: 'b', name: 'B', scriptVersionId: 'main',
        versionInfo: { scriptVersionId: 'main', scriptVersionName: 'Current', createdAt: new Date(), lastSyncedAt: new Date(), missingElements: [], newScenes: [], syncStatus: 'current' },
        elements: [btag('t1', 'Ada', 'Cast Members', 'k1'), btag('t2', 'Grace', 'Cast Members', 'k1'), btag('t3', 'ada', 'Cast Members', 'k2'), btag('t4', 'harness', 'Stunts', 'k2')],
        scenes, customCategories: [], castList: [], locationsList: [], createdAt: new Date(), updatedAt: new Date(),
        sheets: { k1: { set: "ADA'S KITCHEN", synopsis: 'Breakfast argument' } },
      },
    });
    store().syncElements();
    useScreenplayStore.setState((s) => ({
      breakdown: { ...s.breakdown!, elementList: s.breakdown!.elementList!.map((e) => ({ ...e, boardId: e.name === 'ADA' ? '1' : '2' })) },
    }));
  });

  it('makes one strip per sheet with cast Board IDs, Set, Synopsis and flags', () => {
    store().importStripsFromBreakdown();
    const [s1, s2] = store().schedule!.strips;
    expect(s1).toMatchObject({ sceneId: 'k1', location: "ADA'S KITCHEN", description: 'Breakfast argument', castNumbers: [1, 2], color: 'White' });
    expect(s2).toMatchObject({ sceneId: 'k2', location: 'KITCHEN', castNumbers: [1], hasStunts: true, color: 'DarkGreen' });
    expect(store().schedule!.unscheduledStrips).toEqual([s1.id, s2.id]);
  });

  it('re-importing keeps existing strips, their days and locks', () => {
    store().importStripsFromBreakdown();
    const dayId = store().addShootDay();
    const first = store().schedule!.strips[0];
    store().assignStripToDay(first.id, dayId);
    store().lockStrip(first.id, true);
    store().updateBreakdownSheet('k1', { synopsis: 'Breakfast argument, take two' });

    store().importStripsFromBreakdown();
    const schedule = store().schedule!;
    expect(schedule.strips).toHaveLength(2);
    const again = schedule.strips.find((s) => s.sceneId === 'k1')!;
    expect(again).toMatchObject({ id: first.id, isLocked: true, scheduledDayId: dayId, description: 'Breakfast argument, take two' });
    expect(schedule.shootDays[0].strips).toEqual([first.id]);
    expect(schedule.unscheduledStrips).not.toContain(first.id);
  });

  it('feeds Cast Members elements into the DOOD with their names and Board IDs', () => {
    store().importStripsFromBreakdown();
    const dayId = store().addShootDay();
    store().schedule!.strips.forEach((s) => store().assignStripToDay(s.id, dayId));
    const rows = buildScheduleDOOD(store().schedule!, 'Cast Members', { breakdown: store().breakdown, people: [] }).rows;
    expect(rows.map((r) => `${r.boardId}. ${r.name}`)).toEqual(['1. ADA', '2. GRACE']);
  });
});
