import { describe, expect, it } from 'vitest';
import type { ElementType, ScreenplayElement } from '../types/screenplay';
import { createDefaultRevisionSettings } from '../types/screenplay';
import { nextPageLabel, paginate } from './paginate';
import {
  clearRevised,
  lockPagesAt,
  markRevised,
  numberScenes,
  pageRevision,
  removeSceneNumbers,
  showsRevisionMark,
  stampRevisions,
  toggleOmitScene,
  unlockAPages,
} from './production';

let nextId = 0;
const el = (type: ElementType, text: string, extra: Partial<ScreenplayElement> = {}): ScreenplayElement => ({
  id: `p${nextId++}`,
  type,
  content: [{ text }],
  ...extra,
});
const text = (e: ScreenplayElement) => e.content.map((r) => r.text).join('');
const actions = (n: number) => Array.from({ length: n }, (_, i) => el('Action', `Beat ${i + 1}.`));

describe('revisions', () => {
  it('has the 19 standard revision sets, Blue first', () => {
    const { sets, activeSetId, revisionMode, marksShown, markLocation } = createDefaultRevisionSettings();
    expect(sets).toHaveLength(19);
    expect(sets.map((s) => s.label.split(' ')[0])).toEqual([
      'Blue', 'Pink', 'Yellow', 'Green', 'Goldenrod', 'Buff', 'Salmon', 'Cherry', 'Tan',
      '2nd', '2nd', '2nd', '2nd', '2nd', '2nd', '2nd', '2nd', '2nd', '2nd',
    ]);
    expect(sets[9].label).toBe('2nd White Revision');
    expect(sets.every((s) => s.mark === '*')).toBe(true);
    expect({ activeSetId, revisionMode, marksShown, markLocation }).toEqual({
      activeSetId: 1, revisionMode: false, marksShown: 'active', markLocation: 7.75,
    });
  });

  it('stamps new and edited paragraphs with the active set in Revision Mode', () => {
    const a = el('Action', 'Rain.');
    const b = el('Action', 'Wind.');
    const prev = [a, b];
    const next = [a, { ...b, content: [{ text: 'Thunder.' }] }, el('Action', 'Hail.')];
    const stamped = stampRevisions(prev, next, 2);
    expect(stamped.map((e) => e.revisionId)).toEqual([undefined, 2, 2]);
    expect(stampRevisions(prev, prev, 2)).toBe(prev);
  });

  it('marks and clears revised paragraphs, runs included', () => {
    const script = [el('Action', 'One.'), el('Action', 'Two.')];
    const marked = markRevised(script, new Set([script[1].id]), 3);
    expect(marked[1].revisionId).toBe(3);
    expect(marked[1].content[0].revisionId).toBe(3);
    const cleared = clearRevised(marked, new Set([script[1].id]));
    expect(cleared[1].revisionId).toBeUndefined();
    expect(cleared[1].content[0].revisionId).toBeUndefined();
  });

  it('shows marks for the active set only unless all are shown', () => {
    const settings = { ...createDefaultRevisionSettings(), activeSetId: 2 };
    expect(showsRevisionMark(2, settings)).toBe(true);
    expect(showsRevisionMark(1, settings)).toBe(false);
    expect(showsRevisionMark(1, { ...settings, marksShown: 'all' })).toBe(true);
    expect(showsRevisionMark(undefined, { ...settings, marksShown: 'all' })).toBe(false);
  });

  it('finds the revision that colors each page', () => {
    const script = [...actions(10), el('Action', 'Changed.', { revisionId: 1 })];
    const { pages } = paginate(script, { linesPerPage: 12 });
    const settings = createDefaultRevisionSettings();
    expect(pages.map((p) => pageRevision(p, script, settings)?.label)).toEqual([undefined, 'Blue Revision']);
  });
});

describe('locked pages', () => {
  it('numbers A-pages after a locked page', () => {
    expect(['12', '12A', '12B', '12Z'].map(nextPageLabel)).toEqual(['12A', '12B', '12C', '12ZA']);
  });

  it('keeps locked pages where they were and puts overflow on A-pages', () => {
    const script = actions(12); // 6 per 12-line page: pages 1, 2
    const before = paginate(script, { linesPerPage: 12 });
    const locks = lockPagesAt(before, script);
    expect(locks.map((l) => [l.label, l.elementId])).toEqual([['1', script[0].id], ['2', script[6].id]]);

    // Add three beats to page 1: they no longer fit, so an A-page appears and page 2 stays put
    const grown = [...script.slice(0, 3), ...actions(3), ...script.slice(3)];
    const after = paginate(grown, { linesPerPage: 12, lockedPages: locks });
    expect(after.pages.map((p) => p.label)).toEqual(['1', '1A', '2']);
    expect(after.pages[2].items[0]).toMatchObject({ kind: 'element', elementId: script[6].id });

    // Delete beats from page 1: it ends short and page 2 still starts at the same beat
    const shrunk = script.filter((_, i) => i !== 1 && i !== 2);
    const short = paginate(shrunk, { linesPerPage: 12, lockedPages: locks });
    expect(short.pages.map((p) => p.label)).toEqual(['1', '2']);
    expect(short.pages[0].items).toHaveLength(4);
  });

  it('keeps a locked break inside a speech, with (MORE) and (CONT\'D)', () => {
    const speech = Array.from({ length: 9 }, (_, i) => `Sentence ${i + 1} runs on for a little while before it stops.`).join(' ');
    const script = [el('Action', 'Rain.'), el('Character', 'ALEX'), el('Dialogue', speech)];
    const before = paginate(script, { linesPerPage: 12 });
    const locks = lockPagesAt(before, script);
    expect(locks[1]).toMatchObject({ elementId: script[2].id, offset: before.breaks[0].offset });

    // Shorten the action above: the locked page still breaks at the same sentence
    const edited = [{ ...script[0] }, script[1], script[2]];
    const after = paginate(edited, { linesPerPage: 12, lockedPages: locks });
    expect(after.breaks[0]).toMatchObject({ offset: before.breaks[0].offset, more: '(MORE)', contd: "ALEX (CONT'D)" });
    expect(after.pages.map((p) => p.label)).toEqual(['1', '2']);
  });

  it('unlocks A-pages only', () => {
    const locks = [
      { label: '1', elementId: 'a', offset: 0 },
      { label: '1A', elementId: 'b', offset: 0 },
      { label: '2', elementId: 'c', offset: 0 },
    ];
    expect(unlockAPages(locks).map((l) => l.label)).toEqual(['1', '2']);
  });
});

describe('scene numbers', () => {
  const scenes = () => [
    el('Scene Heading', 'INT. A - DAY'), el('Action', 'a.'),
    el('Scene Heading', 'INT. B - DAY'), el('Action', 'b.'),
    el('Scene Heading', 'INT. C - DAY'),
  ];
  const numbers = (els: ScreenplayElement[]) => els.filter((e) => e.type === 'Scene Heading').map((e) => e.sceneNumber);

  it('numbers every scene, or from the current one, from a starting number', () => {
    const script = scenes();
    expect(numbers(numberScenes(script, { scheme: '1A', keepExisting: false, startAt: 1 }))).toEqual(['1', '2', '3']);
    const fromB = numberScenes(script, { scheme: '1A', keepExisting: false, startAt: 10, fromElementId: script[2].id });
    expect(numbers(fromB)).toEqual([undefined, '10', '11']);
  });

  it('keeps existing numbers and gives new scenes A-numbers (1A and A2 schemes)', () => {
    const numbered = numberScenes(scenes(), { scheme: '1A', keepExisting: false, startAt: 1 });
    const inserted = [...numbered.slice(0, 2), el('Scene Heading', 'INT. NEW - DAY'), el('Scene Heading', 'INT. NEWER - DAY'), ...numbered.slice(2), el('Scene Heading', 'INT. END - DAY')];
    expect(numbers(numberScenes(inserted, { scheme: '1A', keepExisting: true, startAt: 1 }))).toEqual(['1', '1A', '1B', '2', '3', '4']);
    expect(numbers(numberScenes(inserted, { scheme: 'A2', keepExisting: true, startAt: 1 }))).toEqual(['1', 'A2', 'B2', '2', '3', '4']);
  });

  it('removes scene numbers', () => {
    const numbered = numberScenes(scenes(), { scheme: '1A', keepExisting: false, startAt: 1 });
    expect(numbers(removeSceneNumbers(numbered))).toEqual([undefined, undefined, undefined]);
  });
});

describe('omit scene', () => {
  it('replaces a scene with OMITTED, keeping its number, and restores it', () => {
    const script = [
      el('Scene Heading', 'INT. A - DAY', { sceneNumber: '1' }), el('Action', 'a.'),
      el('Scene Heading', 'INT. B - DAY', { sceneNumber: '2' }), el('Action', 'b.'), el('Character', 'ALEX'), el('Dialogue', 'Hi.'),
      el('Scene Heading', 'INT. C - DAY', { sceneNumber: '3' }),
    ];
    const omitted = toggleOmitScene(script, script[4].id); // any element in scene 2
    expect(omitted.map(text)).toEqual(['INT. A - DAY', 'a.', 'OMITTED', 'INT. C - DAY']);
    expect(omitted[2].sceneNumber).toBe('2');

    const restored = toggleOmitScene(omitted, omitted[2].id);
    expect(restored.map(text)).toEqual(script.map(text));
    expect(restored[2].sceneNumber).toBe('2');
  });
});

describe('PDF output', () => {
  it('prints only revised pages when asked', async () => {
    const { generatePDF } = await import('../utils/pdf');
    const script = [...actions(60), el('Action', 'Changed.', { revisionId: 1 }), ...actions(60)];
    const titlePage = { title: '', credit: '', author: '' };
    const all = generatePDF({ title: '', author: '', titlePage, elements: script }).getNumberOfPages();
    const revised = generatePDF({ title: 'T', author: '', titlePage, elements: script }, { revisedPagesOnly: true });
    expect(all).toBeGreaterThan(2);
    expect(revised.getNumberOfPages()).toBe(1);
  });
});
