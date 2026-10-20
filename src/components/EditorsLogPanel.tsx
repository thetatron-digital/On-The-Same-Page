// SuperVisor > Reports: the Editor's Log, with CSV, PDF and Avid ALE exports
import { useMemo, useState } from 'react';
import type { TakeEntry } from '../types/screenplay';
import { useScreenplayStore } from '../store/screenplayStore';
import { editorsLog, editorsLogCsv, generateALE } from '../utils/supervisorReports';
import { editorsLogPdf } from '../utils/editorsLogPdf';

const FPS = [23.976, 24, 25, 29.97, 30];

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function EditorsLogPanel({ sessionTakes, allTakes, dayLabel }: { sessionTakes: TakeEntry[]; allTakes: TakeEntry[]; dayLabel: string }) {
  const title = useScreenplayStore((s) => s.screenplay.title) || 'Untitled';
  const [scope, setScope] = useState<'day' | 'all'>('day');
  const [fps, setFps] = useState(23.976);
  const takes = scope === 'day' ? sessionTakes : allTakes;
  const rows = useMemo(() => editorsLog(takes), [takes]);
  const label = scope === 'day' ? dayLabel : 'All days';
  const base = `${title} Editors Log ${label}`;

  return (
    <section className="editors-log">
      <div className="reports-header">
        <h3>Editor's Log</h3>
        <select value={scope} onChange={(e) => setScope(e.target.value as 'day' | 'all')} aria-label="Which takes">
          <option value="day">{dayLabel}</option>
          <option value="all">All days</option>
        </select>
        <span className="editors-log-actions">
          <button className="generate-btn secondary" disabled={!rows.length} onClick={() => save(new Blob([editorsLogCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`)}>CSV</button>
          <button className="generate-btn secondary" disabled={!rows.length} onClick={() => save(editorsLogPdf(rows, title, label).output('blob'), `${base}.pdf`)}>PDF</button>
          <select value={fps} onChange={(e) => setFps(Number(e.target.value))} aria-label="Frame rate for ALE" title="Project frame rate for Avid">
            {FPS.map((f) => <option key={f} value={f}>{f} fps</option>)}
          </select>
          <button className="generate-btn" disabled={!rows.length} title="Avid Log Exchange for Media Composer or Resolve"
            onClick={() => save(new Blob([generateALE(takes, { fps })], { type: 'text/plain' }), `${title} ${label}.ale`)}>Export ALE</button>
        </span>
      </div>
      {rows.length ? (
        <div className="editors-log-table">
          <table>
            <thead><tr><th>Scene</th><th>Setup</th><th>Take</th><th>Cam</th><th>TC In</th><th>TC Out</th><th>Dur</th><th>Rating</th><th>Notes</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={r.rating === 'Print' ? 'print' : r.rating === 'NG' ? 'ng' : ''}>
                  <td>{r.scene}</td><td>{r.setup}</td><td>{r.take}</td><td>{r.camera}</td><td>{r.tcIn}</td><td>{r.tcOut}</td><td>{r.duration}</td><td>{r.rating}</td><td>{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="no-reports">No takes logged {scope === 'day' ? 'today' : 'yet'}.</p>}
    </section>
  );
}
