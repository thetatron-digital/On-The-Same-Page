// BaseCamp Reports: Movie Magic's built-in reports (One Line Schedule,
// Shooting Schedule, Cast List, Location List, element lists, Category By
// Day), previewed on screen and exported as PDF or CSV.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import { STRIP_COLOR_HEX, stripColorFor, stripTextColor } from '../../types/screenplay';
import {
  buildCategoryByDayReport, buildElementListReport, buildLocationListReport, buildScheduleReport,
  dayBreakLine, formatReportDate, oneLineToCsv, tableReportToCsv, type TableReport,
} from '../../utils/scheduleReports';
import { REPORT_TITLES, scheduleReportPdf, tableReportPdf, type ReportKind } from '../../utils/scheduleReportPdf';
import { BREAKDOWN_CATEGORY_INFO } from '../../types/screenplay';

type AnyReportKind = ReportKind | 'castList' | 'locationList' | 'elementList' | 'categoryByDay';
const LIST_TITLES: Record<Exclude<AnyReportKind, ReportKind>, string> = {
  castList: 'Cast List',
  locationList: 'Location List',
  elementList: 'Element List (by category)',
  categoryByDay: 'Category By Day',
};
import { productionInfoLine, resolveProductionInfo } from '../../utils/productionInfo';
import './basecampTools.css';

export function ScheduleReports() {
  const { schedule, breakdown, people, settings, scriptTitle, setBasecampView } = useScreenplayStore(
    useShallow((s) => ({
      schedule: s.schedule,
      breakdown: s.breakdown,
      people: s.productionData.people,
      settings: s.productionData.settings,
      scriptTitle: s.screenplay.title,
      setBasecampView: s.setBasecampView,
    }))
  );
  const info = useMemo(() => resolveProductionInfo(settings, people), [settings, people]);
  const projectName = info.pictureTitle || scriptTitle;
  const credits = productionInfoLine(info);
  const [kind, setKind] = useState<AnyReportKind>('oneLine');
  const [category, setCategory] = useState('Props');
  const categories = useMemo(() => {
    const used = new Set((breakdown?.elements ?? []).map((t) => t.category));
    return Object.keys(BREAKDOWN_CATEGORY_INFO).filter((c) => used.has(c) || c === 'Cast Members' || c === 'Background Actors');
  }, [breakdown]);
  const isTable = kind !== 'oneLine' && kind !== 'shooting';
  const table: TableReport | null = useMemo(() => {
    if (!schedule || !isTable) return null;
    const ctx = { breakdown, people };
    if (kind === 'castList') return buildElementListReport(schedule, ctx, 'Cast Members');
    if (kind === 'locationList') return buildLocationListReport(schedule, ctx);
    if (kind === 'elementList') return buildElementListReport(schedule, ctx, category);
    return buildCategoryByDayReport(schedule, ctx, category);
  }, [schedule, breakdown, people, kind, category, isTable]);
  const [includeBanners, setIncludeBanners] = useState(true);

  const report = useMemo(
    () => (schedule ? buildScheduleReport(schedule, { breakdown, people, includeBanners, title: projectName, credits }) : null),
    [schedule, breakdown, people, includeBanners, projectName, credits]
  );
  const hasStrips = !!report?.days.some((d) => d.items.some((i) => i.kind === 'strip'));
  const reportTitle = isTable ? (table?.title ?? '') : REPORT_TITLES[kind as ReportKind];
  const fileBase = `${reportTitle.replace(/\W+/g, '_')}_${(projectName || 'Schedule').replace(/\W+/g, '_')}`;
  const exportCsv = () => {
    if (isTable && table) download(new Blob([tableReportToCsv(table)], { type: 'text/csv' }), `${fileBase}.csv`);
    else if (report) download(new Blob([oneLineToCsv(report)], { type: 'text/csv' }), `${fileBase}.csv`);
  };
  const exportPdf = () => {
    if (isTable && table) download(tableReportPdf(table, projectName, credits).output('blob'), `${fileBase}.pdf`);
    else if (report) download(scheduleReportPdf(report, kind as ReportKind).output('blob'), `${fileBase}.pdf`);
  };

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bc-content-area bct-reports">
      <div className="bc-page-header bct-header">
        <h2>Reports</h2>
        <div className="bct-actions">
          <label className="bct-inline-label">
            Report
            <select value={kind} onChange={(e) => setKind(e.target.value as AnyReportKind)}>
              <option value="oneLine">{REPORT_TITLES.oneLine}</option>
              <option value="shooting">{REPORT_TITLES.shooting}</option>
              {Object.entries(LIST_TITLES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </label>
          {(kind === 'elementList' || kind === 'categoryByDay') && (
            <label className="bct-inline-label">
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          {!isTable && <label className="bct-check"><input type="checkbox" checked={includeBanners} onChange={(e) => setIncludeBanners(e.target.checked)} /> Include Banners</label>}
          <button className="bc-btn bc-btn-outline" disabled={!hasStrips} onClick={exportCsv}>Export CSV</button>
          <button className="bc-btn bc-btn-primary" disabled={!hasStrips} onClick={exportPdf}>Export PDF</button>
        </div>
      </div>

      {!hasStrips || !report ? (
        <div className="bct-empty">
          <p>Schedule strips onto shoot days to build reports.</p>
          <button className="bc-btn bc-btn-primary" onClick={() => setBasecampView('stripboard')}>Go to Strip Board</button>
        </div>
      ) : isTable && table ? (
        <div className="bct-report">
          <div className="bct-report-title"><strong>{table.title}</strong><span>{projectName}</span></div>
          {credits && <div className="bct-report-credits">{credits}</div>}
          {table.sections.map((section, i) => (
            <section key={i} className="bct-report-day">
              {section.heading && <div className="bct-report-dayhead">{section.heading}</div>}
              {section.rows.length === 0 ? (
                <p className="bct-muted">None</p>
              ) : (
                <table className="bc-table">
                  <thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>{section.rows.map((row, r) => <tr key={r} className="bc-table-row">{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}</tbody>
                </table>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="bct-report">
          <div className="bct-report-title"><strong>{REPORT_TITLES[kind as ReportKind]}</strong><span>{report.title}</span></div>
          {report.credits && <div className="bct-report-credits">{report.credits}</div>}
          {report.days.map((day) => (
            <section key={day.dayNumber} className="bct-report-day">
              {kind === 'shooting' && (
                <div className="bct-report-dayhead">Shoot Day # {day.dayNumber}{day.date ? ` -- ${formatReportDate(day.date)}` : ''}</div>
              )}
              {day.items.map((item, i) =>
                item.kind === 'banner' ? (
                  <div key={i} className="bct-banner">{item.text}</div>
                ) : (
                  <div key={item.stripId} className={`bct-report-strip ${kind}`}>
                    <span className="bct-report-swatch" style={{ background: STRIP_COLOR_HEX[stripColorFor(item.intExt, item.dayNight)], color: stripTextColor(stripColorFor(item.intExt, item.dayNight)) }}>
                      {item.sceneNumber}
                    </span>
                    <div className="bct-report-main">
                      <div className="bct-report-line">
                        <span>{item.intExt}</span><strong>{item.set}</strong><span>{item.dayNight}</span>
                        <span>{item.pages} pgs</span>
                        {kind === 'oneLine' && item.castIds && <span>Cast: {item.castIds}</span>}
                      </div>
                      {kind === 'shooting' && (
                        <>
                          {item.synopsis && <div className="bct-report-synopsis">{item.synopsis}</div>}
                          <div className="bct-report-lists">
                            {item.cast.length > 0 && <div><h5>Cast Members</h5>{item.cast.map((c) => <div key={c}>{c}</div>)}</div>}
                            {item.elements.map((e) => <div key={e.category}><h5>{e.category}</h5>{e.names.map((n) => <div key={n}>{n}</div>)}</div>)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              )}
              <div className="bct-report-daybreak">{dayBreakLine(day)}</div>
            </section>
          ))}
          <div className="bct-report-total">Total: {report.days.length} shoot days -- {report.totalPages} pages</div>
        </div>
      )}
    </div>
  );
}
