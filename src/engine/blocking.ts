// Geometry for blocking diagrams: sensor sizes, field of view, wedges
export const SENSORS: Record<string, { label: string; width: number }> = {
  ff: { label: 'Full Frame (36 mm)', width: 36 },
  s35: { label: 'Super 35 (24.9 mm)', width: 24.89 },
  aps: { label: 'APS-C (23.5 mm)', width: 23.5 },
  m43: { label: 'Micro Four Thirds (17.3 mm)', width: 17.3 },
  s16: { label: 'Super 16 (12.5 mm)', width: 12.52 },
  lf: { label: 'Large Format (36.7 mm)', width: 36.7 },
  phone: { label: 'Phone (~7 mm)', width: 7 },
};

/** Horizontal field of view in degrees: 2·atan(sensor width / 2f) */
export const horizontalFov = (focalLength: number, sensorWidth: number) =>
  (2 * Math.atan(sensorWidth / (2 * focalLength)) * 180) / Math.PI;

const RAD = Math.PI / 180;

/** Point at `distance` from (x, y) in direction `angle` (0 = up, clockwise) */
export const project = (x: number, y: number, angle: number, distance: number) => ({
  x: x + Math.sin(angle * RAD) * distance,
  y: y - Math.cos(angle * RAD) * distance,
});

/** Triangle for a camera's view: apex at the lens, `reach` metres out */
export function fovWedge(x: number, y: number, rotation: number, fov: number, reach: number) {
  const left = project(x, y, rotation - fov / 2, reach);
  const right = project(x, y, rotation + fov / 2, reach);
  return [{ x, y }, left, right];
}

/** Angle from one point to another (0 = up, clockwise), for aiming */
export const angleTo = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  ((Math.atan2(to.x - from.x, -(to.y - from.y)) / RAD) % 360 + 360) % 360;

/** Is point p inside the camera's view (within reach)? */
export function inView(cam: { x: number; y: number; rotation: number }, fov: number, reach: number, p: { x: number; y: number }): boolean {
  const d = Math.hypot(p.x - cam.x, p.y - cam.y);
  if (d === 0 || d > reach) return false;
  let diff = angleTo(cam, p) - cam.rotation;
  diff = ((diff + 540) % 360) - 180;
  return Math.abs(diff) <= fov / 2;
}

/** Distance from point p to segment ab (for picking walls) */
export function distanceToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export const snap = (v: number, step = 0.25) => Math.round(v / step) * step;
