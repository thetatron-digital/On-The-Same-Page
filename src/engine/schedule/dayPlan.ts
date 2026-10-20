// ============================================
// DAY PLAN AND LIVE AHEAD / BEHIND
// ============================================
// Spread the working day (call to wrap, less lunch and company moves)
// across the day's scenes by page count, so each scene has a planned
// length. On set, compare the planned minutes of the work finished with
// the minutes actually worked: that is how far ahead or behind the day
// is, and the scheduled wrap moves by the same amount.

import type { CompanyMove, SceneStrip, ShootDay } from '../../types/screenplay';
import { parseClock } from '../../utils/calendarIcs';

export interface PlanItem {
  kind: 'strip' | 'move';
  id: string;            // strip id, or move id
  eighths: number;
  minutes: number;       // planned length
  start: number;         // planned start, minutes after call
}

export interface DayPlan {
  items: PlanItem[];
  callMinutes: number | null;  // minutes after midnight
  wrapMinutes: number | null;
  lunchMinutes: number;
  workMinutes: number;          // shooting time to share among scenes
}

const DEFAULT_DAY = 12 * 60; // when call or wrap is missing

export function planDay(day: ShootDay, strips: Map<string, SceneStrip>, moves: CompanyMove[] = [], defaultLunch = 60): DayPlan {
  const call = parseClock(day.callTime);
  const wrap = parseClock(day.estimatedWrap);
  const callMinutes = call ? call[0] * 60 + call[1] : null;
  let wrapMinutes = wrap ? wrap[0] * 60 + wrap[1] : null;
  if (callMinutes !== null && wrapMinutes !== null && wrapMinutes <= callMinutes) wrapMinutes += 24 * 60; // past midnight
  const lunchMinutes = day.lunchDuration ?? defaultLunch;
  const length = callMinutes !== null && wrapMinutes !== null ? wrapMinutes - callMinutes : DEFAULT_DAY;

  const dayStrips = day.strips.map((id) => strips.get(id)).filter(Boolean) as SceneStrip[];
  const dayMoves = moves.filter((m) => day.strips.includes(m.afterStripId));
  const moveMinutes = dayMoves.reduce((n, m) => n + (m.estimatedTime || 0), 0);
  const workMinutes = Math.max(0, length - lunchMinutes - moveMinutes);
  const eighths = dayStrips.map((s) => Math.max(1, Math.round(s.pageCount * 8)));
  const totalEighths = eighths.reduce((a, b) => a + b, 0) || 1;

  const items: PlanItem[] = [];
  let at = 0;
  dayStrips.forEach((s, i) => {
    const minutes = Math.round((workMinutes * eighths[i]) / totalEighths);
    items.push({ kind: 'strip', id: s.id, eighths: eighths[i], minutes, start: at });
    at += minutes;
    for (const m of dayMoves.filter((mv) => mv.afterStripId === s.id)) {
      items.push({ kind: 'move', id: m.id, eighths: 0, minutes: m.estimatedTime || 0, start: at });
      at += m.estimatedTime || 0;
    }
  });
  return { items, callMinutes, wrapMinutes, lunchMinutes, workMinutes };
}

export interface DayProgress {
  aheadMinutes: number;          // + ahead, - behind
  plannedDoneMinutes: number;
  workedMinutes: number;
  projectedWrapMinutes: number | null; // minutes after midnight
  remainingMinutes: number;
}

/**
 * Where the day stands: planned minutes of finished scenes (and the moves
 * after them) against minutes worked since the day started, less lunch.
 */
export function dayProgress(plan: DayPlan, completed: Set<string>, startedAt: Date, now: Date, lunchTakenMinutes = 0): DayProgress {
  let plannedDone = 0;
  let lastStripDone = false;
  for (const item of plan.items) {
    if (item.kind === 'strip') lastStripDone = completed.has(item.id);
    if ((item.kind === 'strip' && completed.has(item.id)) || (item.kind === 'move' && lastStripDone)) plannedDone += item.minutes;
  }
  const worked = Math.max(0, (now.getTime() - startedAt.getTime()) / 60000 - lunchTakenMinutes);
  const ahead = Math.round(plannedDone - worked);
  const total = plan.items.reduce((n, i) => n + i.minutes, 0);
  return {
    aheadMinutes: ahead,
    plannedDoneMinutes: plannedDone,
    workedMinutes: Math.round(worked),
    projectedWrapMinutes: plan.wrapMinutes !== null ? plan.wrapMinutes - ahead : null,
    remainingMinutes: Math.max(0, total - plannedDone),
  };
}

export const clockFromMinutes = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
