// ============================================
// STRIPBOARD OPERATIONS
// ============================================
// Auto Day Breaks and Sort, as in Movie Magic Scheduling
// (findings/mm-scheduling.md, "Auto Day Breaks" and "Sort strips"):
//   - Auto Day Breaks fills each day up to a maximum number of pages
//     (or estimated minutes) and starts a new day before the strip that
//     would go over. A strip longer than the maximum gets a day to itself.
//   - Sort reorders the scheduled strips by any number of levels, each
//     ascending or descending. Like MMS, sorting clears all day breaks:
//     the caller gets one flat list back and must re-break the days.

export interface BreakableStrip {
  id: string;
  eighths: number; // page length in eighths (8 = one page)
  estimatedMinutes?: number;
}

export interface AutoDayBreakOptions {
  // Exactly one of these; pages are compared in eighths internally
  maxPagesPerDay?: number;
  maxMinutesPerDay?: number;
}

/** Split an ordered list of strips into shooting days. */
export function autoDayBreaks<T extends BreakableStrip>(strips: T[], options: AutoDayBreakOptions): T[][] {
  const limit =
    options.maxPagesPerDay !== undefined
      ? Math.round(options.maxPagesPerDay * 8)
      : options.maxMinutesPerDay;
  if (!limit || limit <= 0) throw new Error('Auto Day Breaks needs a positive maximum per day.');

  const measure = (s: T) =>
    options.maxPagesPerDay !== undefined ? s.eighths : (s.estimatedMinutes ?? 0);

  const days: T[][] = [];
  let current: T[] = [];
  let used = 0;
  for (const strip of strips) {
    const size = measure(strip);
    if (current.length > 0 && used + size > limit) {
      days.push(current);
      current = [];
      used = 0;
    }
    current.push(strip);
    used += size;
  }
  if (current.length > 0) days.push(current);
  return days;
}

export type SortDirection = 'asc' | 'desc';

export interface SortLevel<T> {
  key: (strip: T) => string | number | undefined;
  direction: SortDirection;
}

// "10A" after "10", "9" before "10": numbers compare numerically
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareValues(a: string | number | undefined, b: string | number | undefined): number {
  // Blanks sort last regardless of direction
  const aBlank = a === undefined || a === '';
  const bBlank = b === undefined || b === '';
  if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/** Multi-level stable sort. Level 1 has the highest priority. */
export function sortStrips<T>(strips: T[], levels: SortLevel<T>[]): T[] {
  return strips
    .map((strip, index) => ({ strip, index }))
    .sort((x, y) => {
      for (const level of levels) {
        const a = level.key(x.strip);
        const b = level.key(y.strip);
        const blank = (v: unknown) => v === undefined || v === '';
        let cmp = compareValues(a, b);
        if (level.direction === 'desc' && !blank(a) && !blank(b)) cmp = -cmp;
        if (cmp !== 0) return cmp;
      }
      return x.index - y.index;
    })
    .map(({ strip }) => strip);
}

/** Total page length of a day, e.g. 2 3/8 pages = 19 eighths. */
export const totalEighths = (strips: BreakableStrip[]) => strips.reduce((sum, s) => sum + s.eighths, 0);
