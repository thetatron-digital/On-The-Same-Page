// Shot Generator: block a board in 3D (mannequins, props, a camera with a
// real lens) and drop the camera view onto the board, like Storyboarder's
// Shot Generator. Camera view on the left, top-down plan on the right.
// three.js (MIT) is loaded only when this opens.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { CameraAngle, ShotSize } from '../../types/screenplay';
import {
  BODY, FOCAL_LENGTHS, FRAMED_SIZES, POSES, POSE_IDS, applyAngle, aimAt, defaultShotScene, describeShot, frameShot, newObject, verticalFov,
  type Joint, type ShotCamera, type ShotObject, type ShotObjectKind, type ShotScene,
} from '../../engine/storyboard/shotGenerator';
import './ShotGenerator.css';

const RAD = Math.PI / 180;
const ANGLES: CameraAngle[] = ['Eye Level', 'Low Angle', 'High Angle', "Bird's Eye", "Worm's Eye", 'Dutch Angle'];

export interface ShotGeneratorResult {
  image: string; // PNG data URL, board size
  scene: ShotScene;
  shotSize: ShotSize;
  cameraAngle: CameraAngle;
  focalLength: number;
}

interface Props {
  initial?: ShotScene;
  width: number;  // board size for the render
  height: number;
  onInsert: (result: ShotGeneratorResult, mode: 'reference' | 'new-board') => void;
  onClose: (scene: ShotScene) => void;
}

// ---------- three.js scene building ----------

const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });

function limb(length: number, radius: number, mat: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.001, length - radius * 2), 4, 10), mat);
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  return mesh;
}

function jointGroup(rotation: [number, number, number] | undefined, x: number, y: number, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (rotation) g.rotation.set(rotation[0] * RAD, rotation[1] * RAD, rotation[2] * RAD);
  return g;
}

function buildMannequin(obj: ShotObject): THREE.Object3D {
  const H = obj.height;
  const pose = POSES[obj.pose ?? 'stand'];
  const j = (name: Joint) => pose.joints[name];
  const mat = material(obj.color);
  const r = BODY.limbRadius * H;

  const pelvis = jointGroup(j('pelvis'), 0, (BODY.hipY - (pose.drop ?? 0)) * H);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(BODY.hipHalf * 2.6 * H, 0.07 * H, 0.1 * H), mat);
  hips.castShadow = true;
  pelvis.add(hips);

  const spine = jointGroup(j('spine'), 0, 0);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.075 * H, BODY.torso * H - 0.12 * H, 4, 12), mat);
  torso.scale.set(1.15, 1, 0.7);
  torso.position.y = (BODY.torso * H) / 2;
  torso.castShadow = true;
  spine.add(torso);
  pelvis.add(spine);

  const neck = jointGroup(j('neck'), 0, BODY.torso * H);
  const head = new THREE.Mesh(new THREE.SphereGeometry(BODY.headRadius * H, 20, 14), mat);
  head.scale.set(0.9, 1.1, 1);
  head.position.y = BODY.neck * H + BODY.headRadius * H;
  head.castShadow = true;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.015 * H, 0.025 * H, 0.03 * H), mat);
  nose.position.set(0, head.position.y - 0.005 * H, BODY.headRadius * H);
  neck.add(head, nose);
  spine.add(neck);

  for (const side of [1, -1] as const) {
    const l = side === 1;
    const shoulder = jointGroup(j(l ? 'lShoulder' : 'rShoulder'), side * BODY.shoulderHalf * H, BODY.torso * H * 0.93);
    shoulder.add(limb(BODY.upperArm * H, r, mat));
    const elbow = jointGroup(j(l ? 'lElbow' : 'rElbow'), 0, -BODY.upperArm * H);
    elbow.add(limb(BODY.forearm * H, r * 0.85, mat));
    shoulder.add(elbow);
    spine.add(shoulder);

    const hip = jointGroup(j(l ? 'lHip' : 'rHip'), side * BODY.hipHalf * H, 0);
    hip.add(limb(BODY.thigh * H, r * 1.4, mat));
    const knee = jointGroup(j(l ? 'lKnee' : 'rKnee'), 0, -BODY.thigh * H);
    knee.add(limb(BODY.shin * H, r * 1.1, mat));
    hip.add(knee);
    pelvis.add(hip);
  }

  const root = new THREE.Group();
  root.add(pelvis);
  return root;
}

function buildObject(obj: ShotObject): THREE.Object3D {
  let node: THREE.Object3D;
  if (obj.kind === 'character') node = buildMannequin(obj);
  else {
    const geometry = obj.kind === 'cylinder'
      ? new THREE.CylinderGeometry((obj.width ?? 0.5) / 2, (obj.width ?? 0.5) / 2, obj.height, 24)
      : new THREE.BoxGeometry(obj.width ?? 1, obj.height, obj.depth ?? 1);
    const mesh = new THREE.Mesh(geometry, material(obj.color));
    mesh.position.y = obj.height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    node = new THREE.Group().add(mesh);
  }
  node.position.set(obj.x, 0, obj.z);
  node.rotation.y = obj.rotation * RAD;
  return node;
}

function applyCamera(cam: THREE.PerspectiveCamera, c: ShotCamera, aspect: number) {
  cam.aspect = aspect;
  cam.fov = verticalFov(c.focalLength, aspect);
  cam.position.set(c.x, c.height, c.z);
  cam.rotation.order = 'YXZ';
  cam.rotation.set(c.tilt * RAD, c.pan * RAD, c.roll * RAD);
  cam.updateProjectionMatrix();
}

// ---------- Plan view (2D, top-down) ----------

const PLAN_SIZE = 320;

function hfovDeg(focal: number) {
  return 2 * Math.atan(18 / focal) / RAD;
}

export default function ShotGenerator({ initial, width, height, onInsert, onClose }: Props) {
  const [scene, setScene] = useState<ShotScene>(() => initial ?? defaultShotScene());
  const [selectedId, setSelectedId] = useState<string | 'camera'>(() => scene.subjectId ?? 'camera');
  const [planScale, setPlanScale] = useState(32); // px per metre
  const aspect = width / height;
  const viewRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLCanvasElement>(null);
  const three = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; objects: THREE.Group } | null>(null);
  const drag = useRef<{ kind: 'look' | 'move' | 'turn'; id: string; x: number; y: number; start: ShotScene } | null>(null);

  const selected = scene.objects.find((o) => o.id === selectedId);
  const described = useMemo(() => describeShot(scene, aspect), [scene, aspect]);
  const setCamera = (camera: Partial<ShotCamera>) => setScene((s) => ({ ...s, camera: { ...s.camera, ...camera } }));
  const updateObject = (id: string, updates: Partial<ShotObject>) =>
    setScene((s) => ({ ...s, objects: s.objects.map((o) => (o.id === id ? { ...o, ...updates } : o)) }));

  // three.js setup
  useEffect(() => {
    const host = viewRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    const world = new THREE.Scene();
    world.background = new THREE.Color('#e9e9ec');
    world.add(new THREE.HemisphereLight('#ffffff', '#8a8a90', 1.6));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
    world.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    world.add(floor);
    const grid = new THREE.GridHelper(40, 40, '#c4c4c8', '#d8d8dc');
    grid.position.y = 0.001;
    world.add(grid);
    const objects = new THREE.Group();
    world.add(objects);
    const camera = new THREE.PerspectiveCamera(30, aspect, 0.05, 300);
    three.current = { renderer, scene: world, camera, objects };

    const resize = () => {
      const w = host.clientWidth;
      renderer.setSize(w, w / aspect);
      renderer.render(world, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => {
      observer.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      three.current = null;
    };
  }, [aspect]);

  // Rebuild objects and render whenever the scene changes
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    t.objects.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        (node.material as THREE.Material).dispose();
      }
    });
    t.objects.clear();
    scene.objects.forEach((o) => t.objects.add(buildObject(o)));
    applyCamera(t.camera, scene.camera, aspect);
    t.renderer.render(t.scene, t.camera);
  }, [scene, aspect]);

  // Plan view drawing
  useEffect(() => {
    const canvas = planRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const px = (x: number) => PLAN_SIZE / 2 + x * planScale;
    ctx.clearRect(0, 0, PLAN_SIZE, PLAN_SIZE);
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, PLAN_SIZE, PLAN_SIZE);
    ctx.strokeStyle = '#dcdce0';
    ctx.lineWidth = 1;
    const half = PLAN_SIZE / 2 / planScale;
    for (let m = -Math.ceil(half); m <= half; m++) {
      ctx.beginPath(); ctx.moveTo(px(m), 0); ctx.lineTo(px(m), PLAN_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, px(m)); ctx.lineTo(PLAN_SIZE, px(m)); ctx.stroke();
    }
    // camera wedge
    const c = scene.camera;
    const fov = hfovDeg(c.focalLength) * RAD;
    const dir = (a: number) => [-Math.sin(c.pan * RAD + a), -Math.cos(c.pan * RAD + a)];
    const reach = 12;
    ctx.fillStyle = 'rgba(139, 92, 246, 0.12)';
    ctx.beginPath();
    ctx.moveTo(px(c.x), px(c.z));
    const [lx, lz] = dir(fov / 2);
    const [rx, rz] = dir(-fov / 2);
    ctx.lineTo(px(c.x + lx * reach), px(c.z + lz * reach));
    ctx.lineTo(px(c.x + rx * reach), px(c.z + rz * reach));
    ctx.closePath();
    ctx.fill();
    // objects
    for (const o of scene.objects) {
      ctx.save();
      ctx.translate(px(o.x), px(o.z));
      ctx.rotate(-o.rotation * RAD);
      ctx.fillStyle = o.color;
      ctx.strokeStyle = o.id === selectedId ? '#8B5CF6' : '#555';
      ctx.lineWidth = o.id === selectedId ? 3 : 1.5;
      if (o.kind === 'character') {
        ctx.beginPath(); ctx.arc(0, 0, 0.25 * planScale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 0.5 * planScale); ctx.stroke(); // facing
      } else if (o.kind === 'cylinder') {
        ctx.beginPath(); ctx.arc(0, 0, ((o.width ?? 0.5) / 2) * planScale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        const w = (o.width ?? 1) * planScale;
        const d = (o.depth ?? 1) * planScale;
        ctx.fillRect(-w / 2, -d / 2, w, d); ctx.strokeRect(-w / 2, -d / 2, w, d);
      }
      ctx.restore();
      if (o.id === scene.subjectId) {
        ctx.fillStyle = '#333';
        ctx.font = '10px sans-serif';
        ctx.fillText('★', px(o.x) - 4, px(o.z) - 0.3 * planScale - 3);
      }
    }
    // camera body
    ctx.save();
    ctx.translate(px(c.x), px(c.z));
    ctx.rotate(-c.pan * RAD);
    ctx.fillStyle = selectedId === 'camera' ? '#8B5CF6' : '#333';
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, 7); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }, [scene, selectedId, planScale]);

  // ---------- interaction ----------

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * PLAN_SIZE;
    const sy = ((e.clientY - rect.top) / rect.height) * PLAN_SIZE;
    return { x: (sx - PLAN_SIZE / 2) / planScale, z: (sy - PLAN_SIZE / 2) / planScale };
  };

  const onPlanDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toWorld(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    const near = (x: number, z: number, r: number) => Math.hypot(p.x - x, p.z - z) <= r;
    const c = scene.camera;
    if (near(c.x, c.z, 0.45)) {
      setSelectedId('camera');
      drag.current = { kind: e.altKey ? 'turn' : 'move', id: 'camera', x: p.x, y: p.z, start: scene };
      return;
    }
    const hit = [...scene.objects].reverse().find((o) =>
      o.kind === 'character' || o.kind === 'cylinder' ? near(o.x, o.z, Math.max(0.35, (o.width ?? 0.5) / 2))
        : Math.abs((p.x - o.x) * Math.cos(o.rotation * RAD) - (p.z - o.z) * Math.sin(o.rotation * RAD)) <= (o.width ?? 1) / 2 + 0.1
          && Math.abs((p.x - o.x) * Math.sin(o.rotation * RAD) + (p.z - o.z) * Math.cos(o.rotation * RAD)) <= (o.depth ?? 1) / 2 + 0.1);
    if (hit) {
      setSelectedId(hit.id);
      drag.current = { kind: e.altKey ? 'turn' : 'move', id: hit.id, x: p.x, y: p.z, start: scene };
    } else if (selectedId === 'camera' || e.shiftKey) {
      // Click empty floor with the camera selected: aim the camera there
      setCamera({ pan: aimAt(scene.camera, p.x, scene.camera.height, p.z).pan });
      drag.current = { kind: 'turn', id: 'camera', x: p.x, y: p.z, start: scene };
    }
  };

  const onPlanMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toWorld(e);
    if (d.id === 'camera') {
      const c = d.start.camera;
      if (d.kind === 'move') setCamera({ x: c.x + p.x - d.x, z: c.z + p.z - d.y });
      else setCamera({ pan: aimAt({ ...scene.camera }, p.x, scene.camera.height, p.z).pan });
      return;
    }
    const o = d.start.objects.find((x) => x.id === d.id)!;
    if (d.kind === 'move') updateObject(d.id, { x: o.x + p.x - d.x, z: o.z + p.z - d.y });
    else updateObject(d.id, { rotation: Math.round(Math.atan2(p.x - o.x, p.z - o.z) / RAD) });
  };

  const onViewDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind: 'look', id: 'camera', x: e.clientX, y: e.clientY, start: scene };
  };
  const onViewMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.kind !== 'look') return;
    const c = d.start.camera;
    // Drag to pan and tilt the camera (like turning a fluid head)
    const k = verticalFov(c.focalLength, aspect) / e.currentTarget.clientHeight;
    setCamera({ pan: c.pan + (e.clientX - d.x) * k, tilt: Math.max(-90, Math.min(90, c.tilt + (e.clientY - d.y) * k)) });
  };
  const onViewWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Dolly forward/back along the floor
    const c = scene.camera;
    const step = -e.deltaY * 0.004;
    setCamera({ x: c.x - Math.sin(c.pan * RAD) * step, z: c.z - Math.cos(c.pan * RAD) * step });
  };

  const addObject = (kind: ShotObjectKind) => {
    const c = scene.camera;
    // In front of the camera, 3 m out
    const at = { x: +(c.x - Math.sin(c.pan * RAD) * 3).toFixed(2), z: +(c.z - Math.cos(c.pan * RAD) * 3).toFixed(2) };
    const obj = newObject(kind, at, scene.objects.filter((o) => o.kind === 'character').length);
    if (kind === 'character') obj.rotation = Math.round(c.pan);
    setScene((s) => ({ ...s, objects: [...s.objects, obj], subjectId: s.subjectId ?? (kind === 'character' ? obj.id : undefined) }));
    setSelectedId(obj.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    setScene((s) => ({
      ...s,
      objects: s.objects.filter((o) => o.id !== selected.id),
      subjectId: s.subjectId === selected.id ? s.objects.find((o) => o.kind === 'character' && o.id !== selected.id)?.id : s.subjectId,
    }));
    setSelectedId('camera');
  };

  const capture = (): string => {
    const t = three.current!;
    const size = new THREE.Vector2();
    t.renderer.getSize(size);
    const ratio = t.renderer.getPixelRatio();
    t.renderer.setPixelRatio(1);
    t.renderer.setSize(width, height, false);
    applyCamera(t.camera, scene.camera, aspect);
    t.renderer.render(t.scene, t.camera);
    const url = t.renderer.domElement.toDataURL('image/png');
    t.renderer.setPixelRatio(ratio);
    t.renderer.setSize(size.x, size.y);
    t.renderer.render(t.scene, t.camera);
    return url;
  };

  const insert = (mode: 'reference' | 'new-board') =>
    onInsert({ image: capture(), scene, shotSize: described.size, cameraAngle: described.angle, focalLength: scene.camera.focalLength }, mode);

  // Keys: Delete removes the selection, Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      if (e.key === 'Escape') { e.stopPropagation(); onClose(scene); }
      else if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); removeSelected(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const c = scene.camera;
  const num = (value: number, onChange: (v: number) => void, step = 0.1, min?: number, max?: number) => (
    <input type="number" step={step} min={min} max={max} value={Math.round(value * 100) / 100} onChange={(e) => onChange(Number(e.target.value))} />
  );

  return (
    <div className="sg-overlay" role="dialog" aria-label="Shot Generator">
      <div className="sg-header">
        <h2>Shot Generator</h2>
        <span className="sg-readout">{c.focalLength}mm · {described.size} · {described.angle}</span>
        <div className="sg-actions">
          <button className="sb-btn sb-primary" onClick={() => insert('reference')} title="Render the camera view onto this board's reference layer">Insert into Board</button>
          <button className="sb-btn" onClick={() => insert('new-board')}>Insert as New Board</button>
          <button className="sb-btn" onClick={() => onClose(scene)}>Close</button>
        </div>
      </div>

      <div className="sg-body">
        <aside className="sg-panel">
          <div className="sg-add">
            <button className="sb-btn small" onClick={() => addObject('character')}>+ Character</button>
            <button className="sb-btn small" onClick={() => addObject('box')}>+ Box</button>
            <button className="sb-btn small" onClick={() => addObject('cylinder')}>+ Column</button>
            <button className="sb-btn small" onClick={() => addObject('wall')}>+ Wall</button>
          </div>
          <ul className="sg-list">
            <li><button className={selectedId === 'camera' ? 'active' : ''} onClick={() => setSelectedId('camera')}>🎥 Camera</button></li>
            {scene.objects.map((o) => (
              <li key={o.id}>
                <button className={selectedId === o.id ? 'active' : ''} onClick={() => setSelectedId(o.id)}>
                  {o.id === scene.subjectId ? '★ ' : ''}{o.name}
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <div className="sg-props">
              <label>Name<input value={selected.name} onChange={(e) => updateObject(selected.id, { name: e.target.value })} /></label>
              <div className="sg-grid2">
                <label>X (m){num(selected.x, (v) => updateObject(selected.id, { x: v }))}</label>
                <label>Z (m){num(selected.z, (v) => updateObject(selected.id, { z: v }))}</label>
              </div>
              <label>Turn {selected.rotation}°
                <input type="range" min={-180} max={180} value={selected.rotation} onChange={(e) => updateObject(selected.id, { rotation: Number(e.target.value) })} />
              </label>
              <div className="sg-grid2">
                <label>Height (m){num(selected.height, (v) => updateObject(selected.id, { height: Math.max(0.1, v) }), 0.05, 0.1)}</label>
                {selected.kind !== 'character' && <label>Width (m){num(selected.width ?? 1, (v) => updateObject(selected.id, { width: Math.max(0.05, v) }), 0.1, 0.05)}</label>}
              </div>
              {selected.kind === 'character' ? (
                <>
                  <label>Pose
                    <select value={selected.pose ?? 'stand'} onChange={(e) => updateObject(selected.id, { pose: e.target.value as ShotObject['pose'] })}>
                      {POSE_IDS.map((p) => <option key={p} value={p}>{POSES[p].label}</option>)}
                    </select>
                  </label>
                  {scene.subjectId !== selected.id && (
                    <button className="sb-btn small" onClick={() => setScene((s) => ({ ...s, subjectId: selected.id }))} title="Shot size and angle presets frame this character">Make Subject ★</button>
                  )}
                </>
              ) : (
                <label>Depth (m){num(selected.depth ?? 1, (v) => updateObject(selected.id, { depth: Math.max(0.05, v) }), 0.1, 0.05)}</label>
              )}
              <label>Color<input type="color" value={selected.color} onChange={(e) => updateObject(selected.id, { color: e.target.value })} /></label>
              <button className="sb-btn small" onClick={removeSelected}>Delete</button>
            </div>
          ) : (
            <div className="sg-props">
              <div className="sg-grid2">
                <label>X (m){num(c.x, (v) => setCamera({ x: v }))}</label>
                <label>Z (m){num(c.z, (v) => setCamera({ z: v }))}</label>
              </div>
              <label>Height {c.height.toFixed(2)} m<input type="range" min={0.05} max={15} step={0.05} value={c.height} onChange={(e) => setCamera({ height: Number(e.target.value) })} /></label>
              <label>Pan {Math.round(c.pan)}°<input type="range" min={-180} max={180} value={Math.round(c.pan)} onChange={(e) => setCamera({ pan: Number(e.target.value) })} /></label>
              <label>Tilt {Math.round(c.tilt)}°<input type="range" min={-90} max={90} value={Math.round(c.tilt)} onChange={(e) => setCamera({ tilt: Number(e.target.value) })} /></label>
              <label>Roll {Math.round(c.roll)}°<input type="range" min={-45} max={45} value={Math.round(c.roll)} onChange={(e) => setCamera({ roll: Number(e.target.value) })} /></label>
            </div>
          )}
          <p className="sb-muted">Plan: drag to move, Alt+drag to turn. With the camera selected, click the floor to aim it. Camera view: drag to pan/tilt, scroll to dolly.</p>
        </aside>

        <div className="sg-main">
          <div className="sg-view" ref={viewRef} onPointerDown={onViewDown} onPointerMove={onViewMove} onPointerUp={() => { drag.current = null; }} onWheel={onViewWheel} />
          <div className="sg-camera-bar">
            <label>Lens
              <select value={c.focalLength} onChange={(e) => setCamera({ focalLength: Number(e.target.value) })}>
                {FOCAL_LENGTHS.map((f) => <option key={f} value={f}>{f}mm</option>)}
              </select>
            </label>
            <div className="sg-presets" aria-label="Shot size">
              {FRAMED_SIZES.map((size) => (
                <button key={size} className={`sb-btn small ${described.size === size ? 'active' : ''}`} onClick={() => setCamera(frameShot(scene, size, aspect))}>{size}</button>
              ))}
            </div>
            <div className="sg-presets" aria-label="Camera angle">
              {ANGLES.map((angle) => (
                <button key={angle} className={`sb-btn small ${described.angle === angle ? 'active' : ''}`} onClick={() => setCamera(applyAngle(scene, angle))}>{angle}</button>
              ))}
            </div>
          </div>
        </div>

        <aside className="sg-plan">
          <canvas ref={planRef} width={PLAN_SIZE} height={PLAN_SIZE} onPointerDown={onPlanDown} onPointerMove={onPlanMove} onPointerUp={() => { drag.current = null; }}
            onWheel={(e) => setPlanScale((s) => Math.max(8, Math.min(120, s * (e.deltaY > 0 ? 0.9 : 1.1))))} />
          <span className="sb-muted">Top view · scroll to zoom</span>
        </aside>
      </div>
    </div>
  );
}
