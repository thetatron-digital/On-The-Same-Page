// One reference image: big view, its look, facet tags, credits, links, decks
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import type { FacetId, ReferenceCredits, ReferenceDeck, ReferenceImage } from '../../types/references';
import type { BreakdownScene } from '../../types/screenplay';
import { FACETS, lensBand } from '../../engine/references/facets';
import { clipUrl, removeClipMedia } from '../../services/mediaStore';

const CREDIT_FIELDS: { key: keyof ReferenceCredits; label: string }[] = [
  { key: 'title', label: 'Title' }, { key: 'year', label: 'Year' }, { key: 'director', label: 'Director' },
  { key: 'dp', label: 'Cinematographer' }, { key: 'productionDesigner', label: 'Production Designer' },
  { key: 'costumeDesigner', label: 'Costume Designer' }, { key: 'colorist', label: 'Colorist' }, { key: 'source', label: 'Source / URL' },
];

interface Props {
  image: ReferenceImage;
  decks: ReferenceDeck[];
  scenes: BreakdownScene[];
  onClose: () => void;
  onPickColour: (hex: string) => void;
}

export function ReferenceDetail({ image, decks, scenes, onClose, onPickColour }: Props) {
  const { update, remove, toggleDeck, shots } = useScreenplayStore(
    useShallow((s) => ({ update: s.updateReferenceImage, remove: s.deleteReferenceImage, toggleDeck: s.toggleImageInDeck, shots: s.viewFinder?.shots ?? [] }))
  );
  const [full, setFull] = useState<string | null>(null);
  const [keywords, setKeywords] = useState(image.keywords.join(', '));

  // Full-size image (falls back to the thumbnail while it loads or if it can't)
  useEffect(() => {
    let live = true;
    clipUrl(image.media).then((url) => { if (live) setFull(url); }).catch(() => {});
    return () => { live = false; };
  }, [image.media]);

  const toggle = (facet: FacetId, value: string) => {
    const current = image.facets[facet] ?? [];
    update(image.id, { facets: { ...image.facets, [facet]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] } });
  };
  const setFocal = (mm: number | undefined) => {
    update(image.id, {
      focalLength: mm,
      ...(mm ? { facets: { ...image.facets, lensSize: [lensBand(mm)] } } : {}),
    });
  };
  const ratio = (image.width / image.height).toFixed(2);

  return (
    <aside className="rf-detail" aria-label="Image details">
      <div className="rf-detail-head">
        <strong>{image.credits.title || 'Untitled'}</strong>
        <button className="rf-x" onClick={onClose} aria-label="Close details">×</button>
      </div>
      <a href={full ?? image.thumbnail} target="_blank" rel="noreferrer" className="rf-detail-image" title="Open full size">
        <img src={full ?? image.thumbnail} alt={image.credits.title ?? ''} />
      </a>
      <div className="rf-look">
        <span className="rf-palette">
          {image.look.palette.map((c) => <button key={c} style={{ background: c }} title={`${c}: find similar colours`} aria-label={`Find images with ${c}`} onClick={() => onPickColour(c)} />)}
        </span>
        <span className="rf-muted">{image.width}×{image.height} · {ratio}:1 · {image.look.temperature} · {image.look.saturation === 'b&w' ? 'B&W' : image.look.saturation} · {image.look.contrast} contrast · {image.look.key} key</span>
      </div>

      <section>
        <h4>Tags</h4>
        {FACETS.map((f) => (
          <div key={f.id} className="rf-tag-row">
            <span className="rf-tag-label">{f.label}</span>
            <span className="rf-pills">
              {f.values.map((v) => {
                const on = image.facets[f.id]?.includes(v) ?? false;
                return <button key={v} className={`rf-pill ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(f.id, v)}>{v}</button>;
              })}
            </span>
          </div>
        ))}
        <div className="rf-fields">
          <label>Focal length (mm)<input type="number" min={4} max={1200} value={image.focalLength ?? ''} onChange={(e) => setFocal(Number(e.target.value) || undefined)} /></label>
          <label>People in frame<input type="number" min={0} value={image.people ?? ''} onChange={(e) => update(image.id, { people: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
        </div>
        <label className="rf-field-wide">Keywords
          <input value={keywords} placeholder="neon, rain, reflections" onChange={(e) => setKeywords(e.target.value)}
            onBlur={() => update(image.id, { keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean) })} />
        </label>
      </section>

      <section>
        <h4>Credits</h4>
        <div className="rf-fields">
          {CREDIT_FIELDS.map(({ key, label }) => (
            <label key={key} className={key === 'source' ? 'rf-field-wide' : ''}>{label}
              <input value={image.credits[key] ?? ''} onChange={(e) => update(image.id, { credits: { ...image.credits, [key]: e.target.value || undefined } })} />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h4>Links</h4>
        <div className="rf-chips">
          {image.sceneIds.map((id) => {
            const sc = scenes.find((s) => s.id === id);
            return <span key={id} className="rf-chip">Sc {sc?.sceneNumber ?? '?'} <button onClick={() => update(image.id, { sceneIds: image.sceneIds.filter((x) => x !== id) })} aria-label="Unlink scene">×</button></span>;
          })}
          {image.shotIds.map((id) => {
            const sh = shots.find((s) => s.id === id);
            return <span key={id} className="rf-chip">Shot {sh ? `${sh.sceneNumber}-${sh.shotNumber}` : '?'} <button onClick={() => update(image.id, { shotIds: image.shotIds.filter((x) => x !== id) })} aria-label="Unlink shot">×</button></span>;
          })}
        </div>
        <div className="rf-fields">
          <label>Add scene
            <select value="" onChange={(e) => e.target.value && update(image.id, { sceneIds: [...image.sceneIds, e.target.value] })}>
              <option value="">Choose…</option>
              {scenes.filter((s) => !image.sceneIds.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.sceneNumber}. {s.intExt}. {s.location}</option>)}
            </select>
          </label>
          <label>Add shot
            <select value="" onChange={(e) => e.target.value && update(image.id, { shotIds: [...image.shotIds, e.target.value] })}>
              <option value="">Choose…</option>
              {shots.filter((s) => !image.shotIds.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.sceneNumber}-{s.shotNumber} {s.description?.slice(0, 30)}</option>)}
            </select>
          </label>
        </div>
      </section>

      {decks.length > 0 && (
        <section>
          <h4>Decks</h4>
          {decks.map((d) => (
            <label key={d.id} className="rf-check"><input type="checkbox" checked={d.imageIds.includes(image.id)} onChange={() => toggleDeck(d.id, image.id)} /> {d.name}</label>
          ))}
        </section>
      )}

      <section>
        <label className="rf-field-wide">Notes<textarea rows={3} value={image.notes ?? ''} onChange={(e) => update(image.id, { notes: e.target.value || undefined })} /></label>
        <p className="rf-muted">{image.media.store === 'drive' ? 'Stored in Google Drive' : 'Stored in this browser'}{image.addedBy ? ` · added by ${image.addedBy}` : ''} · {image.addedAt.toLocaleDateString()}</p>
        <button className="rf-btn danger" onClick={() => { if (confirm('Remove this image from the library?')) { remove(image.id); void removeClipMedia(image.media, true); onClose(); } }}>Delete Image</button>
      </section>
    </aside>
  );
}
