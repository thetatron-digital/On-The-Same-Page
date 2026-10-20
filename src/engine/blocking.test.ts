import { describe, expect, it } from 'vitest';
import { SENSORS, angleTo, distanceToSegment, fovWedge, horizontalFov, inView, project, snap } from './blocking';

describe('blocking geometry', () => {
  it('computes field of view from focal length and sensor', () => {
    expect(horizontalFov(50, SENSORS.ff.width)).toBeCloseTo(39.6, 1);
    expect(horizontalFov(35, SENSORS.s35.width)).toBeCloseTo(39.1, 1);
    expect(horizontalFov(24, 36)).toBeGreaterThan(horizontalFov(85, 36));
  });

  it('projects and aims with 0 = up, clockwise', () => {
    expect(project(0, 0, 0, 2)).toEqual({ x: 0, y: -2 });
    const east = project(0, 0, 90, 2);
    expect(east.x).toBeCloseTo(2);
    expect(east.y).toBeCloseTo(0);
    expect(angleTo({ x: 0, y: 0 }, { x: 0, y: 5 })).toBeCloseTo(180);
    expect(angleTo({ x: 0, y: 0 }, { x: -3, y: 0 })).toBeCloseTo(270);
  });

  it('builds a wedge and tells what is in shot', () => {
    const [apex, left, right] = fovWedge(0, 0, 0, 40, 10);
    expect(apex).toEqual({ x: 0, y: 0 });
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    const cam = { x: 0, y: 0, rotation: 0 };
    expect(inView(cam, 40, 10, { x: 0.5, y: -5 })).toBe(true);
    expect(inView(cam, 40, 10, { x: 5, y: -2 })).toBe(false);
    expect(inView({ x: 0, y: 0, rotation: 350 }, 40, 10, { x: 0.5, y: -5 })).toBe(true); // wraps past 0
  });

  it('measures distance to a wall and snaps', () => {
    expect(distanceToSegment({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(1);
    expect(distanceToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(3);
    expect(snap(1.13)).toBe(1.25);
  });
});
