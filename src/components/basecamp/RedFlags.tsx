// Red Flags: Movie Magic's Red Flag Entry + Manager and the Conflicts
// inspector (Flag / Category / Element / Note) in one BaseCamp view.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import { DEFAULT_RED_FLAG_NAMES, doodStatusForName, findConflicts } from '../../engine/schedule/redFlags';
import { CAST_CATEGORY, scheduledElementDays, toYMD } from '../../utils/doodReport';
import './basecampTools.css';

const DOOD_LABEL = { travel: 'Travel', rehearsal: 'Rehearsal', fitting: 'Fitting' } as const;

export function RedFlags() {
  const s = useScreenplayStore(
    useShallow((st) => ({
      schedule: st.schedule,
      breakdown: st.breakdown,
      people: st.productionData.people,
      addRedFlag: st.addRedFlag,
      deleteRedFlag: st.deleteRedFlag,
      addRedFlagName: st.addRedFlagName,
    }))
  );
  const { schedule, breakdown, people } = s;
  const names = schedule?.redFlagNames ?? DEFAULT_RED_FLAG_NAMES;
  const flags = useMemo(() => [...(schedule?.redFlags ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [schedule]);

  // Elements to flag: cast (from strips/people and the element list) plus every tagged element
  const elementsByCategory = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    const add = (category: string, id: string, name: string) => {
      const m = map.get(category) ?? new Map<string, string>();
      if (!m.has(id)) m.set(id, name);
      map.set(category, m);
    };
    for (const e of breakdown?.elementList ?? []) add(e.category, e.id, e.boardId ? `${e.boardId}. ${e.name}` : e.name);
    for (const p of people.filter((p) => p.group === 'Talent')) {
      const character = p.roles.find((r) => r.group === 'Talent')?.characterName;
      add(CAST_CATEGORY, p.id, `${p.castNumber ? `${p.castNumber}. ` : ''}${(character ?? `${p.firstName} ${p.lastName}`).toUpperCase()}`);
    }
    return map;
  }, [breakdown, people]);
  const categories = [...elementsByCategory.keys()].sort((a, b) => (a === CAST_CATEGORY ? -1 : b === CAST_CATEGORY ? 1 : a.localeCompare(b)));

  const [form, setForm] = useState({ name: names[0], date: toYMD(new Date()), category: CAST_CATEGORY, elementId: '', note: '' });
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const elementOptions = [...(elementsByCategory.get(form.category) ?? new Map())];

  const conflicts = useMemo(() => {
    if (!schedule) return [];
    const availability = people
      .filter((p) => p.availability)
      .map((p) => ({ elementId: p.id, startDate: p.availability!.startDate, endDate: p.availability!.endDate, blockedDates: p.availability!.blockedDates ?? [] }));
    return findConflicts(scheduledElementDays(schedule, { breakdown, people }), schedule.redFlags ?? [], availability);
  }, [schedule, breakdown, people]);

  const submit = () => {
    if (!form.elementId) return setError('Pick an element to flag.');
    const elementName = elementsByCategory.get(form.category)?.get(form.elementId);
    const err = s.addRedFlag({
      name: form.name,
      date: form.date,
      category: form.category,
      elementId: form.elementId,
      elementName,
      note: form.note.trim() || undefined,
      doodStatus: doodStatusForName(form.name),
    });
    setError(err);
    if (!err) setForm({ ...form, note: '' });
  };

  return (
    <div className="bc-content-area bct-redflags">
      <div className="bc-page-header bct-header"><h2>Red Flags</h2></div>

      <div className="bct-flag-form">
        <label className="bct-inline-label">Flag
          <select value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="bct-inline-label">Date
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="bct-inline-label">Category
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, elementId: '' })}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="bct-inline-label">Element
          <select value={form.elementId} onChange={(e) => setForm({ ...form, elementId: e.target.value })}>
            <option value="">Choose…</option>
            {elementOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="bct-inline-label bct-grow">Note
          <input value={form.note} placeholder="e.g. Doctor's appointment" onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </label>
        <button className="bc-btn bc-btn-primary" onClick={submit}>Add Red Flag</button>
      </div>
      <div className="bct-flag-names">
        <input value={newName} placeholder="New flag name (end with '- DOOD' to show on the Day Out of Days)" onChange={(e) => setNewName(e.target.value)} />
        <button className="bc-btn bc-btn-outline small" disabled={!newName.trim()} onClick={() => { s.addRedFlagName(newName); setNewName(''); }}>Add Name</button>
      </div>
      {error && <p className="bct-error">{error}</p>}

      <h3 className="bct-section-title">Conflicts {conflicts.length > 0 && <span className="bct-count">{conflicts.length}</span>}</h3>
      {conflicts.length === 0 ? (
        <p className="bct-muted">No red flags or availability problems on scheduled days.</p>
      ) : (
        <table className="bc-table">
          <thead><tr><th>Day</th><th>Date</th><th>Scene</th><th>Flag</th><th>Category</th><th>Element</th><th>Note</th></tr></thead>
          <tbody>
            {conflicts.map((c, i) => (
              <tr key={i} className="bc-table-row bct-conflict-row">
                <td>{c.dayNumber}</td><td>{c.date}</td><td>{c.sceneNumber}</td><td>⚑ {c.flag}</td><td>{c.category}</td><td>{c.element}</td><td>{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="bct-section-title">All Red Flags</h3>
      {flags.length === 0 ? (
        <p className="bct-muted">No red flags yet.</p>
      ) : (
        <table className="bc-table">
          <thead><tr><th>Date</th><th>Flag</th><th>Category</th><th>Element</th><th>Note</th><th>DOOD</th><th /></tr></thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.id} className="bc-table-row">
                <td>{f.date}</td><td>{f.name}</td><td>{f.category ?? ''}</td><td>{f.elementName ?? ''}</td><td>{f.note ?? ''}</td>
                <td>{f.doodStatus ? DOOD_LABEL[f.doodStatus] : ''}</td>
                <td><button className="bc-modal-close" title="Delete" onClick={() => s.deleteRedFlag(f.id)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
