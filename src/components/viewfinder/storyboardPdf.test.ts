import { describe, expect, it } from 'vitest';
import { storyboardPdf } from './storyboardPdf';
import { boardPositions } from '../../engine/storyboard/boards';
import type { StoryboardFrame } from '../../types/screenplay';

const frame = (i: number, extra: Partial<StoryboardFrame> = {}): StoryboardFrame => ({
  id: `f${i}`, order: i, description: '', ...extra,
});

describe('storyboard PDF', () => {
  it('lays out six boards per page with shot labels and text', () => {
    const frames = Array.from({ length: 7 }, (_, i) => frame(i, { newShot: i % 3 === 0, dialogue: i === 0 ? 'MAYA: Keep it.' : undefined }));
    const doc = storyboardPdf(frames, boardPositions(frames), { title: 'Night Shift', scene: 'Scene 1: INT. DINER - NIGHT' });
    expect(doc.getNumberOfPages()).toBe(2);
    const text = doc.output();
    expect(text).toContain('Shot 1A');
    expect(text).toContain('Shot 3A');
    expect(text).toContain('MAYA: Keep it.');
  });
});
