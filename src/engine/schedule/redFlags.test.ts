import { describe, expect, it } from 'vitest';
import { doodEventsFor, doodFlagClash, doodStatusForName, findConflicts, type RedFlag } from './redFlags';
import { buildDOODRow } from './dood';
import { createCalendar, layOutSchedule } from './calendar';

const flags: RedFlag[] = [
  { id: 'f1', name: 'Unavailable', date: '2026-03-03', elementId: 'ada', elementName: 'ADA', category: 'Cast Members', note: 'Doctor' },
  { id: 'f2', name: 'Fitting - DOOD', date: '2026-03-02', elementId: 'ada', doodStatus: 'fitting' },
  { id: 'f3', name: 'Location Closed', date: '2026-03-04', elementId: 'park', elementName: 'PARK' },
];

describe('red flags', () => {
  it('recognizes the DOOD flag names', () => {
    expect(['Travel - DOOD', 'Rehearsal - DOOD', 'Fitting - DOOD', 'Unavailable'].map(doodStatusForName)).toEqual(['travel', 'rehearsal', 'fitting', undefined]);
  });

  it('allows only one DOOD flag per element per day', () => {
    expect(doodFlagClash(flags, { name: 'Travel - DOOD', date: '2026-03-02', elementId: 'ada', doodStatus: 'travel' })?.id).toBe('f2');
    expect(doodFlagClash(flags, { name: 'Travel - DOOD', date: '2026-03-05', elementId: 'ada', doodStatus: 'travel' })).toBeUndefined();
    expect(doodFlagClash(flags, { name: 'Unavailable', date: '2026-03-02', elementId: 'ada' })).toBeUndefined();
  });

  it('feeds DOOD flags to the Day Out of Days', () => {
    const columns = layOutSchedule(createCalendar('2026-03-02'), 3);
    const row = buildDOODRow({
      id: 'ada', name: 'ADA', workDays: [1, 2], events: doodEventsFor(flags, 'ada'),
      options: { allowHold: true, allowDropPickup: false, minDaysBetweenDropPickup: 10 },
    }, columns);
    expect(row.cells.map((c) => c.code)).toEqual(['FT', 'SW', 'WF']);
  });

  it('finds flags and availability windows that hit scheduled days', () => {
    const scheduled = [
      { date: '2026-03-03', dayNumber: 2, sceneNumber: '5', elementId: 'ada', elementName: 'ADA', category: 'Cast Members' },
      { date: '2026-03-03', dayNumber: 2, sceneNumber: '6', elementId: 'grace', elementName: 'GRACE', category: 'Cast Members' },
      { date: '2026-03-02', dayNumber: 1, sceneNumber: '1', elementId: 'ada', elementName: 'ADA', category: 'Cast Members' }, // only a DOOD flag
    ];
    const conflicts = findConflicts(scheduled, flags, [{ elementId: 'grace', blockedDates: [], startDate: '2026-03-10' }]);
    expect(conflicts.map((c) => [c.dayNumber, c.sceneNumber, c.flag, c.element, c.note])).toEqual([
      [2, '5', 'Unavailable', 'ADA', 'Doctor'],
      [2, '6', 'Availability', 'GRACE', 'available from 2026-03-10'],
    ]);
  });
});
