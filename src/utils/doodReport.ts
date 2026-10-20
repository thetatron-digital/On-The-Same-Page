// ============================================
// DAY OUT OF DAYS REPORT (from an OTSP schedule)
// ============================================
// Collects the elements of one category from the stripboard and the
// breakdown, works out which shooting days each one works, and runs the
// DOOD engine. Like Movie Magic, a report needs scheduled days.

import type { Breakdown, ProductionPerson, Schedule } from '../types/screenplay';
import { layOutSchedule, type CalendarColumn } from '../engine/schedule/calendar';
import { doodEventsFor } from '../engine/schedule/redFlags';
import {
  buildDOOD,
  DEFAULT_DOOD_SETTINGS,
  resolveDOODOptions,
  type DOODElementInput,
  type DOODRow,
} from '../engine/schedule/dood';

export const CAST_CATEGORY = 'Cast Members';

export interface DOODReport {
  category: string;
  columns: CalendarColumn[];
  rows: DOODRow[];
}

// Local calendar date of a stored Date (shoot days are stored at noon)
export const toYMD = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function scheduleColumns(schedule: Schedule): CalendarColumn[] {
  if (schedule.calendar) return layOutSchedule(schedule.calendar, schedule.shootDays.length);
  return schedule.shootDays.map((day, i) => ({ kind: 'shoot', date: toYMD(day.date), shootDayIndex: i }));
}

/** Categories that have something to report: Cast plus tagged breakdown categories. */
export function doodCategories(breakdown: Breakdown | null): string[] {
  const tagged = new Set((breakdown?.elements ?? []).map((e) => e.category).filter((c) => c !== CAST_CATEGORY));
  return [CAST_CATEGORY, ...[...tagged].sort()];
}

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toUpperCase();

interface Element {
  id: string;
  name: string;
  boardId?: string;
  works: (stripId: string) => boolean;
}

function castElements(schedule: Schedule, breakdown: Breakdown | null, people: ProductionPerson[]): Element[] {
  const stripById = new Map(schedule.strips.map((s) => [s.id, s]));
  const ids = new Map<string, number | undefined>(); // castId -> board number
  for (const day of schedule.shootDays) {
    for (const stripId of day.strips) {
      const strip = stripById.get(stripId);
      strip?.castIds.forEach((id, i) => {
        if (!ids.has(id) || ids.get(id) === undefined) ids.set(id, strip.castNumbers[i]);
      });
    }
  }
  return [...ids].map(([id, stripNumber]) => {
    const person = people.find((p) => p.id === id);
    const castMember = breakdown?.castList.find((c) => c.id === id);
    const record = breakdown?.elementList?.find((e) => e.id === id);
    const character = person?.roles.find((r) => r.group === 'Talent')?.characterName;
    const name =
      character?.toUpperCase() ||
      record?.name ||
      castMember?.characterName ||
      (person ? `${person.firstName} ${person.lastName}`.trim() : id);
    const recordNumber = record?.boardId && !Number.isNaN(Number(record.boardId)) ? Number(record.boardId) : undefined;
    const number = person?.castNumber ?? recordNumber ?? stripNumber;
    return {
      id,
      name,
      boardId: number !== undefined ? String(number) : undefined,
      works: (stripId) => stripById.get(stripId)?.castIds.includes(id) ?? false,
    };
  });
}

function taggedElements(schedule: Schedule, breakdown: Breakdown | null, category: string): Element[] {
  const stripById = new Map(schedule.strips.map((s) => [s.id, s]));

  // Master element list (Element Manager): names, Board IDs, exclusions
  if (breakdown?.elementList?.length) {
    const scenesOf = new Map<string, Set<string>>();
    for (const tag of breakdown.elements) {
      if (!tag.elementRefId) continue;
      const set = scenesOf.get(tag.elementRefId) ?? new Set<string>();
      set.add(tag.sceneId);
      scenesOf.set(tag.elementRefId, set);
    }
    return breakdown.elementList
      .filter((e) => e.category === category && !e.excludeFromStripboard)
      .map((e) => ({
        id: e.id,
        name: e.name,
        boardId: e.boardId,
        works: (stripId: string) => scenesOf.get(e.id)?.has(stripById.get(stripId)?.sceneId ?? '') ?? false,
      }));
  }

  const groups = new Map<string, { name: string; sceneIds: Set<string> }>();
  for (const el of breakdown?.elements ?? []) {
    if (el.category !== category) continue;
    const key = normalize(el.text);
    if (!key) continue;
    const group = groups.get(key) ?? { name: key, sceneIds: new Set<string>() };
    group.sceneIds.add(el.sceneId);
    groups.set(key, group);
  }
  return [...groups].map(([key, g]) => ({
    id: `${category}:${key}`,
    name: g.name,
    works: (stripId) => g.sceneIds.has(stripById.get(stripId)?.sceneId ?? ''),
  }));
}

export function buildScheduleDOOD(
  schedule: Schedule,
  category: string,
  context: { breakdown: Breakdown | null; people: ProductionPerson[] }
): DOODReport {
  const settings = schedule.doodSettings ?? DEFAULT_DOOD_SETTINGS;
  const elements =
    category === CAST_CATEGORY
      ? castElements(schedule, context.breakdown, context.people)
      : taggedElements(schedule, context.breakdown, category);

  const inputs: DOODElementInput[] = elements
    .map((el) => ({
      id: el.id,
      name: el.name,
      boardId: el.boardId,
      options: resolveDOODOptions(settings, category, el.id),
      events: doodEventsFor(schedule.redFlags ?? [], el.id),
      workDays: schedule.shootDays.flatMap((day, i) => (day.strips.some(el.works) ? [i] : [])),
    }))
    .filter((el) => el.workDays.length > 0)
    .sort((a, b) => {
      const an = Number(a.boardId);
      const bn = Number(b.boardId);
      if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
      if (a.boardId && !b.boardId) return -1;
      if (!a.boardId && b.boardId) return 1;
      return a.name.localeCompare(b.name);
    });

  const columns = scheduleColumns(schedule);
  return { category, columns, rows: buildDOOD(inputs, columns, settings.codes) };
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One header row per Movie Magic's DOOD layout (Month/Day/Day of Week/Shooting Day), then elements. */
export function doodToCsv(report: DOODReport): string {
  const header = (label: string, cell: (c: CalendarColumn) => string) =>
    [label, ...report.columns.map(cell), '', '', '', '', '', '', ''];
  const dateOf = (c: CalendarColumn) => (c.date ? new Date(`${c.date}T12:00:00`) : null);
  const lines: (string | number)[][] = [
    header('Month', (c) => dateOf(c)?.toLocaleString('en-US', { month: 'short' }) ?? ''),
    header('Day', (c) => (c.date ? String(Number(c.date.slice(8))) : '')),
    header('Day of Week', (c) => (dateOf(c) ? WEEKDAYS[dateOf(c)!.getDay()] : '')),
    [
      'Shooting Day',
      ...report.columns.map((c) => (c.kind === 'shoot' ? String(c.shootDayIndex! + 1) : c.kind === 'holiday' ? 'Holiday' : 'Co. Travel')),
      'Co. Travel', 'Work', 'Hold', 'Holiday', 'Start', 'Finish', 'TOTAL',
    ],
    ...report.rows.map((row) => [
      row.boardId ? `${row.boardId}. ${row.name}` : row.name,
      ...row.cells.map((c) => c.code),
      row.totals.companyTravel,
      row.totals.work,
      row.totals.hold,
      row.totals.holiday,
      row.totals.start ?? '',
      row.totals.finish ?? '',
      row.totals.total,
    ]),
  ];
  return lines.map((line) => line.map(csvCell).join(',')).join('\n') + '\n';
}

/**
 * Who works on which dated shoot day: cast on each strip plus every
 * tagged element of the strip's scene. Feeds the Red Flag Conflicts check.
 */
export function scheduledElementDays(
  schedule: Schedule,
  context: { breakdown: Breakdown | null; people: ProductionPerson[] }
): import('../engine/schedule/redFlags').ScheduledElementDay[] {
  const stripById = new Map(schedule.strips.map((s) => [s.id, s]));
  const records = new Map((context.breakdown?.elementList ?? []).map((e) => [e.id, e]));
  const columns = scheduleColumns(schedule).filter((c) => c.kind === 'shoot');
  // Same cast naming as the DOOD: "1. ADA"
  const castNames = new Map(
    castElements(schedule, context.breakdown, context.people).map((c) => [c.id, c.boardId ? `${c.boardId}. ${c.name}` : c.name])
  );
  const result: import('../engine/schedule/redFlags').ScheduledElementDay[] = [];
  schedule.shootDays.forEach((day, i) => {
    const date = columns[i]?.date || toYMD(day.date);
    if (!date) return;
    for (const stripId of day.strips) {
      const strip = stripById.get(stripId);
      if (!strip) continue;
      const base = { date, dayNumber: day.dayNumber, sceneNumber: strip.sceneNumber };
      for (const id of strip.castIds) {
        result.push({ ...base, elementId: id, elementName: castNames.get(id) ?? id, category: CAST_CATEGORY });
      }
      const tagged = new Set<string>();
      for (const tag of context.breakdown?.elements ?? []) {
        if (tag.sceneId !== strip.sceneId || !tag.elementRefId || tagged.has(tag.elementRefId) || tag.category === CAST_CATEGORY) continue;
        tagged.add(tag.elementRefId);
        const record = records.get(tag.elementRefId);
        result.push({ ...base, elementId: tag.elementRefId, elementName: record?.name ?? tag.text, category: tag.category });
      }
    }
  });
  return result;
}
