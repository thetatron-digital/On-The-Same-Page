import { describe, expect, it } from 'vitest';
import { effectiveDurationMs } from './storyboardMedia';

describe('storyboard media', () => {
  it('holds a board for the longer of its duration and its audio', () => {
    const audio = (durationMs: number) => ({ dataUrl: '', name: 'a', durationMs });
    expect(effectiveDurationMs({ id: 'a', order: 1, description: '' }, 2000)).toBe(2000);
    expect(effectiveDurationMs({ id: 'a', order: 1, description: '', durationMs: 1500 }, 2000)).toBe(1500);
    expect(effectiveDurationMs({ id: 'a', order: 1, description: '', durationMs: 1500, audio: audio(3200) }, 2000)).toBe(3200);
    expect(effectiveDurationMs({ id: 'a', order: 1, description: '', audio: audio(900) }, 2000)).toBe(2000);
  });
});
