import { describe, expect, it } from 'vitest';
import type { Schedule, SceneStrip, ShootDay } from '../types/screenplay';
import { createCalendar } from '../engine/schedule/calendar';
import { parseClock, scheduleToIcs } from './calendarIcs';

const strip = (id: string, sceneNumber: string, pageCount: number, location = 'KITCHEN'): SceneStrip => ({
  id, sceneId: id, sceneNumber, intExt: 'INT', location, timeOfDay: 'DAY', description: '', pageCount,
  color: 'white' as SceneStrip['color'], castIds: [], castNumbers: [], isLocked: false,
} as unknown as SceneStrip);
const day = (id: string, dayNumber: number, strips: string[], extra: Partial<ShootDay> = {}): ShootDay => ({
  id, dayNumber, strips, shotPackages: [], callTime: '6:30 AM', estimatedWrap: '7:00 PM', isLocked: false, hasNightWork: false, ...extra,
} as unknown as ShootDay);

const schedule = {
  id: 's', projectName: 'Night Shift',
  strips: [strip('a', '4', 2.5), strip('b', '5', 0.375, 'STREET, NORTH; SIDE')],
  unscheduledStrips: [], shotPackages: [], unscheduledPackages: [], dayBreaks: [], companyMoves: [], dood: [],
  shootDays: [
    day('d1', 1, ['a', 'b']),
    day('d2', 2, ['b'], { callTime: '6:00 PM', estimatedWrap: '4:00 AM', timezone: 'America/New_York' }),
    day('d3', 3, [], { callTime: '' }),
  ],
  // Fri 2026-11-06 start, weekends off, a holiday on Mon 11-09
  calendar: createCalendar('2026-11-06', { specialDays: [{ date: '2026-11-09', kind: 'holiday', label: 'Veterans Day (obs.)' }] }),
} as unknown as Schedule;

describe('calendar export', () => {
  it('reads call times', () => {
    expect(parseClock('6:30 AM')).toEqual([6, 30]);
    expect(parseClock('12 am')).toEqual([0, 0]);
    expect(parseClock('18:45')).toEqual([18, 45]);
    expect(parseClock('later')).toBeNull();
  });

  it('writes one event per shoot day on the production calendar, plus holidays', () => {
    const ics = scheduleToIcs(schedule, { title: 'Night Shift', now: new Date('2026-10-20T08:00:00Z') });
    const unfolded = ics.replace(/\r\n /g, '');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0')).toBe(true);
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(unfolded).toContain('DTSTART:20261106T063000\r\nDTEND:20261106T190000');
    expect(unfolded).toContain('SUMMARY:Night Shift: Day 1 of 3 · Sc 4\\, 5');
    expect(unfolded).toContain('LOCATION:KITCHEN\\, STREET\\, NORTH\\; SIDE');
    expect(unfolded).toContain('Shoot Day 1 of 3 · 2 7/8 pages');
    // Day 2 skips the weekend and the holiday; wraps after midnight
    expect(unfolded).toContain('DTSTART;TZID=America/New_York:20261110T180000\r\nDTEND;TZID=America/New_York:20261111T040000');
    // No call time: all day
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20261111\r\nDTEND;VALUE=DATE:20261112');
    expect(unfolded).toContain('SUMMARY:Night Shift: Veterans Day (obs.)');
    expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(unfolded).toContain('DTSTAMP:20261020T080000Z');
  });
});
