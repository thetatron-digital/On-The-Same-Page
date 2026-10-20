// Production calendar: Movie Magic's Edit Calendar window (production
// start date, weekly days off, special days) with a month preview.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import {
  addDays,
  createCalendar,
  layOutSchedule,
  type ProductionCalendar as Calendar,
  type SpecialDayKind,
  type Weekday,
} from '../../engine/schedule/calendar';
import { toYMD } from '../../utils/doodReport';
import { scheduleToIcs } from '../../utils/calendarIcs';
import './basecampTools.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KIND_LABEL: Record<SpecialDayKind, string> = {
  off: 'Day Off',
  holiday: 'Holiday',
  companyTravel: 'Company Travel',
  workday: 'Work Day (exception)',
};

const monthStart = (ymd: string) => `${ymd.slice(0, 7)}-01`;

export function ProductionCalendar() {
  const { schedule, setScheduleCalendar, projectTitle } = useScreenplayStore(
    useShallow((s) => ({ schedule: s.schedule, setScheduleCalendar: s.setScheduleCalendar, projectTitle: s.screenplay.title }))
  );
  const today = toYMD(new Date());
  const [draft, setDraft] = useState<Calendar>(
    () => schedule?.calendar ?? createCalendar(toYMD(schedule?.shootDays[0]?.date) || today)
  );
  const [month, setMonth] = useState(monthStart(draft.startDate));
  const [newDay, setNewDay] = useState<{ date: string; kind: SpecialDayKind }>({ date: draft.startDate, kind: 'holiday' });

  const shootDayCount = Math.max(schedule?.shootDays.length ?? 0, 1);
  const layout = useMemo(() => layOutSchedule(draft, shootDayCount), [draft, shootDayCount]);
  const byDate = useMemo(() => new Map(layout.map((c) => [c.date, c])), [layout]);
  const special = useMemo(() => new Map(draft.specialDays.map((d) => [d.date, d])), [draft.specialDays]);
  const lastDate = layout[layout.length - 1]?.date;

  const toggleDayOff = (day: Weekday) =>
    setDraft({
      ...draft,
      daysOff: draft.daysOff.includes(day) ? draft.daysOff.filter((d) => d !== day) : [...draft.daysOff, day].sort() as Weekday[],
    });

  const addSpecialDay = () => {
    if (!newDay.date) return;
    setDraft({
      ...draft,
      specialDays: [...draft.specialDays.filter((d) => d.date !== newDay.date), { ...newDay }].sort((a, b) => a.date.localeCompare(b.date)),
    });
  };

  // Six-week grid for the month being viewed
  const grid = useMemo(() => {
    const first = new Date(`${month}T12:00:00`);
    const start = addDays(month, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const isApplied = JSON.stringify(schedule?.calendar ?? null) === JSON.stringify(draft);

  return (
    <div className="bc-content-area bct-calendar">
      <div className="bc-page-header bct-header">
        <h2>Calendar</h2>
        <div className="bct-actions">
          <button
            className="bc-btn bc-btn-outline"
            disabled={!schedule?.shootDays.length}
            title="Shoot days as calendar events for Google, Apple or Outlook Calendar"
            onClick={() => {
              const title = projectTitle || schedule!.projectName || 'Production';
              const blob = new Blob([scheduleToIcs(schedule!, { title })], { type: 'text/calendar;charset=utf-8' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `${title} shoot days.ics`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}
          >
            Export to Calendar
          </button>
          {schedule?.calendar && (
            <button className="bc-btn bc-btn-outline" onClick={() => setScheduleCalendar(null)}>Remove Calendar</button>
          )}
          <button className="bc-btn bc-btn-primary" disabled={isApplied} onClick={() => setScheduleCalendar(draft)}>
            {schedule?.calendar ? 'Apply Changes' : 'Use This Calendar'}
          </button>
        </div>
      </div>

      <div className="bct-calendar-layout">
        <div className="bct-calendar-form">
          <div className="bc-form-group">
            <label>CALENDAR NAME</label>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="bc-form-group">
            <label>START OF PRODUCTION</label>
            <input type="date" value={draft.startDate} onChange={(e) => e.target.value && setDraft({ ...draft, startDate: e.target.value })} />
          </div>
          <div className="bc-form-group">
            <label>END OF PRODUCTION (from the stripboard)</label>
            <input value={lastDate ?? ''} readOnly />
          </div>

          <h4 className="bc-form-section-title">Days Off</h4>
          <div className="bct-weekdays">
            {WEEKDAYS.map((name, i) => (
              <label key={name} className="bct-check">
                <input type="checkbox" checked={draft.daysOff.includes(i as Weekday)} onChange={() => toggleDayOff(i as Weekday)} /> {name}
              </label>
            ))}
          </div>

          <h4 className="bc-form-section-title">Special Days</h4>
          <div className="bct-special-add">
            <input type="date" value={newDay.date} onChange={(e) => setNewDay({ ...newDay, date: e.target.value })} />
            <select value={newDay.kind} onChange={(e) => setNewDay({ ...newDay, kind: e.target.value as SpecialDayKind })}>
              {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <button className="bc-btn bc-btn-outline small" onClick={addSpecialDay}>Add</button>
          </div>
          <ul className="bct-special-list">
            {draft.specialDays.map((d) => (
              <li key={d.date}>
                <span>{d.date}</span><span>{KIND_LABEL[d.kind]}</span>
                <button className="bc-modal-close" title="Remove" onClick={() => setDraft({ ...draft, specialDays: draft.specialDays.filter((x) => x.date !== d.date) })}>×</button>
              </li>
            ))}
            {draft.specialDays.length === 0 && <li className="bct-muted">None</li>}
          </ul>
          {!isApplied && <p className="bc-form-hint">Changes take effect on the stripboard and DOOD when you apply them.</p>}
        </div>

        <div className="bct-month">
          <div className="bct-month-nav">
            <button className="bc-btn bc-btn-outline small" onClick={() => setMonth(monthStart(addDays(month, -1)))}>‹</button>
            <strong>{new Date(`${month}T12:00:00`).toLocaleString('en-US', { month: 'long', year: 'numeric' })}</strong>
            <button className="bc-btn bc-btn-outline small" onClick={() => setMonth(monthStart(addDays(month, 32)))}>›</button>
          </div>
          <div className="bct-month-grid">
            {WEEKDAYS.map((d) => <div key={d} className="bct-month-head">{d}</div>)}
            {grid.map((date) => {
              const col = byDate.get(date);
              const sp = special.get(date);
              const off = !col && (sp?.kind === 'off' || (sp?.kind !== 'workday' && draft.daysOff.includes(new Date(`${date}T12:00:00`).getDay() as Weekday)));
              const cls = [
                'bct-month-cell',
                date.slice(0, 7) !== month.slice(0, 7) ? 'bct-other-month' : '',
                col?.kind === 'shoot' ? 'bct-shoot' : '',
                col?.kind === 'holiday' || sp?.kind === 'holiday' ? 'bct-holiday' : '',
                col?.kind === 'companyTravel' || sp?.kind === 'companyTravel' ? 'bct-travel' : '',
                off ? 'bct-off' : '',
              ].join(' ');
              return (
                <div key={date} className={cls}>
                  <span className="bct-date-num">{Number(date.slice(8))}</span>
                  {col?.kind === 'shoot' && <span className="bct-day-label">Day {col.shootDayIndex! + 1}</span>}
                  {sp && sp.kind !== 'workday' && col?.kind !== 'shoot' && <span className="bct-day-label">{KIND_LABEL[sp.kind]}</span>}
                </div>
              );
            })}
          </div>
          <p className="bc-form-hint">Shoot days come from the Strip Board ({schedule?.shootDays.length ?? 0} scheduled).</p>
        </div>
      </div>
    </div>
  );
}
