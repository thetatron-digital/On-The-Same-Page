import { describe, expect, it } from 'vitest';
import { boardLayerForName, planPsdImport } from './storyboardPsd';

describe('PSD layer mapping', () => {
  it('matches board layers by name, ignoring case and copies', () => {
    expect(boardLayerForName('Pencil')).toBe('pencil');
    expect(boardLayerForName('ink copy')).toBe('ink');
    expect(boardLayerForName('Layer 3')).toBeNull();
    expect(boardLayerForName(undefined)).toBeNull();
  });

  it('skips hidden layers and flattens unknown ones into Fill', () => {
    expect(planPsdImport([{ name: 'Reference' }, { name: 'Sketch' }, { name: 'Tone', hidden: true }, { name: 'Notes' }])).toEqual([
      { index: 0, target: 'reference' },
      { index: 1, target: 'fill' },
      { index: 3, target: 'notes' },
    ]);
  });
});
