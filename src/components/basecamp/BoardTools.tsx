// Strip Board toolbar tools from Movie Magic: board picker and Stripboard
// Manager, Auto Day Breaks, Sort, day breaks, banners, Move All to Boneyard.
import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import type { StripSortField, StripSortLevel } from '../../store/types';
import type { ShootDay } from '../../types/screenplay';
import './basecampTools.css';

// Dialog state lives outside the component: BaseCamp's views are
// re-created on every store change, which would close an open dialog.
interface BoardToolsUi {
  dialog: 'breaks' | 'sort' | 'banner' | 'boards' | null;
  newBoard: { name: string; description: string; mode: 'copy' | 'empty' };
  renaming: { id: string; name: string; description: string } | null;
  bannerText: string;
  bannerColor: string;
  maxPages: number;
  levels: StripSortLevel[];
  error: string | null;
  setDialog: (v: 'breaks' | 'sort' | 'banner' | 'boards' | null) => void;
  setNewBoard: (v: { name: string; description: string; mode: 'copy' | 'empty' }) => void;
  setRenaming: (v: { id: string; name: string; description: string } | null) => void;
  setBannerText: (v: string) => void;
  setBannerColor: (v: string) => void;
  setMaxPages: (v: number) => void;
  setLevels: (v: StripSortLevel[]) => void;
  setError: (v: string | null) => void;
}

const useBoardToolsUi = create<BoardToolsUi>((set) => ({
  dialog: null,
  newBoard: { name: '', description: '', mode: 'copy' },
  renaming: null,
  bannerText: 'COMPANY MOVE',
  bannerColor: '#F5D76E',
  maxPages: 5,
  levels: [{ field: 'location', direction: 'asc' }],
  error: null,
  setDialog: (v) => set({ dialog: v }),
  setNewBoard: (v) => set({ newBoard: v }),
  setRenaming: (v) => set({ renaming: v }),
  setBannerText: (v) => set({ bannerText: v }),
  setBannerColor: (v) => set({ bannerColor: v }),
  setMaxPages: (v) => set({ maxPages: v }),
  setLevels: (v) => set({ levels: v }),
  setError: (v) => set({ error: v }),
}));

// Stable empty value so the store selector doesn't change on every read
const NO_DAYS: ShootDay[] = [];

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
    activeBoardName, activeBoardDescription, otherBoards, activeBoardId, createStripboard, stripLayout, setStripLayout, switchStripboard, renameStripboard, deleteStripboard, moveAllStripsToBoneyard,
  } = useScreenplayStore(
    useShallow((s) => ({
      activeBoardName: s.schedule?.activeBoardName,
      activeBoardDescription: s.schedule?.activeBoardDescription,
      otherBoards: s.schedule?.otherBoards,
      activeBoardId: s.schedule?.activeBoardId ?? 'board-main',
      createStripboard: s.createStripboard,
      switchStripboard: s.switchStripboard,
      renameStripboard: s.renameStripboard,
      deleteStripboard: s.deleteStripboard,
      moveAllStripsToBoneyard: s.moveAllStripsToBoneyard,
      stripLayout: s.schedule?.stripLayout ?? 'standard',
      setStripLayout: s.setStripLayout,
      autoAssignDayBreaks: s.autoAssignDayBreaks,
      sortScheduledStrips: s.sortScheduledStrips,
      insertDayBreakAfter: s.insertDayBreakAfter,
      deleteAllDayBreaks: s.deleteAllDayBreaks,
      addBanner: s.addBanner,
      hasScheduled: !!s.schedule?.shootDays.some((d) => d.strips.length > 0),
      selectedStripId: s.selectedStripId,
      selectedShootDayId: s.selectedShootDayId,
      shootDays: s.schedule?.shootDays ?? NO_DAYS,
    }))
  );
  const { dialog, newBoard, renaming, bannerText, bannerColor, maxPages, levels, error, setDialog, setNewBoard, setRenaming, setBannerText, setBannerColor, setMaxPages, setLevels, setError } = useBoardToolsUi();
  const boards = useMemo(
    () => [
      { id: activeBoardId, name: activeBoardName ?? 'Main Board', description: activeBoardDescription },
      ...(otherBoards ?? []).map((b) => ({ id: b.id, name: b.name, description: b.description })),
    ],
    [activeBoardId, activeBoardName, activeBoardDescription, otherBoards]
  );
  const stripDay = shootDays.find((d) => selectedStripId && d.strips.includes(selectedStripId));
  // Banner goes before the selected strip, else at the end of the selected (or first) day
  const bannerDay = stripDay ?? shootDays.find((d) => d.id === selectedShootDayId) ?? shootDays[0];

  const close = () => { setDialog(null); setError(null); };
  const run = (result: string | null) => (result ? setError(result) : close());

  return (
    <>
      <div className="bct-board-tools">
        <label className="bct-inline-label bct-board-picker">
          Board
          <select value={activeBoardId} onChange={(e) => switchStripboard(e.target.value)}>
            {[...boards].sort((a, b) => a.name.localeCompare(b.name)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <button className="bc-btn bc-btn-outline small" onClick={() => setDialog('boards')}>Stripboard Manager…</button>
        <label className="bct-inline-label">
          Layout
          <select value={stripLayout} onChange={(e) => setStripLayout(e.target.value as 'standard' | 'detailed' | 'thin')}>
            <option value="standard">Standard (cast IDs)</option>
            <option value="detailed">Detailed (sheet #, synopsis)</option>
            <option value="thin">Thin</option>
          </select>
        </label>
        <button className="bc-btn bc-btn-outline small" disabled={!hasScheduled} onClick={() => setDialog('breaks')} title="Insert day breaks across the whole board">Auto Day Breaks…</button>
        <button className="bc-btn bc-btn-outline small" disabled={!hasScheduled} onClick={() => setDialog('sort')} title="Reorder scheduled strips">Sort…</button>
        <button className="bc-btn bc-btn-outline small" disabled={!stripDay} title={stripDay ? 'Start a new day after the selected strip' : 'Select a scheduled strip first'}
          onClick={() => { const err = insertDayBreakAfter(selectedStripId!); if (err) alert(err); }}>Insert Day Break</button>
        <button className="bc-btn bc-btn-outline small" disabled={!hasScheduled || shootDays.length < 2} title="Put every scheduled strip on one day"
          onClick={() => { if (confirm('Delete all day breaks? Every scheduled strip will be on Day 1.')) { const err = deleteAllDayBreaks(); if (err) alert(err); } }}>Delete All Day Breaks</button>
        <button className="bc-btn bc-btn-outline small" disabled={!bannerDay} onClick={() => setDialog('banner')} title="Add a banner (e.g. COMPANY MOVE) to the board">Insert Banner…</button>
        <button className="bc-btn bc-btn-outline small" disabled={!hasScheduled} title="Send every scheduled strip on this board to the Boneyard"
          onClick={() => { if (confirm('Move all strips on this board to the Boneyard?')) moveAllStripsToBoneyard(); }}>Move All to Boneyard</button>
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

      {dialog === 'boards' && (
        <div className="bc-modal-overlay" onClick={close}>
          <div className="bc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bc-modal-header"><h3>Stripboard Manager</h3><button className="bc-modal-close" onClick={close}>×</button></div>
            <div className="bc-modal-body">
              <table className="bct-sort-table">
                <thead><tr><th>Board</th><th>Description</th><th /></tr></thead>
                <tbody>
                  {boards.map((b) => (
                    <tr key={b.id}>
                      {renaming?.id === b.id ? (
                        <>
                          <td><input value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} /></td>
                          <td><input value={renaming.description} onChange={(e) => setRenaming({ ...renaming, description: e.target.value })} /></td>
                          <td className="bct-row-actions">
                            <button className="bc-btn bc-btn-primary small" onClick={() => { renameStripboard(b.id, renaming.name, renaming.description || undefined); setRenaming(null); }}>Save</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td><strong>{b.name}</strong>{b.id === activeBoardId && <span className="bct-active-tag">active</span>}</td>
                          <td>{b.description ?? ''}</td>
                          <td className="bct-row-actions">
                            {b.id !== activeBoardId && <button className="bc-btn bc-btn-outline small" onClick={() => switchStripboard(b.id)}>Make Active</button>}
                            <button className="bc-btn bc-btn-outline small" onClick={() => setRenaming({ id: b.id, name: b.name, description: b.description ?? '' })}>Rename</button>
                            {b.id !== activeBoardId && (
                              <button className="bc-btn bc-btn-outline small" onClick={() => { if (confirm(`Delete board "${b.name}"?`)) { const err = deleteStripboard(b.id); if (err) alert(err); } }}>Delete</button>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <h4 className="bc-form-section-title">New Board</h4>
              <div className="bc-form-group"><label>Name</label><input value={newBoard.name} placeholder="e.g. Weather Cover" onChange={(e) => setNewBoard({ ...newBoard, name: e.target.value })} /></div>
              <div className="bc-form-group"><label>Description</label><input value={newBoard.description} onChange={(e) => setNewBoard({ ...newBoard, description: e.target.value })} /></div>
              <label className="bct-check"><input type="radio" checked={newBoard.mode === 'copy'} onChange={() => setNewBoard({ ...newBoard, mode: 'copy' })} /> Copy the active board's days</label>
              <label className="bct-check"><input type="radio" checked={newBoard.mode === 'empty'} onChange={() => setNewBoard({ ...newBoard, mode: 'empty' })} /> Start with every strip in the Boneyard</label>
            </div>
            <div className="bc-modal-footer">
              <button className="bc-btn bc-btn-secondary" onClick={close}>Close</button>
              <button className="bc-btn bc-btn-primary" disabled={!newBoard.name.trim()} onClick={() => {
                createStripboard(newBoard.name, newBoard.mode, newBoard.description || undefined);
                setNewBoard({ name: '', description: '', mode: 'copy' });
              }}>Create Board</button>
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
