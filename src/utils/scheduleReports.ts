// ============================================
// SCHEDULE REPORTS (One-Line Schedule, Shooting Schedule)
// ============================================
// Same information as Movie Magic's built-in "One Line Schedule" and
// "Shooting Schedule" layouts (findings/mm-scheduling.md, Report Layouts):
// each strip's Int/Ext, Set, Day/Night, pages and scene numbers, plus the
// synopsis and the elements by category for the Shooting Schedule, laid
// out day by day with day-break totals.

import type { Breakdown, ProductionPerson, Schedule, SceneStrip } from '../types/screenplay';
import { BREAKDOWN_CATEGORY_INFO } from '../types/screenplay';
import { formatEighths } from './breakdown';
import { toYMD } from './doodReport';

export interface ReportStrip {
  kind: 'strip';
  stripId: string;
  sceneNumber: string;
  intExt: string;
  set: string;
  dayNight: string;
  eighths: number;
  pages: string; // "2 3/8"
  synopsis: string;
  castIds: string; // board IDs, e.g. "1, 2, 5"
  elements: { category: string; names: string[] }[]; // non-cast categories with elements
  cast: string[]; // "1. ADA", ...
}

export interface ReportBanner {
  kind: 'banner';
  text: string;
}

export interface ReportDay {
  dayNumber: number;
  date: string; // YYYY-MM-DD or ''
  items: (ReportStrip | ReportBanner)[];
  totalEighths: number;
  totalPages: string;
}

export interface ScheduleReport {
  title: string;
  credits?: string; // Production Info line for the header
  days: ReportDay[];
  totalEighths: number;
  totalPages: string;
}

const CATEGORY_ORDER = Object.keys(BREAKDOWN_CATEGORY_INFO);

function stripRow(
  strip: SceneStrip,
  breakdown: Breakdown | null,
  people: ProductionPerson[]
): ReportStrip {
  const eighths = Math.round(strip.pageCount * 8);
  const records = new Map((breakdown?.elementList ?? []).map((e) => [e.id, e]));
  const sheet = breakdown?.sheets?.[strip.sceneId];

  // Elements tagged in this scene, by category, using master names
  const byCategory = new Map<string, Set<string>>();
  for (const tag of breakdown?.elements ?? []) {
    if (tag.sceneId !== strip.sceneId || tag.category === 'Cast Members') continue;
    const name = (tag.elementRefId && records.get(tag.elementRefId)?.name) || tag.text.trim().toUpperCase();
    const set = byCategory.get(tag.category) ?? new Set<string>();
    set.add(name);
    byCategory.set(tag.category, set);
  }
  const elements = [...byCategory]
    .sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
    })
    .map(([category, names]) => ({ category, names: [...names].sort() }));

  const cast = strip.castIds.map((id, i) => {
    const record = records.get(id);
    const person = people.find((p) => p.id === id);
    const character = person?.roles.find((r) => r.group === 'Talent')?.characterName?.toUpperCase();
    const number = record?.boardId ?? (person?.castNumber !== undefined ? String(person.castNumber) : undefined) ?? (strip.castNumbers[i] !== undefined ? String(strip.castNumbers[i]) : undefined);
    const name = record?.name ?? character ?? (person ? `${person.firstName} ${person.lastName}`.trim() : id);
    return number ? `${number}. ${name}` : name;
  });
  const castIds = cast.map((c) => c.split('.')[0]).filter((c) => /^\w+$/.test(c)).join(', ');

  return {
    kind: 'strip',
    stripId: strip.id,
    sceneNumber: strip.sceneNumber,
    intExt: strip.intExt,
    set: strip.location,
    dayNight: strip.timeOfDay,
    eighths,
    pages: formatEighths(eighths),
    synopsis: sheet?.synopsis || strip.description || '',
    castIds,
    elements,
    cast,
  };
}

export function buildScheduleReport(
  schedule: Schedule,
  context: { breakdown: Breakdown | null; people: ProductionPerson[]; includeBanners?: boolean; title?: string; credits?: string }
): ScheduleReport {
  const stripById = new Map(schedule.strips.map((s) => [s.id, s]));
  const days: ReportDay[] = schedule.shootDays.map((day) => {
    const items: (ReportStrip | ReportBanner)[] = [];
    const banners = context.includeBanners ? (day.banners ?? []) : [];
    for (const stripId of day.strips) {
      banners.filter((b) => b.beforeStripId === stripId).forEach((b) => items.push({ kind: 'banner', text: b.text }));
      const strip = stripById.get(stripId);
      if (strip) items.push(stripRow(strip, context.breakdown, context.people));
    }
    banners
      .filter((b) => !b.beforeStripId || !day.strips.includes(b.beforeStripId))
      .forEach((b) => items.push({ kind: 'banner', text: b.text }));
    const totalEighths = items.reduce((sum, i) => sum + (i.kind === 'strip' ? i.eighths : 0), 0);
    return { dayNumber: day.dayNumber, date: toYMD(day.date), items, totalEighths, totalPages: formatEighths(totalEighths) };
  });
  const totalEighths = days.reduce((sum, d) => sum + d.totalEighths, 0);
  return { title: context.title ?? schedule.projectName, credits: context.credits, days, totalEighths, totalPages: formatEighths(totalEighths) };
}

export const formatReportDate = (ymd: string) =>
  ymd
    ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : '';

/** "End Day 1 -- Mon, Oct 19, 2026 -- 4 4/8 Pages", the one-liner day-break line */
export const dayBreakLine = (day: ReportDay) =>
  [`End Day ${day.dayNumber}`, formatReportDate(day.date), `${day.totalPages} Pages`].filter(Boolean).join(' -- ');

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function oneLineToCsv(report: ScheduleReport): string {
  const rows: (string | number)[][] = [['Shoot Day', 'Date', 'Scene', 'I/E', 'Set', 'D/N', 'Pages', 'Cast IDs', 'Synopsis']];
  for (const day of report.days) {
    for (const item of day.items) {
      if (item.kind === 'banner') rows.push([day.dayNumber, day.date, '', '', item.text, '', '', '', '']);
      else rows.push([day.dayNumber, day.date, item.sceneNumber, item.intExt, item.set, item.dayNight, item.pages, item.castIds, item.synopsis]);
    }
    rows.push([day.dayNumber, day.date, '', '', dayBreakLine(day), '', day.totalPages, '', '']);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

// ============================================
// LIST REPORTS (Cast List, Location List, element lists, Category By Day)
// ============================================
// Movie Magic's other built-in reports, as simple tables.

export interface TableReport {
  title: string;
  subtitle?: string;
  columns: string[];
  sections: { heading?: string; rows: string[][] }[];
}

type ReportContext = { breakdown: Breakdown | null; people: ProductionPerson[] };

const numericFirst = (a: string, b: string) => {
  const an = Number(a), bn = Number(b);
  if (a && b && !Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
  if (a && !b) return -1;
  if (!a && b) return 1;
  return a.localeCompare(b);
};

// Which scheduled days and scenes each element appears in
function elementAppearances(schedule: Schedule, ctx: ReportContext, category: string) {
  const records = new Map((ctx.breakdown?.elementList ?? []).map((e) => [e.id, e]));
  const dayOfStrip = new Map<string, number>();
  schedule.shootDays.forEach((d) => d.strips.forEach((id) => dayOfStrip.set(id, d.dayNumber)));
  const result = new Map<string, { name: string; boardId: string; scenes: Set<string>; days: Set<number> }>();
  const add = (id: string, name: string, boardId: string, scene: string, day?: number) => {
    const entry = result.get(id) ?? { name, boardId, scenes: new Set<string>(), days: new Set<number>() };
    entry.scenes.add(scene);
    if (day !== undefined) entry.days.add(day);
    result.set(id, entry);
  };

  for (const strip of schedule.strips) {
    const day = dayOfStrip.get(strip.id);
    if (category === 'Cast Members') {
      strip.castIds.forEach((id, i) => {
        const record = records.get(id);
        const person = ctx.people.find((p) => p.id === id);
        const character = person?.roles.find((r) => r.group === 'Talent')?.characterName?.toUpperCase();
        add(id, record?.name ?? character ?? (person ? `${person.firstName} ${person.lastName}` : id),
          record?.boardId ?? (person?.castNumber !== undefined ? String(person.castNumber) : String(strip.castNumbers[i] ?? '')),
          strip.sceneNumber, day);
      });
    }
    for (const tag of ctx.breakdown?.elements ?? []) {
      if (tag.sceneId !== strip.sceneId || tag.category !== category) continue;
      const record = tag.elementRefId ? records.get(tag.elementRefId) : undefined;
      if (record?.excludeFromStripboard) continue;
      const id = record?.id ?? `${category}:${tag.text.trim().toUpperCase()}`;
      add(id, record?.name ?? tag.text.trim().toUpperCase(), record?.boardId ?? '', strip.sceneNumber, day);
    }
  }
  return result;
}

const sceneList = (scenes: Set<string>) =>
  [...scenes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ');
const dayList = (days: Set<number>) => [...days].sort((a, b) => a - b).join(', ');

/** Cast List / Prop List / any category: one row per element */
export function buildElementListReport(schedule: Schedule, ctx: ReportContext, category: string): TableReport {
  const rows = [...elementAppearances(schedule, ctx, category).values()]
    .sort((a, b) => numericFirst(a.boardId, b.boardId) || a.name.localeCompare(b.name))
    .map((e) => {
      const person = category === 'Cast Members'
        ? ctx.people.find((p) => p.roles.some((r) => r.characterName?.toUpperCase() === e.name))
        : undefined;
      const base = [e.boardId, e.name];
      if (category === 'Cast Members') base.push(person ? `${person.firstName} ${person.lastName}`.trim() : '');
      return [...base, String(e.scenes.size), sceneList(e.scenes), dayList(e.days)];
    });
  const columns = category === 'Cast Members'
    ? ['ID', 'Character', 'Actor', 'Scenes', 'Scene Numbers', 'Shoot Days']
    : ['ID', 'Element', 'Scenes', 'Scene Numbers', 'Shoot Days'];
  return {
    title: category === 'Cast Members' ? 'Cast List' : category === 'Props' ? 'Prop List' : `${category} List`,
    columns,
    sections: [{ rows }],
  };
}

/** Location List: each Set with its real location, scenes and shoot days */
export function buildLocationListReport(schedule: Schedule, ctx: ReportContext): TableReport {
  const dayOfStrip = new Map<string, number>();
  schedule.shootDays.forEach((d) => d.strips.forEach((id) => dayOfStrip.set(id, d.dayNumber)));
  const sets = new Map<string, { location: string; ie: Set<string>; scenes: Set<string>; days: Set<number>; eighths: number }>();
  for (const strip of schedule.strips) {
    const sheet = ctx.breakdown?.sheets?.[strip.sceneId];
    const key = strip.location || '(no set)';
    const entry = sets.get(key) ?? { location: '', ie: new Set<string>(), scenes: new Set<string>(), days: new Set<number>(), eighths: 0 };
    if (sheet?.location && !entry.location) entry.location = sheet.location;
    entry.ie.add(strip.intExt);
    entry.scenes.add(strip.sceneNumber);
    const day = dayOfStrip.get(strip.id);
    if (day !== undefined) entry.days.add(day);
    entry.eighths += Math.round(strip.pageCount * 8);
    sets.set(key, entry);
  }
  const rows = [...sets]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([set, e]) => [set, e.location, [...e.ie].join('/'), sceneList(e.scenes), formatEighths(e.eighths), dayList(e.days)]);
  return { title: 'Location List', columns: ['Set', 'Location', 'I/E', 'Scenes', 'Pages', 'Shoot Days'], sections: [{ rows }] };
}

/** Category By Day (e.g. Extras By Day): what each shoot day needs */
export function buildCategoryByDayReport(schedule: Schedule, ctx: ReportContext, category: string): TableReport {
  const stripById = new Map(schedule.strips.map((s) => [s.id, s]));
  const appearances = elementAppearances(schedule, ctx, category);
  const sections = schedule.shootDays.map((day) => {
    const scenes = new Set(day.strips.map((id) => stripById.get(id)?.sceneNumber).filter(Boolean) as string[]);
    const rows = [...appearances.values()]
      .filter((e) => e.days.has(day.dayNumber))
      .sort((a, b) => numericFirst(a.boardId, b.boardId) || a.name.localeCompare(b.name))
      .map((e) => [e.boardId, e.name, sceneList(new Set([...e.scenes].filter((s) => scenes.has(s))))]);
    return { heading: ['Shoot Day # ' + day.dayNumber, formatReportDate(toYMD(day.date))].filter(Boolean).join(' -- '), rows };
  });
  const title = category === 'Background Actors' ? 'Extras By Day' : `${category} By Day`;
  return { title, columns: ['ID', category === 'Cast Members' ? 'Character' : 'Element', 'Scenes'], sections };
}

export function tableReportToCsv(report: TableReport): string {
  const lines: string[][] = [report.sections.some((s) => s.heading) ? ['Section', ...report.columns] : report.columns];
  for (const section of report.sections) {
    for (const row of section.rows) lines.push(section.heading !== undefined ? [section.heading, ...row] : row);
  }
  return lines.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}
