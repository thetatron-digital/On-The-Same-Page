// ============================================
// RED FLAGS AND CONFLICTS
// ============================================
// Movie Magic's Red Flags (findings/mm-scheduling.md): a dated note
// attached to an element (e.g. "ADA unavailable", "Location closed").
// Flags with a DOOD status (Travel / Rehearsal / Fitting) put that code
// on the Day Out of Days, one per element per day. The Conflicts
// inspector lists flags that land on a day where their element works.

export type RedFlagDOODStatus = 'travel' | 'rehearsal' | 'fitting';

export interface RedFlag {
  id: string;
  name: string; // from the flag name list, e.g. "Unavailable"
  date: string; // YYYY-MM-DD
  category?: string;
  elementId?: string; // master element id (or cast person id)
  elementName?: string; // for display when the element is gone
  note?: string;
  doodStatus?: RedFlagDOODStatus;
}

// Movie Magic ships DOOD-type names alongside ordinary ones
export const DEFAULT_RED_FLAG_NAMES = [
  'Unavailable',
  'Location Closed',
  'Permit Restriction',
  'Travel - DOOD',
  'Rehearsal - DOOD',
  'Fitting - DOOD',
];

export const doodStatusForName = (name: string): RedFlagDOODStatus | undefined =>
  /^travel\b.*dood/i.test(name) ? 'travel'
    : /^rehearsal\b.*dood/i.test(name) ? 'rehearsal'
    : /^fitting\b.*dood/i.test(name) ? 'fitting'
    : undefined;

/** Movie Magic's rule: only one Day Out of Days red flag per element per day. */
export function doodFlagClash(flags: RedFlag[], candidate: Omit<RedFlag, 'id'> & { id?: string }): RedFlag | undefined {
  if (!candidate.doodStatus || !candidate.elementId) return undefined;
  return flags.find(
    (f) => f.id !== candidate.id && f.doodStatus && f.elementId === candidate.elementId && f.date === candidate.date
  );
}

/** DOOD events for one element, in the shape the DOOD engine takes. */
export const doodEventsFor = (flags: RedFlag[], elementId: string) =>
  flags
    .filter((f) => f.elementId === elementId && f.doodStatus)
    .map((f) => ({ date: f.date, kind: f.doodStatus! }));

export interface ScheduledElementDay {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  sceneNumber: string;
  elementId: string;
  elementName: string;
  category: string;
}

export interface Conflict {
  date: string;
  dayNumber: number;
  sceneNumber: string;
  flag: string; // flag name, or "Availability"
  category: string;
  element: string;
  note: string;
}

/**
 * Flags (that aren't DOOD markers) on a day where their element is
 * scheduled. Availability windows from People are checked the same way.
 */
export function findConflicts(
  scheduled: ScheduledElementDay[],
  flags: RedFlag[],
  availability: { elementId: string; startDate?: string; endDate?: string; blockedDates: string[] }[] = []
): Conflict[] {
  const conflicts: Conflict[] = [];
  const flagIndex = new Map<string, RedFlag[]>();
  for (const f of flags) {
    if (f.doodStatus || !f.elementId) continue;
    const key = `${f.elementId}|${f.date}`;
    flagIndex.set(key, [...(flagIndex.get(key) ?? []), f]);
  }
  const avail = new Map(availability.map((a) => [a.elementId, a]));
  const seen = new Set<string>();

  for (const s of scheduled) {
    for (const f of flagIndex.get(`${s.elementId}|${s.date}`) ?? []) {
      const key = `${f.id}|${s.sceneNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({ date: s.date, dayNumber: s.dayNumber, sceneNumber: s.sceneNumber, flag: f.name, category: s.category, element: s.elementName, note: f.note ?? '' });
    }
    const a = avail.get(s.elementId);
    if (!a || !s.date) continue;
    const reason = a.blockedDates.includes(s.date)
      ? 'blocked that day'
      : a.startDate && s.date < a.startDate
        ? `available from ${a.startDate}`
        : a.endDate && s.date > a.endDate
          ? `available until ${a.endDate}`
          : null;
    const key = `avail|${s.elementId}|${s.date}|${s.sceneNumber}`;
    if (reason && !seen.has(key)) {
      seen.add(key);
      conflicts.push({ date: s.date, dayNumber: s.dayNumber, sceneNumber: s.sceneNumber, flag: 'Availability', category: s.category, element: s.elementName, note: reason });
    }
  }
  return conflicts.sort((x, y) => x.dayNumber - y.dayNumber || x.sceneNumber.localeCompare(y.sceneNumber, undefined, { numeric: true }));
}
