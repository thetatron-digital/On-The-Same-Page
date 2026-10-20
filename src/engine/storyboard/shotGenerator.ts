// ============================================
// SHOT GENERATOR (pure scene + camera math)
// ============================================
// A small 3D blocking scene for a storyboard board, like Storyboarder's
// Shot Generator (findings/storyboarder.md): posable mannequins and simple
// props on a floor, one camera with a real focal length, shot-size and
// camera-angle presets. Units are metres; the floor is y = 0. Rotations
// are degrees. A character at rotation 0 faces +z; the camera at pan 0
// looks toward -z (three.js conventions). Rendering lives in the
// component; this file has no three.js so it can be unit tested.

import type { CameraAngle, ShotSize } from '../../types/screenplay';

export type ShotObjectKind = 'character' | 'box' | 'cylinder' | 'wall';
export type PoseId = 'stand' | 'walk' | 'sit' | 'point' | 'reach' | 'kneel' | 'armsUp';

export interface ShotObject {
  id: string;
  kind: ShotObjectKind;
  name: string;
  x: number;
  z: number;
  rotation: number;  // degrees around the vertical axis
  height: number;    // metres (a character's standing height)
  width?: number;    // props
  depth?: number;    // props
  color: string;
  pose?: PoseId;
}

export interface ShotCamera {
  x: number;
  z: number;
  height: number;      // lens height above the floor
  pan: number;         // degrees, 0 looks toward -z, positive turns left
  tilt: number;        // degrees, positive looks up
  roll: number;        // degrees (Dutch angle)
  focalLength: number; // mm on a full-frame (36 mm wide) sensor
}

export interface ShotScene {
  objects: ShotObject[];
  camera: ShotCamera;
  subjectId?: string; // the character the presets frame
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const SENSOR_WIDTH_MM = 36;

export const FOCAL_LENGTHS = [12, 14, 18, 21, 24, 28, 35, 50, 65, 85, 100, 135, 200];

/** Vertical field of view in degrees for a focal length and frame aspect */
export function verticalFov(focalLength: number, aspect: number): number {
  const halfH = Math.atan(SENSOR_WIDTH_MM / 2 / focalLength);
  return 2 * Math.atan(Math.tan(halfH) / aspect) * DEG;
}

export const EYE_HEIGHT = 0.935; // eyes, as a fraction of standing height

// How much of a standing character each shot size shows, from the top of
// the head down, as a fraction of the character's height
export const FRAMING: Partial<Record<ShotSize, number>> = {
  ECU: 0.06,
  BCU: 0.1,
  CU: 0.16,
  MCU: 0.3,
  MS: 0.5,
  MWS: 0.7,
  FS: 1.15,
  WS: 2.2,
  EWS: 6,
};
export const FRAMED_SIZES = Object.keys(FRAMING) as ShotSize[];

/** Height range (bottom, top) a shot size covers on a character */
export function framedSpan(size: ShotSize, characterHeight: number): { centerY: number; span: number } {
  const span = (FRAMING[size] ?? 0.5) * characterHeight;
  // Tight shots centre on the eyes; others keep a little headroom
  if (size === 'ECU' || size === 'BCU') return { centerY: characterHeight * EYE_HEIGHT, span };
  const top = characterHeight + span * 0.06;
  return { centerY: Math.max(top - span / 2, Math.min(characterHeight / 2, span / 2)), span };
}

/** Camera distance that fits a vertical span in frame */
export const distanceForSpan = (span: number, focalLength: number, aspect: number) =>
  span / 2 / Math.tan((verticalFov(focalLength, aspect) / 2) * RAD);

/** Pan and tilt that point the camera at a point */
export function aimAt(camera: ShotCamera, x: number, y: number, z: number): Pick<ShotCamera, 'pan' | 'tilt'> {
  const dx = x - camera.x;
  const dz = z - camera.z;
  const ground = Math.hypot(dx, dz);
  return {
    pan: ground < 1e-6 ? camera.pan : Math.atan2(-dx, -dz) * DEG,
    tilt: Math.atan2(y - camera.height, Math.max(ground, 1e-6)) * DEG,
  };
}

const subjectOf = (scene: ShotScene) =>
  scene.objects.find((o) => o.id === scene.subjectId && o.kind === 'character') ?? scene.objects.find((o) => o.kind === 'character');

/**
 * Move the camera to frame the subject at a shot size, keeping the
 * camera's current side of the subject (or its front if very close).
 */
export function frameShot(scene: ShotScene, size: ShotSize, aspect: number): ShotCamera {
  const subject = subjectOf(scene);
  const camera = scene.camera;
  if (!subject) return camera;
  const { centerY, span } = framedSpan(size, subject.height);
  const distance = distanceForSpan(span, camera.focalLength, aspect);
  let dx = camera.x - subject.x;
  let dz = camera.z - subject.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) {
    dx = Math.sin(subject.rotation * RAD);
    dz = Math.cos(subject.rotation * RAD);
  } else {
    dx /= len;
    dz /= len;
  }
  const next = { ...camera, x: subject.x + dx * distance, z: subject.z + dz * distance, height: centerY, roll: 0 };
  return { ...next, ...aimAt(next, subject.x, centerY, subject.z) };
}

/** Camera height, aim and roll for an angle preset (subject stays in frame) */
export function applyAngle(scene: ShotScene, angle: CameraAngle): ShotCamera {
  const subject = subjectOf(scene);
  const camera = scene.camera;
  const h = subject?.height ?? 1.75;
  const tx = subject?.x ?? camera.x;
  const tz = subject?.z ?? camera.z - 3;
  const ground = Math.max(0.5, Math.hypot(camera.x - tx, camera.z - tz));
  const target = h * 0.75;
  const place = (height: number, aimY: number, roll = 0) => {
    const next = { ...camera, height, roll };
    return { ...next, ...aimAt(next, tx, aimY, tz) };
  };
  switch (angle) {
    case 'Eye Level': return place(h * EYE_HEIGHT, h * EYE_HEIGHT);
    case 'Low Angle': return place(h * 0.35, target);
    case "Worm's Eye": return place(0.1, target);
    case 'High Angle': return place(h + ground * 0.6, h * 0.6);
    case "Bird's Eye":
    case 'Overhead': {
      // Straight down over the subject
      return { ...camera, x: tx, z: tz + 0.001, height: Math.max(h + 2, ground + h), tilt: -90, roll: 0, pan: camera.pan };
    }
    case 'Dutch Angle': return { ...camera, roll: camera.roll ? 0 : 15 };
  }
}

/**
 * The shot size and angle this camera gives, for the shot list: how much
 * of the subject's height fills the frame, and where the camera sits.
 */
export function describeShot(scene: ShotScene, aspect: number): { size: ShotSize; angle: CameraAngle } {
  const camera = scene.camera;
  const subject = subjectOf(scene);
  const angle: CameraAngle =
    camera.tilt <= -75 ? "Bird's Eye"
      : Math.abs(camera.roll) >= 5 ? 'Dutch Angle'
        : !subject ? 'Eye Level'
          : camera.height <= subject.height * 0.15 ? "Worm's Eye"
            : camera.tilt >= 5 || camera.height < subject.height * 0.6 ? 'Low Angle'
              : camera.tilt <= -10 || camera.height > subject.height * 1.15 ? 'High Angle'
                : 'Eye Level';
  if (!subject) return { size: 'WS', angle };
  // Distance to the subject's plane: along the floor, or down from overhead
  const distance = Math.max(0.05, angle === "Bird's Eye" ? camera.height - subject.height : Math.hypot(camera.x - subject.x, camera.z - subject.z));
  const span = 2 * distance * Math.tan((verticalFov(camera.focalLength, aspect) / 2) * RAD);
  const fraction = span / subject.height;
  let best: ShotSize = 'MS';
  for (const size of FRAMED_SIZES) {
    if (Math.abs(Math.log(FRAMING[size]! / fraction)) < Math.abs(Math.log(FRAMING[best]! / fraction))) best = size;
  }
  return { size: best, angle };
}

// ---------- Mannequin ----------

export type Joint = 'pelvis' | 'spine' | 'neck' | 'lShoulder' | 'lElbow' | 'rShoulder' | 'rElbow' | 'lHip' | 'lKnee' | 'rHip' | 'rKnee';

/** Body proportions as fractions of standing height (OTSP's own) */
export const BODY = {
  hipY: 0.53,
  torso: 0.29,        // hips to shoulders
  neck: 0.04,
  headRadius: 0.065,
  shoulderHalf: 0.115,
  hipHalf: 0.06,
  upperArm: 0.18,
  forearm: 0.22,      // incl. hand
  thigh: 0.245,
  shin: 0.285,        // incl. foot
  limbRadius: 0.028,
};

/** Joint rotations [x, y, z] in degrees; x bends forward for legs and arms */
export const POSES: Record<PoseId, { label: string; drop?: number; joints: Partial<Record<Joint, [number, number, number]>> }> = {
  stand: { label: 'Standing', joints: { lShoulder: [0, 0, 8], rShoulder: [0, 0, -8] } },
  walk: {
    label: 'Walking',
    joints: { lShoulder: [-25, 0, 6], lElbow: [-15, 0, 0], rShoulder: [25, 0, -6], rElbow: [-15, 0, 0], lHip: [-25, 0, 0], lKnee: [10, 0, 0], rHip: [20, 0, 0], rKnee: [25, 0, 0] },
  },
  sit: {
    label: 'Sitting',
    drop: 0.27,
    joints: { lHip: [-90, 0, 3], rHip: [-90, 0, -3], lKnee: [90, 0, 0], rKnee: [90, 0, 0], lShoulder: [-20, 0, 8], rShoulder: [-20, 0, -8], lElbow: [-40, 0, 0], rElbow: [-40, 0, 0] },
  },
  point: { label: 'Pointing', joints: { rShoulder: [-90, 0, 0], lShoulder: [0, 0, 8] } },
  reach: { label: 'Reaching', joints: { spine: [15, 0, 0], lShoulder: [-70, 0, 10], rShoulder: [-70, 0, -10], lElbow: [-10, 0, 0], rElbow: [-10, 0, 0] } },
  kneel: {
    label: 'Kneeling',
    drop: 0.24,
    joints: { lHip: [-90, 0, 0], lKnee: [90, 0, 0], rHip: [0, 0, 0], rKnee: [90, 0, 0], lShoulder: [0, 0, 8], rShoulder: [0, 0, -8] },
  },
  armsUp: { label: 'Arms Up', joints: { lShoulder: [0, 0, 165], rShoulder: [0, 0, -165], neck: [-10, 0, 0] } },
};
export const POSE_IDS = Object.keys(POSES) as PoseId[];

// ---------- Scene editing ----------

let counter = 0;
export const newObjectId = () => `sg-${Date.now().toString(36)}-${(counter++).toString(36)}`;

const PROP_DEFAULTS: Record<Exclude<ShotObjectKind, 'character'>, Pick<ShotObject, 'height' | 'width' | 'depth' | 'color' | 'name'>> = {
  box: { name: 'Box', height: 0.75, width: 1, depth: 0.6, color: '#b9a48a' },
  cylinder: { name: 'Column', height: 1, width: 0.5, depth: 0.5, color: '#9fb4c7' },
  wall: { name: 'Wall', height: 2.6, width: 4, depth: 0.12, color: '#d9d4cc' },
};

export function newObject(kind: ShotObjectKind, at: { x: number; z: number }, count = 0): ShotObject {
  if (kind === 'character') {
    return { id: newObjectId(), kind, name: `Character ${count + 1}`, x: at.x, z: at.z, rotation: 0, height: 1.75, color: '#d8d8d8', pose: 'stand' };
  }
  return { id: newObjectId(), kind, x: at.x, z: at.z, rotation: 0, ...PROP_DEFAULTS[kind] };
}

export function defaultShotScene(): ShotScene {
  const character = newObject('character', { x: 0, z: 0 });
  const camera: ShotCamera = { x: 0, z: 4, height: 1.6, pan: 0, tilt: 0, roll: 0, focalLength: 35 };
  const scene: ShotScene = { objects: [character], camera, subjectId: character.id };
  return { ...scene, camera: frameShot(scene, 'MS', 16 / 9) };
}
