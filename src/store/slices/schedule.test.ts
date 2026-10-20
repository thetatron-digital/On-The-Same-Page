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
    const report = buildScheduleDOOD(store().schedule!, 'Cast', { breakdown: null, people: [] });
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
    const row = () => buildScheduleDOOD(store().schedule!, 'Cast', { breakdown: null, people: [] }).rows.find((r) => r.boardId === '2')!;
    expect(row().cells.map((c) => c.code)).toEqual(['SW', 'H', 'WF']);
    store().updateDOODSettings({ elementOptions: { 'cast-2': { allowHold: false } } });
    expect(row().cells.map((c) => c.code)).toEqual(['SW', '', 'WF']);
  });

  it('exports CSV with the Movie Magic header rows and totals', () => {
    store().autoAssignDayBreaks({ maxPagesPerDay: 5 });
    store().setScheduleCalendar(createCalendar('2026-03-02'));
    const csv = doodToCsv(buildScheduleDOOD(store().schedule!, 'Cast', { breakdown: null, people: [] }));
    const lines = csv.trim().split('\n');
    expect(lines[0]).toMatch(/^Month,Mar,Mar,Mar/);
    expect(lines[2]).toMatch(/^Day of Week,Mon,Tue,Wed/);
    expect(lines[3]).toBe('Shooting Day,1,2,3,Co. Travel,Work,Hold,Holiday,Start,Finish,TOTAL');
    expect(lines[4]).toBe('1. cast-1,SW,H,WF,0,2,1,0,2026-03-02,2026-03-04,3');
  });
});
