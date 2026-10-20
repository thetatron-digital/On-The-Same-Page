// ViewFinder Storyboard: a Storyboarder-style board editor per scene.
// Board strip, drawing canvas, board metadata, the scene's script lines,
// Storyboarder's single-key shortcuts, animatic playback and PDF export.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import type { StoryboardFrame, StoryboardLayer } from '../../types/screenplay';
import { generateBreakdownScenes } from '../../utils/breakdown';
import { getPlainText } from '../../utils/fdx';
import { boardAtTime, boardPositions, formatTime, suggestDurationMs } from '../../engine/storyboard/boards';
import { StoryboardCanvas, type StoryboardCanvasHandle } from './StoryboardCanvas';
import { LAYERS, TOOLS, type ToolId } from './storyboardTools';
import { storyboardPdf } from './storyboardPdf';
import './Storyboard.css';

const BOARD_W = 1280;
const BOARD_H = 720;
const DEFAULT_MS = 2000;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const blankFrame = (extra: Partial<StoryboardFrame> = {}): Omit<StoryboardFrame, 'id' | 'order'> => ({ description: '', layers: {}, ...extra });

export function StoryboardEditor({ onClose }: { onClose: () => void }) {
  const s = useScreenplayStore(
    useShallow((st) => ({
      elements: st.screenplay.elements,
      title: st.screenplay.title,
      viewFinder: st.viewFinder,
      selectedSceneId: st.selectedViewFinderSceneId,
      selectScene: st.selectViewFinderScene,
      createStoryboard: st.createStoryboard,
      insertFrame: st.insertStoryboardFrame,
      updateFrame: st.updateStoryboardFrame,
      deleteFrame: st.deleteStoryboardFrame,
      reorderFrames: st.reorderStoryboardFrames,
    }))
  );
  const scenes = useMemo(() => generateBreakdownScenes(s.elements), [s.elements]);
  const sceneId = s.selectedSceneId && scenes.some((sc) => sc.id === s.selectedSceneId) ? s.selectedSceneId : scenes[0]?.id ?? null;
  const scene = scenes.find((sc) => sc.id === sceneId);
  const storyboard = s.viewFinder?.storyboards.find((sb) => sb.sceneId === sceneId);
  const frames = useMemo(() => storyboard?.frames ?? [], [storyboard]);
  const defaultMs = storyboard?.defaultBoardTimingMs ?? DEFAULT_MS;
  const positions = useMemo(() => boardPositions(frames, defaultMs), [frames, defaultMs]);

  const [boardIndex, setBoardIndex] = useState(0);
  const index = Math.min(boardIndex, Math.max(0, frames.length - 1));
  const frame = frames[index];

  const [toolId, setToolId] = useState<ToolId>('pencil');
  const tool = TOOLS.find((t) => t.id === toolId)!;
  const [sizes, setSizes] = useState<Record<ToolId, number>>(() => Object.fromEntries(TOOLS.map((t) => [t.id, t.size])) as Record<ToolId, number>);
  const [colors, setColors] = useState<Record<ToolId, string>>(() => Object.fromEntries(TOOLS.map((t) => [t.id, t.color])) as Record<ToolId, string>);
  const [eraseLayer, setEraseLayer] = useState<StoryboardLayer>('pencil');
  const [onionOn, setOnionOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playMs, setPlayMs] = useState(0);
  const canvasRef = useRef<StoryboardCanvasHandle>(null);

  // Script lines of this scene: action and dialogue blocks
  const scriptLines = useMemo(() => {
    if (!scene) return [];
    const start = s.elements.findIndex((e) => e.id === scene.id);
    const lines: { kind: 'action' | 'dialogue'; text: string }[] = [];
    let speaker = '';
    for (let i = start + 1; i < s.elements.length && s.elements[i].type !== 'Scene Heading'; i++) {
      const el = s.elements[i];
      const text = getPlainText(el.content).trim();
      if (!text) continue;
      if (el.type === 'Character') speaker = text.replace(/\s*\(.*\)\s*$/, '');
      else if (el.type === 'Dialogue') lines.push({ kind: 'dialogue', text: `${speaker}: ${text}` });
      else if (el.type === 'Action') lines.push({ kind: 'action', text });
    }
    return lines;
  }, [scene, s.elements]);

  const ensureStoryboard = useCallback(() => {
    if (storyboard) return storyboard.id;
    if (!scene) return null;
    return s.createStoryboard(scene.id, scene.sceneNumber);
  }, [storyboard, scene, s]);

  const addBoard = useCallback((at: number, extra: Partial<StoryboardFrame> = {}) => {
    const id = ensureStoryboard();
    if (!id) return;
    s.insertFrame(id, at, blankFrame(extra));
    setBoardIndex(at);
  }, [ensureStoryboard, s]);

  const update = useCallback((updates: Partial<StoryboardFrame>) => {
    if (storyboard && frame) s.updateFrame(storyboard.id, frame.id, updates);
  }, [storyboard, frame, s]);

  const duplicate = () => {
    if (!storyboard || !frame) return;
    const { id: _id, order: _order, ...copy } = frame;
    s.insertFrame(storyboard.id, index + 1, { ...copy, newShot: false });
    setBoardIndex(index + 1);
  };
  const remove = () => {
    if (!storyboard || !frame) return;
    s.deleteFrame(storyboard.id, frame.id);
    setBoardIndex(Math.max(0, index - 1));
  };
  const move = (delta: number) => {
    if (!storyboard || !frame) return;
    const to = index + delta;
    if (to < 0 || to >= frames.length) return;
    const ids = frames.map((f) => f.id);
    ids.splice(index, 1);
    ids.splice(to, 0, frame.id);
    s.reorderFrames(storyboard.id, ids);
    setBoardIndex(to);
  };

  // Keep the board's thumbnail (composite) in step with its layers
  useEffect(() => {
    if (!frame || !storyboard) return;
    const timer = setTimeout(() => {
      const image = canvasRef.current?.composite('image/jpeg', 0.5);
      if (image && image !== frame.image) s.updateFrame(storyboard.id, frame.id, { image });
    }, 400);
    return () => clearTimeout(timer);
    // only when this board's drawing changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.id, frame?.layers, frame?.referenceOpacity]);

  // Animatic playback
  useEffect(() => {
    if (!playing) return;
    const total = positions.reduce((sum, p) => sum + p.durationMs, 0);
    const startedAt = performance.now() - playMs;
    let raf = 0;
    const tick = () => {
      const t = performance.now() - startedAt;
      if (t >= total) { setPlaying(false); setPlayMs(0); return; }
      setPlayMs(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  const playIndex = boardAtTime(positions, playMs);

  // Storyboarder's single-key commands
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const t = TOOLS.find((x) => x.key === e.key);
      if (t && !mod && !e.altKey) { setToolId(t.id); if (t.layer && t.id !== 'eraser') setEraseLayer(t.layer); return; }
      if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); return; }
      if (e.key === 'Escape') { setPlaying(false); setPlayMs(0); return; }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); canvasRef.current?.undo(); return; }
      if (mod && e.key === 'Backspace') { e.preventDefault(); remove(); return; }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); move(-1); return; }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); move(1); return; }
      if (e.key === 'ArrowLeft') { setBoardIndex(Math.max(0, index - 1)); return; }
      if (e.key === 'ArrowRight') { setBoardIndex(Math.min(frames.length - 1, index + 1)); return; }
      if (mod || e.altKey) return;
      if (e.key === 'n') addBoard(index + 1);
      else if (e.key === 'N') addBoard(index);
      else if (e.key === 'd') duplicate();
      else if (e.key === '/') update({ newShot: !frame?.newShot });
      else if (e.key === 'o') setOnionOn((o) => !o);
      else if (e.key === ']') setSizes((sz) => ({ ...sz, [toolId]: Math.min(256, Math.round(sz[toolId] * 1.2) + 1) }));
      else if (e.key === '[') setSizes((sz) => ({ ...sz, [toolId]: Math.max(1, Math.round(sz[toolId] * 0.8)) }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const exportPdf = () => {
    if (!storyboard || !scene) return;
    const doc = storyboardPdf(frames, positions, { title: s.title || 'Untitled', scene: `Scene ${scene.sceneNumber}: ${scene.intExt}. ${scene.location} - ${scene.timeOfDay}` });
    const url = URL.createObjectURL(doc.output('blob'));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Storyboard_Scene_${scene.sceneNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (scenes.length === 0) {
    return (
      <div className="sb-editor">
        <div className="sb-header"><button className="sb-btn" onClick={onClose}>← Shot List</button><h2>Storyboard</h2></div>
        <div className="sb-empty">Write scenes in ReWriter first. Each scene gets its own storyboard.</div>
      </div>
    );
  }

  const position = positions[index];
  const suggestion = frame ? suggestDurationMs(frame, defaultMs) : defaultMs;

  return (
    <div className="sb-editor">
      <div className="sb-header">
        <button className="sb-btn" onClick={onClose}>← Shot List</button>
        <select className="sb-scene-select" value={sceneId ?? ''} onChange={(e) => { s.selectScene(e.target.value); setBoardIndex(0); }}>
          {scenes.map((sc) => <option key={sc.id} value={sc.id}>{sc.sceneNumber}. {sc.intExt}. {sc.location} - {sc.timeOfDay}</option>)}
        </select>
        <span className="sb-meta">{frames.length} boards · {formatTime(positions.reduce((sum, p) => sum + p.durationMs, 0))}</span>
        <div className="sb-header-actions">
          <button className="sb-btn" disabled={!frames.length} onClick={() => setPlaying((p) => !p)} title="Play the animatic (Space)">{playing ? '■ Stop' : '▶ Play'}</button>
          <button className="sb-btn" disabled={!frames.length} onClick={exportPdf}>Export PDF</button>
        </div>
      </div>

      <div className="sb-body">
        <div className="sb-tools" role="toolbar" aria-label="Drawing tools">
          {TOOLS.map((t) => (
            <button key={t.id} className={`sb-tool ${toolId === t.id ? 'active' : ''}`} title={`${t.label} (${t.key})`}
              onClick={() => { setToolId(t.id); if (t.layer && t.id !== 'eraser') setEraseLayer(t.layer); }}>
              <span className="sb-tool-key">{t.key}</span>{t.label}
            </button>
          ))}
          <label className="sb-tool-field">Size <input type="range" min={1} max={120} value={sizes[toolId]} onChange={(e) => setSizes({ ...sizes, [toolId]: Number(e.target.value) })} /></label>
          {toolId !== 'eraser' && <label className="sb-tool-field">Color <input type="color" value={colors[toolId]} onChange={(e) => setColors({ ...colors, [toolId]: e.target.value })} /></label>}
          {toolId === 'eraser' && (
            <label className="sb-tool-field">Erases
              <select value={eraseLayer} onChange={(e) => setEraseLayer(e.target.value as StoryboardLayer)}>
                {LAYERS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          )}
          <button className={`sb-tool ${onionOn ? 'active' : ''}`} onClick={() => setOnionOn(!onionOn)} title="Onion skin (O)">Onion Skin</button>
          <button className="sb-tool" disabled={!frame} onClick={() => canvasRef.current?.undo()} title="Undo stroke (Cmd/Ctrl+Z)">Undo</button>
          <button className="sb-tool" disabled={!frame} onClick={() => canvasRef.current?.clearLayer(tool.layer ?? eraseLayer)}>Clear Layer</button>
        </div>

        <div className="sb-stage">
          {playing && frames.length ? (
            <div className="sb-play">
              {frames[playIndex]?.image ? <img src={frames[playIndex].image} alt="" /> : <div className="sb-play-blank" />}
              <div className="sb-play-caption">
                <strong>{positions[playIndex].shot}</strong>
                <span>{frames[playIndex]?.dialogue || frames[playIndex]?.actionNotes || ''}</span>
                <span>{formatTime(playMs)}</span>
              </div>
            </div>
          ) : frame ? (
            <StoryboardCanvas
              ref={canvasRef}
              width={BOARD_W}
              height={BOARD_H}
              frameId={frame.id}
              layers={frame.layers ?? {}}
              referenceOpacity={frame.referenceOpacity ?? 0.5}
              tool={tool}
              size={sizes[toolId]}
              color={colors[toolId]}
              eraseLayer={eraseLayer}
              onion={onionOn ? { prev: frames[index - 1]?.image, next: frames[index + 1]?.image } : null}
              onLayerChange={(layer, url) => update({ layers: { ...(frame.layers ?? {}), [layer]: url } })}
            />
          ) : (
            <div className="sb-empty">
              <p>No boards for this scene yet.</p>
              <button className="sb-btn sb-primary" onClick={() => addBoard(0)}>+ New Board (N)</button>
              {scriptLines.length > 0 && (
                <button className="sb-btn" onClick={() => {
                  const id = ensureStoryboard();
                  if (!id) return;
                  scriptLines.forEach((line, i) => s.insertFrame(id, i, blankFrame(
                    line.kind === 'dialogue' ? { dialogue: line.text, newShot: i === 0 } : { actionNotes: line.text, newShot: i === 0 }
                  )));
                  setBoardIndex(0);
                }}>Create a board per script line ({scriptLines.length})</button>
              )}
            </div>
          )}
        </div>

        <aside className="sb-side">
          {frame && position && (
            <div className="sb-board-meta">
              <div className="sb-shot-line"><span className="sb-shot">Shot {position.shot}</span><span>Board {position.number} · {formatTime(position.startMs)}</span></div>
              <label className="sb-check"><input type="checkbox" checked={!!frame.newShot} onChange={(e) => update({ newShot: e.target.checked })} /> New Shot (/)</label>
              <label>Duration (ms)
                <span className="sb-row">
                  <input type="number" min={100} step={100} value={frame.durationMs ?? ''} placeholder={String(defaultMs)} onChange={(e) => update({ durationMs: Number(e.target.value) || undefined })} />
                  {suggestion !== (frame.durationMs ?? defaultMs) && (
                    <button className="sb-btn small" title="Estimated from the dialogue and action" onClick={() => update({ durationMs: suggestion })}>≈ {suggestion}</button>
                  )}
                </span>
              </label>
              <label>Dialogue<textarea value={frame.dialogue ?? ''} onChange={(e) => update({ dialogue: e.target.value })} rows={2} /></label>
              <label>Action<textarea value={frame.actionNotes ?? ''} onChange={(e) => update({ actionNotes: e.target.value })} rows={2} /></label>
              <label>Notes<textarea value={frame.notes ?? ''} onChange={(e) => update({ notes: e.target.value })} rows={2} /></label>
              <label>Reference layer (light box)
                <input type="range" min={0} max={1} step={0.05} value={frame.referenceOpacity ?? 0.5} onChange={(e) => update({ referenceOpacity: Number(e.target.value) })} />
              </label>
            </div>
          )}
          <div className="sb-script">
            <h4>Script</h4>
            {scriptLines.length === 0 && <p className="sb-muted">No action or dialogue in this scene.</p>}
            {scriptLines.map((line, i) => (
              <button key={i} className={`sb-line ${line.kind}`} disabled={!frame} title="Copy into the current board"
                onClick={() => update(line.kind === 'dialogue' ? { dialogue: line.text } : { actionNotes: line.text })}>
                {line.text}
              </button>
            ))}
          </div>
        </aside>
      </div>

      <div className="sb-strip">
        <div className="sb-strip-actions">
          <button className="sb-btn" onClick={() => addBoard(frames.length ? index + 1 : 0)} title="New board after (N); before: Shift+N">+ Board</button>
          <button className="sb-btn" disabled={!frame} onClick={duplicate} title="Duplicate (D)">Duplicate</button>
          <button className="sb-btn" disabled={!frame || index === 0} onClick={() => move(-1)} title="Move left (Alt+←)">◀</button>
          <button className="sb-btn" disabled={!frame || index >= frames.length - 1} onClick={() => move(1)} title="Move right (Alt+→)">▶</button>
          <button className="sb-btn" disabled={!frame} onClick={remove} title="Delete (Cmd/Ctrl+Backspace)">Delete</button>
        </div>
        <div className="sb-thumbs">
          {frames.map((f, i) => (
            <button key={f.id} className={`sb-thumb ${i === index ? 'active' : ''} ${f.newShot ? 'new-shot' : ''}`} onClick={() => setBoardIndex(i)}>
              {f.image ? <img src={f.image} alt="" /> : <span className="sb-thumb-blank" />}
              <span className="sb-thumb-label">{positions[i].shot} · {formatTime(positions[i].durationMs)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
