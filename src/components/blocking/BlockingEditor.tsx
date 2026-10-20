// ViewFinder > Blocking: top-down diagrams of a scene, like Shot Designer:
// set walls, doors and props, actors with numbered marks and moves,
// cameras with lens-accurate field of view (linked to shots), lights.
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useShallow } from 'zustand/react/shallow';
import jsPDF from 'jspdf';
import { useScreenplayStore } from '../../store/screenplayStore';
import type { BlockingItem, BlockingKind } from '../../types/blocking';
import { SENSORS, angleTo, distanceToSegment, fovWedge, horizontalFov, inView, project, snap } from '../../engine/blocking';
import { generateBreakdownScenes } from '../../utils/breakdown';
import { generateId } from '../../utils/fdx';
import './blocking.css';

type Tool = 'select' | BlockingKind | 'mark';
const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'select', label: 'Select', key: 'v' }, { id: 'actor', label: 'Actor', key: 'a' }, { id: 'camera', label: 'Camera', key: 'c' },
  { id: 'light', label: 'Light', key: 'l' }, { id: 'wall', label: 'Wall', key: 'w' }, { id: 'door', label: 'Door', key: 'd' },
  { id: 'window', label: 'Window', key: 'n' }, { id: 'prop', label: 'Prop', key: 'p' },
];
const FOCALS = [14, 18, 21, 24, 28, 32, 35, 40, 50, 65, 75, 85, 100, 135];
const ACTOR_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
const REACH = 7; // metres of camera wedge drawn
const PX = 60;   // pixels per metre at zoom 1

const fovOf = (it: BlockingItem) => horizontalFov(it.focalLength ?? 35, SENSORS[it.sensor ?? 's35']?.width ?? 24.89);

export default function BlockingEditor({ onClose }: { onClose: () => void }) {
  const s = useScreenplayStore(useShallow((st) => ({
    elements: st.screenplay.elements, viewFinder: st.viewFinder, selectedSceneId: st.selectedViewFinderSceneId, selectScene: st.selectViewFinderScene,
    add: st.addBlockingDiagram, update: st.updateBlockingDiagram, remove: st.deleteBlockingDiagram,
  })));
  const scenes = useMemo(() => generateBreakdownScenes(s.elements), [s.elements]);
  const sceneId = s.selectedSceneId && scenes.some((sc) => sc.id === s.selectedSceneId) ? s.selectedSceneId : scenes[0]?.id ?? null;
  const diagrams = (s.viewFinder?.blockingDiagrams ?? []).filter((d) => d.sceneId === sceneId);
  const shots = (s.viewFinder?.shots ?? []).filter((sh) => sh.sceneId === sceneId);
  const [diagramId, setDiagramId] = useState<string | null>(null);
  const diagram = diagrams.find((d) => d.id === diagramId) ?? diagrams[0];

  const [items, setItemsState] = useState<BlockingItem[]>(diagram?.items ?? []);
  // Latest items for pointer handlers (events can outrun renders)
  const itemsRef = useRef(items);
  const setItems = (next: BlockingItem[]) => { itemsRef.current = next; setItemsState(next); };
  const [loadedId, setLoadedId] = useState(diagram?.id);
  if (diagram?.id !== loadedId) { setLoadedId(diagram?.id); setItemsState(diagram?.items ?? []); }
  useEffect(() => { itemsRef.current = items; }, [items]);
  const commit = (next: BlockingItem[]) => { setItems(next); if (diagram) s.update(diagram.id, { items: next }); };

  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState({ x: -6, y: -4, zoom: 1 });
  const [grid, setGrid] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ mode: 'move' | 'rotate' | 'pan' | 'wall' | 'mark'; id?: string; mark?: number; start: { x: number; y: number }; origin: BlockingItem[]; view?: typeof view } | null>(null);
  const selected = items.find((i) => i.id === selectedId);

  const size = { w: 900, h: 600 };
  const vb = { x: view.x, y: view.y, w: size.w / (PX * view.zoom), h: size.h / (PX * view.zoom) };
  const toWorld = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: vb.x + ((e.clientX - r.left) / r.width) * vb.w, y: vb.y + ((e.clientY - r.top) / r.height) * vb.h };
  };

  const place = (kind: BlockingKind, p: { x: number; y: number }): BlockingItem => {
    const count = items.filter((i) => i.kind === kind).length;
    const base = { id: generateId(), kind, x: snap(p.x), y: snap(p.y), rotation: 0 };
    if (kind === 'actor') return { ...base, label: `Actor ${count + 1}`, color: ACTOR_COLORS[count % ACTOR_COLORS.length], path: [] };
    if (kind === 'camera') return { ...base, label: `${String.fromCharCode(65 + count)} Cam`, focalLength: 35, sensor: 's35' };
    if (kind === 'light') return { ...base, label: `Light ${count + 1}`, color: '#FBBF24' };
    if (kind === 'prop') return { ...base, label: 'Table', w: 1.2, h: 0.8 };
    return { ...base, label: kind === 'wall' ? 'Wall' : kind === 'door' ? 'Door' : 'Window', x2: snap(p.x), y2: snap(p.y) };
  };

  const hit = (p: { x: number; y: number }): { id: string; mark?: number } | null => {
    for (const it of [...items].reverse()) {
      if (it.kind === 'actor') {
        const m = (it.path ?? []).findIndex((pt) => Math.hypot(p.x - pt.x, p.y - pt.y) < 0.25);
        if (m >= 0) return { id: it.id, mark: m };
        if (Math.hypot(p.x - it.x, p.y - it.y) < 0.35) return { id: it.id };
      } else if (it.kind === 'camera' || it.kind === 'light') {
        if (Math.hypot(p.x - it.x, p.y - it.y) < 0.4) return { id: it.id };
      } else if (it.kind === 'prop') {
        if (Math.abs(p.x - it.x) <= (it.w ?? 1) / 2 && Math.abs(p.y - it.y) <= (it.h ?? 1) / 2) return { id: it.id };
      } else if (distanceToSegment(p, it, { x: it.x2 ?? it.x, y: it.y2 ?? it.y }) < 0.2) return { id: it.id };
    }
    return null;
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!diagram) return;
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
    const p = toWorld(e);
    const handle = (e.target as Element).getAttribute('data-handle');
    if (handle && selected) { drag.current = { mode: 'rotate', id: selected.id, start: p, origin: items }; return; }
    if (tool === 'mark' && selected?.kind === 'actor') {
      commit(items.map((i) => (i.id === selected.id ? { ...i, path: [...(i.path ?? []), { x: snap(p.x), y: snap(p.y) }] } : i)));
      return;
    }
    if (tool !== 'select' && tool !== 'mark') {
      const it = place(tool, p);
      const next = [...items, it];
      setItems(next);
      setSelectedId(it.id);
      if (tool === 'wall' || tool === 'door' || tool === 'window') drag.current = { mode: 'wall', id: it.id, start: p, origin: next };
      else { commit(next); setTool('select'); }
      return;
    }
    const h = hit(p);
    if (h) {
      setSelectedId(h.id);
      drag.current = { mode: h.mark !== undefined ? 'mark' : 'move', id: h.id, mark: h.mark, start: p, origin: items };
    } else {
      setSelectedId(null);
      drag.current = { mode: 'pan', start: { x: e.clientX, y: e.clientY }, origin: items, view };
    }
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'pan') {
      const r = svgRef.current!.getBoundingClientRect();
      setView({ ...d.view!, x: d.view!.x - ((e.clientX - d.start.x) / r.width) * vb.w, y: d.view!.y - ((e.clientY - d.start.y) / r.height) * vb.h });
      return;
    }
    const p = toWorld(e);
    const dx = snap(p.x - d.start.x), dy = snap(p.y - d.start.y);
    setItems(d.origin.map((it) => {
      if (it.id !== d.id) return it;
      if (d.mode === 'rotate') return { ...it, rotation: Math.round(angleTo(it, p) / 5) * 5 };
      if (d.mode === 'wall') return { ...it, x2: snap(p.x), y2: snap(p.y) };
      if (d.mode === 'mark') return { ...it, path: (it.path ?? []).map((pt, k) => (k === d.mark ? { x: snap(p.x), y: snap(p.y) } : pt)) };
      return {
        ...it, x: it.x + dx, y: it.y + dy,
        ...(it.x2 !== undefined ? { x2: it.x2 + dx, y2: (it.y2 ?? it.y) + dy } : {}),
        ...(it.path ? { path: it.path.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) } : {}),
      };
    }));
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.mode === 'pan') return;
    if (d.mode === 'wall') setTool('select');
    commit(itemsRef.current);
  };

  const updateSelected = (patch: Partial<BlockingItem>) => selected && commit(items.map((i) => (i.id === selected.id ? { ...i, ...patch } : i)));
  const deleteSelected = () => { if (selected) { commit(items.filter((i) => i.id !== selected.id)); setSelectedId(null); } };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); deleteSelected(); return; }
      if (e.key === 'Escape') { setSelectedId(null); setTool('select'); return; }
      if (e.key === 'r' && selected) { updateSelected({ rotation: (selected.rotation + (e.shiftKey ? -15 : 15) + 360) % 360 }); return; }
      const tl = TOOLS.find((x) => x.key === e.key);
      if (tl && !e.metaKey && !e.ctrlKey) setTool(tl.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const exportImage = async (kind: 'png' | 'pdf') => {
    const svg = svgRef.current!;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('[data-handle], .bk-select-ring').forEach((n) => n.remove());
    clone.setAttribute('width', String(size.w * 2));
    clone.setAttribute('height', String(size.h * 2));
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size.w * 2;
    canvas.height = size.h * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const name = `${diagram?.name ?? 'Blocking'}`.replace(/[\\/:*?"<>|]+/g, ' ');
    const a = document.createElement('a');
    if (kind === 'png') {
      a.href = canvas.toDataURL('image/png');
      a.download = `${name}.png`;
    } else {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
      const W = doc.internal.pageSize.getWidth();
      doc.setFont('helvetica', 'bold').setFontSize(14).text(name, 36, 36);
      const sc = scenes.find((x) => x.id === sceneId);
      if (sc) doc.setFont('helvetica', 'normal').setFontSize(10).text(`Scene ${sc.sceneNumber}: ${sc.intExt}. ${sc.location} - ${sc.timeOfDay}`, 36, 52);
      const imgW = W - 72;
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 36, 64, imgW, (imgW * size.h) / size.w);
      let y = 64 + (imgW * size.h) / size.w + 18;
      doc.setFontSize(9);
      for (const cam of items.filter((i) => i.kind === 'camera')) {
        const shot = shots.find((sh) => sh.id === cam.shotId);
        const sees = items.filter((i) => i.kind === 'actor' && inView(cam, fovOf(cam), REACH * 2, i)).map((i) => i.label);
        doc.text(`${cam.label}: ${cam.focalLength}mm on ${SENSORS[cam.sensor ?? 's35']?.label}${shot ? ` · Shot ${shot.shotNumber} ${shot.size}` : ''}${sees.length ? ` · sees ${sees.join(', ')}` : ''}`, 36, y);
        y += 12;
      }
      a.href = URL.createObjectURL(doc.output('blob'));
      a.download = `${name}.pdf`;
    }
    a.click();
  };

  // ---------- render ----------
  const renderItem = (it: BlockingItem) => {
    const sel = it.id === selectedId;
    if (it.kind === 'wall' || it.kind === 'door' || it.kind === 'window') {
      const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y;
      const len = Math.hypot(x2 - it.x, y2 - it.y);
      return (
        <g key={it.id}>
          {it.kind === 'wall' && <line x1={it.x} y1={it.y} x2={x2} y2={y2} className="bk-wall" />}
          {it.kind === 'window' && <><line x1={it.x} y1={it.y} x2={x2} y2={y2} className="bk-window" /><line x1={it.x} y1={it.y} x2={x2} y2={y2} className="bk-window-inner" /></>}
          {it.kind === 'door' && (
            <>
              <line x1={it.x} y1={it.y} x2={x2} y2={y2} className="bk-door" />
              <path d={`M ${x2} ${y2} A ${len} ${len} 0 0 0 ${it.x + (y2 - it.y)} ${it.y - (x2 - it.x)}`} className="bk-door-swing" />
            </>
          )}
          {sel && <line x1={it.x} y1={it.y} x2={x2} y2={y2} className="bk-select-ring line" />}
        </g>
      );
    }
    if (it.kind === 'prop') {
      return (
        <g key={it.id} transform={`rotate(${it.rotation} ${it.x} ${it.y})`}>
          <rect x={it.x - (it.w ?? 1) / 2} y={it.y - (it.h ?? 1) / 2} width={it.w ?? 1} height={it.h ?? 1} className={`bk-prop ${sel ? 'sel' : ''}`} />
          <text x={it.x} y={it.y + 0.08} className="bk-label small">{it.label}</text>
        </g>
      );
    }
    if (it.kind === 'camera') {
      const fov = fovOf(it);
      const w = fovWedge(it.x, it.y, it.rotation, fov, REACH);
      const shot = shots.find((sh) => sh.id === it.shotId);
      return (
        <g key={it.id}>
          <polygon points={w.map((p) => `${p.x},${p.y}`).join(' ')} className="bk-fov" />
          <g transform={`rotate(${it.rotation} ${it.x} ${it.y})`}>
            <rect x={it.x - 0.22} y={it.y - 0.15} width={0.44} height={0.32} rx={0.04} className={`bk-camera ${sel ? 'sel' : ''}`} />
            <polygon points={`${it.x - 0.12},${it.y - 0.15} ${it.x + 0.12},${it.y - 0.15} ${it.x + 0.18},${it.y - 0.3} ${it.x - 0.18},${it.y - 0.3}`} className="bk-camera" />
          </g>
          <text x={it.x} y={it.y + 0.55} className="bk-label">{it.label} · {it.focalLength}mm{shot ? ` · ${shot.shotNumber}` : ''}</text>
        </g>
      );
    }
    if (it.kind === 'light') {
      const beam = fovWedge(it.x, it.y, it.rotation, 50, 2.5);
      return (
        <g key={it.id}>
          <polygon points={beam.map((p) => `${p.x},${p.y}`).join(' ')} className="bk-beam" style={{ fill: it.color }} />
          <circle cx={it.x} cy={it.y} r={0.22} className={`bk-light ${sel ? 'sel' : ''}`} style={{ fill: it.color }} />
          <text x={it.x} y={it.y + 0.5} className="bk-label small">{it.label}</text>
        </g>
      );
    }
    // actor with marks and moves
    const nose = project(it.x, it.y, it.rotation, 0.42);
    const marks = [{ x: it.x, y: it.y }, ...(it.path ?? [])];
    return (
      <g key={it.id}>
        {marks.slice(1).map((m, k) => {
          const from = marks[k];
          return <line key={k} x1={from.x} y1={from.y} x2={m.x} y2={m.y} className="bk-move" style={{ stroke: it.color }} markerEnd="url(#bk-arrow)" />;
        })}
        {(it.path ?? []).map((m, k) => (
          <g key={k}>
            <circle cx={m.x} cy={m.y} r={0.2} className="bk-mark" style={{ stroke: it.color }} />
            <text x={m.x} y={m.y + 0.07} className="bk-label tiny">{k + 2}</text>
          </g>
        ))}
        <circle cx={it.x} cy={it.y} r={0.3} className={`bk-actor ${sel ? 'sel' : ''}`} style={{ fill: it.color }} />
        <line x1={it.x} y1={it.y} x2={nose.x} y2={nose.y} className="bk-nose" />
        <text x={it.x} y={it.y + 0.07} className="bk-label tiny light">{it.path?.length ? '1' : it.label.charAt(0)}</text>
        <text x={it.x} y={it.y - 0.42} className="bk-label">{it.label}</text>
      </g>
    );
  };

  const handlePos = selected && ['actor', 'camera', 'light', 'prop'].includes(selected.kind) ? project(selected.x, selected.y, selected.rotation, 0.9) : null;
  const gridLines = useMemo(() => {
    const out: ReactElement[] = [];
    for (let x = Math.floor(vb.x); x <= vb.x + vb.w; x++) out.push(<line key={`x${x}`} x1={x} y1={vb.y} x2={x} y2={vb.y + vb.h} className={x % 5 === 0 ? 'bk-grid major' : 'bk-grid'} />);
    for (let y = Math.floor(vb.y); y <= vb.y + vb.h; y++) out.push(<line key={`y${y}`} x1={vb.x} y1={y} x2={vb.x + vb.w} y2={y} className={y % 5 === 0 ? 'bk-grid major' : 'bk-grid'} />);
    return out;
  }, [vb.x, vb.y, vb.w, vb.h]);

  const scene = scenes.find((x) => x.id === sceneId);
  return (
    <div className="bk-editor">
      <div className="bk-header">
        <button className="bk-btn" onClick={onClose}>← Shot List</button>
        <select value={sceneId ?? ''} onChange={(e) => { s.selectScene(e.target.value); setDiagramId(null); setSelectedId(null); }} aria-label="Scene">
          {scenes.map((sc) => <option key={sc.id} value={sc.id}>{sc.sceneNumber}. {sc.intExt}. {sc.location} - {sc.timeOfDay}</option>)}
        </select>
        <select value={diagram?.id ?? ''} onChange={(e) => { setDiagramId(e.target.value); setSelectedId(null); }} aria-label="Diagram" disabled={!diagrams.length}>
          {diagrams.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="bk-btn" disabled={!sceneId} onClick={() => { const name = prompt('Diagram name', `${scene?.location ?? 'Scene'} ${diagrams.length ? diagrams.length + 1 : ''}`.trim()); if (name && sceneId) setDiagramId(s.add(sceneId, name)); }}>+ Diagram</button>
        {diagram && <button className="bk-btn" onClick={() => { const name = prompt('Rename diagram', diagram.name); if (name) s.update(diagram.id, { name }); }}>Rename</button>}
        {diagram && <button className="bk-btn" onClick={() => { if (confirm(`Delete "${diagram.name}"?`)) { s.remove(diagram.id); setDiagramId(null); } }}>Delete</button>}
        <div className="bk-header-end">
          <label className="bk-check"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> 1 m grid</label>
          <button className="bk-btn" disabled={!diagram} onClick={() => void exportImage('png')}>PNG</button>
          <button className="bk-btn" disabled={!diagram} onClick={() => void exportImage('pdf')}>PDF</button>
        </div>
      </div>

      {!diagram ? (
        <div className="bk-empty">
          {scenes.length ? <><p>No blocking diagram for this scene yet.</p><button className="bk-btn primary" onClick={() => sceneId && setDiagramId(s.add(sceneId, scene?.location ?? 'Blocking'))}>Create Diagram</button></>
            : <p>Write scenes in ReWriter first.</p>}
        </div>
      ) : (
        <div className="bk-body">
          <div className="bk-tools" role="toolbar" aria-label="Tools">
            {TOOLS.map((t) => (
              <button key={t.id} className={`bk-tool ${tool === t.id ? 'active' : ''}`} onClick={() => setTool(t.id)} title={`${t.label} (${t.key.toUpperCase()})`}>{t.label}</button>
            ))}
            <button className={`bk-tool ${tool === 'mark' ? 'active' : ''}`} disabled={selected?.kind !== 'actor'} onClick={() => setTool(tool === 'mark' ? 'select' : 'mark')} title="Click to add the selected actor's next mark">+ Marks</button>
            <span className="bk-muted">Drag to move, the dot to turn, empty space to pan; scroll to zoom. R rotates.</span>
          </div>
          <svg
            ref={svgRef}
            className={`bk-canvas tool-${tool}`}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onWheel={(e) => {
              const p = toWorld(e);
              const zoom = Math.max(0.3, Math.min(4, view.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
              const w = size.w / (PX * zoom), h = size.h / (PX * zoom);
              setView({ zoom, x: p.x - ((p.x - vb.x) / vb.w) * w, y: p.y - ((p.y - vb.y) / vb.h) * h });
            }}
          >
            <defs>
              <marker id="bk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#555" /></marker>
            </defs>
            <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#ffffff" />
            {grid && gridLines}
            {items.filter((i) => ['wall', 'door', 'window', 'prop'].includes(i.kind)).map(renderItem)}
            {items.filter((i) => i.kind === 'camera' || i.kind === 'light').map(renderItem)}
            {items.filter((i) => i.kind === 'actor').map(renderItem)}
            {handlePos && <><line x1={selected!.x} y1={selected!.y} x2={handlePos.x} y2={handlePos.y} className="bk-handle-line" /><circle cx={handlePos.x} cy={handlePos.y} r={0.14} className="bk-handle" data-handle="rotate" /></>}
          </svg>

          <aside className="bk-panel">
            {selected ? (
              <>
                <label>Label<input value={selected.label} onChange={(e) => updateSelected({ label: e.target.value })} /></label>
                {['actor', 'camera', 'light', 'prop'].includes(selected.kind) && (
                  <label>Facing {selected.rotation}°<input type="range" min={0} max={355} step={5} value={selected.rotation} onChange={(e) => updateSelected({ rotation: Number(e.target.value) })} /></label>
                )}
                {selected.kind === 'camera' && (
                  <>
                    <label>Lens
                      <select value={selected.focalLength} onChange={(e) => updateSelected({ focalLength: Number(e.target.value) })}>
                        {FOCALS.map((f) => <option key={f} value={f}>{f}mm</option>)}
                      </select>
                    </label>
                    <label>Sensor
                      <select value={selected.sensor ?? 's35'} onChange={(e) => updateSelected({ sensor: e.target.value })}>
                        {Object.entries(SENSORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </label>
                    <p className="bk-muted">{fovOf(selected).toFixed(1)}° horizontal field of view</p>
                    <label>Shot
                      <select value={selected.shotId ?? ''} onChange={(e) => updateSelected({ shotId: e.target.value || undefined })}>
                        <option value="">None</option>
                        {shots.map((sh) => <option key={sh.id} value={sh.id}>{sh.shotNumber} · {sh.size} · {sh.description?.slice(0, 30)}</option>)}
                      </select>
                    </label>
                    <p className="bk-muted">In shot: {items.filter((i) => i.kind === 'actor' && inView(selected, fovOf(selected), REACH * 2, i)).map((i) => i.label).join(', ') || 'nobody'}</p>
                  </>
                )}
                {(selected.kind === 'actor' || selected.kind === 'light') && (
                  <label>Colour<input type="color" value={selected.color ?? '#3B82F6'} onChange={(e) => updateSelected({ color: e.target.value })} /></label>
                )}
                {selected.kind === 'actor' && (
                  <div className="bk-marks">
                    <span>Marks: {1 + (selected.path?.length ?? 0)}</span>
                    {(selected.path ?? []).map((_, k) => (
                      <span key={k} className="bk-chip">{k + 2} <button aria-label={`Remove mark ${k + 2}`} onClick={() => updateSelected({ path: selected.path!.filter((_, j) => j !== k) })}>×</button></span>
                    ))}
                  </div>
                )}
                {selected.kind === 'prop' && (
                  <div className="bk-row">
                    <label>W (m)<input type="number" step={0.1} min={0.1} value={selected.w ?? 1} onChange={(e) => updateSelected({ w: Math.max(0.1, Number(e.target.value)) })} /></label>
                    <label>D (m)<input type="number" step={0.1} min={0.1} value={selected.h ?? 1} onChange={(e) => updateSelected({ h: Math.max(0.1, Number(e.target.value)) })} /></label>
                  </div>
                )}
                {(selected.kind === 'wall' || selected.kind === 'door' || selected.kind === 'window') && (
                  <p className="bk-muted">{Math.hypot((selected.x2 ?? selected.x) - selected.x, (selected.y2 ?? selected.y) - selected.y).toFixed(2)} m long</p>
                )}
                <button className="bk-btn danger" onClick={deleteSelected}>Delete</button>
              </>
            ) : (
              <div className="bk-muted">
                <p><strong>Actors</strong> (A): select one, then + Marks and click to add where they move.</p>
                <p><strong>Cameras</strong> (C): set the lens and sensor; the wedge shows exactly what the lens sees. Link a shot from the shot list.</p>
                <p><strong>Walls, doors, windows</strong>: drag to draw. Grid squares are 1 m.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
