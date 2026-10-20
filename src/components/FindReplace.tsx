// Edit > Find… panel: Find, Replace and Go To tabs (Final Draft's Find
// dialog fields). It floats over the script so editing can carry on.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../store/screenplayStore';
import type { ElementType } from '../types/screenplay';
import { useFind, findAgain, replaceCurrent, replaceEverywhere } from '../commands/findState';
import { paginateScript } from '../engine/paginate';
import { bookmarks } from '../engine/scriptTools';
import { goToElement } from './writingActions';
import './FindReplace.css';

const ELEMENTS: ElementType[] = ['Scene Heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Transition', 'Shot', 'General'];
export type FindTab = 'find' | 'replace' | 'goto';

export const FindPanel = ({ tab: initialTab, onClose }: { tab: FindTab; onClose: () => void }) => {
  const [tab, setTab] = useState<FindTab>(initialTab);
  const find = useFind();
  const { screenplay, scriptNotes, setActiveNote } = useScreenplayStore(
    useShallow((s) => ({ screenplay: s.screenplay, scriptNotes: s.scriptNotes, setActiveNote: s.setActiveNote }))
  );
  const pagination = paginateScript(screenplay);
  const scenes = useMemo(() => {
    let n = 0;
    return screenplay.elements.filter((el) => el.type === 'Scene Heading')
      .map((el) => ({ id: el.id, number: el.sceneNumber ?? String(++n), text: el.content.map((r) => r.text).join('') }));
  }, [screenplay.elements]);
  const marks = bookmarks(screenplay.elements);
  const notes = scriptNotes.filter((n) => n.elementId && !n.resolved);
  const [page, setPage] = useState('');
  const [scene, setScene] = useState('');
  const [gotoMessage, setGotoMessage] = useState('');

  const goToPage = () => {
    const target = pagination.pages.find((p) => p.label.toUpperCase() === page.trim().toUpperCase());
    const first = target?.items.find((i) => i.kind === 'element' || i.kind === 'dual');
    if (!first) { setGotoMessage('No such page.'); return; }
    goToElement(first.kind === 'element' ? first.elementId : first.left[0].elementId);
    setGotoMessage('');
  };
  const goToScene = () => {
    const target = scenes.find((s) => s.number.toUpperCase() === scene.trim().toUpperCase());
    if (!target) { setGotoMessage('No such scene.'); return; }
    goToElement(target.id);
    setGotoMessage('');
  };
  const onFindKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); findAgain(e.shiftKey); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="find-panel" role="dialog" aria-label="Find">
      <div className="find-header">
        <div className="find-tabs" role="tablist">
          {(['find', 'replace', 'goto'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'find' ? 'Find' : t === 'replace' ? 'Replace' : 'Go To'}
            </button>
          ))}
        </div>
        <button className="find-close" onClick={onClose} aria-label="Close Find">×</button>
      </div>

      {tab !== 'goto' && (
        <>
          <label className="find-row">
            <span>Find:</span>
            <input
              autoFocus
              value={find.query}
              onChange={(e) => find.set({ query: e.target.value, message: '' })}
              onKeyDown={onFindKey}
            />
          </label>
          {tab === 'replace' && (
            <label className="find-row">
              <span>Replace:</span>
              <input value={find.replacement} onChange={(e) => find.set({ replacement: e.target.value })} onKeyDown={onFindKey} />
            </label>
          )}
          <div className="find-options">
            <label>
              Element:
              <select
                value={find.options.element}
                onChange={(e) => find.set({ options: { ...find.options, element: e.target.value as ElementType | 'All' } })}
              >
                <option value="All">All elements</option>
                {ELEMENTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>
              <input type="checkbox" checked={find.options.matchCase} onChange={(e) => find.set({ options: { ...find.options, matchCase: e.target.checked } })} />
              Match case
            </label>
            <label>
              <input type="checkbox" checked={find.options.wholeWord} onChange={(e) => find.set({ options: { ...find.options, wholeWord: e.target.checked } })} />
              Whole words
            </label>
          </div>
          <div className="find-buttons">
            <span className="find-message" aria-live="polite">{find.message}</span>
            <button onClick={() => findAgain(true)} disabled={!find.query}>Previous</button>
            <button className="primary" onClick={() => findAgain()} disabled={!find.query}>Next</button>
            {tab === 'replace' && (
              <>
                <button onClick={replaceCurrent} disabled={!find.query}>Replace</button>
                <button onClick={replaceEverywhere} disabled={!find.query}>Replace All</button>
              </>
            )}
          </div>
        </>
      )}

      {tab === 'goto' && (
        <div className="goto-grid">
          <label className="find-row">
            <span>Page:</span>
            <input value={page} onChange={(e) => setPage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && goToPage()} placeholder={`1–${pagination.pages[pagination.pageCount - 1].label}`} />
            <button onClick={goToPage}>Go</button>
          </label>
          <label className="find-row">
            <span>Scene:</span>
            <input value={scene} onChange={(e) => setScene(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && goToScene()} />
            <button onClick={goToScene}>Go</button>
          </label>
          <label className="find-row">
            <span>Bookmark:</span>
            <select value="" onChange={(e) => e.target.value && goToElement(e.target.value)} disabled={marks.length === 0}>
              <option value="">{marks.length ? 'Choose…' : 'No bookmarks'}</option>
              {marks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="find-row">
            <span>ScriptNote:</span>
            <select
              value=""
              disabled={notes.length === 0}
              onChange={(e) => {
                const note = notes.find((n) => n.id === e.target.value);
                if (note) { goToElement(note.elementId); setActiveNote(note.id); }
              }}
            >
              <option value="">{notes.length ? 'Choose…' : 'No open notes'}</option>
              {notes.map((n) => <option key={n.id} value={n.id}>{n.title || n.content.slice(0, 40) || 'ScriptNote'}</option>)}
            </select>
          </label>
          {gotoMessage && <span className="find-message">{gotoMessage}</span>}
        </div>
      )}
    </div>
  );
};
