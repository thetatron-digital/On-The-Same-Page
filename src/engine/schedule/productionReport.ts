// ============================================
// DAILY PRODUCTION REPORT
// ============================================
// What happened on a shoot day, from what OTSP already knows: the day's
// scheduled strips (BaseCamp), takes and setups (SuperVisor), the clock,
// lunch and delays (OnSet), plus what the AD types in (times, notes).
// Progress is Previous / Today / To Date / Remaining, as on a studio DPR.

import type { DelayEntry, OnSet, Schedule, SceneStrip, ShootDay, SuperVisor } from '../../types/screenplay';
import { layOutSchedule } from './calendar';

export type SceneShotStatus = 'complete' | 'partial' | 'not-shot';

export interface ProductionReportTimes {
  crewCall?: string;
  firstShot?: string;
  lunchStart?: string;
  lunchEnd?: string;
  firstShotAfterLunch?: string;
  cameraWrap?: string;
  lastOut?: string;
}

/** What the AD enters for a day (everything else is derived) */
export interface ProductionReportEntry {
  dayId: string;
  times: ProductionReportTimes;
  sceneStatus: Record<string, SceneShotStatus>; // by strip id, overrides the derived status
  addedScenes?: string;   // scenes shot that weren't scheduled, e.g. "14, 15pt"
  cameraRolls?: string;
  soundRolls?: string;
  notes?: string;
  incidents?: string;
  preparedBy?: string;
}

export interface ReportSceneRow {
  stripId: string;
  sceneNumber: string;
  set: string;
  dayNight: string;
  eighths: number;
  status: SceneShotStatus;
  derived: boolean; // status came from OnSet/SuperVisor rather than the AD
  takes: number;
}

export interface Progress {
  previous: number;
  today: number;
  toDate: number;
  remaining: number;
  total: number;
}

export interface ProductionReport {
  day: ShootDay;
  dayCount: number;
  date: string; // YYYY-MM-DD, '' when unknown
  times: ProductionReportTimes;
  scenes: ReportSceneRow[];
  scheduledEighths: number;
  shotEighths: number;
  scenesProgress: Progress;
  pagesProgress: Progress; // in eighths
  setupsProgress: Progress;
  supervisor: { setups: number; takes: number; prints: number; ng: number; byCamera: { camera: string; takes: number; prints: number }[] } | null;
  delays: DelayEntry[];
  delayMinutes: number;
  aheadBehindEighths: number; // + ahead of schedule, - behind (to date)
  entry: ProductionReportEntry;
}

export const emptyEntry = (dayId: string): ProductionReportEntry => ({ dayId, times: {}, sceneStatus: {} });

const eighthsOf = (s: SceneStrip) => Math.round(s.pageCount * 8);
const clock = (d: Date | undefined) =>
  d ? new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : undefined;
const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dayDates(schedule: Schedule): Map<string, string> {
  const days = [...schedule.shootDays].sort((a, b) => a.dayNumber - b.dayNumber);
  const shoot = schedule.calendar ? layOutSchedule(schedule.calendar, days.length).filter((c) => c.kind === 'shoot') : [];
  return new Map(days.map((d, i) => [d.id, shoot[i]?.date || (d.date ? ymdLocal(new Date(d.date)) : '')]));
}

interface Sources {
  superVisor?: SuperVisor | null;
  onSet?: OnSet | null;
}

/** A day's scene status: the AD's word, else OnSet's completed strips, else takes logged that day */
function sceneRows(schedule: Schedule, day: ShootDay, entry: ProductionReportEntry | undefined, src: Sources): ReportSceneRow[] {
  const strips = new Map(schedule.strips.map((s) => [s.id, s]));
  const session = src.superVisor?.sessions.find((s) => s.shootDayId === day.id);
  const onSetDay = src.onSet?.productionStatus?.currentDayId === day.id ? src.onSet.productionStatus : null;
  return day.strips.map((id) => strips.get(id)).filter(Boolean).map((s) => {
    const strip = s as SceneStrip;
    const takes = session?.takes.filter((t) => t.sceneNumber === strip.sceneNumber).length ?? 0;
    const override = entry?.sceneStatus[strip.id];
    const derived: SceneShotStatus = onSetDay?.completedStrips.includes(strip.id) ? 'complete' : takes > 0 ? 'partial' : 'not-shot';
    return {
      stripId: strip.id, sceneNumber: strip.sceneNumber, set: `${strip.intExt}. ${strip.location}`, dayNight: strip.timeOfDay,
      eighths: eighthsOf(strip), status: override ?? derived, derived: !override, takes,
    };
  });
}

const sumShot = (rows: ReportSceneRow[]) => rows.filter((r) => r.status === 'complete').reduce((n, r) => n + r.eighths, 0);

export function buildProductionReport(schedule: Schedule, dayId: string, src: Sources = {}): ProductionReport | null {
  const days = [...schedule.shootDays].sort((a, b) => a.dayNumber - b.dayNumber);
  const index = days.findIndex((d) => d.id === dayId);
  if (index < 0) return null;
  const day = days[index];
  const entries = new Map((schedule.productionReports ?? []).map((e) => [e.dayId, e]));
  const entry = entries.get(day.id) ?? emptyEntry(day.id);
  const dates = dayDates(schedule);
  const date = dates.get(day.id) ?? '';

  const rowsFor = (d: ShootDay) => sceneRows(schedule, d, entries.get(d.id), src);
  const scenes = rowsFor(day);
  const earlier = days.slice(0, index).map(rowsFor);

  const totalScenes = schedule.strips.length;
  const totalEighths = schedule.strips.reduce((n, s) => n + eighthsOf(s), 0);
  const completeCount = (rows: ReportSceneRow[]) => rows.filter((r) => r.status === 'complete').length;
  const progress = (previous: number, today: number, total: number): Progress =>
    ({ previous, today, toDate: previous + today, remaining: Math.max(0, total - previous - today), total });

  const sessions = src.superVisor?.sessions ?? [];
  const setupsOf = (d: ShootDay) => sessions.find((s) => s.shootDayId === d.id)?.totalSetups ?? 0;
  const totalSetups = sessions.reduce((n, s) => n + s.totalSetups, 0);

  const session = sessions.find((s) => s.shootDayId === day.id);
  const byCamera = new Map<string, { takes: number; prints: number }>();
  for (const t of session?.takes ?? []) {
    const c = byCamera.get(t.camera) ?? { takes: 0, prints: 0 };
    byCamera.set(t.camera, { takes: c.takes + 1, prints: c.prints + (t.circled ? 1 : 0) });
  }

  // Delays logged on this day's date (OnSet keeps one running list)
  const delays = (src.onSet?.delays ?? []).filter((d) => date && ymdLocal(new Date(d.startedAt)) === date);
  const delayMinutes = delays.reduce((n, d) => n + (d.duration ?? (d.endedAt ? Math.round((new Date(d.endedAt).getTime() - new Date(d.startedAt).getTime()) / 60000) : 0)), 0);

  // Times: the AD's entries, else what OnSet recorded, else the scheduled call
  const status = src.onSet?.productionStatus?.currentDayId === day.id ? src.onSet.productionStatus : null;
  const firstStrip = status?.actualTimes.filter((t) => t.type === 'strip').sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())[0];
  const lunch = status ? src.onSet?.lunchStatus : null;
  const lunchEnd = lunch?.lunchStartedAt && lunch.actualDuration ? new Date(new Date(lunch.lunchStartedAt).getTime() + lunch.actualDuration * 60000) : undefined;
  const times: ProductionReportTimes = {
    crewCall: entry.times.crewCall ?? (day.callTime || undefined),
    firstShot: entry.times.firstShot ?? clock(firstStrip?.startedAt),
    lunchStart: entry.times.lunchStart ?? clock(lunch?.lunchStartedAt),
    lunchEnd: entry.times.lunchEnd ?? clock(lunchEnd),
    firstShotAfterLunch: entry.times.firstShotAfterLunch,
    cameraWrap: entry.times.cameraWrap,
    lastOut: entry.times.lastOut,
  };

  const scheduledToDate = [...days.slice(0, index + 1)].reduce((n, d) => n + rowsFor(d).reduce((m, r) => m + r.eighths, 0), 0);
  const shotToDate = earlier.reduce((n, rows) => n + sumShot(rows), 0) + sumShot(scenes);

  return {
    day,
    dayCount: days.length,
    date,
    times,
    scenes,
    scheduledEighths: scenes.reduce((n, r) => n + r.eighths, 0),
    shotEighths: sumShot(scenes),
    scenesProgress: progress(earlier.reduce((n, rows) => n + completeCount(rows), 0), completeCount(scenes), totalScenes),
    pagesProgress: progress(earlier.reduce((n, rows) => n + sumShot(rows), 0), sumShot(scenes), totalEighths),
    setupsProgress: progress(days.slice(0, index).reduce((n, d) => n + setupsOf(d), 0), setupsOf(day), totalSetups),
    supervisor: session
      ? {
          setups: session.totalSetups, takes: session.takes.length,
          prints: session.takes.filter((t) => t.circled).length, ng: session.takes.filter((t) => t.rating === 'NG').length,
          byCamera: [...byCamera.entries()].map(([camera, c]) => ({ camera, ...c })).sort((a, b) => a.camera.localeCompare(b.camera)),
        }
      : null,
    delays,
    delayMinutes,
    aheadBehindEighths: shotToDate - scheduledToDate,
    entry,
  };
}

/** Plain-text report for email (mailto:) or pasting */
export function productionReportText(r: ProductionReport, title: string, fmt: (eighths: number) => string): string {
  const t = r.times;
  const p = (label: string, pr: Progress, f = (n: number) => String(n)) =>
    `${label.padEnd(8)} Prev ${f(pr.previous)} · Today ${f(pr.today)} · To date ${f(pr.toDate)} · Remaining ${f(pr.remaining)}`;
  const lines = [
    `${title} — Daily Production Report`,
    `Day ${r.day.dayNumber} of ${r.dayCount}${r.date ? ` · ${r.date}` : ''}`,
    '',
    `Crew call ${t.crewCall ?? '—'} · First shot ${t.firstShot ?? '—'} · Lunch ${t.lunchStart ?? '—'}–${t.lunchEnd ?? '—'} · First shot after lunch ${t.firstShotAfterLunch ?? '—'} · Wrap ${t.cameraWrap ?? '—'} · Last out ${t.lastOut ?? '—'}`,
    '',
    'Scenes:',
    ...r.scenes.map((s) => `  Sc ${s.sceneNumber}  ${s.set} ${s.dayNight}  ${fmt(s.eighths)} pgs  ${s.status === 'complete' ? 'COMPLETE' : s.status === 'partial' ? 'PARTIAL' : 'NOT SHOT'}`),
    ...(r.entry.addedScenes ? [`  Added: ${r.entry.addedScenes}`] : []),
    `  Pages scheduled ${fmt(r.scheduledEighths)} · shot ${fmt(r.shotEighths)} · ${r.aheadBehindEighths >= 0 ? 'ahead' : 'behind'} ${fmt(Math.abs(r.aheadBehindEighths))} to date`,
    '',
    p('Scenes', r.scenesProgress),
    p('Pages', r.pagesProgress, fmt),
    ...(r.supervisor ? [p('Setups', r.setupsProgress), `Takes ${r.supervisor.takes} · Prints ${r.supervisor.prints} · NG ${r.supervisor.ng}`] : []),
    ...(r.delays.length ? ['', `Delays (${r.delayMinutes} min):`, ...r.delays.map((d) => `  ${d.category}: ${d.reason}${d.duration ? ` (${d.duration} min)` : ''}`)] : []),
    ...(r.entry.cameraRolls || r.entry.soundRolls ? ['', `Camera rolls ${r.entry.cameraRolls ?? '—'} · Sound rolls ${r.entry.soundRolls ?? '—'}`] : []),
    ...(r.entry.notes ? ['', 'Notes:', r.entry.notes] : []),
    ...(r.entry.incidents ? ['', 'Incidents / accidents:', r.entry.incidents] : []),
    ...(r.entry.preparedBy ? ['', `Prepared by ${r.entry.preparedBy}`] : []),
  ];
  return lines.join('\n');
}
