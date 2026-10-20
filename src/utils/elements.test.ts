import { describe, expect, it } from 'vitest';
import type { Breakdown, BreakdownElement, BreakdownScene } from '../types/screenplay';
import { deleteElement, elementUsage, mergeElements, renumberBoardIds, syncElementList } from './elements';

const scene = (id: string, n: string): BreakdownScene => ({
  id, sceneNumber: n, intExt: 'INT', location: 'HOUSE', timeOfDay: 'DAY', dayNight: 'Day',
  eighths: 8, pageStart: 1, pageEnd: 1, description: '', elements: [], castIds: [],
});
const tag = (id: string, text: string, category: string, sceneId: string): BreakdownElement => ({
  id, text, category, sceneId, sourceElementId: 'x', startOffset: 0, endOffset: text.length,
});

const scenes = [scene('s1', '1'), scene('s2', '2'), scene('s3', '3')];
const base = (): Breakdown => ({
  id: 'b', name: 'B', scriptVersionId: 'main',
  versionInfo: { scriptVersionId: 'main', scriptVersionName: 'Current', createdAt: new Date(), lastSyncedAt: new Date(), missingElements: [], newScenes: [], syncStatus: 'current' },
  elements: [
    tag('t1', 'revolver', 'Props', 's2'),
    tag('t2', ' Revolver ', 'Props', 's3'),
    tag('t3', 'Ada', 'Cast', 's3'),
    tag('t4', 'Grace', 'Cast', 's1'),
    tag('t5', 'revolver', 'Weapons', 's1'), // same text, different category
  ],
  scenes, customCategories: [], castList: [], locationsList: [], createdAt: new Date(), updatedAt: new Date(),
});

describe('element master list', () => {
  it('creates one record per category + name and links every tag', () => {
    const b = syncElementList(base());
    expect(b.elementList!.map((e) => `${e.category}:${e.name}`).sort()).toEqual(['Cast:ADA', 'Cast:GRACE', 'Props:REVOLVER', 'Weapons:REVOLVER']);
    expect(b.elements.every((t) => t.elementRefId)).toBe(true);
    expect(b.elements[0].elementRefId).toBe(b.elements[1].elementRefId);
  });

  it('is idempotent', () => {
    const once = syncElementList(base());
    expect(syncElementList(once)).toBe(once);
  });

  it('counts occurrences per sheet in script order', () => {
    const b = syncElementList(base());
    const revolver = b.elementList!.find((e) => e.category === 'Props')!;
    expect(elementUsage(b, scenes).get(revolver.id)).toEqual({ sceneIds: ['s2', 's3'], occurrences: 2 });
  });

  it('renumbers Board IDs by first appearance, keeping locked IDs', () => {
    let b = syncElementList(base());
    b = renumberBoardIds(b, scenes, 'Cast');
    const id = (name: string) => b.elementList!.find((e) => e.name === name)!.boardId;
    expect([id('GRACE'), id('ADA')]).toEqual(['1', '2']); // Grace appears in scene 1
    b = { ...b, elementList: b.elementList!.map((e) => (e.name === 'ADA' ? { ...e, boardId: '1', lockBoardId: true } : e)) };
    b = renumberBoardIds(b, scenes, 'Cast');
    expect([id('ADA'), id('GRACE')]).toEqual(['1', '2']);
  });

  it('merges elements and repoints their tags', () => {
    let b = syncElementList(base());
    const [props, weapons] = ['Props', 'Weapons'].map((c) => b.elementList!.find((e) => e.category === c)!.id);
    b = mergeElements(b, props, [weapons]);
    expect(b.elementList!.some((e) => e.id === weapons)).toBe(false);
    expect(b.elements.find((t) => t.id === 't5')!.elementRefId).toBe(props);
  });

  it('deletes an element with all its tags', () => {
    let b = syncElementList(base());
    const props = b.elementList!.find((e) => e.category === 'Props')!.id;
    b = deleteElement(b, props);
    expect(b.elements.map((t) => t.id)).toEqual(['t3', 't4', 't5']);
  });
});
