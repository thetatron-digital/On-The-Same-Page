import { describe, expect, it } from 'vitest';
import { detectFps, displayTimecode, frameAt, framesToTimecode, shortTime, timeOfFrame, timecodeToFrames } from './timecode';

describe('timecode', () => {
  it('converts frames and timecode both ways', () => {
    expect(framesToTimecode(0, 24)).toBe('00:00:00:00');
    expect(framesToTimecode(24 * 3661 + 5, 24)).toBe('01:01:01:05');
    expect(timecodeToFrames('01:01:01:05', 24)).toBe(24 * 3661 + 5);
    expect(framesToTimecode(30, 29.97)).toBe('00:00:01:00');
    expect(timecodeToFrames('00:00:00:24', 24)).toBeNull(); // no frame 24 at 24 fps
    expect(timecodeToFrames('nonsense', 24)).toBeNull();
  });

  it('steps frames without drifting', () => {
    for (const fps of [23.976, 24, 25, 29.97, 60]) {
      for (const frame of [0, 1, 47, 1000, 86399]) expect(frameAt(timeOfFrame(frame, fps), fps)).toBe(frame);
    }
  });

  it('offsets display timecode by the clip source timecode', () => {
    expect(displayTimecode(1.5, 24, '10:00:00:00')).toBe('10:00:01:12');
    expect(shortTime(75.9)).toBe('1:15');
    expect(shortTime(3725)).toBe('1:02:05');
  });

  it('detects common frame rates from frame times', () => {
    const times = (fps: number) => Array.from({ length: 30 }, (_, i) => i / fps);
    expect(detectFps(times(23.976))).toBe(23.976);
    expect(detectFps(times(25))).toBe(25);
    expect(detectFps(times(59.94))).toBe(59.94);
    expect(detectFps([0, 0.04])).toBeNull();
  });
});
