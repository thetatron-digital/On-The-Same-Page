// Document > Macros…, Document > Bookmarks… and Tools > Reports dialogs.
// Fields follow Final Draft's dialogs (findings/ui-parity-spec.md §1.3).
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../store/screenplayStore';
import { createDefaultMacros, type ElementType, type Macro } from '../types/screenplay';
import { bookmarks, getMacros, macroShortcut } from '../engine/scriptTools';
import {
  castReport, characterReport, listCharacters, locationReport, reportToCSV, reportToPDF, sceneReport, scenesOf,
  type CastSort, type LocationSort, type SceneSort,
} from '../utils/reports';
import { generatePDF } from '../utils/pdf';
import type { SidesHeader } from '../engine/sides';
import { goToElement, isMac } from './writingActions';
import './ProductionDialogs.css';
import './WritingDialogs.css';

interface DialogProps {
  onClose: () => void;
}

const ELEMENTS: ElementType[] = ['General', 'Scene Heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Transition', 'Shot'];

export const MacrosDialog = ({ onClose }: DialogProps) => {
  const { screenplay, setMacros } = useScreenplayStore(
    useShallow((s) => ({ screenplay: s.screenplay, setMacros: s.setMacros }))
  );
  const macros = getMacros(screenplay);
  const change = (id: string, changes: Partial<Macro>) => setMacros(macros.map((m) => (m.id === id ? { ...m, ...changes } : m)));

  // The first free shortcut, bank 1 then bank 2
  const free = (['1', '2'] as const).flatMap((bank) =>
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((key) => ({ bank: Number(bank) as 1 | 2, key })))
    .find(({ bank, key }) => !macros.some((m) => m.bank === bank && m.key === key));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog writing-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Macros</h3>
        <div className="revisions-table-wrap">
          <table className="revisions-table">
            <thead>
              <tr><th>Shortcut</th><th>Name</th><th>Macro Element</th><th>Text</th><th>Transition To</th><th /></tr>
            </thead>
            <tbody>
              {[...macros].sort((a, b) => a.bank - b.bank || (a.key === '0' ? 10 : +a.key) - (b.key === '0' ? 10 : +b.key)).map((m) => (
                <tr key={m.id}>
                  <td className="shortcut-cell">{macroShortcut(m, isMac)}</td>
                  <td><input type="text" value={m.name} aria-label="Macro name" onChange={(e) => change(m.id, { name: e.target.value })} /></td>
                  <td>
                    <select value={m.element} aria-label="Macro element" onChange={(e) => change(m.id, { element: e.target.value as Macro['element'] })}>
                      <option value="None">(any)</option>
                      {ELEMENTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td><input type="text" value={m.text} aria-label="Macro text" onChange={(e) => change(m.id, { text: e.target.value })} /></td>
                  <td>
                    <select value={m.transition} aria-label="Transition to" onChange={(e) => change(m.id, { transition: e.target.value as Macro['transition'] })}>
                      <option value="None">None</option>
                      {ELEMENTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td><button className="row-delete" aria-label="Delete macro" onClick={() => setMacros(macros.filter((x) => x.id !== m.id))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="production-row">
          <button
            disabled={!free}
            onClick={() => free && setMacros([...macros, { id: `macro-${Date.now()}`, name: 'New', element: 'None', text: '', transition: 'None', ...free }])}
          >
            New
          </button>
          <button onClick={() => setMacros(createDefaultMacros())}>Restore Defaults</button>
        </div>
        <div className="modal-buttons">
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export const BookmarksDialog = ({ onClose }: DialogProps) => {
  const { elements, setBookmark } = useScreenplayStore(
    useShallow((s) => ({ elements: s.screenplay.elements, setBookmark: s.setBookmark }))
  );
  const list = bookmarks(elements);
  const [selected, setSelected] = useState<string | null>(null);
  const current = list.find((b) => b.id === selected) ?? list[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Bookmarks</h3>
        {list.length === 0 ? (
          <p className="dialog-empty">No bookmarks yet. Use Insert ▸ Bookmark ({isMac ? '⌘\\' : 'Ctrl+\\'}).</p>
        ) : (
          <ul className="bookmark-list" role="listbox" aria-label="Bookmarks">
            {list.map((b) => (
              <li
                key={b.id}
                role="option"
                aria-selected={current?.id === b.id}
                className={current?.id === b.id ? 'selected' : ''}
                onClick={() => setSelected(b.id)}
                onDoubleClick={() => { goToElement(b.id); onClose(); }}
              >
                <strong>{b.name}</strong> <span>{b.text.slice(0, 60)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-buttons">
          <button disabled={!current} onClick={() => current && setBookmark(current.id, null)}>Delete</button>
          <button disabled={!current} onClick={() => { if (current) { goToElement(current.id); onClose(); } }}>Goto</button>
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export type ReportType = 'scene' | 'location' | 'character' | 'cast';

const REPORT_NAMES: Record<ReportType, string> = {
  scene: 'Scene Report',
  location: 'Location Report',
  character: 'Character Report',
  cast: 'Cast Report',
};

// Saves text or a PDF as a file
const saveFile = (name: string, data: Blob) => {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

export const ReportsDialog = ({ onClose, initial }: DialogProps & { initial: ReportType }) => {
  const screenplay = useScreenplayStore((s) => s.screenplay);
  const [type, setType] = useState<ReportType>(initial);
  const [sceneSort, setSceneSort] = useState<SceneSort>('script');
  const [locationSort, setLocationSort] = useState<LocationSort>('name');
  const [castSort, setCastSort] = useState<CastSort>('dialogues');
  const characters = useMemo(() => listCharacters(screenplay), [screenplay]);
  const [character, setCharacter] = useState('');
  const [includeDialogue, setIncludeDialogue] = useState(true);
  const [includeSceneHeadings, setIncludeSceneHeadings] = useState(true);
  const who = character || characters[0] || '';

  const report = useMemo(() => {
    if (type === 'scene') return sceneReport(screenplay, sceneSort);
    if (type === 'location') return locationReport(screenplay, locationSort);
    if (type === 'cast') return castReport(screenplay, castSort);
    return characterReport(screenplay, who, { includeDialogue, includeSceneHeadings });
  }, [type, screenplay, sceneSort, locationSort, castSort, who, includeDialogue, includeSceneHeadings]);

  const base = `${screenplay.title || 'Untitled'} - ${report.title}`.replace(/[\\/:*?"<>|]/g, '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog reports-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Reports</h3>
        <div className="report-options">
          <label className="production-field">
            Report:
            <select value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              {(Object.keys(REPORT_NAMES) as ReportType[]).map((t) => <option key={t} value={t}>{REPORT_NAMES[t]}</option>)}
            </select>
          </label>
          {type === 'scene' && (
            <label className="production-field">
              Sort report by:
              <select value={sceneSort} onChange={(e) => setSceneSort(e.target.value as SceneSort)}>
                <option value="script">Script order</option>
                <option value="length">Length</option>
                <option value="heading">Scene heading</option>
              </select>
            </label>
          )}
          {type === 'location' && (
            <label className="production-field">
              Sort by:
              <select value={locationSort} onChange={(e) => setLocationSort(e.target.value as LocationSort)}>
                <option value="name">Location name</option>
                <option value="scenes">Number of scenes</option>
                <option value="length">Length</option>
              </select>
            </label>
          )}
          {type === 'character' && (
            <>
              <label className="production-field">
                Select a character:
                <select value={who} onChange={(e) => setCharacter(e.target.value)}>
                  {characters.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="production-check">
                <input type="checkbox" checked={includeDialogue} onChange={(e) => setIncludeDialogue(e.target.checked)} />
                Include Dialogues
              </label>
              <label className="production-check">
                <input type="checkbox" checked={includeSceneHeadings} onChange={(e) => setIncludeSceneHeadings(e.target.checked)} />
                Include Scene Headings
              </label>
            </>
          )}
          {type === 'cast' && (
            <label className="production-field">
              Sort by:
              <select value={castSort} onChange={(e) => setCastSort(e.target.value as CastSort)}>
                <option value="dialogues">Total dialogues</option>
                <option value="scenes">Total scene appearances</option>
                <option value="speaking">Number of speaking scenes</option>
                <option value="nonSpeaking">Number of non-speaking scenes</option>
              </select>
            </label>
          )}
        </div>

        <div className="report-preview">
          {report.subtitle && <div className="report-subtitle">{report.subtitle}</div>}
          <div className="revisions-table-wrap">
            <table className="revisions-table report-table">
              <thead><tr>{report.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr><td colSpan={report.columns.length} className="dialog-empty">Nothing to report yet.</td></tr>
                ) : report.rows.map((row, i) => (
                  <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-buttons">
          <button onClick={() => saveFile(`${base}.csv`, new Blob([reportToCSV(report)], { type: 'text/csv' }))}>Save CSV</button>
          <button onClick={() => saveFile(`${base}.pdf`, reportToPDF(report, screenplay.title).output('blob'))}>Save PDF</button>
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

// File > Sides…: choose scenes, add a call-sheet-style header, save a PDF
export const SidesDialog = ({ onClose }: DialogProps) => {
  const { screenplay, selectedElementId, watermarkSettings } = useScreenplayStore(
    useShallow((s) => ({ screenplay: s.screenplay, selectedElementId: s.selectedElementId, watermarkSettings: s.watermarkSettings }))
  );
  const scenes = useMemo(() => {
    const headings = screenplay.elements.filter((el) => el.type === 'Scene Heading');
    return scenesOf(screenplay).map((s, i) => ({ ...s, id: headings[i].id }));
  }, [screenplay]);
  const current = useMemo(() => {
    let id = '';
    for (const el of screenplay.elements) {
      if (el.type === 'Scene Heading') id = el.id;
      if (el.id === selectedElementId) return id;
    }
    return '';
  }, [screenplay.elements, selectedElementId]);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(current ? [current] : []));
  const [header, setHeader] = useState<SidesHeader>({
    production: screenplay.title,
    date: new Date().toLocaleDateString(),
    shootDay: '',
    callTime: '',
    notes: '',
  });
  const [cover, setCover] = useState(true);
  const toggle = (id: string) => setChosen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const field = (key: keyof SidesHeader, label: string) => (
    <label className="production-field">
      {label}
      <input type="text" value={header[key]} onChange={(e) => setHeader({ ...header, [key]: e.target.value })} />
    </label>
  );
  const save = () => {
    const sceneIds = scenes.filter((s) => chosen.has(s.id)).map((s) => s.id);
    const numbers = scenes.filter((s) => chosen.has(s.id)).map((s) => s.number).join('-');
    generatePDF(screenplay, { sides: { sceneIds, header, cover }, watermark: watermarkSettings, showSceneNumbers: true })
      .save(`${(header.production || 'Script').replace(/[\\/:*?"<>|]/g, '')} sides ${numbers}.pdf`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog sides-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Sides</h3>
        <div className="sides-columns">
          <div className="revisions-table-wrap sides-scenes" role="group" aria-label="Scenes">
            {scenes.map((s) => (
              <label key={s.id} className="production-check">
                <input type="checkbox" checked={chosen.has(s.id)} onChange={() => toggle(s.id)} />
                <span className="sides-scene-number">{s.number}</span> {s.heading} <span className="sides-scene-meta">p. {s.page}</span>
              </label>
            ))}
          </div>
          <div>
            {field('production', 'Production:')}
            {field('date', 'Date:')}
            {field('shootDay', 'Shoot day:')}
            {field('callTime', 'Call time:')}
            {field('notes', 'Notes:')}
            <label className="production-check">
              <input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} />
              Cover page with scenes and cast
            </label>
            <p className="dialog-hint">Pages keep their script numbers; other scenes on those pages are crossed out.</p>
          </div>
        </div>
        <div className="modal-buttons">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={chosen.size === 0} onClick={save}>Save PDF</button>
        </div>
      </div>
    </div>
  );
};
