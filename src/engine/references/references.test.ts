import { describe, expect, it } from 'vitest';
import type { ReferenceImage } from '../../types/references';
import { analyzeLook, colourDistance, palette } from './look';
import { facetCounts, matchesQuery } from './search';
import { lensBand } from './facets';

const pixels = (rgb: [number, number, number][], each = 100) => {
  const data = new Uint8ClampedArray(rgb.length * each * 4);
  rgb.forEach((c, i) => { for (let k = 0; k < each; k++) data.set([...c, 255], (i * each + k) * 4); });
  return data;
};

describe('image look', () => {
  it('finds the dominant colours, most common first', () => {
    const p = palette([...Array(300).fill([200, 40, 40]), ...Array(100).fill([20, 40, 200])], 2);
    expect(p).toEqual(['#c82828', '#1428c8']);
  });

  it('reads warm, vivid, bright pictures and dark, cool, flat ones', () => {
    expect(analyzeLook(pixels([[240, 160, 40], [250, 200, 80]]))).toMatchObject({ temperature: 'warm', saturation: 'vivid', key: 'high' });
    expect(analyzeLook(pixels([[20, 30, 60], [25, 35, 70]]))).toMatchObject({ temperature: 'cool', key: 'low', contrast: 'low' });
    expect(analyzeLook(pixels([[0, 0, 0], [255, 255, 255]]))).toMatchObject({ saturation: 'b&w', contrast: 'high' });
  });

  it('measures colour distance', () => {
    expect(colourDistance('#ff0000', '#ff0000')).toBe(0);
    expect(colourDistance('#ff0000', '#fe0505')).toBeLessThan(0.02);
    expect(colourDistance('#000000', '#ffffff')).toBeGreaterThan(0.9);
  });

  it('bands focal lengths', () => {
    expect([12, 24, 50, 85, 300].map(lensBand)).toEqual(['Ultra Wide', 'Wide', 'Medium', 'Long', 'Telephoto']);
  });
});

const img = (id: string, extra: Partial<ReferenceImage>): ReferenceImage => ({
  id, media: { store: 'local', id, mime: 'image/jpeg', size: 1, fileName: `${id}.jpg` }, thumbnail: '', width: 16, height: 9,
  look: { palette: ['#102040'], temperature: 'cool', saturation: 'muted', contrast: 'medium', key: 'low' },
  facets: {}, credits: {}, keywords: [], sceneIds: [], shotIds: [], addedAt: new Date(), ...extra,
});

describe('reference search', () => {
  const images = [
    img('a', { facets: { timeOfDay: ['Night'], frameSize: ['CU'] }, credits: { title: 'Collateral', dp: 'Dion Beebe' }, keywords: ['taxi'] }),
    img('b', { facets: { timeOfDay: ['Day'], frameSize: ['WS'] }, look: { palette: ['#e0a040'], temperature: 'warm', saturation: 'vivid', contrast: 'high', key: 'high' }, sceneIds: ['s1'] }),
    img('c', { facets: { timeOfDay: ['Night'], frameSize: ['WS'] }, focalLength: 85 }),
  ];
  const ids = (q: Parameters<typeof matchesQuery>[1]) => images.filter((i) => matchesQuery(i, q)).map((i) => i.id);

  it('filters by facets: any value within a facet, all facets together', () => {
    expect(ids({ facets: { timeOfDay: ['Night'] } })).toEqual(['a', 'c']);
    expect(ids({ facets: { timeOfDay: ['Night'], frameSize: ['WS', 'MS'] } })).toEqual(['c']);
  });

  it('searches text, look, colour, scene and decks', () => {
    expect(ids({ text: 'beebe taxi' })).toEqual(['a']);
    expect(ids({ text: '85mm' })).toEqual(['c']);
    expect(ids({ look: { temperature: ['warm'] } })).toEqual(['b']);
    expect(ids({ colour: '#e3a545' })).toEqual(['b']);
    expect(ids({ sceneId: 's1' })).toEqual(['b']);
    expect(ids({ deckImageIds: ['c', 'a'] })).toEqual(['a', 'c']);
  });

  it('counts facet values', () => {
    const counts = facetCounts(images);
    expect(counts.get('timeOfDay:Night')).toBe(2);
    expect(counts.get('frameSize:WS')).toBe(2);
  });
});
