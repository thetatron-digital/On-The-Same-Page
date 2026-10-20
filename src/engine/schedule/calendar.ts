// ============================================
// PRODUCTION CALENDAR
// ============================================
// Mirrors Movie Magic Scheduling's calendar model: a production start
// date, a weekly days-off template ("5 day week") and special days
// (day off, holiday, company travel, exception workday). Shooting days
// are laid onto the calendar in order, skipping anything that isn't a
// workday. Dates are plain 'YYYY-MM-DD' strings so they never shift
// with time zones.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday (Date.getUTCDay)

export type SpecialDayKind = 'off' | 'holiday' | 'companyTravel' | 'workday';

export interface SpecialDay {
  date: string; // YYYY-MM-DD
  kind: SpecialDayKind; // 'workday' = shoot on a normally-off day
  label?: string;
}

export interface ProductionCalendar {
  id: string;
  name: string;
  startDate: string; // first possible shooting date, YYYY-MM-DD
  daysOff: Weekday[]; // weekly template, e.g. [0, 6] for a 5-day week
  specialDays: SpecialDay[];
}

export type CalendarColumnKind = 'shoot' | 'holiday' | 'companyTravel';

// One column of a schedule as it appears on a calendar or DOOD report
export interface CalendarColumn {
  kind: CalendarColumnKind;
  date: string;
  shootDayIndex?: number; // index into the ordered shooting days, for 'shoot'
  label?: string;
}

export const FIVE_DAY_WEEK: Weekday[] = [0, 6];

export function createCalendar(startDate: string, overrides: Partial<ProductionCalendar> = {}): ProductionCalendar {
  return {
    id: 'calendar-default',
    name: 'Default Calendar',
    startDate,
    daysOff: FIVE_DAY_WEEK,
    specialDays: [],
    ...overrides,
  };
}

const parse = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export const addDays = (date: string, days: number): string =>
  new Date(parse(date) + days * 86_400_000).toISOString().slice(0, 10);

export const daysBetween = (from: string, to: string): number =>
  Math.round((parse(to) - parse(from)) / 86_400_000);

const weekday = (date: string) => new Date(parse(date)).getUTCDay() as Weekday;

/**
 * Walk the calendar from its start date and lay `shootDayCount` shooting
 * days onto it. Holidays and company-travel days that fall between the
 * first and last shooting day become their own columns (they count on a
 * Day Out of Days report); ordinary days off are skipped.
 */
export function layOutSchedule(calendar: ProductionCalendar, shootDayCount: number): CalendarColumn[] {
  const special = new Map(calendar.specialDays.map((d) => [d.date, d]));
  const columns: CalendarColumn[] = [];
  const pending: CalendarColumn[] = []; // non-shoot columns waiting for a later shoot day
  let date = calendar.startDate;
  let shot = 0;
  // Guard against calendars where every day is off
  for (let guard = 0; shot < shootDayCount && guard < shootDayCount * 14 + 366; guard++, date = addDays(date, 1)) {
    const sp = special.get(date);
    if (sp?.kind === 'holiday' || sp?.kind === 'companyTravel') {
      if (shot > 0) pending.push({ kind: sp.kind, date, label: sp.label });
      continue;
    }
    const isOff = sp?.kind === 'off' || (sp?.kind !== 'workday' && calendar.daysOff.includes(weekday(date)));
    if (isOff) continue;

    columns.push(...pending.splice(0), { kind: 'shoot', date, shootDayIndex: shot });
    shot++;
  }
  return columns;
}

// Dates of the shooting days only, in order
export function shootDates(calendar: ProductionCalendar, shootDayCount: number): string[] {
  return layOutSchedule(calendar, shootDayCount)
    .filter((c) => c.kind === 'shoot')
    .map((c) => c.date);
}
