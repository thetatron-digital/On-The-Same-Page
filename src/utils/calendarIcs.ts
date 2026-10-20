// Shoot days as an iCalendar (.ics) file for Google, Apple and Outlook
// calendars (RFC 5545). Days use the production calendar's dates (or each
// day's own date); call to wrap when both times are set, else all day.
import type { Schedule, SceneStrip, ShootDay } from '../types/screenplay';
import { layOutSchedule } from '../engine/schedule/calendar';
import { formatEighths } from './breakdown';
import { toYMD } from './doodReport';

/** "6:30 AM" / "18:30" -> [hours, minutes] */
export function parseClock(text: string | undefined): [number, number] | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*$/i.exec(text ?? '');
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ampm = m[3]?.toLowerCase().replace(/\./g, '');
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h < 24 && min < 60 ? [h, min] : null;
}

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines longer than 75 octets fold onto continuation lines starting with a space
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const ymd = (date: string) => date.replace(/-/g, '');
const pad = (n: number) => String(n).padStart(2, '0');
const nextDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

function stampNow(now: Date) {
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

export interface IcsOptions {
  title: string;
  now?: Date;
  uidDomain?: string;
}

export function scheduleToIcs(schedule: Schedule, opts: IcsOptions): string {
  const now = opts.now ?? new Date();
  const domain = opts.uidDomain ?? 'otsp.app';
  const days = [...schedule.shootDays].sort((a, b) => a.dayNumber - b.dayNumber);
  const strips = new Map(schedule.strips.map((s) => [s.id, s]));
  const columns = schedule.calendar ? layOutSchedule(schedule.calendar, days.length) : [];
  const dateOf = (day: ShootDay, index: number) =>
    columns.filter((c) => c.kind === 'shoot')[index]?.date || toYMD(day.date);

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OTSP//BaseCamp Schedule//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(opts.title)}`,
  ];
  const event = (uid: string, props: string[]) => lines.push('BEGIN:VEVENT', `UID:${uid}@${domain}`, `DTSTAMP:${stampNow(now)}`, ...props, 'END:VEVENT');

  days.forEach((day, i) => {
    const date = dateOf(day, i);
    if (!date) return;
    const dayStrips = day.strips.map((id) => strips.get(id)).filter(Boolean) as SceneStrip[];
    const scenes = dayStrips.map((s) => s.sceneNumber);
    const eighths = dayStrips.reduce((sum, s) => sum + Math.round(s.pageCount * 8), 0);
    const locations = [...new Set(dayStrips.map((s) => s.location).filter(Boolean))];
    const summary = `${opts.title}: Day ${day.dayNumber} of ${days.length}${scenes.length ? ` · Sc ${scenes.join(', ')}` : ''}`;
    const description = [
      `Shoot Day ${day.dayNumber} of ${days.length} · ${formatEighths(eighths)} pages`,
      day.callTime ? `Call ${day.callTime}${day.estimatedWrap ? ` · Wrap ${day.estimatedWrap}` : ''}` : '',
      '',
      ...dayStrips.map((s) => `Sc ${s.sceneNumber}  ${s.intExt}. ${s.location} - ${s.timeOfDay}  (${formatEighths(Math.round(s.pageCount * 8))} pgs)${s.description ? ` ${s.description}` : ''}`),
    ].filter((l, k) => l || k === 2).join('\n');
    const call = parseClock(day.callTime);
    const wrap = parseClock(day.estimatedWrap);
    const tz = day.timezone ? `;TZID=${day.timezone}` : '';
    let when: string[];
    if (call && wrap) {
      const end = wrap[0] * 60 + wrap[1] <= call[0] * 60 + call[1] ? nextDay(date) : date; // wraps after midnight
      when = [`DTSTART${tz}:${ymd(date)}T${pad(call[0])}${pad(call[1])}00`, `DTEND${tz}:${ymd(end)}T${pad(wrap[0])}${pad(wrap[1])}00`];
    } else {
      when = [`DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(date))}`];
    }
    event(`shootday-${day.id}`, [
      ...when,
      `SUMMARY:${escape(summary)}`,
      ...(day.location || locations.length ? [`LOCATION:${escape(day.locationAddress || day.location || locations.join(', '))}`] : []),
      `DESCRIPTION:${escape(description)}`,
      'TRANSP:OPAQUE',
    ]);
  });

  // Holidays and company travel inside the shoot
  for (const col of columns) {
    if (col.kind === 'shoot') continue;
    const label = col.kind === 'holiday' ? 'Holiday' : 'Company Travel';
    event(`${col.kind}-${col.date}`, [
      `DTSTART;VALUE=DATE:${ymd(col.date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(col.date))}`,
      `SUMMARY:${escape(`${opts.title}: ${col.label || label}`)}`, 'TRANSP:TRANSPARENT',
    ]);
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
