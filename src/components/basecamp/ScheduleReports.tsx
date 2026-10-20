// BaseCamp Reports: Movie Magic's One Line Schedule and Shooting Schedule,
// previewed on screen and exported as PDF or CSV.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import { STRIP_COLOR_HEX, stripColorFor, stripTextColor } from '../../types/screenplay';
import { buildScheduleReport, dayBreakLine, formatReportDate, oneLineToCsv } from '../../utils/scheduleReports';
import { REPORT_TITLES, scheduleReportPdf, type ReportKind } from '../../utils/scheduleReportPdf';
import './basecampTools.css';

export function ScheduleReports() {
  const { schedule, breakdown, people, projectName, setBasecampView } = useScreenplayStore(
    useShallow((s) => ({
      schedule: s.schedule,
      breakdown: s.breakdown,
      people: s.productionData.people,
      projectName: s.productionData.settings.projectName || s.screenplay.title,
      setBasecampView: s.setBasecampView,
    }))
  );
  const [kind, setKind] = useState<ReportKind>('oneLine');
  const [includeBanners, setIncludeBanners] = useState(true);

  const report = useMemo(
    () => (schedule ? buildScheduleReport(schedule, { breakdown, people, includeBanners, title: projectName }) : null),
    [schedule, breakdown, people, includeBanners, projectName]
  );
  const hasStrips = !!report?.days.some((d) => d.items.some((i) => i.kind === 'strip'));
  const fileBase = `${REPORT_TITLES[kind].replace(/ /g, '_')}_${(projectName || 'Schedule').replace(/\W+/g, '_')}`;

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
            <select value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
              <option value="oneLine">{REPORT_TITLES.oneLine}</option>
              <option value="shooting">{REPORT_TITLES.shooting}</option>
            </select>
          </label>
          <label className="bct-check"><input type="checkbox" checked={includeBanners} onChange={(e) => setIncludeBanners(e.target.checked)} /> Include Banners</label>
          <button className="bc-btn bc-btn-outline" disabled={!hasStrips} onClick={() => report && download(new Blob([oneLineToCsv(report)], { type: 'text/csv' }), `${fileBase}.csv`)}>Export CSV</button>
          <button className="bc-btn bc-btn-primary" disabled={!hasStrips} onClick={() => report && download(scheduleReportPdf(report, kind).output('blob'), `${fileBase}.pdf`)}>Export PDF</button>
        </div>
      </div>

      {!hasStrips || !report ? (
        <div className="bct-empty">
          <p>Schedule strips onto shoot days to build reports.</p>
          <button className="bc-btn bc-btn-primary" onClick={() => setBasecampView('stripboard')}>Go to Strip Board</button>
        </div>
      ) : (
        <div className="bct-report">
          <div className="bct-report-title"><strong>{REPORT_TITLES[kind]}</strong><span>{report.title}</span></div>
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
