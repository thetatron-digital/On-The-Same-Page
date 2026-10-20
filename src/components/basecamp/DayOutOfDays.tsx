// Day Out of Days: Movie Magic's DOOD report for one category at a time
// (Print/View → Day Out of Days), with its preferences window.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import { buildScheduleDOOD, doodCategories, doodToCsv, CAST_CATEGORY } from '../../utils/doodReport';
import {
  DEFAULT_DOOD_SETTINGS,
  DEFAULT_MIN_DAYS_BETWEEN_DROP_PICKUP,
  resolveDOODOptions,
  type DOODCodes,
  type DOODElementOptions,
} from '../../engine/schedule/dood';
import type { CalendarColumn } from '../../engine/schedule/calendar';
import { productionInfoLine, resolveProductionInfo } from '../../utils/productionInfo';
import './basecampTools.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CODE_LABELS: [keyof DOODCodes, string][] = [
  ['start', 'Start'], ['work', 'Work'], ['finish', 'Finish'], ['hold', 'Hold'],
  ['drop', 'Drop'], ['pickup', 'Pickup'], ['holiday', 'Holiday'], ['companyTravel', 'Company Travel'],
  ['travel', 'Travel'], ['rehearsal', 'Rehearsal'], ['fitting', 'Fitting'],
];

const columnDate = (c: CalendarColumn) => (c.date ? new Date(`${c.date}T12:00:00`) : null);

export function DayOutOfDays() {
  const { schedule, breakdown, people, productionSettings, updateDOODSettings, setBasecampView } = useScreenplayStore(
    useShallow((s) => ({
      schedule: s.schedule,
      breakdown: s.breakdown,
      people: s.productionData.people,
      productionSettings: s.productionData.settings,
      updateDOODSettings: s.updateDOODSettings,
      setBasecampView: s.setBasecampView,
    }))
  );
  const [category, setCategory] = useState(CAST_CATEGORY);
  const [showPrefs, setShowPrefs] = useState(false);

  const categories = useMemo(() => doodCategories(breakdown), [breakdown]);
  const report = useMemo(
    () => (schedule ? buildScheduleDOOD(schedule, category, { breakdown, people }) : null),
    [schedule, category, breakdown, people]
  );
  const settings = schedule?.doodSettings ?? DEFAULT_DOOD_SETTINGS;
  const hasDays = !!schedule && schedule.shootDays.some((d) => d.strips.length > 0);

  const exportCsv = () => {
    if (!report) return;
    const blob = new Blob([doodToCsv(report)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Day_Out_of_Days_${category.replace(/\W+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bc-content-area bct-dood">
      <div className="bc-page-header bct-header">
        <h2>Day Out of Days</h2>
        <div className="bct-actions">
          <label className="bct-inline-label">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button className="bc-btn bc-btn-outline" onClick={() => setShowPrefs(true)}>Preferences…</button>
          <button className="bc-btn bc-btn-outline" onClick={() => window.print()} disabled={!report?.rows.length}>Print</button>
          <button className="bc-btn bc-btn-primary" onClick={exportCsv} disabled={!report?.rows.length}>Export CSV</button>
        </div>
      </div>

      {!hasDays ? (
        <div className="bct-empty">
          <p>No Day Out of Days data is available. Schedule strips onto shoot days first. Like Movie Magic, a DOOD needs day breaks.</p>
          <button className="bc-btn bc-btn-primary" onClick={() => setBasecampView('stripboard')}>Go to Strip Board</button>
        </div>
      ) : !report || report.rows.length === 0 ? (
        <div className="bct-empty"><p>No {category} elements appear on scheduled strips.</p></div>
      ) : (
        <div className="bct-table-wrap">
          {(() => {
            const info = resolveProductionInfo(productionSettings, people);
            const credits = productionInfoLine(info);
            return info.pictureTitle || credits ? (
              <div className="bct-report-credits"><strong>{info.pictureTitle}</strong>{credits ? `  ·  ${credits}` : ''}</div>
            ) : null;
          })()}
          <table className="bct-dood-table">
            <thead>
              <tr>
                <th className="bct-sticky">Month</th>
                {report.columns.map((c, i) => <th key={i}>{columnDate(c)?.toLocaleString('en-US', { month: 'short' }) ?? ''}</th>)}
                <th colSpan={7} className="bct-totals-head">Totals</th>
              </tr>
              <tr>
                <th className="bct-sticky">Day</th>
                {report.columns.map((c, i) => <th key={i}>{c.date ? Number(c.date.slice(8)) : ''}</th>)}
                <th colSpan={7} />
              </tr>
              <tr>
                <th className="bct-sticky">Day of Week</th>
                {report.columns.map((c, i) => <th key={i}>{columnDate(c) ? WEEKDAYS[columnDate(c)!.getDay()] : ''}</th>)}
                <th colSpan={7} />
              </tr>
              <tr>
                <th className="bct-sticky">Shooting Day</th>
                {report.columns.map((c, i) => (
                  <th key={i} className={c.kind !== 'shoot' ? 'bct-special' : ''}>
                    {c.kind === 'shoot' ? c.shootDayIndex! + 1 : c.kind === 'holiday' ? 'Hol' : 'Trvl'}
                  </th>
                ))}
                <th>Co. Travel</th><th>Work</th><th>Hold</th><th>Holiday</th><th>Start</th><th>Finish</th><th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.elementId}>
                  <td className="bct-sticky bct-name">{row.boardId ? `${row.boardId}. ` : ''}{row.name}</td>
                  {row.cells.map((cell, i) => <td key={i} className={`bct-cell bct-${cell.kind}`}>{cell.code}</td>)}
                  <td>{row.totals.companyTravel}</td>
                  <td>{row.totals.work}</td>
                  <td>{row.totals.hold}</td>
                  <td>{row.totals.holiday}</td>
                  <td className="bct-date">{row.totals.start ?? ''}</td>
                  <td className="bct-date">{row.totals.finish ?? ''}</td>
                  <td className="bct-total">{row.totals.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!schedule?.calendar && (
            <p className="bc-form-hint">Tip: set a production calendar in Calendar so days off, holidays and drop/pickup gaps are dated correctly.</p>
          )}
        </div>
      )}

      {showPrefs && (
        <DOODPreferences
          category={category}
          codes={settings.codes}
          options={resolveDOODOptions(settings, category, '')}
          onSave={(codes, options) => {
            updateDOODSettings({ codes, categoryOptions: { ...settings.categoryOptions, [category]: options } });
            setShowPrefs(false);
          }}
          onClose={() => setShowPrefs(false)}
        />
      )}
    </div>
  );
}

function DOODPreferences(props: {
  category: string;
  codes: DOODCodes;
  options: DOODElementOptions;
  onSave: (codes: DOODCodes, options: DOODElementOptions) => void;
  onClose: () => void;
}) {
  const [codes, setCodes] = useState(props.codes);
  const [options, setOptions] = useState(props.options);
  return (
    <div className="bc-modal-overlay" onClick={props.onClose}>
      <div className="bc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bc-modal-header"><h3>Day Out of Days Preferences</h3><button className="bc-modal-close" onClick={props.onClose}>×</button></div>
        <div className="bc-modal-body">
          <h4 className="bc-form-section-title">{props.category}: hold and drop/pickup</h4>
          <label className="bct-check"><input type="checkbox" checked={options.allowHold} onChange={(e) => setOptions({ ...options, allowHold: e.target.checked })} /> Allow Hold Days</label>
          <label className="bct-check"><input type="checkbox" checked={options.allowDropPickup} onChange={(e) => setOptions({ ...options, allowDropPickup: e.target.checked })} /> Allow Drop/Pickup Days</label>
          <div className="bc-form-group">
            <label>Minimum Days Allowed Between Drop/Pickup</label>
            <input type="number" min={1} value={options.minDaysBetweenDropPickup} disabled={!options.allowDropPickup}
              onChange={(e) => setOptions({ ...options, minDaysBetweenDropPickup: Math.max(1, Number(e.target.value) || DEFAULT_MIN_DAYS_BETWEEN_DROP_PICKUP) })} />
          </div>
          <h4 className="bc-form-section-title">Abbreviations</h4>
          <div className="bct-code-grid">
            {CODE_LABELS.map(([key, label]) => (
              <label key={key}>
                {label}
                <input value={codes[key]} maxLength={2} onChange={(e) => setCodes({ ...codes, [key]: e.target.value.toUpperCase() })} />
              </label>
            ))}
          </div>
        </div>
        <div className="bc-modal-footer">
          <button className="bc-btn bc-btn-secondary" onClick={props.onClose}>Cancel</button>
          <button className="bc-btn bc-btn-primary" onClick={() => props.onSave(codes, options)}>OK</button>
        </div>
      </div>
    </div>
  );
}
