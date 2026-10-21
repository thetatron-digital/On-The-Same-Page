// ViewFinder > References: a ShotDeck-style library of the production's
// own images. Facet filters and decks on the left, the grid in the middle,
// the selected image's tags, credits and links on the right.
import { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import type { FacetId, ImageLook, ReferenceImage } from '../../types/references';
import { FACETS } from '../../engine/references/facets';
import { facetCounts, matchesQuery, type ReferenceQuery } from '../../engine/references/search';
import { generateBreakdownScenes } from '../../utils/breakdown';
import { addReferenceFiles } from './addReferences';
import { ReferenceDetail } from './ReferenceDetail';
import { exportDeckPdf, exportDeckZip } from './deckExport';
import { useAppViews } from '../../routing/appViews';
import './references.css';

type LookKey = keyof Omit<ImageLook, 'palette'>;
const LOOK_FILTERS: { key: LookKey; label: string; values: string[] }[] = [
  { key: 'temperature', label: 'Temperature', values: ['warm', 'neutral', 'cool'] },
  { key: 'saturation', label: 'Saturation', values: ['b&w', 'muted', 'natural', 'vivid'] },
  { key: 'contrast', label: 'Contrast', values: ['low', 'medium', 'high'] },
  { key: 'key', label: 'Brightness', values: ['low', 'medium', 'high'] },
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ReferenceLibrary({ onClose }: { onClose: () => void }) {
  const { references, elements, addDeck, deleteDeck, updateDeck } = useScreenplayStore(
    useShallow((s) => ({
      references: s.references, elements: s.screenplay.elements,
      addDeck: s.addReferenceDeck, deleteDeck: s.deleteReferenceDeck, updateDeck: s.updateReferenceDeck,
    }))
  );
  const images = useMemo(() => references?.images ?? [], [references]);
  const decks = useMemo(() => references?.decks ?? [], [references]);
  const scenes = useMemo(() => generateBreakdownScenes(elements), [elements]);
  const [query, setQuery] = useState<ReferenceQuery>({});
  const [deckId, setDeckId] = useState<string | null>(null);
  // Opened from Find Anything: start on that image
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const id = useAppViews.getState().referenceImageId;
    if (id) useAppViews.getState().set({ referenceImageId: null });
    return id;
  });
  const [openFacets, setOpenFacets] = useState<Set<string>>(() => new Set(['timeOfDay', 'frameSize', 'lighting']));
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const deck = decks.find((d) => d.id === deckId);
  const fullQuery: ReferenceQuery = { ...query, deckImageIds: deck?.imageIds };
  const shown = useMemo(() => images.filter((i) => matchesQuery(i, fullQuery)).sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [images, query, deck]);
  const counts = useMemo(() => facetCounts(shown), [shown]);
  const selected = images.find((i) => i.id === selectedId);
  const activeFilters = Object.values(query.facets ?? {}).flat().length + Object.values(query.look ?? {}).flat().length + (query.colour ? 1 : 0) + (query.sceneId ? 1 : 0);

  const toggleFacet = (facet: FacetId, value: string) => setQuery((q) => {
    const current = q.facets?.[facet] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    return { ...q, facets: { ...q.facets, [facet]: next } };
  });
  const toggleLook = (key: LookKey, value: string) => setQuery((q) => {
    const current = (q.look?.[key] ?? []) as string[];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    return { ...q, look: { ...q.look, [key]: next } };
  });

  const add = async (files: File[]) => {
    setBusy(`Adding ${files.length} image${files.length === 1 ? '' : 's'}…`);
    const { added, failed } = await addReferenceFiles(files, { sceneId: query.sceneId });
    if (deckId) added.forEach((id) => useScreenplayStore.getState().toggleImageInDeck(deckId, id));
    setBusy(null);
    if (added.length === 1) setSelectedId(added[0]);
    if (failed.length) alert(failed.join('\n'));
  };

  const runExport = async (kind: 'pdf' | 'zip') => {
    setBusy(kind === 'pdf' ? 'Making the PDF…' : 'Packing the ZIP…');
    try {
      const name = deck?.name ?? 'References';
      if (kind === 'pdf') await exportDeckPdf(shown, name);
      else await exportDeckZip(shown, name);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={`rf-library ${dragging ? 'drag' : ''}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const files = [...e.dataTransfer.files]; if (files.length) void add(files); }}
    >
      <div className="rf-toolbar">
        <button className="rf-btn" onClick={onClose}>← Shot List</button>
        <h2>References</h2>
        <input className="rf-search" type="search" placeholder="Search titles, credits, keywords…" value={query.text ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, text: e.target.value }))} aria-label="Search references" />
        <span className="rf-count">{shown.length} of {images.length}</span>
        <div className="rf-toolbar-end">
          <button className="rf-btn" disabled={!shown.length || !!busy} onClick={() => void runExport('pdf')} title="Contact sheet with captions">Export PDF</button>
          <button className="rf-btn" disabled={!shown.length || !!busy} onClick={() => void runExport('zip')} title="Original images and a captions spreadsheet">Export ZIP</button>
          <button className="rf-btn primary" onClick={() => fileRef.current?.click()}>Add Images</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) void add(fs); }} />
        </div>
      </div>

      <div className="rf-body">
        <aside className="rf-filters">
          <section>
            <h4>Decks</h4>
            <button className={`rf-deck ${!deckId ? 'active' : ''}`} onClick={() => setDeckId(null)}>All Images <span>{images.length}</span></button>
            {decks.map((d) => (
              <div key={d.id} className={`rf-deck-row ${deckId === d.id ? 'active' : ''}`}>
                <button className="rf-deck" onClick={() => setDeckId(d.id)} onDoubleClick={() => { const name = prompt('Deck name', d.name); if (name) updateDeck(d.id, { name }); }} title="Double-click to rename">
                  {d.name} <span>{d.imageIds.length}</span>
                </button>
                <button className="rf-x" aria-label={`Delete deck ${d.name}`} onClick={() => { if (confirm(`Delete the deck "${d.name}"? The images stay in the library.`)) { deleteDeck(d.id); if (deckId === d.id) setDeckId(null); } }}>×</button>
              </div>
            ))}
            <button className="rf-link" onClick={() => { const name = prompt('New deck name'); if (name) setDeckId(addDeck(name, selectedId ? [selectedId] : [])); }}>+ New Deck</button>
          </section>

          <section>
            <div className="rf-filter-head">
              <h4>Filters</h4>
              {activeFilters > 0 && <button className="rf-link" onClick={() => setQuery((q) => ({ text: q.text }))}>Clear {activeFilters}</button>}
            </div>
            <label className="rf-colour">Colour
              <input type="color" value={query.colour ?? '#808080'} onChange={(e) => setQuery((q) => ({ ...q, colour: e.target.value }))} />
              {query.colour && <button className="rf-x" onClick={() => setQuery((q) => ({ ...q, colour: undefined }))} aria-label="Clear colour">×</button>}
            </label>
            <label className="rf-colour">Scene
              <select value={query.sceneId ?? ''} onChange={(e) => setQuery((q) => ({ ...q, sceneId: e.target.value || undefined }))}>
                <option value="">Any</option>
                {scenes.map((s) => <option key={s.id} value={s.id}>{s.sceneNumber}. {s.location}</option>)}
              </select>
            </label>
          </section>

          {FACETS.map((f) => {
            const open = openFacets.has(f.id);
            const chosen = query.facets?.[f.id] ?? [];
            return (
              <section key={f.id} className="rf-facet">
                <button className="rf-facet-head" aria-expanded={open} onClick={() => setOpenFacets((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })}>
                  {open ? '▾' : '▸'} {f.label}{chosen.length ? <span className="rf-badge">{chosen.length}</span> : null}
                </button>
                {open && f.values.map((v) => (
                  <label key={v} className="rf-check">
                    <input type="checkbox" checked={chosen.includes(v)} onChange={() => toggleFacet(f.id, v)} />
                    {v}<span>{counts.get(`${f.id}:${v}`) ?? ''}</span>
                  </label>
                ))}
              </section>
            );
          })}
          {LOOK_FILTERS.map((l) => (
            <section key={l.key} className="rf-facet">
              <span className="rf-facet-label">{l.label}</span>
              <div className="rf-pills">
                {l.values.map((v) => {
                  const on = ((query.look?.[l.key] ?? []) as string[]).includes(v);
                  return <button key={v} className={`rf-pill ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleLook(l.key, v)}>{v === 'b&w' ? 'B&W' : cap(v)}</button>;
                })}
              </div>
            </section>
          ))}
        </aside>

        <main className="rf-grid-wrap">
          {images.length === 0 ? (
            <div className="rf-empty">
              <p><strong>Drop stills, frame grabs or scout photos here</strong>, or use Add Images.</p>
              <p className="rf-muted">Tag them by frame size, lens, lighting, time of day and more, then pull decks for each scene. Colour, contrast and brightness are read from each image automatically.</p>
            </div>
          ) : (
            <div className="rf-grid">
              {shown.map((img) => (
                <button key={img.id} className={`rf-tile ${img.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(img.id === selectedId ? null : img.id)}
                  style={{ aspectRatio: `${img.width} / ${img.height}` }} title={tileTitle(img)}>
                  <img src={img.thumbnail} alt={img.credits.title ?? ''} loading="lazy" />
                  <span className="rf-swatches">{img.look.palette.slice(0, 5).map((c) => <span key={c} style={{ background: c }} />)}</span>
                </button>
              ))}
              {shown.length === 0 && <p className="rf-muted">Nothing matches these filters.</p>}
            </div>
          )}
          {dragging && <div className="rf-drop">Drop images to add them{deck ? ` to “${deck.name}”` : ''}</div>}
          {busy && <div className="rf-busy">{busy}</div>}
        </main>

        {selected && (
          <ReferenceDetail
            key={selected.id}
            image={selected}
            decks={decks}
            scenes={scenes}
            onClose={() => setSelectedId(null)}
            onPickColour={(c) => setQuery((q) => ({ ...q, colour: c }))}
          />
        )}
      </div>
    </div>
  );
}

const tileTitle = (img: ReferenceImage) =>
  [img.credits.title, img.credits.year && `(${img.credits.year})`, img.credits.dp && `DP ${img.credits.dp}`].filter(Boolean).join(' ');
