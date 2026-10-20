import { describe, expect, it } from 'vitest';
import { createCalendar, layOutSchedule, shootDates, type CalendarColumn } from './calendar';
import { buildDOODRow, DEFAULT_MIN_DAYS_BETWEEN_DROP_PICKUP, type DOODElementInput } from './dood';
import { autoDayBreaks, sortStrips } from './stripboard';

// 2026-03-02 is a Monday
const MONDAY = '2026-03-02';

describe('calendar', () => {
  it('skips weekends on a 5-day week', () => {
    expect(shootDates(createCalendar(MONDAY), 6)).toEqual([
      '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09',
    ]);
  });

  it('skips special days off and shoots on exception workdays', () => {
    const cal = createCalendar(MONDAY, {
      specialDays: [
        { date: '2026-03-03', kind: 'off' },
        { date: '2026-03-07', kind: 'workday' }, // Saturday
      ],
    });
    expect(shootDates(cal, 5)).toEqual(['2026-03-02', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07']);
  });

  it('keeps holidays and company travel between shoot days as their own columns', () => {
    const cal = createCalendar(MONDAY, {
      specialDays: [
        { date: '2026-03-03', kind: 'holiday' },
        { date: '2026-03-04', kind: 'companyTravel' },
      ],
    });
    expect(layOutSchedule(cal, 2).map((c) => c.kind)).toEqual(['shoot', 'holiday', 'companyTravel', 'shoot']);
  });

  it('ignores holidays before the first shoot day', () => {
    const cal = createCalendar(MONDAY, { specialDays: [{ date: MONDAY, kind: 'holiday' }] });
    expect(layOutSchedule(cal, 1)).toEqual([{ kind: 'shoot', date: '2026-03-03', shootDayIndex: 0 }]);
  });
});

const element = (workDays: number[], options: Partial<DOODElementInput['options']> = {}): DOODElementInput => ({
  id: 'ada',
  name: 'ADA',
  boardId: '1',
  workDays,
  options: {
    allowHold: true,
    allowDropPickup: false,
    minDaysBetweenDropPickup: DEFAULT_MIN_DAYS_BETWEEN_DROP_PICKUP,
    ...options,
  },
});

const codes = (row: { cells: { code: string }[] }) => row.cells.map((c) => c.code);

describe('Day Out of Days', () => {
  const fiveDays = layOutSchedule(createCalendar(MONDAY), 5);

  it('marks a one-day element SWF', () => {
    const row = buildDOODRow(element([2]), fiveDays);
    expect(codes(row)).toEqual(['', '', 'SWF', '', '']);
    expect(row.totals).toMatchObject({ work: 1, hold: 0, total: 1, start: '2026-03-04', finish: '2026-03-04' });
  });

  it('holds between start and finish', () => {
    const row = buildDOODRow(element([0, 3]), fiveDays);
    expect(codes(row)).toEqual(['SW', 'H', 'H', 'WF', '']);
    expect(row.totals).toMatchObject({ work: 2, hold: 2, total: 4 });
  });

  it('leaves gaps blank when holds are not allowed', () => {
    const row = buildDOODRow(element([0, 3], { allowHold: false }), fiveDays);
    expect(codes(row)).toEqual(['SW', '', '', 'WF', '']);
    expect(row.totals.total).toBe(2);
  });

  it('drops and picks up across a long enough gap', () => {
    const cal = createCalendar(MONDAY);
    const columns = layOutSchedule(cal, 15); // three weeks of shooting
    const row = buildDOODRow(element([0, 1, 14], { allowDropPickup: true }), columns);
    // Gap from day 2 (Tue) to day 15 (Fri of week 3) is well over 10 days
    expect(row.cells[1].code).toBe('WD');
    expect(row.cells[14].code).toBe('PWF');
    expect(row.cells.slice(2, 14).every((c) => c.code === '')).toBe(true);
    expect(row.totals).toMatchObject({ work: 3, hold: 0, total: 3 });
  });

  it('holds instead of dropping when the gap is too short', () => {
    const row = buildDOODRow(element([0, 4], { allowDropPickup: true }), fiveDays);
    expect(codes(row)).toEqual(['SW', 'H', 'H', 'H', 'WF']);
  });

  it('counts holidays and company travel inside the element run', () => {
    const cal = createCalendar(MONDAY, {
      specialDays: [
        { date: '2026-03-03', kind: 'holiday' },
        { date: '2026-03-04', kind: 'companyTravel' },
      ],
    });
    const columns: CalendarColumn[] = layOutSchedule(cal, 3);
    const row = buildDOODRow(element([0, 2]), columns);
    expect(codes(row)).toEqual(['SW', '/', 'M', 'H', 'WF']);
    expect(row.totals).toMatchObject({ work: 2, hold: 1, holiday: 1, companyTravel: 1, total: 4 });
  });

  it('puts travel/rehearsal/fitting flags on days off but never over work', () => {
    const row = buildDOODRow(
      {
        ...element([1, 3]),
        events: [
          { date: '2026-03-02', kind: 'fitting' },
          { date: '2026-03-04', kind: 'rehearsal' },
          { date: '2026-03-05', kind: 'travel' }, // a work day: ignored
        ],
      },
      fiveDays
    );
    expect(codes(row)).toEqual(['FT', 'SW', 'R', 'WF', '']);
    expect(row.totals.hold).toBe(0);
  });

  it('gives an element that never works an empty row', () => {
    const row = buildDOODRow(element([]), fiveDays);
    expect(codes(row)).toEqual(['', '', '', '', '']);
    expect(row.totals).toMatchObject({ start: null, finish: null, total: 0 });
  });
});

describe('Auto Day Breaks', () => {
  const strips = [
    { id: 'a', eighths: 12 }, // 1 4/8
    { id: 'b', eighths: 20 }, // 2 4/8
    { id: 'c', eighths: 30 }, // 3 6/8
    { id: 'd', eighths: 70 }, // 8 6/8, longer than a day
    { id: 'e', eighths: 3 },
  ];

  it('fills each day up to the maximum pages', () => {
    const days = autoDayBreaks(strips, { maxPagesPerDay: 5 });
    expect(days.map((d) => d.map((s) => s.id))).toEqual([['a', 'b'], ['c'], ['d'], ['e']]);
  });

  it('can break by estimated minutes instead', () => {
    const timed = [
      { id: 'a', eighths: 8, estimatedMinutes: 240 },
      { id: 'b', eighths: 8, estimatedMinutes: 240 },
      { id: 'c', eighths: 8, estimatedMinutes: 120 },
    ];
    expect(autoDayBreaks(timed, { maxMinutesPerDay: 500 }).map((d) => d.length)).toEqual([2, 1]);
  });

  it('rejects a missing maximum', () => {
    expect(() => autoDayBreaks(strips, {})).toThrow();
  });
});

describe('Sort strips', () => {
  const strips = [
    { id: '1', scene: '10', ie: 'INT', loc: 'KITCHEN' },
    { id: '2', scene: '2', ie: 'EXT', loc: 'PARK' },
    { id: '3', scene: '10A', ie: 'INT', loc: 'KITCHEN' },
    { id: '4', scene: '9', ie: 'INT', loc: '' },
  ];

  it('sorts scene numbers naturally (9, 10, 10A)', () => {
    const sorted = sortStrips(strips, [{ key: (s) => s.scene, direction: 'asc' }]);
    expect(sorted.map((s) => s.scene)).toEqual(['2', '9', '10', '10A']);
  });

  it('applies levels in priority order and keeps blanks last', () => {
    const sorted = sortStrips(strips, [
      { key: (s) => s.ie, direction: 'desc' },
      { key: (s) => s.loc, direction: 'asc' },
      { key: (s) => s.scene, direction: 'asc' },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(['1', '3', '4', '2']);
  });
});
