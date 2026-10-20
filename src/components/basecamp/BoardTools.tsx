// Strip Board toolbar tools from Movie Magic: Auto Day Breaks and Sort.
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import type { StripSortField, StripSortLevel } from '../../store/types';
import './basecampTools.css';

const SORT_FIELDS: [StripSortField, string][] = [
  ['sceneNumber', 'Scene Number'],
  ['intExt', 'Int/Ext'],
  ['location', 'Set / Location'],
  ['timeOfDay', 'Day/Night'],
  ['pageCount', 'Pages'],
  ['color', 'Strip Color'],
  ['firstCast', 'Cast ID (lowest)'],
  ['castCount', 'Number of Cast'],
];

export function BoardTools() {
  const {
    autoAssignDayBreaks, sortScheduledStrips, insertDayBreakAfter, deleteAllDayBreaks, addBanner,
    hasScheduled, selectedStripId, selectedShootDayId, shootDays,
  } = useScreenplayStore(
    useShallow((s) => ({
      autoAssignDayBreaks: s.autoAssignDayBreaks,
      sortScheduledStrips: s.sortScheduledStrips,
      insertDayBreakAfter: s.insertDayBreakAfter,
      deleteAllDayBreaks: s.deleteAllDayBreaks,
      addBanner: s.addBanner,
      hasScheduled: !!s.schedule?.shootDays.some((d) => d.strips.length > 0),
      selectedStripId: s.selectedStripId,
      selectedShootDayId: s.selectedShootDayId,
      shootDays: s.schedule?.shootDays ?? [],
    }))
  );
  const [dialog, setDialog] = useState<'breaks' | 'sort' | 'banner' | null>(null);
  const [bannerText, setBannerText] = useState('COMPANY MOVE');
  const [bannerColor, setBannerColor] = useState('#F5D76E');
  const stripDay = shootDays.find((d) => selectedStripId && d.strips.includes(selectedStripId));
  // Banner goes before the selected strip, else at the end of the selected (or first) day
  const bannerDay = stripDay ?? shootDays.find((d) => d.id === selectedShootDayId) ?? shootDays[0];
  const [maxPages, setMaxPages] = useState(5);
  const [levels, setLevels] = useState<StripSortLevel[]>([{ field: 'location', direction: 'asc' }]);
  const [error, setError] = useState<string | null>(null);

  const close = () => { setDialog(null); setError(null); };
  const run = (result: string | null) => (result ? setError(result) : close());

  return (
    <>
      <div className="bct-board-tools">
        <button className="bc-btn bc-btn-outline small" disabled={!hasScheduled} onClick={() => setDialog('breaks')} title="Insert day breaks across the whole board">Auto Day Breaks…</button>
        <button className="bc-btn bc-btn-outline small" disabled={!hasScheduled} onClick={() => setDialog('sort')} title="Reorder scheduled strips">Sort…</button>
        <button className="bc-btn bc-btn-outline small" disabled={!stripDay} title={stripDay ? 'Start a new day after the selected strip' : 'Select a scheduled strip first'}
          onClick={() => { const err = insertDayBreakAfter(selectedStripId!); if (err) alert(err); }}>Insert Day Break</button>
        <button className="bc-btn bc-btn-outline small" disabled={!hasScheduled || shootDays.length < 2} title="Put every scheduled strip on one day"
          onClick={() => { if (confirm('Delete all day breaks? Every scheduled strip will be on Day 1.')) { const err = deleteAllDayBreaks(); if (err) alert(err); } }}>Delete All Day Breaks</button>
        <button className="bc-btn bc-btn-outline small" disabled={!bannerDay} onClick={() => setDialog('banner')} title="Add a banner (e.g. COMPANY MOVE) to the board">Insert Banner…</button>
      </div>

      {dialog === 'breaks' && (
        <div className="bc-modal-overlay" onClick={close}>
          <div className="bc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bc-modal-header"><h3>Auto Day Breaks</h3><button className="bc-modal-close" onClick={close}>×</button></div>
            <div className="bc-modal-body">
              <div className="bc-form-group">
                <label>Maximum Pages Per Day</label>
                <input type="number" min={0.125} step={0.125} value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} />
              </div>
              <p className="bc-form-hint">Scheduled strips are spread over shoot days in board order, up to this many pages each. Existing days keep their call times; extra days are added or removed as needed.</p>
              {error && <p className="bct-error">{error}</p>}
            </div>
            <div className="bc-modal-footer">
              <button className="bc-btn bc-btn-secondary" onClick={close}>Cancel</button>
              <button className="bc-btn bc-btn-primary" onClick={() => run(autoAssignDayBreaks({ maxPagesPerDay: maxPages }))}>OK</button>
            </div>
          </div>
        </div>
      )}

      {dialog === 'banner' && bannerDay && (
        <div className="bc-modal-overlay" onClick={close}>
          <div className="bc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bc-modal-header"><h3>Insert Banner</h3><button className="bc-modal-close" onClick={close}>×</button></div>
            <div className="bc-modal-body">
              <div className="bc-form-group">
                <label>Banner Text</label>
                <input value={bannerText} onChange={(e) => setBannerText(e.target.value)} />
              </div>
              <div className="bct-banner-presets">
                {['COMPANY MOVE', 'LUNCH', 'TRAVEL DAY', 'END OF WEEK', 'SECOND UNIT'].map((t) => (
                  <button key={t} className="bc-btn bc-btn-outline small" onClick={() => setBannerText(t)}>{t}</button>
                ))}
              </div>
              <div className="bc-form-group">
                <label>Color</label>
                <input type="color" value={bannerColor} onChange={(e) => setBannerColor(e.target.value)} />
              </div>
              <p className="bc-form-hint">
                Goes into Day {bannerDay.dayNumber}{stripDay ? ', before the selected strip' : ', at the end of the day'}.
              </p>
            </div>
            <div className="bc-modal-footer">
              <button className="bc-btn bc-btn-secondary" onClick={close}>Cancel</button>
              <button className="bc-btn bc-btn-primary" disabled={!bannerText.trim()} onClick={() => {
                addBanner(bannerDay.id, bannerText.toUpperCase(), { beforeStripId: stripDay ? selectedStripId! : undefined, color: bannerColor });
                close();
              }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {dialog === 'sort' && (
        <div className="bc-modal-overlay" onClick={close}>
          <div className="bc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bc-modal-header"><h3>Sort</h3><button className="bc-modal-close" onClick={close}>×</button></div>
            <div className="bc-modal-body">
              <table className="bct-sort-table">
                <thead><tr><th>Level</th><th>Sort By</th><th>Order</th><th /></tr></thead>
                <tbody>
                  {levels.map((level, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        <select value={level.field} onChange={(e) => setLevels(levels.map((l, j) => (j === i ? { ...l, field: e.target.value as StripSortField } : l)))}>
                          {SORT_FIELDS.map(([f, label]) => <option key={f} value={f}>{label}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={level.direction} onChange={(e) => setLevels(levels.map((l, j) => (j === i ? { ...l, direction: e.target.value as 'asc' | 'desc' } : l)))}>
                          <option value="asc">Ascending</option>
                          <option value="desc">Descending</option>
                        </select>
                      </td>
                      <td><button className="bc-modal-close" title="Remove level" disabled={levels.length === 1} onClick={() => setLevels(levels.filter((_, j) => j !== i))}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="bc-btn bc-btn-outline small" onClick={() => setLevels([...levels, { field: 'sceneNumber', direction: 'asc' }])}>+ Add Level</button>
              <p className="bc-form-hint">Only scheduled strips are sorted. All day breaks are removed and the sorted strips land on Day 1; run Auto Day Breaks afterwards.</p>
              {error && <p className="bct-error">{error}</p>}
            </div>
            <div className="bc-modal-footer">
              <button className="bc-btn bc-btn-secondary" onClick={close}>Cancel</button>
              <button className="bc-btn bc-btn-primary" onClick={() => run(sortScheduledStrips(levels))}>Sort</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
