import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScreenplayStore } from '../store/screenplayStore';
import type { Breakdown, BreakdownElement, BreakdownScene } from '../types/screenplay';
import { syncElementList } from '../utils/elements';
import { offerLinkedElements } from './elementLinking';

const scene = (id: string): BreakdownScene => ({
  id, sceneNumber: id, intExt: 'INT', location: 'HOUSE', timeOfDay: 'DAY', dayNight: 'Day',
  eighths: 8, pageStart: 1, pageEnd: 1, description: '', elements: [], castIds: [],
});
const tag = (id: string, text: string, category: string, sceneId: string): BreakdownElement => ({
  id, text, category, sceneId, sourceElementId: 'x', startOffset: 0, endOffset: text.length,
});

// ADA is linked to her REVOLVER; tag ADA in scene s2
function setup(mode: Breakdown['elementLinkMode']) {
  let b: Breakdown = syncElementList({
    id: 'b', name: 'B', scriptVersionId: 'main',
    versionInfo: { scriptVersionId: 'main', scriptVersionName: 'Current', createdAt: new Date(), lastSyncedAt: new Date(), missingElements: [], newScenes: [], syncStatus: 'current' },
    elements: [tag('t1', 'Ada', 'Cast Members', 's1'), tag('t2', 'Revolver', 'Props', 's1'), tag('t3', 'Ada', 'Cast Members', 's2')],
    scenes: [scene('s1'), scene('s2')], customCategories: [], castList: [], locationsList: [], createdAt: new Date(), updatedAt: new Date(),
    elementLinkMode: mode,
  });
  const ada = b.elementList!.find((e) => e.name === 'ADA')!;
  const revolver = b.elementList!.find((e) => e.name === 'REVOLVER')!;
  b = { ...b, elementList: b.elementList!.map((e) => (e.id === ada.id ? { ...e, linkedElementIds: [revolver.id] } : e)) };
  useScreenplayStore.setState({ breakdown: b });
}
const propsInS2 = () => useScreenplayStore.getState().breakdown!.elements.filter((e) => e.sceneId === 's2' && e.category === 'Props').length;

afterEach(() => vi.restoreAllMocks());

describe('offerLinkedElements', () => {
  it('adds linked elements without asking in auto mode', () => {
    setup('auto');
    expect(offerLinkedElements(['t3'])).toBe(1);
    expect(propsInS2()).toBe(1);
  });

  it('asks first in confirm mode and respects a no', () => {
    setup('confirm');
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(offerLinkedElements(['t3'])).toBe(0);
    expect(ask).toHaveBeenCalledWith(expect.stringContaining('Props: REVOLVER'));
    expect(propsInS2()).toBe(0);
  });

  it('does nothing in never mode or when nothing is linked', () => {
    setup('never');
    expect(offerLinkedElements(['t3'])).toBe(0);
    setup('auto');
    expect(offerLinkedElements(['t1'])).toBe(0); // REVOLVER already in s1
  });
});
