// ============================================
// DAY OUT OF DAYS (DOOD)
// ============================================
// Builds the element × day matrix behind a Day Out of Days report, the
// way Movie Magic Scheduling does (findings/mm-scheduling.md, "Day Out
// of Days"):
//   - an element's first work day is a Start (S), its last a Finish (F);
//     a one-day element is SWF
//   - shooting days between start and finish where the element doesn't
//     work become Hold (H) if holds are allowed for it
//   - a gap of at least `minDaysBetweenDropPickup` calendar days becomes
//     a Drop (D) on the last work day before it and a Pickup (P) on the
//     first work day after, if drop/pickup is allowed; the gap is not paid
//   - holidays and company-travel days between start and finish are
//     marked and totalled
//   - Travel / Rehearsal / Fitting red flags put their code on that day
// Totals: TOTAL = Work + Hold + Company Travel (per the MMS help).
// The exact MMS hold/drop arithmetic was not observable without
// decompiling; this is OTSP's documented version of it.

import { daysBetween, type CalendarColumn } from './calendar';

export interface DOODCodes {
  start: string;
  work: string;
  finish: string;
  hold: string;
  drop: string;
  pickup: string;
  holiday: string;
  companyTravel: string;
  travel: string;
  rehearsal: string;
  fitting: string;
}

// Same defaults as Movie Magic's DOOD preferences (one-letter where MMS is)
export const DEFAULT_DOOD_CODES: DOODCodes = {
  start: 'S',
  work: 'W',
  finish: 'F',
  hold: 'H',
  drop: 'D',
  pickup: 'P',
  holiday: '/',
  companyTravel: 'M',
  travel: 'TR',
  rehearsal: 'R',
  fitting: 'FT',
};

export interface DOODElementOptions {
  allowHold: boolean;
  allowDropPickup: boolean;
  minDaysBetweenDropPickup: number;
}

export const DEFAULT_MIN_DAYS_BETWEEN_DROP_PICKUP = 10;

// Per-schedule DOOD preferences (Movie Magic keeps these per category,
// overridable per element in the Edit Element window)
export interface DOODSettings {
  codes: DOODCodes;
  categoryOptions: Record<string, DOODElementOptions>;
  elementOptions: Record<string, Partial<DOODElementOptions>>; // keyed by element id
}

const NO_HOLDS: DOODElementOptions = {
  allowHold: false,
  allowDropPickup: false,
  minDaysBetweenDropPickup: DEFAULT_MIN_DAYS_BETWEEN_DROP_PICKUP,
};

// Cast shows holds by default, as on a standard DOOD report
export const DEFAULT_DOOD_SETTINGS: DOODSettings = {
  codes: DEFAULT_DOOD_CODES,
  categoryOptions: { Cast: { ...NO_HOLDS, allowHold: true } },
  elementOptions: {},
};

export function resolveDOODOptions(settings: DOODSettings, category: string, elementId: string): DOODElementOptions {
  return {
    ...NO_HOLDS,
    ...settings.categoryOptions[category],
    ...settings.elementOptions[elementId],
  };
}

export interface DOODElementInput {
  id: string;
  name: string;
  boardId?: string; // e.g. cast number
  options: DOODElementOptions;
  // Shooting-day indexes on which the element works
  workDays: number[];
  // Red-flag style day events (by calendar date)
  events?: { date: string; kind: 'travel' | 'rehearsal' | 'fitting' }[];
}

export type DOODDayKind = 'work' | 'hold' | 'holiday' | 'companyTravel' | 'travel' | 'rehearsal' | 'fitting' | 'none';

export interface DOODCell {
  code: string; // e.g. 'SW', 'W', 'WD', 'PW', 'WF', 'H', '/', ''
  kind: DOODDayKind;
}

export interface DOODTotals {
  companyTravel: number;
  work: number;
  hold: number;
  holiday: number;
  start: string | null; // date of first work day
  finish: string | null; // date of last work day
  total: number; // work + hold + companyTravel
}

export interface DOODRow {
  elementId: string;
  name: string;
  boardId?: string;
  cells: DOODCell[]; // one per column
  totals: DOODTotals;
}

const EMPTY: DOODCell = { code: '', kind: 'none' };

export function buildDOODRow(
  element: DOODElementInput,
  columns: CalendarColumn[],
  codes: DOODCodes = DEFAULT_DOOD_CODES
): DOODRow {
  const cells: DOODCell[] = columns.map(() => EMPTY);
  const totals: DOODTotals = { companyTravel: 0, work: 0, hold: 0, holiday: 0, start: null, finish: null, total: 0 };

  // Column positions of the element's work days, in schedule order
  const workSet = new Set(element.workDays);
  const workCols = columns
    .map((c, i) => (c.kind === 'shoot' && workSet.has(c.shootDayIndex!) ? i : -1))
    .filter((i) => i >= 0);

  if (workCols.length > 0) {
    const first = workCols[0];
    const last = workCols[workCols.length - 1];
    totals.start = columns[first].date;
    totals.finish = columns[last].date;

    // Find drop/pickup gaps between consecutive work days
    const drops = new Set<number>();
    const pickups = new Set<number>();
    const unpaidGap = new Set<number>();
    if (element.options.allowDropPickup) {
      for (let k = 1; k < workCols.length; k++) {
        const a = workCols[k - 1];
        const b = workCols[k];
        const gapDays = daysBetween(columns[a].date, columns[b].date) - 1;
        if (b - a > 1 && gapDays >= element.options.minDaysBetweenDropPickup) {
          drops.add(a);
          pickups.add(b);
          for (let i = a + 1; i < b; i++) unpaidGap.add(i);
        }
      }
    }

    for (let i = first; i <= last; i++) {
      const col = columns[i];
      if (workCols.includes(i)) {
        let code = codes.work;
        if (i === first) code = codes.start + code;
        if (pickups.has(i)) code = codes.pickup + code;
        if (i === last) code += codes.finish;
        else if (drops.has(i)) code += codes.drop;
        cells[i] = { code, kind: 'work' };
        totals.work++;
      } else if (unpaidGap.has(i)) {
        // dropped: element is off payroll until the pickup
      } else if (col.kind === 'holiday') {
        cells[i] = { code: codes.holiday, kind: 'holiday' };
        totals.holiday++;
      } else if (col.kind === 'companyTravel') {
        cells[i] = { code: codes.companyTravel, kind: 'companyTravel' };
        totals.companyTravel++;
      } else if (element.options.allowHold) {
        cells[i] = { code: codes.hold, kind: 'hold' };
        totals.hold++;
      }
    }
  }

  // Red-flag events override an empty cell or a hold (never a work day)
  for (const event of element.events ?? []) {
    const i = columns.findIndex((c) => c.date === event.date);
    if (i < 0 || cells[i].kind === 'work') continue;
    if (cells[i].kind === 'hold') totals.hold--;
    cells[i] = { code: codes[event.kind], kind: event.kind };
  }

  totals.total = totals.work + totals.hold + totals.companyTravel;
  return { elementId: element.id, name: element.name, boardId: element.boardId, cells, totals };
}

export function buildDOOD(
  elements: DOODElementInput[],
  columns: CalendarColumn[],
  codes: DOODCodes = DEFAULT_DOOD_CODES
): DOODRow[] {
  return elements.map((e) => buildDOODRow(e, columns, codes));
}
