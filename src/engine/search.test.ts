import { describe, expect, it } from 'vitest';
import type { ProjectData } from '../types/user';
import { buildSearchIndex, searchIndex } from './search';

const el = (id: string, type: string, t: string, sceneNumber?: string) => ({ id, type, content: [{ text: t }], ...(sceneNumber ? { sceneNumber } : {}) });
const data = {
  screenplay: { elements: [
    el('h1', 'Scene Heading', 'INT. DINER - NIGHT'), el('a1', 'Action', 'Rain on the windows.'),
    el('c1', 'Character', 'MAYA (V.O.)'), el('d1', 'Dialogue', 'Keep it.'),
    el('h2', 'Scene Heading', 'EXT. PARKING LOT - NIGHT', '2A'), el('c2', 'Character', 'MAYA'), el('d2', 'Dialogue', 'Go.'),
  ] },
  productionData: { people: [{ id: 'p1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@x.com', group: 'Talent', roles: [{ group: 'Talent', department: '', position: '', characterName: 'MAYA' }] }], locations: [{ id: 'l1', name: 'Rosie’s Diner', streetAddress: '1 Main St', city: 'LA' }], callSheets: [] },
  viewFinder: { shots: [{ id: 's1', sceneId: 'h1', sceneNumber: '1', shotNumber: 'A', size: 'CU', description: 'Maya at the counter' }] },
  budget: { categories: [{ number: '3300', name: 'Camera', accounts: [{ id: 'acc', number: '3301', name: 'Director of Photography' }] }] },
} as unknown as ProjectData;

describe('find anything', () => {
  const index = buildSearchIndex(data);

  it('indexes scenes, characters, people, locations, shots and accounts', () => {
    expect(index.find((i) => i.kind === 'scene' && i.target === 'h2')?.title).toBe('2A. EXT. PARKING LOT - NIGHT');
    expect(index.find((i) => i.kind === 'scene' && i.target === 'h1')?.subtitle).toBe('Rain on the windows.');
    expect(index.find((i) => i.kind === 'character')).toMatchObject({ title: 'MAYA', subtitle: '2 lines in 2 scenes', target: 'c1' });
    expect(index.map((i) => i.kind).sort()).toEqual(['account', 'character', 'location', 'person', 'scene', 'scene', 'shot']);
  });

  it('ranks title starts first and needs every word', () => {
    const maya = searchIndex(index, 'maya').map((i) => i.kind);
    expect(maya[0]).toBe('character'); // title match beats subtitle matches
    expect(maya.slice(1).sort()).toEqual(['person', 'shot']);
    expect(searchIndex(index, 'diner').map((i) => i.kind)).toEqual(['location', 'scene']);
    expect(searchIndex(index, 'parking night').map((i) => i.target)).toEqual(['h2']);
    expect(searchIndex(index, 'photography')[0].app).toBe('bottomline');
    expect(searchIndex(index, '')).toEqual([]);
    expect(searchIndex(index, 'zzz')).toEqual([]);
  });
});
