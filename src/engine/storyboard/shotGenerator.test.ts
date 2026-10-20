import { describe, expect, it } from 'vitest';
import { FRAMED_SIZES, aimAt, applyAngle, defaultShotScene, describeShot, distanceForSpan, frameShot, framedSpan, newObject, verticalFov, type ShotScene } from './shotGenerator';

const ASPECT = 16 / 9;

describe('lens math', () => {
  it('gives a full-frame vertical field of view', () => {
    expect(verticalFov(50, ASPECT)).toBeCloseTo(22.9, 1);
    expect(verticalFov(24, ASPECT)).toBeGreaterThan(verticalFov(85, ASPECT));
  });

  it('fits a span: a longer lens stands further back', () => {
    expect(distanceForSpan(1, 85, ASPECT)).toBeGreaterThan(distanceForSpan(1, 35, ASPECT));
  });
});

describe('framing presets', () => {
  const scene = defaultShotScene();

  it('frames each shot size and reads it back', () => {
    for (const size of FRAMED_SIZES) {
      const camera = frameShot(scene, size, ASPECT);
      expect(describeShot({ ...scene, camera }, ASPECT).size).toBe(size);
    }
  });

  it('keeps the camera on its side of the subject and aims at it', () => {
    const camera = frameShot({ ...scene, camera: { ...scene.camera, x: 3, z: 0 } }, 'CU', ASPECT);
    expect(camera.x).toBeGreaterThan(0);
    expect(Math.abs(camera.z)).toBeLessThan(1e-6);
    expect(camera.pan).toBeCloseTo(90, 5); // looking toward -x
    expect(camera.tilt).toBeCloseTo(0, 5);
  });

  it('centres a medium shot on the upper body and a full shot mid-body', () => {
    expect(framedSpan('MS', 2).centerY).toBeCloseTo(1.56, 2);
    expect(framedSpan('FS', 2).centerY).toBeCloseTo(1, 5);
  });
});

describe('angles', () => {
  const base = defaultShotScene();
  const read = (camera: ShotScene['camera']) => describeShot({ ...base, camera }, ASPECT).angle;

  it('round-trips the angle presets', () => {
    expect(read(applyAngle(base, 'Eye Level'))).toBe('Eye Level');
    expect(read(applyAngle(base, 'Low Angle'))).toBe('Low Angle');
    expect(read(applyAngle(base, 'High Angle'))).toBe('High Angle');
    expect(read(applyAngle(base, "Worm's Eye"))).toBe("Worm's Eye");
    expect(read(applyAngle(base, "Bird's Eye"))).toBe("Bird's Eye");
    expect(read(applyAngle(base, 'Dutch Angle'))).toBe('Dutch Angle');
  });

  it('aims down at a point below the lens', () => {
    const { pan, tilt } = aimAt({ ...base.camera, x: 0, z: 2, height: 2 }, 0, 0, 0);
    expect(pan).toBeCloseTo(0, 5);
    expect(tilt).toBeCloseTo(-45, 5);
  });
});

describe('objects', () => {
  it('makes characters and props with their defaults', () => {
    expect(newObject('character', { x: 1, z: 2 }, 1)).toMatchObject({ name: 'Character 2', pose: 'stand', height: 1.75, x: 1, z: 2 });
    expect(newObject('wall', { x: 0, z: 0 })).toMatchObject({ kind: 'wall', width: 4 });
  });
});
