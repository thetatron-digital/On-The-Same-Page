// Find Anything (Cmd/Ctrl+K): search the whole project and jump there
import { useEffect, useMemo, useRef, useState } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { buildSearchIndex, searchIndex, type SearchKind } from '../engine/search';
import { goTo } from '../services/findAnything';
import { useFindAnything } from './findAnythingState';
import './FindAnything.css';


const KIND_LABEL: Record<SearchKind, string> = {
  scene: 'Scene', character: 'Character', element: 'Element', person: 'Person', location: 'Location', shot: 'Shot',
  callsheet: 'Call Sheet', clip: 'Dailies', reference: 'Reference', account: 'Budget',
};

export function FindAnything() {
  const { open, set } = useFindAnything();

  // Cmd/Ctrl+K anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        set(!useFindAnything.getState().open);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [set]);

  if (!open) return null;
  return <Palette onClose={() => set(false)} />;
}

function Palette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // Snapshot of the project when the palette opens
  const index = useMemo(() => buildSearchIndex(useScreenplayStore.getState().getProjectData()), []);
  const results = useMemo(() => searchIndex(index, query), [index, query]);
  const listRef = useRef<HTMLUListElement>(null);
  const current = Math.min(active, Math.max(0, results.length - 1));

  const choose = (i: number) => {
    const item = results[i];
    if (!item) return;
    onClose();
    goTo(item);
  };

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  return (
    <div className="fa-overlay" onMouseDown={onClose}>
      <div className="fa-panel" role="dialog" aria-label="Find anything" onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="fa-input"
          autoFocus
          placeholder="Find scenes, characters, people, locations, shots, clips, references, budget…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(results.length - 1, current + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, current - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); choose(current); }
            else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          }}
          aria-controls="fa-results"
          aria-activedescendant={results[current] ? `fa-${current}` : undefined}
        />
        <ul className="fa-results" id="fa-results" role="listbox" ref={listRef}>
          {results.map((r, i) => (
            <li key={`${r.kind}-${r.id}`} id={`fa-${i}`} role="option" aria-selected={i === current}
              className={i === current ? 'active' : ''} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(i); }}>
              <span className={`fa-kind ${r.kind}`}>{KIND_LABEL[r.kind]}</span>
              <span className="fa-text"><strong>{r.title}</strong><span>{r.subtitle}</span></span>
            </li>
          ))}
          {query && results.length === 0 && <li className="fa-empty">Nothing matches “{query}”.</li>}
          {!query && <li className="fa-empty">Type to search the whole project. ↑ ↓ to move, Enter to go, Esc to close.</li>}
        </ul>
      </div>
    </div>
  );
}
