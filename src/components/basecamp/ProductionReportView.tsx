// BaseCamp > Production Report: the Daily Production Report for a shoot
// day, filled from the schedule, SuperVisor and OnSet; the AD adds times,
// corrections and notes. Export as PDF, or copy / email as text.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import {
  buildProductionReport, productionReportText, type Progress, type ProductionReportTimes, type SceneShotStatus,
} from '../../engine/schedule/productionReport';
import { formatEighths } from '../../utils/breakdown';
import { productionReportPdf } from '../../utils/productionReportPdf';
import { resolveProductionInfo } from '../../utils/productionInfo';
import './basecampTools.css';

const TIME_FIELDS: { key: keyof ProductionReportTimes; label: string }[] = [
  { key: 'crewCall', label: 'Crew Call' },
  { key: 'firstShot', label: 'First Shot' },
  { key: 'lunchStart', label: 'Lunch' },
  { key: 'lunchEnd', label: 'Lunch End' },
  { key: 'firstShotAfterLunch', label: 'First Shot After Lunch' },
  { key: 'cameraWrap', label: 'Camera Wrap' },
  { key: 'lastOut', label: 'Last Out' },
];

const STATUS_LABEL: Record<SceneShotStatus, string> = { complete: 'Complete', partial: 'Partial', 'not-shot': 'Not Shot' };

function ProgressTable({ rows }: { rows: { label: string; p: Progress; fmt?: (n: number) => string }[] }) {
  return (
    <table className="bct-sort-table bct-progress">
      <thead><tr><th></th><th>Previous</th><th>Today</th><th>To Date</th><th>Remaining</th><th>Total</th></tr></thead>
      <tbody>
        {rows.map(({ label, p, fmt = String }) => (
          <tr key={label}><th>{label}</th><td>{fmt(p.previous)}</td><td><strong>{fmt(p.today)}</strong></td><td>{fmt(p.toDate)}</td><td>{fmt(p.remaining)}</td><td>{fmt(p.total)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function ProductionReportView() {
  const { schedule, superVisor, onSet, update, settings, people, scriptTitle } = useScreenplayStore(
    useShallow((s) => ({
      schedule: s.schedule, superVisor: s.superVisor, onSet: s.onSet, update: s.updateProductionReport,
      settings: s.productionData.settings, people: s.productionData.people, scriptTitle: s.screenplay.title,
    }))
  );
  const days = useMemo(() => [...(schedule?.shootDays ?? [])].sort((a, b) => a.dayNumber - b.dayNumber), [schedule]);
  const [dayId, setDayId] = useState<string>(() => onSet?.productionStatus?.currentDayId ?? days[0]?.id ?? '');
  const activeDayId = days.some((d) => d.id === dayId) ? dayId : days[0]?.id ?? '';
  const report = useMemo(() => (schedule && activeDayId ? buildProductionReport(schedule, activeDayId, { superVisor, onSet }) : null), [schedule, activeDayId, superVisor, onSet]);
  const title = resolveProductionInfo(settings, people).pictureTitle || scriptTitle || 'Production';
  const [copied, setCopied] = useState(false);

  if (!schedule || !days.length || !report) {
    return (
      <div className="bc-content-area">
        <div className="bc-page-header bct-header"><h2>Production Report</h2></div>
        <p className="bct-empty">Schedule shoot days on the Strip Board first. Each day gets its own production report.</p>
      </div>
    );
  }

  const e = report.entry;
  const text = () => productionReportText(report, title, formatEighths);
  const ahead = report.aheadBehindEighths;

  return (
    <div className="bc-content-area bct-dpr">
      <div className="bc-page-header bct-header">
        <h2>Production Report</h2>
        <select value={activeDayId} onChange={(ev) => setDayId(ev.target.value)} aria-label="Shoot day">
          {days.map((d) => <option key={d.id} value={d.id}>Day {d.dayNumber} of {days.length}</option>)}
        </select>
        {report.date && <span className="bct-muted">{new Date(`${report.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>}
        <div className="bct-actions">
          <button className="bc-btn bc-btn-outline" onClick={async () => { await navigator.clipboard.writeText(text()); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy Text'}</button>
          <a className="bc-btn bc-btn-outline" href={`mailto:?subject=${encodeURIComponent(`${title} — Production Report, Day ${report.day.dayNumber}`)}&body=${encodeURIComponent(text())}`}>Email…</a>
          <button className="bc-btn bc-btn-primary" onClick={() => {
            const doc = productionReportPdf(report, title);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(doc.output('blob'));
            a.download = `${title} DPR Day ${report.day.dayNumber}.pdf`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          }}>Export PDF</button>
        </div>
      </div>

      <section className="bct-dpr-section">
        <h3 className="bct-section-title">Times</h3>
        <div className="bct-dpr-times">
          {TIME_FIELDS.map(({ key, label }) => (
            <label key={key}>{label}
              <input
                value={e.times[key] ?? ''}
                placeholder={report.times[key] ?? '—'}
                onChange={(ev) => update(activeDayId, { times: { [key]: ev.target.value || undefined } })}
              />
            </label>
          ))}
        </div>
        <p className="bct-muted">Grey times come from the schedule and OnSet; type to override.</p>
      </section>

      <section className="bct-dpr-section">
        <h3 className="bct-section-title">Scenes</h3>
        <table className="bct-sort-table">
          <thead><tr><th>Sc</th><th>Set</th><th>D/N</th><th>Pages</th><th>Takes</th><th>Status</th></tr></thead>
          <tbody>
            {report.scenes.map((s) => (
              <tr key={s.stripId} className={`bct-dpr-${s.status}`}>
                <td>{s.sceneNumber}</td><td>{s.set}</td><td>{s.dayNight}</td><td>{formatEighths(s.eighths)}</td><td>{s.takes || ''}</td>
                <td>
                  <select value={s.status} onChange={(ev) => update(activeDayId, { sceneStatus: { [s.stripId]: ev.target.value as SceneShotStatus } })}
                    title={s.derived ? 'From OnSet / SuperVisor' : 'Set by you'}>
                    {(Object.keys(STATUS_LABEL) as SceneShotStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}{s.derived && k === s.status ? ' (auto)' : ''}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {report.scenes.length === 0 && <tr><td colSpan={6} className="bct-muted">No scenes scheduled on this day.</td></tr>}
          </tbody>
        </table>
        <label className="bct-dpr-wide">Added scenes (shot but not scheduled)
          <input value={e.addedScenes ?? ''} placeholder="e.g. 14, 15pt" onChange={(ev) => update(activeDayId, { addedScenes: ev.target.value || undefined })} />
        </label>
        <p>
          Pages scheduled <strong>{formatEighths(report.scheduledEighths)}</strong> · shot <strong>{formatEighths(report.shotEighths)}</strong> ·{' '}
          <span className={ahead >= 0 ? 'bct-ahead' : 'bct-behind'}>{ahead >= 0 ? 'ahead' : 'behind'} {formatEighths(Math.abs(ahead))} pages to date</span>
        </p>
      </section>

      <section className="bct-dpr-section">
        <h3 className="bct-section-title">Progress</h3>
        <ProgressTable rows={[
          { label: 'Scenes', p: report.scenesProgress },
          { label: 'Pages', p: report.pagesProgress, fmt: formatEighths },
          ...(report.supervisor ? [{ label: 'Setups', p: report.setupsProgress }] : []),
        ]} />
        {report.supervisor ? (
          <p>
            Takes <strong>{report.supervisor.takes}</strong> · Prints <strong>{report.supervisor.prints}</strong> · NG <strong>{report.supervisor.ng}</strong>
            {report.supervisor.byCamera.length > 0 && <> · {report.supervisor.byCamera.map((c) => `${c.camera} cam ${c.takes}/${c.prints}`).join(', ')}</>}
          </p>
        ) : <p className="bct-muted">No SuperVisor session for this day.</p>}
      </section>

      <section className="bct-dpr-section">
        <h3 className="bct-section-title">Delays {report.delayMinutes ? `(${report.delayMinutes} min)` : ''}</h3>
        {report.delays.length ? (
          <ul>{report.delays.map((d) => <li key={d.id}>{d.category}: {d.reason}{d.duration ? ` · ${d.duration} min` : ''}{d.notes ? ` · ${d.notes}` : ''}</li>)}</ul>
        ) : <p className="bct-muted">None logged in OnSet on this day.</p>}
      </section>

      <section className="bct-dpr-section bct-dpr-grid">
        <label>Camera rolls<input value={e.cameraRolls ?? ''} placeholder="e.g. A012–A015, B007" onChange={(ev) => update(activeDayId, { cameraRolls: ev.target.value || undefined })} /></label>
        <label>Sound rolls<input value={e.soundRolls ?? ''} placeholder="e.g. 9–10" onChange={(ev) => update(activeDayId, { soundRolls: ev.target.value || undefined })} /></label>
        <label className="bct-dpr-wide">Notes<textarea rows={3} value={e.notes ?? ''} onChange={(ev) => update(activeDayId, { notes: ev.target.value || undefined })} /></label>
        <label className="bct-dpr-wide">Incidents / accidents<textarea rows={2} value={e.incidents ?? ''} onChange={(ev) => update(activeDayId, { incidents: ev.target.value || undefined })} /></label>
        <label>Prepared by<input value={e.preparedBy ?? ''} onChange={(ev) => update(activeDayId, { preparedBy: ev.target.value || undefined })} /></label>
      </section>
    </div>
  );
}
