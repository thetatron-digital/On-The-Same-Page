import { describe, expect, it } from 'vitest';
import type { ElementType, ScreenplayElement } from '../types/screenplay';
import { findAll, findNext, replaceAll, replaceMatch } from './find';

const el = (id: string, type: ElementType, text: string, extra: Partial<ScreenplayElement> = {}): ScreenplayElement =>
  ({ id, type, content: [{ text }], ...extra });
const text = (e: ScreenplayElement) => e.content.map((r) => r.text).join('');
const all = { matchCase: false, wholeWord: false, element: 'All' as const };

const script = [
  el('a', 'Action', 'Rain on the window. Rainy days.'),
  el('b', 'Character', 'RAINE'),
  el('c', 'Dialogue', 'I hate rain.'),
  el('d', 'General', 'rain', { outline: { kind: 'synopsis' } }),
];

describe('find', () => {
  it('finds every match in script order, skipping non-printing text', () => {
    expect(findAll(script, 'rain', all).map((m) => [m.elementId, m.start])).toEqual([['a', 0], ['a', 20], ['b', 0], ['c', 7]]);
  });

  it('honors match case, whole words and the element filter', () => {
    expect(findAll(script, 'rain', { ...all, matchCase: true }).map((m) => m.elementId)).toEqual(['c']);
    expect(findAll(script, 'rain', { ...all, wholeWord: true }).map((m) => [m.elementId, m.start])).toEqual([['a', 0], ['c', 7]]);
    expect(findAll(script, 'rain', { ...all, element: 'Dialogue' }).map((m) => m.elementId)).toEqual(['c']);
  });

  it('finds the next match forwards or backwards, wrapping around', () => {
    const matches = findAll(script, 'rain', all);
    expect(findNext(matches, { index: 0, offset: 1 })).toMatchObject({ elementId: 'a', start: 20 });
    expect(findNext(matches, { index: 2, offset: 11 })).toMatchObject({ elementId: 'a', start: 0 });
    expect(findNext(matches, { index: 1, offset: 0 }, true)).toMatchObject({ elementId: 'a', start: 20 });
  });

  it('replaces one match or all of them', () => {
    const [first] = findAll(script, 'rain', all);
    expect(text(replaceMatch(script, first, 'Snow')[0])).toBe('Snow on the window. Rainy days.');
    const { elements, count } = replaceAll(script, 'rain', 'snow', { ...all, wholeWord: true });
    expect(count).toBe(2);
    expect(elements.map(text)).toEqual(['snow on the window. Rainy days.', 'RAINE', 'I hate snow.', 'rain']);
  });
});
