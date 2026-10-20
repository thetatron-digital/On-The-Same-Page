import { describe, expect, it } from 'vitest';
import type { ElementType, ScreenplayElement } from '../types/screenplay';
import { createDefaultHeaderFooter, createDefaultPageLayout } from '../types/screenplay';
import { linesPerPageFor, paginate } from './paginate';
import { moveScene, renameCharacter, sceneRanges } from './scenes';
import { fillFields, showsFooter, showsHeader } from '../utils/headerFooter';

const el = (id: string, type: ElementType, text: string): ScreenplayElement => ({ id, type, content: [{ text }] });
const text = (e: ScreenplayElement) => e.content.map((r) => r.text).join('');

const script = [
  el('t', 'Action', 'FADE IN:'),
  el('h1', 'Scene Heading', 'INT. A - DAY'), el('a1', 'Action', 'Alex waits.'),
  el('h2', 'Scene Heading', 'INT. B - DAY'), el('c2', 'Character', 'ALEX (V.O.)'), el('d2', 'Dialogue', 'Hi, Alex here.'),
  el('h3', 'Scene Heading', 'INT. C - DAY'),
];

describe('scenes', () => {
  it('finds scene ranges and moves whole scenes', () => {
    expect(sceneRanges(script).map((r) => [r.start, r.end])).toEqual([[1, 3], [3, 6], [6, 7]]);
    expect(moveScene(script, 2, 0).map((e) => e.id)).toEqual(['t', 'h3', 'h1', 'a1', 'h2', 'c2', 'd2']);
    expect(moveScene(script, 0, 2).map((e) => e.id)).toEqual(['t', 'h2', 'c2', 'd2', 'h3', 'h1', 'a1']);
    expect(moveScene(script, 1, 1)).toBe(script);
  });

  it('renames a character, keeping extensions, and optionally in the text', () => {
    const named = renameCharacter(script, 'alex', 'Sam', false);
    expect(named.count).toBe(1);
    expect(named.elements.map(text)).toContain('SAM (V.O.)');
    expect(named.elements.map(text)).toContain('Alex waits.');
    const everywhere = renameCharacter(script, 'ALEX', 'SAM', true);
    expect(everywhere.count).toBe(3);
    expect(everywhere.elements.map(text)).toEqual(['FADE IN:', 'INT. A - DAY', 'Sam waits.', 'INT. B - DAY', 'SAM (V.O.)', 'Hi, Sam here.', 'INT. C - DAY']);
  });
});

describe('page layout and header/footer', () => {
  it('derives lines per page from margins and line spacing', () => {
    expect(linesPerPageFor(createDefaultPageLayout())).toBe(55);
    expect(linesPerPageFor({ ...createDefaultPageLayout(), topMargin: 1.5 })).toBe(52);
    expect(linesPerPageFor({ ...createDefaultPageLayout(), lineSpacing: 'loose' })).toBe(50);
  });

  it('numbers pages from a starting number and can split speeches at any line', () => {
    const actions = Array.from({ length: 30 }, (_, i) => el(`x${i}`, 'Action', `Beat ${i}.`));
    expect(paginate(actions, { linesPerPage: 12, startingPage: 5 }).pages.map((p) => p.label).slice(0, 3)).toEqual(['5', '6', '7']);
    const speech = [el('c', 'Character', 'ALEX'), el('d', 'Dialogue', Array.from({ length: 30 }, () => 'and on').join(' ') + ' to the end.')];
    expect(paginate([el('a', 'Action', 'Rain.'), ...speech], { linesPerPage: 6 }).breaks[0].elementIndex).toBe(1); // moves whole
    expect(paginate([el('a', 'Action', 'Rain.'), ...speech], { linesPerPage: 6, breakAtSentences: false }).breaks[0]).toMatchObject({ elementIndex: 2, more: '(MORE)' });
  });

  it('fills header fields and follows the first-page options', () => {
    const ctx = { page: '12A', revision: '', date: '10/20/2026', title: 'Rain', file: 'rain.fdx', scene: '7' };
    expect(fillFields('{Page}.', ctx)).toBe('12A.');
    expect(fillFields('{Revision}', ctx)).toBe('');
    expect(fillFields('{Title} - Sc. {Scene} - {File}', ctx)).toBe('Rain - Sc. 7 - rain.fdx');
    const hf = createDefaultHeaderFooter();
    expect([showsHeader(hf, 1), showsHeader(hf, 2), showsFooter(hf, 2)]).toEqual([false, true, false]);
    expect(showsFooter({ ...hf, showFooter: true }, 1)).toBe(true);
  });
});
