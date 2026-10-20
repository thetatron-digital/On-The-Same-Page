// View > Scene View and View > Index Cards – Script / Summary (Final Draft's
// scene panes). Both read scene properties; Index Cards edit them and can be
// dragged to reorder scenes.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../store/screenplayStore';
import { SCENE_COLORS } from '../types/screenplay';
import type { PanelView } from '../store/types';
import { formatEighths, scenesOf } from '../utils/reports';
import { sceneRanges } from '../engine/scenes';
import { goToElement } from './writingActions';
import './SceneViews.css';

const VIEW_NAMES: Record<PanelView, string> = {
  script: 'Script',
  sceneView: 'Scene View',
  cardsScript: 'Index Cards – Script',
  cardsSummary: 'Index Cards – Summary',
};

// Scenes with their properties, first action and a short script excerpt
const useSceneCards = () => {
  const screenplay = useScreenplayStore((s) => s.screenplay);
  return useMemo(() => {
    const info = scenesOf(screenplay);
    return sceneRanges(screenplay.elements).map((range, i) => {
      const els = screenplay.elements.slice(range.start, range.end);
      const heading = els[0];
      const body = els.slice(1).filter((el) => !el.outline);
      const textOf = (el: (typeof els)[number]) => el.content.map((r) => r.text).join('');
      return {
        id: heading.id,
        index: i,
        number: info[i]?.number ?? String(i + 1),
        heading: textOf(heading),
        page: info[i]?.page ?? '',
        length: info[i] ? (info[i].omitted ? 'OMITTED' : formatEighths(info[i].eighths)) : '',
        props: heading.scene ?? {},
        action: textOf(body.find((el) => el.type === 'Action') ?? { ...heading, content: [] }),
        excerpt: body.map((el) => (el.type === 'Character' ? `${textOf(el)}:` : textOf(el))).join(' ').slice(0, 420),
      };
    });
  }, [screenplay]);
};

// Opens a scene in the script, wherever the script is showing
const openInScript = (id: string) => {
  const { panelLayout, setPanelLayout } = useScreenplayStore.getState();
  const scriptShowing = panelLayout.primary === 'script' || (panelLayout.split !== 'none' && panelLayout.secondary === 'script');
  if (!scriptShowing) setPanelLayout({ primary: 'script' });
  setTimeout(() => goToElement(id), scriptShowing ? 0 : 50);
};

const SceneView = () => {
  const cards = useSceneCards();
  const shows = useScreenplayStore((s) => s.panelLayout.sceneViewShows);
  return (
    <div className="scene-view" role="list">
      {cards.length === 0 && <div className="scene-views-empty">No scenes yet.</div>}
      {cards.map((c) => (
        <div key={c.id} className="scene-row" role="listitem" onDoubleClick={() => openInScript(c.id)}>
          <span className="scene-row-color" style={{ background: c.props.color ? SCENE_COLORS[c.props.color] : 'transparent' }} />
          <span className="scene-row-number">{c.number}</span>
          <div className="scene-row-main">
            <div className="scene-row-heading">{c.heading}</div>
            {shows.title && c.props.title && <div className="scene-row-title">{c.props.title}</div>}
            {shows.summary && c.props.summary && <div className="scene-row-summary">{c.props.summary}</div>}
            {shows.action && c.action && <div className="scene-row-action">{c.action}</div>}
          </div>
          <span className="scene-row-page">p. {c.page}<br />{c.length}</span>
        </div>
      ))}
    </div>
  );
};

const IndexCards = ({ mode }: { mode: 'script' | 'summary' }) => {
  const cards = useSceneCards();
  const { cardsAcross, setSceneProperties, moveScene } = useScreenplayStore(
    useShallow((s) => ({ cardsAcross: s.panelLayout.cardsAcross, setSceneProperties: s.setSceneProperties, moveScene: s.moveScene }))
  );
  const [dragging, setDragging] = useState<number | null>(null);
  return (
    <div className="index-cards" style={{ gridTemplateColumns: `repeat(${cardsAcross}, minmax(0, 1fr))` }} role="list">
      {cards.length === 0 && <div className="scene-views-empty">No scenes yet.</div>}
      {cards.map((c) => (
        <div
          key={c.id}
          className={`index-card ${dragging === c.index ? 'dragging' : ''}`}
          role="listitem"
          draggable
          onDragStart={(e) => { setDragging(c.index); e.dataTransfer.effectAllowed = 'move'; }}
          onDragEnd={() => setDragging(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (dragging !== null) moveScene(dragging, c.index); setDragging(null); }}
          style={{ borderTopColor: c.props.color ? SCENE_COLORS[c.props.color] : undefined }}
        >
          <div className="index-card-head" onDoubleClick={() => openInScript(c.id)} title="Double-click to open in the script">
            <span className="index-card-number">{c.number}</span> {c.heading}
          </div>
          {mode === 'summary' ? (
            <>
              <input
                className="index-card-title"
                placeholder="Title"
                value={c.props.title ?? ''}
                onChange={(e) => setSceneProperties(c.id, { title: e.target.value })}
              />
              <textarea
                className="index-card-summary"
                placeholder="Summary"
                value={c.props.summary ?? ''}
                onChange={(e) => setSceneProperties(c.id, { summary: e.target.value })}
              />
            </>
          ) : (
            <div className="index-card-excerpt">{c.excerpt}</div>
          )}
          <div className="index-card-foot">p. {c.page} · {c.length}</div>
        </div>
      ))}
    </div>
  );
};

// A non-script panel, with a picker for its view
export const ScenePanel = ({ view, slot }: { view: PanelView; slot: 'primary' | 'secondary' }) => {
  const { panelLayout, setPanelLayout } = useScreenplayStore(
    useShallow((s) => ({ panelLayout: s.panelLayout, setPanelLayout: s.setPanelLayout }))
  );
  const otherIsScript = (slot === 'primary' ? panelLayout.secondary : panelLayout.primary) === 'script' && panelLayout.split !== 'none';
  return (
    <div className="scene-panel">
      <div className="scene-panel-bar">
        <select
          value={view}
          aria-label="Panel view"
          onChange={(e) => setPanelLayout({ [slot]: e.target.value as PanelView })}
        >
          {(Object.keys(VIEW_NAMES) as PanelView[])
            .filter((v) => !(v === 'script' && otherIsScript))
            .map((v) => <option key={v} value={v}>{VIEW_NAMES[v]}</option>)}
        </select>
        {view !== 'sceneView' && (
          <label>
            Cards Across
            <select value={panelLayout.cardsAcross} onChange={(e) => setPanelLayout({ cardsAcross: +e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        {view === 'sceneView' && (['title', 'summary', 'action'] as const).map((field) => (
          <label key={field}>
            <input
              type="checkbox"
              checked={panelLayout.sceneViewShows[field]}
              onChange={(e) => setPanelLayout({ sceneViewShows: { ...panelLayout.sceneViewShows, [field]: e.target.checked } })}
            />
            {field === 'title' ? 'Scene Title' : field === 'summary' ? 'Summary' : 'Action'}
          </label>
        ))}
      </div>
      {view === 'sceneView' ? <SceneView /> : <IndexCards mode={view === 'cardsScript' ? 'script' : 'summary'} />}
    </div>
  );
};
