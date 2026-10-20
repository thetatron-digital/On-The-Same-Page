import { describe, expect, it } from 'vitest';
import type { CompanyMove, SceneStrip, ShootDay } from '../../types/screenplay';
import { clockFromMinutes, dayProgress, planDay } from './dayPlan';

const strip = (id: string, pageCount: number) => ({ id, pageCount } as SceneStrip);
const strips = new Map([['a', strip('a', 2)], ['b', strip('b', 1)], ['c', strip('c', 1)]]);
const day = { id: 'd', dayNumber: 1, strips: ['a', 'b', 'c'], callTime: '7:00 AM', estimatedWrap: '7:00 PM', lunchDuration: 60 } as unknown as ShootDay;
const moves = [{ id: 'm', afterStripId: 'a', fromLocation: 'X', toLocation: 'Y', estimatedTime: 60 }] as CompanyMove[];

describe('day plan', () => {
  it('shares the working day by pages, after lunch and moves', () => {
    const plan = planDay(day, strips, moves);
    expect(plan.workMinutes).toBe(12 * 60 - 60 - 60);
    expect(plan.items.map((i) => `${i.kind}:${i.id}:${i.minutes}@${i.start}`)).toEqual(['strip:a:300@0', 'move:m:60@300', 'strip:b:150@360', 'strip:c:150@510']);
  });

  it('measures ahead or behind and moves the projected wrap', () => {
    const plan = planDay(day, strips, moves);
    const start = new Date('2026-11-02T07:30:00');
    // 4h worked, scene A (5h planned) done: 1h ahead, wrap moves to 6 PM
    const p = dayProgress(plan, new Set(['a']), start, new Date('2026-11-02T11:30:00'));
    expect(p.aheadMinutes).toBe(60 + 60); // the move after A also counts once A is done
    expect(clockFromMinutes(p.projectedWrapMinutes!)).toBe('5:00 PM');
    // After lunch with nothing more done: behind
    const later = dayProgress(plan, new Set(['a']), start, new Date('2026-11-02T16:30:00'), 60);
    expect(later.aheadMinutes).toBe(360 - 480);
    expect(later.remainingMinutes).toBe(300);
  });

  it('handles wraps after midnight and missing times', () => {
    const night = planDay({ ...day, callTime: '6:00 PM', estimatedWrap: '6:00 AM' } as ShootDay, strips);
    expect(night.workMinutes).toBe(660);
    expect(clockFromMinutes(night.wrapMinutes!)).toBe('6:00 AM');
    expect(planDay({ ...day, callTime: '' } as ShootDay, strips).workMinutes).toBe(660);
  });
});
