import { useMemo, useState } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { useShallow } from 'zustand/react/shallow';
import { getPlainText } from '../utils/fdx';
import { notesInScriptOrder } from '../engine/scriptTools';
import { castReport, reportToCSV } from '../utils/reports';
import { goToElement, insertNote } from './writingActions';
import { ScenePropertiesPane } from './SceneProperties';
import { SCENE_COLORS } from '../types/screenplay';
import './Navigator.css';

type NavigatorTab = 'scenes' | 'notes' | 'characters';

// Saves text as a file
const download = (name: string, text: string, type = 'text/csv') => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

// Navigator: Scenes · ScriptNotes · Characters (Final Draft's Navigator tabs)
export const Navigator = () => {
  const {
    screenplay,
    selectedElementId,
    scriptNotes,
    togglePanel,
    setActiveNote,
  } = useScreenplayStore(
    useShallow((s) => ({
      screenplay: s.screenplay,
      selectedElementId: s.selectedElementId,
      scriptNotes: s.scriptNotes,
      togglePanel: s.togglePanel,
      setActiveNote: s.setActiveNote,
    }))
  );
  const [tab, setTab] = useState<NavigatorTab>('scenes');
  const [filter, setFilter] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const match = (text: string) => !filter || text.toLowerCase().includes(filter.toLowerCase());

  // Scene headings, plus Fountain sections and synopses (which don't print)
  let sceneCount = 0;
  const scenes = screenplay.elements
    .filter((el) => el.type === 'Scene Heading' || el.outline?.kind === 'section' || el.outline?.kind === 'synopsis')
    .map((el) => ({
      id: el.id,
      kind: el.outline?.kind ?? 'scene',
      depth: el.outline?.kind === 'section' ? el.outline.depth : 0,
      number: el.outline ? '' : el.sceneNumber ?? String(++sceneCount),
      title: el.scene?.title,
      color: el.scene?.color,
      text: getPlainText(el.content) || 'Untitled Scene',
    }));

  const elementText = useMemo(
    () => new Map(screenplay.elements.map((el) => [el.id, getPlainText(el.content)])),
    [screenplay.elements]
  );
  const notes = notesInScriptOrder(scriptNotes, screenplay.elements.map((el) => el.id))
    .filter((n) => showResolved || !n.resolved)
    .filter((n) => match(`${n.title ?? ''} ${n.content} ${n.author}`));
  const cast = useMemo(() => castReport(screenplay), [screenplay]);

  const exportNotes = () => {
    const rows = notes.map((n) => [n.kind === 'general' ? 'General Note' : 'ScriptNote', n.title ?? '', n.content, n.author,
      new Date(n.timestamp).toISOString(), n.resolved ? 'Resolved' : 'Open', elementText.get(n.elementId) ?? '']);
    download('scriptnotes.csv', reportToCSV({ title: 'ScriptNotes', columns: ['Type', 'Title', 'Note', 'Writer', 'Created', 'Status', 'Paragraph'], rows }));
  };

  return (
    <div className="navigator-panel">
      <div className="panel-header">
        <h3>Navigator</h3>
        <button className="panel-close" onClick={() => togglePanel('navigator')} aria-label="Close Navigator">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="nav-tabs" role="tablist">
        {([['scenes', 'Scenes'], ['notes', 'ScriptNotes'], ['characters', 'Characters']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`nav-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="nav-filter">
        <input placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter" />
      </div>

      <div className="panel-content">
        {tab === 'scenes' && (
          <ul className="scene-list">
            {scenes.filter((s) => match(s.text)).length === 0 ? (
              <li className="empty-state">No scenes</li>
            ) : (
              scenes.filter((s) => match(s.text)).map((scene) => (
                scene.kind === 'scene' ? (
                  <li
                    key={scene.id}
                    className={`scene-item ${selectedElementId === scene.id ? 'active' : ''}`}
                    onClick={() => goToElement(scene.id)}
                  >
                    <span className="scene-color-bar" style={{ background: scene.color ? SCENE_COLORS[scene.color] : 'transparent' }} />
                    <span className="scene-number">{scene.number}.</span>
                    <span className="scene-text">{scene.title ? <><strong>{scene.title}</strong> </> : null}{scene.text}</span>
                  </li>
                ) : (
                  <li
                    key={scene.id}
                    className={`outline-item ${scene.kind}`}
                    style={{ paddingLeft: `${8 + Math.max(0, scene.depth - 1) * 10}px` }}
                  >
                    {scene.text}
                  </li>
                )
              ))
            )}
          </ul>
        )}
        {tab === 'scenes' && <ScenePropertiesPane />}

        {tab === 'notes' && (
          <>
            <div className="nav-actions">
              <button onClick={() => insertNote('script')}>+ ScriptNote</button>
              <button onClick={() => insertNote('general')}>+ General Note</button>
              <button onClick={exportNotes} disabled={notes.length === 0}>CSV</button>
            </div>
            <label className="nav-check">
              <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
              Show resolved
            </label>
            <ul className="scene-list">
              {notes.length === 0 ? (
                <li className="empty-state">No notes</li>
              ) : (
                notes.map((note) => (
                  <li
                    key={note.id}
                    className={`scene-item note-item ${note.resolved ? 'resolved' : ''}`}
                    onClick={() => {
                      if (note.elementId) goToElement(note.elementId);
                      setActiveNote(note.id);
                    }}
                  >
                    <span className="note-swatch" style={{ background: note.color }} />
                    <span className="scene-text">
                      <strong>{note.title || (note.kind === 'general' ? 'General Note' : 'ScriptNote')}</strong>
                      {' '}{note.content || elementText.get(note.elementId) || ''}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </>
        )}

        {tab === 'characters' && (
          <ul className="scene-list">
            {cast.rows.filter((r) => match(r[0])).length === 0 ? (
              <li className="empty-state">No characters</li>
            ) : (
              cast.rows.filter((r) => match(r[0])).map(([name, dialogues, scenesCount]) => (
                <li key={name} className="scene-item character-item">
                  <span className="scene-text">{name}</span>
                  <span className="character-count" title="Speeches / scenes">{dialogues} / {scenesCount}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
};
