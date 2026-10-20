// Format > Highlight Characters…, Edit > Rename Character…,
// Document > Page Layout… and Document > Header and Footer…
// (fields per findings/ui-parity-spec.md §1.3)
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../store/screenplayStore';
import {
  createDefaultPageLayout, type HeaderFooterLine, type HeaderFooterSettings, type LineSpacing, type PageLayoutSettings,
} from '../types/screenplay';
import { listCharacters } from '../utils/reports';
import { getHeaderFooter, HEADER_FIELDS } from '../utils/headerFooter';
import { linesPerPageFor } from '../engine/paginate';
import './ProductionDialogs.css';
import './WritingDialogs.css';
import './DocumentDialogs.css';

interface DialogProps {
  onClose: () => void;
}

// Our own highlight palette
const HIGHLIGHT_COLORS = ['#f5c542', '#4a9eff', '#ff7a7a', '#5fd38d', '#b48cff', '#ff9f43', '#2ec4b6', '#f472b6'];

export const HighlightCharactersDialog = ({ onClose }: DialogProps) => {
  const { screenplay, setCharacterHighlights } = useScreenplayStore(
    useShallow((s) => ({ screenplay: s.screenplay, setCharacterHighlights: s.setCharacterHighlights }))
  );
  const characters = useMemo(() => listCharacters(screenplay), [screenplay]);
  const highlights = screenplay.characterHighlights ?? {};
  const set = (name: string, color: string | null) => {
    const next = { ...highlights };
    if (color) next[name] = color; else delete next[name];
    setCharacterHighlights(next);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Highlight Characters</h3>
        <div className="revisions-table-wrap highlight-list">
          {characters.length === 0 && <p className="dialog-empty">No speaking characters yet.</p>}
          {characters.map((name, i) => (
            <div key={name} className="highlight-row">
              <label className="production-check">
                <input type="checkbox" checked={!!highlights[name]}
                  onChange={(e) => set(name, e.target.checked ? HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length] : null)} />
                {name}
              </label>
              {highlights[name] && (
                <input type="color" value={highlights[name]} aria-label={`${name} color`} onChange={(e) => set(name, e.target.value)} />
              )}
            </div>
          ))}
        </div>
        <div className="modal-buttons">
          <button onClick={() => setCharacterHighlights(Object.fromEntries(characters.map((c, i) => [c, HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length]])))}>Display All</button>
          <button onClick={() => setCharacterHighlights({})}>Clear</button>
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export const RenameCharacterDialog = ({ onClose }: DialogProps) => {
  const { screenplay, renameCharacter } = useScreenplayStore(
    useShallow((s) => ({ screenplay: s.screenplay, renameCharacter: s.renameCharacter }))
  );
  const characters = useMemo(() => listCharacters(screenplay), [screenplay]);
  const [from, setFrom] = useState(characters[0] ?? '');
  const [to, setTo] = useState('');
  const [alsoInText, setAlsoInText] = useState(true);
  const [message, setMessage] = useState('');
  const rename = () => {
    const count = renameCharacter(from, to, alsoInText);
    setMessage(count ? `Renamed in ${count} paragraph${count === 1 ? '' : 's'}.` : 'Nothing to rename.');
    if (count) setTo('');
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Rename Character</h3>
        <label className="production-field">
          Character to Rename:
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {characters.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="production-field">
          Rename to:
          <input type="text" value={to} onChange={(e) => setTo(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && rename()} autoFocus />
        </label>
        <label className="production-check">
          <input type="checkbox" checked={alsoInText} onChange={(e) => setAlsoInText(e.target.checked)} />
          Also change the name in action and dialogue
        </label>
        {message && <p className="dialog-hint" aria-live="polite">{message}</p>}
        <div className="modal-buttons">
          <button onClick={onClose}>Close</button>
          <button className="primary" disabled={!from || !to.trim()} onClick={rename}>Rename</button>
        </div>
      </div>
    </div>
  );
};

export const PageLayoutDialog = ({ onClose }: DialogProps) => {
  const { pageLayout, setPageLayout } = useScreenplayStore(
    useShallow((s) => ({ pageLayout: s.screenplay.pageLayout, setPageLayout: s.setPageLayout }))
  );
  const [draft, setDraft] = useState<PageLayoutSettings>(pageLayout ?? createDefaultPageLayout());
  const [tab, setTab] = useState<'margins' | 'options'>('margins');
  const inches = (key: keyof PageLayoutSettings, label: string, min: number, max: number) => (
    <label className="production-field">
      {label}
      <input type="number" min={min} max={max} step={0.05} value={draft[key] as number}
        onChange={(e) => setDraft({ ...draft, [key]: Math.min(max, Math.max(min, parseFloat(e.target.value) || min)) })} />
      in
    </label>
  );
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Page Layout</h3>
        <div className="find-tabs dialog-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'margins'} className={tab === 'margins' ? 'active' : ''} onClick={() => setTab('margins')}>Margins</button>
          <button role="tab" aria-selected={tab === 'options'} className={tab === 'options' ? 'active' : ''} onClick={() => setTab('options')}>Options</button>
        </div>
        {tab === 'margins' ? (
          <>
            <p className="dialog-hint">Paper: US Letter, 8.5 × 11 in.</p>
            <h4 className="dialog-group">Text Margins</h4>
            {inches('topMargin', 'Top:', 0.5, 2)}
            {inches('bottomMargin', 'Bottom:', 0.5, 2)}
            <h4 className="dialog-group">Header/Footer Margins</h4>
            {inches('headerMargin', 'Header:', 0.25, 1)}
            {inches('footerMargin', 'Footer:', 0.25, 1)}
          </>
        ) : (
          <>
            <label className="production-field">
              Line Spacing:
              <select value={draft.lineSpacing} onChange={(e) => setDraft({ ...draft, lineSpacing: e.target.value as LineSpacing })}>
                <option value="veryTight">Very Tight</option>
                <option value="tight">Tight</option>
                <option value="normal">Normal</option>
                <option value="loose">Loose</option>
              </select>
            </label>
            <label className="production-check">
              <input type="checkbox" checked={draft.breakAtSentences} onChange={(e) => setDraft({ ...draft, breakAtSentences: e.target.checked })} />
              Break dialogue and action at sentences
            </label>
          </>
        )}
        <p className="dialog-hint">{linesPerPageFor(draft)} lines per page.</p>
        <div className="modal-buttons">
          <button onClick={() => setDraft(createDefaultPageLayout())}>Defaults</button>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => { setPageLayout(draft); onClose(); }}>OK</button>
        </div>
      </div>
    </div>
  );
};

export const HeaderFooterDialog = ({ onClose }: DialogProps) => {
  const { screenplay, setHeaderFooter } = useScreenplayStore(
    useShallow((s) => ({ screenplay: s.screenplay, setHeaderFooter: s.setHeaderFooter }))
  );
  const [draft, setDraft] = useState<HeaderFooterSettings>(getHeaderFooter(screenplay));
  const [tab, setTab] = useState<'header' | 'footer' | 'options'>('header');
  const [focus, setFocus] = useState<keyof HeaderFooterLine>('right');
  const line = tab === 'footer' ? draft.footer : draft.header;
  const setLine = (changes: Partial<HeaderFooterLine>) =>
    setDraft(tab === 'footer' ? { ...draft, footer: { ...draft.footer, ...changes } } : { ...draft, header: { ...draft.header, ...changes } });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog header-footer-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Header and Footer</h3>
        <div className="find-tabs dialog-tabs" role="tablist">
          {(['header', 'footer', 'options'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'header' ? 'Header' : t === 'footer' ? 'Footer' : 'Options'}
            </button>
          ))}
        </div>
        {tab !== 'options' ? (
          <>
            <div className="hf-line">
              {(['left', 'center', 'right'] as const).map((pos) => (
                <label key={pos}>
                  {pos === 'left' ? 'Left' : pos === 'center' ? 'Center' : 'Right'}
                  <input type="text" value={line[pos]} onFocus={() => setFocus(pos)} onChange={(e) => setLine({ [pos]: e.target.value })} />
                </label>
              ))}
            </div>
            <div className="hf-insert">
              Insert:
              {HEADER_FIELDS.map((f) => (
                <button key={f} onClick={() => setLine({ [focus]: `${line[focus]}{${f}}` })}>{f === 'Revision' ? 'Active Revision' : f === 'File' ? 'File Name' : f}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label className="production-check"><input type="checkbox" checked={draft.showHeader} onChange={(e) => setDraft({ ...draft, showHeader: e.target.checked })} /> Show Header</label>
            <label className="production-check"><input type="checkbox" checked={draft.headerOnFirstPage} onChange={(e) => setDraft({ ...draft, headerOnFirstPage: e.target.checked })} /> Show Header on first page</label>
            <label className="production-check"><input type="checkbox" checked={draft.showFooter} onChange={(e) => setDraft({ ...draft, showFooter: e.target.checked })} /> Show Footer</label>
            <label className="production-check"><input type="checkbox" checked={draft.footerOnFirstPage} onChange={(e) => setDraft({ ...draft, footerOnFirstPage: e.target.checked })} /> Show Footer on first page</label>
            <label className="production-field">
              Starting page number:
              <input type="number" min={1} value={draft.startingPage} onChange={(e) => setDraft({ ...draft, startingPage: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
            </label>
            {screenplay.lockedPages && <p className="dialog-hint">Pages are locked, so locked page numbers are kept.</p>}
          </>
        )}
        <div className="modal-buttons">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => { setHeaderFooter(draft); onClose(); }}>OK</button>
        </div>
      </div>
    </div>
  );
};
