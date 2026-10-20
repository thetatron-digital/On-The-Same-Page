// ViewFinder Storyboard: a Storyboarder-style board editor per scene.
// Board strip, drawing canvas, board metadata, the scene's script lines,
// Storyboarder's single-key shortcuts, timeline mode, animatic playback and
// exports (PDF, GIF, video, editing-app timelines).
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
import { audioDurationMs, effectiveDurationMs, exportGif, exportVideo, fitImageToBoard, readFileAsDataUrl, renderBoardPng, supportedVideoType } from './storyboardMedia';
import { buildTimeline, editorPackage } from './editorExport';
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
      shots: st.viewFinder?.shots,
      addShot: st.addShot,
      updateShot: st.updateShot,
    }))
  );
  const scenes = useMemo(() => generateBreakdownScenes(s.elements), [s.elements]);
  const sceneId = s.selectedSceneId && scenes.some((sc) => sc.id === s.selectedSceneId) ? s.selectedSceneId : scenes[0]?.id ?? null;
  const scene = scenes.find((sc) => sc.id === sceneId);
  const storyboard = s.viewFinder?.storyboards.find((sb) => sb.sceneId === sceneId);
  const frames = useMemo(() => storyboard?.frames ?? [], [storyboard]);
  const defaultMs = storyboard?.defaultBoardTimingMs ?? DEFAULT_MS;
  // Board length in the animatic includes its audio (as Storyboarder)
  const positions = useMemo(
    () => boardPositions(frames.map((f) => ({ newShot: f.newShot, durationMs: effectiveDurationMs(f, defaultMs) })), defaultMs),
    [frames, defaultMs]
  );

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
  const [guides, setGuides] = useState({ grid: false, center: false, thirds: false });
  const [captions, setCaptions] = useState(false);
  const [busy, setBusy] = useState<{ label: string; progress: number } | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  // Timeline mode: board widths follow their durations; drag an edge to retime
  const [timelineMode, setTimelineMode] = useState(false);
  const [pxPerSecond, setPxPerSecond] = useState(60);
  const [retime, setRetime] = useState<{ id: string; startX: number; startMs: number; ms: number } | null>(null);
  const retimeRef = useRef(retime); // pointer events can outrun renders
  const setRetimeDrag = (next: typeof retime) => { retimeRef.current = next; setRetime(next); };

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

  // Board audio during the animatic
  useEffect(() => {
    playerRef.current?.pause();
    if (!playing) return;
    const clip = frames[playIndex]?.audio?.dataUrl;
    if (!clip) return;
    const audio = new Audio(clip);
    playerRef.current = audio;
    void audio.play().catch(() => {});
    return () => audio.pause();
  }, [playing, playIndex, frames]);

  // Storyboarder's single-key commands
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const t = TOOLS.find((x) => x.key === e.key);
      if (t && !mod && !e.altKey) { setToolId(t.id); if (t.layer && t.id !== 'eraser') setEraseLayer(t.layer); return; }
      if (mod && e.altKey && e.code === 'KeyT') { e.preventDefault(); setTimelineMode((m) => !m); return; }
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
      else if (e.key === 'c') setCaptions((c) => !c);
      else if (e.key === ']') setSizes((sz) => ({ ...sz, [toolId]: Math.min(256, Math.round(sz[toolId] * 1.2) + 1) }));
      else if (e.key === '[') setSizes((sz) => ({ ...sz, [toolId]: Math.max(1, Math.round(sz[toolId] * 0.8)) }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const fileBase = `Storyboard_Scene_${scene?.sceneNumber ?? ''}`;

  const importImageToReference = async (file: File) => {
    const fitted = await fitImageToBoard(await readFileAsDataUrl(file), BOARD_W, BOARD_H);
    canvasRef.current?.replaceLayer('reference', fitted);
  };

  const importImagesAsBoards = async (files: File[]) => {
    const id = ensureStoryboard();
    if (!id) return;
    let at = frames.length ? index + 1 : 0;
    for (const file of files) {
      const fitted = await fitImageToBoard(await readFileAsDataUrl(file), BOARD_W, BOARD_H);
      s.insertFrame(id, at, blankFrame({ layers: { reference: fitted }, referenceOpacity: 1, image: fitted }));
      at++;
    }
    setBoardIndex(at - 1);
  };

  const setAudio = async (dataUrl: string, name: string) => {
    update({ audio: { dataUrl, name, durationMs: await audioDurationMs(dataUrl) } });
  };

  const toggleRecording = async () => {
    if (recorder) { recorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecorder(null);
        const blob = new Blob(chunks, { type: rec.mimeType });
        await setAudio(await readFileAsDataUrl(blob), `Recording ${new Date().toLocaleTimeString()}`);
      };
      rec.start();
      setRecorder(rec);
    } catch {
      alert('Microphone access is needed to record board audio.');
    }
  };

  const runExport = async (kind: 'gif' | 'video' | 'editor') => {
    try {
      if (kind === 'editor') {
        setBusy({ label: 'Packing boards for editing…', progress: 0 });
        const fps = storyboard?.fps ?? 24;
        const name = `${s.title || 'Untitled'} - Scene ${scene?.sceneNumber ?? ''}`;
        const timeline = buildTimeline(frames, positions, { name, fps, width: BOARD_W, height: BOARD_H });
        let done = 0;
        const blob = await editorPackage(frames, timeline, async (f) => {
          const png = await renderBoardPng(f, LAYERS, BOARD_W, BOARD_H);
          setBusy({ label: 'Packing boards for editing…', progress: ++done / frames.length });
          return png;
        });
        download(blob, `${fileBase}_Edit.zip`);
      } else if (kind === 'gif') {
        setBusy({ label: 'Making GIF…', progress: 0 });
        download(await exportGif(frames, positions), `${fileBase}.gif`);
      } else {
        setBusy({ label: 'Recording the animatic…', progress: 0 });
        const { blob, extension } = await exportVideo(frames, positions, (progress) => setBusy({ label: 'Recording the animatic…', progress }));
        download(blob, `${fileBase}.${extension}`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  // One ViewFinder shot per storyboard shot (boards that share a shot number)
  const sendToShotList = () => {
    if (!storyboard || !scene) return;
    const groups = new Map<string, number[]>();
    positions.forEach((p, i) => {
      const shotNumber = p.shot.replace(/[A-Z]\d*$/, '');
      groups.set(shotNumber, [...(groups.get(shotNumber) ?? []), i]);
    });
    let created = 0;
    let updated = 0;
    for (const [shotNumber, indexes] of groups) {
      const first = frames[indexes[0]];
      const text = indexes.map((i) => frames[i]);
      const fields = {
        description: first.actionNotes || first.dialogue || `Storyboard shot ${shotNumber}`,
        actionDescription: text.map((f) => f.actionNotes).filter(Boolean).join(' '),
        dialogueReference: text.map((f) => f.dialogue).filter(Boolean).join(' / '),
        storyboardFrame: first.image,
        storyboardNotes: text.map((f) => f.notes).filter(Boolean).join(' '),
        duration: Math.round(indexes.reduce((sum, i) => sum + positions[i].durationMs, 0) / 1000),
      };
      const existing = first.shotId && s.shots?.find((sh) => sh.id === first.shotId);
      let shotId: string;
      if (existing) {
        s.updateShot(existing.id, fields);
        shotId = existing.id;
        updated++;
      } else {
        shotId = s.addShot({
          sceneId: scene.id, sceneNumber: scene.sceneNumber, shotNumber,
          size: 'MS', angle: 'Eye Level', movement: 'Static', subject: '', equipment: {},
          status: 'Storyboarded', priority: Number(shotNumber) || 0, ...fields,
        });
        created++;
      }
      indexes.forEach((i) => frames[i].shotId !== shotId && s.updateFrame(storyboard.id, frames[i].id, { shotId }));
    }
    alert(`Shot list updated: ${created} shot${created === 1 ? '' : 's'} added, ${updated} updated.`);
  };

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
          <button className="sb-btn" disabled={!frames.length || !!busy} onClick={() => runExport('gif')}>Export GIF</button>
          <button className="sb-btn" disabled={!frames.length || !!busy || !supportedVideoType()} onClick={() => runExport('video')} title="Records the animatic with board audio in real time">Export Video</button>
          <button className="sb-btn" disabled={!frames.length || !!busy} onClick={() => runExport('editor')} title="ZIP with board images, audio and a timeline for Premiere Pro, DaVinci Resolve and Final Cut Pro">Export for Editing</button>
          <button className="sb-btn" disabled={!frames.length} onClick={sendToShotList} title="Create or update ViewFinder shots from these boards">Send to Shot List</button>
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
          <button className={`sb-tool ${captions ? 'active' : ''}`} onClick={() => setCaptions(!captions)} title="Show dialogue on the board (C)">Captions</button>
          {(['grid', 'center', 'thirds'] as const).map((g) => (
            <button key={g} className={`sb-tool ${guides[g] ? 'active' : ''}`} onClick={() => setGuides({ ...guides, [g]: !guides[g] })}>
              {g === 'grid' ? 'Grid' : g === 'center' ? 'Center' : 'Thirds'}
            </button>
          ))}
          <label className={`sb-tool ${frame ? '' : 'disabled'}`} title="Put an image on this board's reference layer">
            Image → Reference
            <input type="file" accept="image/*" hidden disabled={!frame} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importImageToReference(f); }} />
          </label>
          <label className="sb-tool" title="Each image becomes a new board">
            Images → New Boards
            <input type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) void importImagesAsBoards(fs); }} />
          </label>
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
              guides={guides}
              caption={captions ? frame.dialogue : undefined}
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
              <div className="sb-audio">
                <span>Audio</span>
                {frame.audio ? (
                  <>
                    <audio controls src={frame.audio.dataUrl} />
                    <span className="sb-muted">{frame.audio.name} · {formatTime(frame.audio.durationMs)}</span>
                    <button className="sb-btn small" onClick={() => update({ audio: undefined })}>Remove Audio</button>
                  </>
                ) : (
                  <span className="sb-row">
                    <label className="sb-btn small">
                      Add File…
                      <input type="file" accept="audio/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await setAudio(await readFileAsDataUrl(f), f.name); }} />
                    </label>
                    <button className={`sb-btn small ${recorder ? 'sb-recording' : ''}`} onClick={toggleRecording}>{recorder ? '■ Stop Recording' : '● Record'}</button>
                  </span>
                )}
              </div>
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

      {busy && (
        <div className="sb-progress">
          <span>{busy.label}</span>
          <div className="sb-progress-bar"><span style={{ width: `${Math.round(busy.progress * 100)}%` }} /></div>
        </div>
      )}

      <div className="sb-strip">
        <div className="sb-strip-actions">
          <button className="sb-btn" onClick={() => addBoard(frames.length ? index + 1 : 0)} title="New board after (N); before: Shift+N">+ Board</button>
          <button className="sb-btn" disabled={!frame} onClick={duplicate} title="Duplicate (D)">Duplicate</button>
          <button className="sb-btn" disabled={!frame || index === 0} onClick={() => move(-1)} title="Move left (Alt+←)">◀</button>
          <button className="sb-btn" disabled={!frame || index >= frames.length - 1} onClick={() => move(1)} title="Move right (Alt+→)">▶</button>
          <button className="sb-btn" disabled={!frame} onClick={remove} title="Delete (Cmd/Ctrl+Backspace)">Delete</button>
        </div>
        <div className={`sb-thumbs ${timelineMode ? 'timeline' : ''}`}>
          {frames.map((f, i) => {
            const ms = retime?.id === f.id ? Math.max(retime.ms, f.audio?.durationMs ?? 0) : positions[i].durationMs;
            return (
              <div key={f.id} className="sb-thumb-wrap" style={timelineMode ? { width: Math.max(24, (ms / 1000) * pxPerSecond) } : undefined}>
                <button className={`sb-thumb ${i === index ? 'active' : ''} ${f.newShot ? 'new-shot' : ''} ${playing && i === playIndex ? 'playing' : ''}`} onClick={() => setBoardIndex(i)}>
                  {f.image ? <img src={f.image} alt="" /> : <span className="sb-thumb-blank" />}
                  <span className="sb-thumb-label">{positions[i].shot} · {formatTime(ms)}</span>
                  {timelineMode && f.audio && (
                    <span className="sb-thumb-audio" style={{ width: `${Math.min(100, (f.audio.durationMs / ms) * 100)}%` }} title={f.audio.name} />
                  )}
                </button>
                {timelineMode && (
                  <span
                    className="sb-retime"
                    role="separator"
                    aria-label={`Drag to change the length of board ${positions[i].number}`}
                    title={f.audio && f.audio.durationMs >= ms ? 'Board length follows its audio' : 'Drag to change the board length'}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      (e.target as Element).setPointerCapture(e.pointerId);
                      const startMs = f.durationMs && f.durationMs > 0 ? f.durationMs : defaultMs;
                      setRetimeDrag({ id: f.id, startX: e.clientX, startMs, ms: startMs });
                    }}
                    onPointerMove={(e) => {
                      const drag = retimeRef.current;
                      if (drag?.id !== f.id) return;
                      const next = Math.max(100, Math.round((drag.startMs + ((e.clientX - drag.startX) / pxPerSecond) * 1000) / 100) * 100);
                      if (next !== drag.ms) setRetimeDrag({ ...drag, ms: next });
                    }}
                    onPointerUp={() => {
                      const drag = retimeRef.current;
                      if (drag?.id !== f.id) return;
                      if (storyboard && drag.ms !== drag.startMs) s.updateFrame(storyboard.id, f.id, { durationMs: drag.ms });
                      setRetimeDrag(null);
                    }}
                    onPointerCancel={() => setRetimeDrag(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="sb-strip-mode">
          <button className={`sb-btn ${timelineMode ? 'sb-primary' : ''}`} onClick={() => setTimelineMode(!timelineMode)} title="Timeline mode (Cmd/Ctrl+Alt+T)">Timeline</button>
          {timelineMode && (
            <label className="sb-tool-field" title="Timeline zoom">Zoom
              <input type="range" min={15} max={240} value={pxPerSecond} onChange={(e) => setPxPerSecond(Number(e.target.value))} />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
