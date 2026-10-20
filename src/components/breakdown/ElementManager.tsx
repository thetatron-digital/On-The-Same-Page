// Element Manager, laid out like Movie Magic's: categories on the left,
// the element table (Board ID, Locked, Name, Occurrences and the Day Out
// of Days columns) on the right, and an Edit Element window.
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import type { ElementRecord } from '../../types/screenplay';
import { elementUsage } from '../../utils/elements';
import { buildScheduleDOOD } from '../../utils/doodReport';
import { DEFAULT_DOOD_SETTINGS, resolveDOODOptions, type DOODElementOptions, type DOODRow } from '../../engine/schedule/dood';
import './ElementManager.css';

const ALL = '__all__';

export function ElementManager({ onClose }: { onClose: () => void }) {
  const s = useScreenplayStore(
    useShallow((st) => ({
      breakdown: st.breakdown,
      breakdownScenes: st.breakdownScenes,
      schedule: st.schedule,
      people: st.productionData.people,
      syncElements: st.syncElements,
      updateElementRecord: st.updateElementRecord,
      mergeElementRecords: st.mergeElementRecords,
      renumberElementBoardIds: st.renumberElementBoardIds,
      deleteElementRecord: st.deleteElementRecord,
      updateDOODSettings: st.updateDOODSettings,
    }))
  );
  const { breakdown, breakdownScenes, schedule, syncElements } = s;

  // Older projects have tags but no master list yet
  useEffect(() => {
    if (breakdown && breakdown.elements.some((t) => !t.elementRefId)) syncElements();
  }, [breakdown, syncElements]);

  const [category, setCategory] = useState<string>(ALL);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<ElementRecord | null>(null);

  const list = useMemo(() => breakdown?.elementList ?? [], [breakdown]);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    list.forEach((e) => counts.set(e.category, (counts.get(e.category) ?? 0) + 1));
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [list]);
  const usage = useMemo(
    () => (breakdown ? elementUsage(breakdown, breakdownScenes.length ? breakdownScenes : breakdown.scenes) : new Map()),
    [breakdown, breakdownScenes]
  );

  // Day Out of Days figures per element, if there is a schedule
  const dood = useMemo(() => {
    const map = new Map<string, DOODRow>();
    if (!schedule) return map;
    for (const [cat] of categories) {
      for (const row of buildScheduleDOOD(schedule, cat, { breakdown, people: s.people }).rows) {
        map.set(row.elementId, row);
        map.set(`${cat}\u0000${row.name}`, row); // Cast rows are keyed by cast id; match by name
      }
    }
    return map;
  }, [schedule, categories, breakdown, s.people]);
  const doodFor = (e: ElementRecord) => dood.get(e.id) ?? dood.get(`${e.category}\u0000${e.name}`);
  const countKind = (row: DOODRow | undefined, kind: string) => row?.cells.filter((c) => c.kind === kind).length ?? 0;

  const rows = list
    .filter((e) => category === ALL || e.category === category)
    .sort((a, b) => {
      if (category === ALL && a.category !== b.category) return a.category.localeCompare(b.category);
      const an = Number(a.boardId), bn = Number(b.boardId);
      if (a.boardId && b.boardId && !Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
      if (a.boardId && !b.boardId) return -1;
      if (!a.boardId && b.boardId) return 1;
      return a.name.localeCompare(b.name);
    });

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const selectedRecords = list.filter((e) => selected.includes(e.id));
  const canMerge = selectedRecords.length > 1 && new Set(selectedRecords.map((e) => e.category)).size === 1;

  if (!breakdown) {
    return (
      <div className="em-container"><div className="em-empty">Open BreakDown and tag the script first.</div></div>
    );
  }

  return (
    <div className="em-container">
      <div className="em-toolbar">
        <button className="em-btn" onClick={onClose}>← Script</button>
        <h3>Element Manager</h3>
        <div className="em-toolbar-actions">
          <button className="em-btn" disabled={selected.length !== 1} onClick={() => setEditing(selectedRecords[0])}>Edit…</button>
          <button className="em-btn" disabled={category === ALL} title={category === ALL ? 'Pick a category first' : ''}
            onClick={() => s.renumberElementBoardIds(category)}>Renumber Board IDs</button>
          <button className="em-btn" disabled={!canMerge} title="Merge selected elements of one category into the first"
            onClick={() => {
              const [target, ...rest] = selectedRecords;
              if (confirm(`Merge ${rest.length} element(s) into ${target.name}?`)) {
                s.mergeElementRecords(target.id, rest.map((e) => e.id));
                setSelected([target.id]);
              }
            }}>Merge</button>
          <button className="em-btn em-danger" disabled={selected.length === 0}
            onClick={() => {
              if (confirm(`Delete ${selected.length} element(s) and all their tags?`)) {
                selected.forEach((id) => s.deleteElementRecord(id));
                setSelected([]);
              }
            }}>Delete</button>
        </div>
      </div>

      <div className="em-body">
        <nav className="em-categories">
          <button className={category === ALL ? 'active' : ''} onClick={() => setCategory(ALL)}>
            All Elements <span>{list.length}</span>
          </button>
          {categories.map(([cat, n]) => (
            <button key={cat} className={category === cat ? 'active' : ''} onClick={() => { setCategory(cat); setSelected([]); }}>
              {cat} <span>{n}</span>
            </button>
          ))}
        </nav>

        <div className="em-table-wrap">
          {rows.length === 0 ? (
            <div className="em-empty">No elements yet. Tag the script in BreakDown and they appear here.</div>
          ) : (
            <table className="em-table">
              <thead>
                <tr>
                  <th />
                  {category === ALL && <th>Category</th>}
                  <th>Board ID</th><th>Locked</th><th className="em-left">Element Name</th><th>Occurrences</th>
                  <th>Start Date</th><th>Finish Date</th><th>Total Days</th>
                  <th>Co. Travel</th><th>Work</th><th>Hold</th><th>Holiday</th><th>Travel</th><th>Rehearsal</th><th>Fitting</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const row = doodFor(e);
                  return (
                    <tr key={e.id} className={selected.includes(e.id) ? 'selected' : ''} onClick={() => toggle(e.id)} onDoubleClick={() => setEditing(e)}>
                      <td><input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} onClick={(ev) => ev.stopPropagation()} /></td>
                      {category === ALL && <td>{e.category}</td>}
                      <td>{e.boardId ?? ''}</td>
                      <td>{e.lockBoardId ? '🔒' : ''}</td>
                      <td className="em-left em-name">{e.name}{e.excludeFromStripboard ? <span className="em-tag">excluded</span> : null}</td>
                      <td>{usage.get(e.id)?.occurrences ?? 0}</td>
                      <td>{row?.totals.start ?? ''}</td>
                      <td>{row?.totals.finish ?? ''}</td>
                      <td>{row ? row.totals.work : ''}</td>
                      <td>{row ? row.totals.companyTravel : ''}</td>
                      <td>{row ? row.totals.work : ''}</td>
                      <td>{row ? row.totals.hold : ''}</td>
                      <td>{row ? row.totals.holiday : ''}</td>
                      <td>{row ? countKind(row, 'travel') : ''}</td>
                      <td>{row ? countKind(row, 'rehearsal') : ''}</td>
                      <td>{row ? countKind(row, 'fitting') : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <EditElement
          record={editing}
          occurrences={usage.get(editing.id)?.occurrences ?? 0}
          dood={doodFor(editing)}
          options={resolveDOODOptions(schedule?.doodSettings ?? DEFAULT_DOOD_SETTINGS, editing.category, editing.id)}
          onSave={(updates, options) => {
            s.updateElementRecord(editing.id, updates);
            const settings = schedule?.doodSettings ?? DEFAULT_DOOD_SETTINGS;
            s.updateDOODSettings({ elementOptions: { ...settings.elementOptions, [editing.id]: options } });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EditElement(props: {
  record: ElementRecord;
  occurrences: number;
  dood?: DOODRow;
  options: DOODElementOptions;
  onSave: (updates: Partial<ElementRecord>, options: DOODElementOptions) => void;
  onClose: () => void;
}) {
  const [record, setRecord] = useState(props.record);
  const [options, setOptions] = useState(props.options);
  const [newProp, setNewProp] = useState('');
  const properties = record.properties ?? {};

  return (
    <div className="em-modal-overlay" onClick={props.onClose}>
      <div className="em-modal" onClick={(e) => e.stopPropagation()}>
        <div className="em-modal-header"><h3>Edit Element</h3><button className="em-close" onClick={props.onClose}>×</button></div>
        <div className="em-modal-body">
          <fieldset>
            <legend>Element Identification</legend>
            <label>Element Name<input value={record.name} onChange={(e) => setRecord({ ...record, name: e.target.value.toUpperCase() })} /></label>
            <label>Board ID<input value={record.boardId ?? ''} onChange={(e) => setRecord({ ...record, boardId: e.target.value || undefined })} /></label>
            <label className="em-check"><input type="checkbox" checked={record.lockBoardId} onChange={(e) => setRecord({ ...record, lockBoardId: e.target.checked })} /> Lock ID</label>
            <label className="em-check"><input type="checkbox" checked={record.excludeFromStripboard} onChange={(e) => setRecord({ ...record, excludeFromStripboard: e.target.checked })} /> Exclude from Stripboard</label>
          </fieldset>
          <fieldset>
            <legend>Day Out of Days</legend>
            <label className="em-check"><input type="checkbox" checked={options.allowHold} onChange={(e) => setOptions({ ...options, allowHold: e.target.checked })} /> Allow Hold Days</label>
            <label className="em-check"><input type="checkbox" checked={options.allowDropPickup} onChange={(e) => setOptions({ ...options, allowDropPickup: e.target.checked })} /> Allow Drop/Pickup Days</label>
            <label>Minimum Days Allowed Between Drop/Pickup
              <input type="number" min={1} disabled={!options.allowDropPickup} value={options.minDaysBetweenDropPickup}
                onChange={(e) => setOptions({ ...options, minDaysBetweenDropPickup: Math.max(1, Number(e.target.value) || 10) })} />
            </label>
          </fieldset>
          <fieldset>
            <legend>Usage</legend>
            <div className="em-usage">
              <span>Total Occurrences</span><strong>{props.occurrences}</strong>
              <span>Active Schedule Start</span><strong>{props.dood?.totals.start ?? '—'}</strong>
              <span>Active Schedule Finish</span><strong>{props.dood?.totals.finish ?? '—'}</strong>
              <span>Total Days</span><strong>{props.dood?.totals.work ?? '—'}</strong>
            </div>
          </fieldset>
          <fieldset>
            <legend>Element Properties</legend>
            {Object.entries(properties).map(([key, value]) => (
              <label key={key}>{key}
                <span className="em-prop-row">
                  <input value={value} onChange={(e) => setRecord({ ...record, properties: { ...properties, [key]: e.target.value } })} />
                  <button className="em-close" title="Remove field" onClick={() => {
                    const rest = { ...properties };
                    delete rest[key];
                    setRecord({ ...record, properties: rest });
                  }}>×</button>
                </span>
              </label>
            ))}
            <span className="em-prop-row">
              <input placeholder="New field (e.g. Agent)" value={newProp} onChange={(e) => setNewProp(e.target.value)} />
              <button className="em-btn" disabled={!newProp.trim()} onClick={() => {
                setRecord({ ...record, properties: { ...properties, [newProp.trim()]: '' } });
                setNewProp('');
              }}>Add Field</button>
            </span>
            <label>Notes<textarea value={record.notes ?? ''} onChange={(e) => setRecord({ ...record, notes: e.target.value })} /></label>
          </fieldset>
        </div>
        <div className="em-modal-footer">
          <button className="em-btn" onClick={props.onClose}>Cancel</button>
          <button className="em-btn em-primary" disabled={!record.name.trim()} onClick={() => {
            const { name, boardId, lockBoardId, excludeFromStripboard, properties: props2, notes } = record;
            props.onSave({ name: name.trim(), boardId, lockBoardId, excludeFromStripboard, properties: props2, notes }, options);
          }}>OK</button>
        </div>
      </div>
    </div>
  );
}
