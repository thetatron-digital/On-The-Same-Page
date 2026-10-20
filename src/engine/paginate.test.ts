import { describe, expect, it } from 'vitest';
import type { ElementType, ScreenplayElement } from '../types/screenplay';
import { generatePDF } from '../utils/pdf';
import { paginate, paginateScript, wrapText, type ElementItem, type MarkerItem, type Page } from './paginate';

let nextId = 0;
const el = (type: ElementType, text: string, extra: Partial<ScreenplayElement> = {}): ScreenplayElement => ({
  id: `e${nextId++}`,
  type,
  content: [{ text }],
  ...extra,
});

// n one-line sentences joined by hard line breaks, so each is exactly one wrapped line
const sentences = (n: number, end = '.') =>
  Array.from({ length: n }, (_, i) => `Line ${i + 1} of the speech${end}`).join('\n');

const actions = (n: number) => Array.from({ length: n }, (_, i) => el('Action', `Beat ${i + 1}.`));

const elementItems = (page: Page) => page.items.filter((i): i is ElementItem => i.kind === 'element');
const markers = (page: Page) => page.items.filter((i): i is MarkerItem => i.kind !== 'element' && i.kind !== 'dual');

describe('wrapText', () => {
  it('wraps at spaces within the width and keeps character offsets', () => {
    const lines = wrapText('The quick brown fox jumps over', 10);
    expect(lines.map((l) => l.text)).toEqual(['The quick', 'brown fox', 'jumps over']);
    expect(lines.map((l) => l.start)).toEqual([0, 10, 20]);
  });

  it('breaks inside hyphenated words, cuts words longer than a line, and keeps hard breaks', () => {
    expect(wrapText('a well-known fact', 8).map((l) => l.text)).toEqual(['a well-', 'known', 'fact']);
    expect(wrapText('abcdefghijkl', 5).map((l) => l.text)).toEqual(['abcde', 'fghij', 'kl']);
    expect(wrapText('one\ntwo', 20).map((l) => [l.text, l.start])).toEqual([['one', 0], ['two', 4]]);
  });

  it('gives an empty element one line', () => {
    expect(wrapText('', 60)).toEqual([{ text: '', start: 0, end: 0 }]);
  });
});

describe('paginate: spacing', () => {
  it('uses ELEMENT_FORMATTING spacing, with none inside a dialogue block', () => {
    const script = [
      el('Scene Heading', 'INT. KITCHEN - DAY'),
      el('Action', 'Rain on the window.'),
      el('Character', 'ALEX'),
      el('Parenthetical', '(quietly)'),
      el('Dialogue', 'Hello.'),
      el('Action', 'Silence.'),
      el('Scene Heading', 'EXT. STREET - NIGHT'),
    ];
    const tops = elementItems(paginate(script).pages[0]).map((i) => i.top);
    // heading, blank, action, blank, character, paren, dialogue, blank, action, 2 blanks, heading
    expect(tops).toEqual([0, 2, 4, 5, 6, 8, 11]);
  });

  it('fills 55 lines per page by default', () => {
    // 1 line + 1 blank each: 28 one-line actions fill 55 lines exactly
    const result = paginate(actions(60));
    expect(result.linesPerPage).toBe(55);
    expect(result.pages.map((p) => elementItems(p).length)).toEqual([28, 28, 4]);
    expect(result.pages[0].linesUsed).toBe(55);
    expect(result.breaks.map((b) => [b.page, b.elementIndex, b.line])).toEqual([[2, 28, 0], [3, 56, 0]]);
    expect(result.elementPages[27]).toBe(1);
    expect(result.elementPages[28]).toBe(2);
  });
});

describe('paginate: keeping elements together', () => {
  it('moves a Scene Heading that would be orphaned at the bottom of a page', () => {
    // 5 actions use lines 0-8; the heading would land on line 11, the last, with no room for its action
    const script = [...actions(5), el('Scene Heading', 'INT. HALL - DAY'), el('Action', 'Footsteps.')];
    const result = paginate(script, { linesPerPage: 12 });
    expect(result.pageCount).toBe(2);
    expect(result.elementPages[5]).toBe(2);
    expect(result.breaks[0]).toMatchObject({ page: 2, elementIndex: 5, line: 0 });
    expect(elementItems(result.pages[1]).map((i) => [i.type, i.top])).toEqual([['Scene Heading', 0], ['Action', 2]]);
  });

  it('carries a heading, character and short speech over together', () => {
    const script = [
      ...actions(4), // lines 0-6
      el('Scene Heading', 'INT. HALL - DAY'), // would be line 9
      el('Character', 'ALEX'), // line 11
      el('Dialogue', 'Short.'), // line 12: past the bottom
    ];
    const result = paginate(script, { linesPerPage: 12 });
    expect(result.elementPages.slice(4)).toEqual([2, 2, 2]);
    expect(markers(result.pages[0])).toEqual([]);
  });

  it('never leaves a Character name alone at the bottom of a page', () => {
    const script = [...actions(5), el('Character', 'ALEX'), el('Dialogue', 'Hi.\nThere.\nYou.')];
    const result = paginate(script, { linesPerPage: 12 });
    expect(result.elementPages[5]).toBe(2);
    expect(result.elementPages[6]).toBe(2);
    expect(result.pages[0].items.some((i) => i.kind === 'more')).toBe(false);
  });

  it('keeps the element before a Transition with it', () => {
    const script = [...actions(5), el('Action', 'He leaves.'), el('Transition', 'CUT TO:')];
    // the last action fits on line 10, but CUT TO: would need line 12
    const result = paginate(script, { linesPerPage: 12 });
    expect(result.elementPages[5]).toBe(2);
    expect(result.elementPages[6]).toBe(2);
  });
});

describe('paginate: dialogue across a page break', () => {
  it("splits long dialogue with (MORE) and the speaker's (CONT'D)", () => {
    const script = [el('Action', 'Rain.'), el('Character', 'Alex'), el('Dialogue', sentences(12))];
    const result = paginate(script, { linesPerPage: 12 });
    const [p1, p2] = result.pages;

    expect(result.pageCount).toBe(2);
    // Character on line 2, speech from line 3; 8 lines fit with (MORE) on the last line
    const first = elementItems(p1)[2];
    expect(first).toMatchObject({ top: 3, firstLine: 0, continues: true });
    expect(first.lines).toHaveLength(8);
    expect(markers(p1)).toEqual([{ kind: 'more', top: 11, text: '(MORE)' }]);

    expect(markers(p2)).toEqual([{ kind: 'contd', top: 0, text: "ALEX (CONT'D)" }]);
    const rest = elementItems(p2)[0];
    expect(rest).toMatchObject({ top: 1, firstLine: 8, continued: true, continues: false });
    expect(rest.lines).toHaveLength(4);

    expect(result.breaks).toEqual([{
      page: 2, elementIndex: 2, elementId: script[2].id, line: 8,
      offset: rest.lines[0].start, more: '(MORE)', contd: "ALEX (CONT'D)",
    }]);
  });

  it('breaks only at the end of a sentence and re-wraps the rest on the next page', () => {
    const speech = Array.from({ length: 9 }, (_, i) =>
      `Sentence ${i + 1} runs on for a little while before it stops.`).join(' ');
    const script = [el('Action', 'Rain.'), el('Character', 'ALEX'), el('Dialogue', speech)];
    const result = paginate(script, { linesPerPage: 12 });
    const kept = elementItems(result.pages[0])[2];
    const rest = elementItems(result.pages[1])[0];
    const { offset } = result.breaks[0];

    expect(kept.lines.length).toBeLessThanOrEqual(8); // lines 3-10, (MORE) on 11
    expect(kept.lines[kept.lines.length - 1].text).toMatch(/stops\.$/);
    expect(speech.slice(offset)).toMatch(/^Sentence \d/);
    expect(rest.lines.map((l) => l.text)).toEqual(wrapText(speech.slice(offset), 35).map((l) => l.text));
    expect(rest.lines[0].start).toBe(offset);
  });

  it('moves a speech whole when no sentence end fits on the page', () => {
    const longSentence = Array.from({ length: 30 }, () => 'and on').join(' ') + ' until it ends.';
    const script = [...actions(3), el('Character', 'ALEX'), el('Dialogue', longSentence)];
    // the Character lands on line 6: with a sentence end, 2 lines + (MORE) would fit
    const result = paginate(script, { linesPerPage: 12 });
    expect(result.elementPages[3]).toBe(2);
    expect(result.elementPages[4]).toBe(2);
    expect(result.pages[0].items.some((i) => i.kind === 'more')).toBe(false);
  });

  it('keeps at least two lines of a speech on each side of the break', () => {
    // Character on line 8 leaves room for 1 line plus (MORE), so the whole block moves
    const script = [...actions(4), el('Character', 'ALEX'), el('Dialogue', sentences(6))];
    const result = paginate(script, { linesPerPage: 11 });
    expect(result.elementPages[4]).toBe(2);
    expect(result.elementPages[5]).toBe(2);
    expect(result.breaks[0].more).toBeUndefined();
  });

  it('adds (MORE)/(CONT\'D) when the break falls between parts of one speech', () => {
    const script = [
      ...actions(3), // lines 0-4
      el('Character', 'ALEX (V.O.)'), // 6
      el('Dialogue', 'One.\nTwo.\nThree.'), // 7-9
      el('Parenthetical', '(beat)'), // would be 10, but it must stay with its dialogue
      el('Dialogue', 'Four.\nFive.\nSix.'),
    ];
    const result = paginate(script, { linesPerPage: 12 });
    const [p1, p2] = result.pages;
    expect(markers(p1)).toEqual([{ kind: 'more', top: 10, text: '(MORE)' }]);
    expect(markers(p2)).toEqual([{ kind: 'contd', top: 0, text: "ALEX (V.O.) (CONT'D)" }]);
    expect(elementItems(p2).map((i) => [i.type, i.top])).toEqual([['Parenthetical', 1], ['Dialogue', 2]]);
    expect(result.breaks[0]).toMatchObject({ elementIndex: 5, line: 0 });
  });

  it("does not double an existing (CONT'D)", () => {
    const script = [el('Character', "ALEX (CONT'D)"), el('Dialogue', sentences(20))];
    const result = paginate(script, { linesPerPage: 12 });
    expect(markers(result.pages[1])[0].text).toBe("ALEX (CONT'D)");
  });

  it('splits a speech longer than a page over several pages', () => {
    const script = [el('Character', 'ALEX'), el('Dialogue', sentences(30))];
    const result = paginate(script, { linesPerPage: 12 });
    const spoken = result.pages.flatMap((p) => elementItems(p).filter((i) => i.type === 'Dialogue'))
      .reduce((n, i) => n + i.lines.length, 0);
    expect(spoken).toBe(30);
    for (const page of result.pages) expect(page.linesUsed).toBeLessThanOrEqual(12);
    for (const page of result.pages.slice(1)) expect(page.items[0]).toMatchObject({ kind: 'contd' });
  });

  it('splits long action without markers', () => {
    const script = [el('Action', 'Rain.'), el('Action', sentences(14))];
    const result = paginate(script, { linesPerPage: 12 });
    expect(result.pageCount).toBe(2);
    expect(result.pages.flatMap(markers)).toEqual([]);
    expect(result.breaks[0]).toMatchObject({ elementIndex: 1, line: 10 });
  });
});

describe('paginate: automatic character continueds', () => {
  it("adds (CONT'D) when the same character speaks again in a scene", () => {
    const script = [
      el('Scene Heading', 'INT. HALL - DAY'),
      el('Character', 'ALEX'), el('Dialogue', 'Hi.'),
      el('Action', 'She waits.'),
      el('Character', 'Alex (V.O.)'), el('Dialogue', 'Still here.'), // same speaker: CONT'D
      el('Character', 'SAM'), el('Dialogue', 'Yes.'),
      el('Character', 'ALEX'), el('Dialogue', 'Good.'), // someone spoke between: no CONT'D
      el('Scene Heading', 'EXT. YARD - DAY'),
      el('Character', 'ALEX'), el('Dialogue', 'Outside.'), // new scene: no CONT'D
      el('Character', "ALEX (CONT'D)"), el('Dialogue', 'Again.'), // already marked: not doubled
    ];
    const result = paginate(script);
    expect(result.continuedCharacters).toEqual([4]);
    const shown = elementItems(result.pages[0]).filter((i) => i.type === 'Character').map((i) => i.lines[0].text);
    expect(shown).toEqual(['ALEX', "ALEX (V.O.) (CONT'D)", 'SAM', 'ALEX', 'ALEX', "ALEX (CONT'D)"]);
  });

  it('can be turned off', () => {
    const script = [el('Character', 'ALEX'), el('Dialogue', 'Hi.'), el('Action', 'Pause.'), el('Character', 'ALEX'), el('Dialogue', 'Bye.')];
    expect(paginate(script, { autoCharacterContinueds: false }).continuedCharacters).toEqual([]);
  });
});

describe('paginate: element formatting', () => {
  it('hangs the first line of a Parenthetical one character to the left', () => {
    // 26 characters fit on the first line, 25 on the rest
    const text = '(aaaaaaaaaaaa bbbbbbbbbbbb cc)';
    const lines = elementItems(paginate([el('Character', 'ALEX'), el('Parenthetical', text)]).pages[0])[1].lines;
    expect(lines.map((l) => l.text)).toEqual(['(aaaaaaaaaaaa bbbbbbbbbbbb', 'cc)']);
    expect(wrapText(text, 25).map((l) => l.text)).toEqual(['(aaaaaaaaaaaa', 'bbbbbbbbbbbb cc)']);
  });

  it('gives General no space before, like Final Draft', () => {
    const tops = elementItems(paginate([el('Action', 'One.'), el('General', 'Two.')]).pages[0]).map((i) => i.top);
    expect(tops).toEqual([0, 1]);
  });
});

describe('paginate: dual dialogue', () => {
  it('stacks both columns into one block as tall as the taller one', () => {
    const script = [
      el('Action', 'They argue.'),
      el('Character', 'ALEX', { isDualDialogue: true, dualDialoguePosition: 'left' }),
      el('Dialogue', 'No.', { isDualDialogue: true, dualDialoguePosition: 'left' }),
      el('Character', 'SAM', { isDualDialogue: true, dualDialoguePosition: 'right' }),
      el('Dialogue', 'Yes.\nYes.\nYes.', { isDualDialogue: true, dualDialoguePosition: 'right' }),
      el('Action', 'Done.'),
    ];
    const page = paginate(script).pages[0];
    const dual = page.items.find((i) => i.kind === 'dual');
    expect(dual).toMatchObject({ top: 2, height: 4 });
    expect(elementItems(page).map((i) => i.top)).toEqual([0, 7]);
  });
});

describe('paginateScript', () => {
  it('reuses the result for the same elements array', () => {
    const script = actions(3);
    const doc = { elements: script };
    expect(paginateScript(doc)).toBe(paginateScript(doc));
    expect(paginateScript({ elements: [...script] })).not.toBe(paginateScript(doc));
  });
});

describe('PDF export', () => {
  it('has exactly the pages the engine computed', () => {
    const script: ScreenplayElement[] = [];
    for (let s = 1; s <= 12; s++) {
      script.push(el('Scene Heading', `INT. ROOM ${s} - DAY`));
      script.push(el('Action', 'A long description of the room that goes on for a while and wraps onto more lines. '.repeat(3)));
      script.push(el('Character', s % 2 ? 'ALEX' : 'SAM'));
      script.push(el('Dialogue', 'Words that keep coming, sentence after sentence. '.repeat(8)));
      script.push(el('Transition', 'CUT TO:'));
    }
    const { pageCount } = paginate(script);
    expect(pageCount).toBeGreaterThan(3);

    const titlePage = { title: 'Rain', credit: 'Written by', author: 'A. Writer' };
    expect(generatePDF({ title: '', author: '', titlePage, elements: script }).getNumberOfPages()).toBe(pageCount);
    // a title page comes on top of the script pages
    expect(generatePDF({ title: 'Rain', author: 'A. Writer', titlePage, elements: script }).getNumberOfPages()).toBe(pageCount + 1);
  });
});

describe('paginate: inserted page breaks and non-printing paragraphs', () => {
  it('starts a new page at a page break', () => {
    const script = [el('Action', 'One.'), el('Action', 'Two.', { pageBreakBefore: true }), el('Action', 'Three.')];
    const result = paginate(script);
    expect(result.pageCount).toBe(2);
    expect(result.elementPages).toEqual([1, 2, 2]);
    expect(elementItems(result.pages[1])[0]).toMatchObject({ top: 0, spaceBefore: 0 });
  });

  it('gives sections, synopses and boneyard no space on the page', () => {
    const script = [
      el('General', 'ACT ONE', { outline: { kind: 'section', depth: 1 } }),
      el('Scene Heading', 'INT. HALL - DAY'),
      el('General', 'They meet.', { outline: { kind: 'synopsis' } }),
      el('Action', 'Rain.'),
    ];
    const page = paginate(script).pages[0];
    expect(elementItems(page).map((i) => [i.type, i.top])).toEqual([['Scene Heading', 0], ['Action', 2]]);
  });
});
