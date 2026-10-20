import { describe, expect, it } from 'vitest';
import type { ScreenplayElement, ScriptNote } from '../types/screenplay';
import { parseEmphasis, parseFountain, toFountain, writeEmphasis } from './fountain';

const SAMPLE = `Title: _**BRICK & STEEL**_
Credit: Written by
Author: Stu Maschwitz
Source: Story by KTM
Draft date: 1/20/2012
Contact:
    Next Level Productions
    1588 Mission Dr.

# ACT ONE

= Brick and Steel meet trouble.

EXT. BRICK'S PATIO - DAY #1A#

A gorgeous day. The sun is shining. [[Find a better image.]]

But BRICK BRADDOCK, 60s, is not enjoying it.

BRICK
(quietly)
Whoa. *Really* **slow** down.
${'  '}
Please.

STEEL
I know it.

BRICK ^
Me too.

.SNIPER SCOPE POV

!SCREAMING VOICES

@McCLANE
Yippie ki-yay.

~Willy Wonka, pure imagination
~Take a look and you'll see

> THE END <

CUT TO:

> FADE TO BLACK.

===

/* This whole bit
was cut. */

INT. HALLWAY - NIGHT

[[A standalone note.]]

Empty.
`;

const text = (el: ScreenplayElement) => el.content.map((r) => r.text).join('');
const summary = (els: ScreenplayElement[]) => els.map((el) => [el.type, text(el)]);

describe('Fountain import', () => {
  const { screenplay, notes } = parseFountain(SAMPLE);
  const els = screenplay.elements;
  const find = (t: string) => els.find((el) => text(el) === t)!;

  it('reads the title page', () => {
    expect(screenplay.title).toBe('BRICK & STEEL');
    expect(screenplay.titlePage).toMatchObject({
      title: 'BRICK & STEEL', credit: 'Written by', author: 'Stu Maschwitz', source: 'Story by KTM',
      draftDate: '1/20/2012', contact: 'Next Level Productions\n1588 Mission Dr.',
    });
  });

  it('reads sections and synopses as non-printing paragraphs', () => {
    expect(find('ACT ONE').outline).toEqual({ kind: 'section', depth: 1 });
    expect(find('Brick and Steel meet trouble.').outline).toEqual({ kind: 'synopsis' });
  });

  it('reads scene headings, numbers and forced headings', () => {
    expect(find("EXT. BRICK'S PATIO - DAY")).toMatchObject({ type: 'Scene Heading', sceneNumber: '1A' });
    expect(find('SNIPER SCOPE POV').type).toBe('Scene Heading');
    expect(find('INT. HALLWAY - NIGHT').type).toBe('Scene Heading');
  });

  it('reads characters, parentheticals, dialogue with a blank line, and emphasis', () => {
    const i = els.findIndex((el) => text(el) === 'BRICK');
    expect(summary(els.slice(i, i + 3))).toEqual([
      ['Character', 'BRICK'], ['Parenthetical', '(quietly)'], ['Dialogue', 'Whoa. Really slow down.\n\nPlease.'],
    ]);
    expect(els[i + 2].content).toEqual([
      { text: 'Whoa. ' }, { text: 'Really', style: 'Italic' }, { text: ' ' }, { text: 'slow', style: 'Bold' }, { text: ' down.\n\nPlease.' },
    ]);
  });

  it('reads dual dialogue', () => {
    const steel = els.findIndex((el) => text(el) === 'STEEL');
    expect(els.slice(steel, steel + 4).map((el) => [text(el), el.isDualDialogue, el.dualDialoguePosition])).toEqual([
      ['STEEL', true, 'left'], ['I know it.', true, 'left'], ['BRICK', true, 'right'], ['Me too.', true, 'right'],
    ]);
  });

  it('reads forced action, forced characters, lyrics, centered text and transitions', () => {
    expect(find('SCREAMING VOICES').type).toBe('Action');
    expect(find('McCLANE').type).toBe('Character');
    expect(find("Willy Wonka, pure imagination\nTake a look and you'll see")).toMatchObject({ type: 'Action', lyric: true });
    expect(find('THE END')).toMatchObject({ type: 'Action', centered: true });
    expect(find('CUT TO:').type).toBe('Transition');
    expect(find('FADE TO BLACK.').type).toBe('Transition');
  });

  it('reads page breaks, boneyard and notes', () => {
    const hallway = els.findIndex((el) => text(el) === 'INT. HALLWAY - NIGHT');
    expect(els[hallway - 1]).toMatchObject({ outline: { kind: 'boneyard' }, content: [{ text: ' This whole bit\nwas cut. ' }] });
    // the page break skips the non-printing boneyard and lands on the heading
    expect(els.filter((el) => el.pageBreakBefore).map(text)).toEqual(['INT. HALLWAY - NIGHT']);
    expect(text(find('A gorgeous day. The sun is shining.'))).toBe('A gorgeous day. The sun is shining.');
    expect(notes.map((n) => [text(els[n.elementIndex]), n.text])).toEqual([
      ['A gorgeous day. The sun is shining.', 'Find a better image.'],
      ['Empty.', 'A standalone note.'],
    ]);
  });
});

describe('Fountain round-trip', () => {
  it('writes back what it reads', () => {
    const first = parseFountain(SAMPLE);
    const notes: ScriptNote[] = first.notes.map((n, i) => ({
      id: `n${i}`, elementId: first.screenplay.elements[n.elementIndex].id, author: 'You', content: n.text, timestamp: new Date(), resolved: false,
    }));
    const written = toFountain(first.screenplay, notes);
    const second = parseFountain(written);

    const strip = (els: ScreenplayElement[]) => els.map(({ id: _id, ...rest }) => (void _id, rest));
    expect(strip(second.screenplay.elements)).toEqual(strip(first.screenplay.elements));
    expect(second.screenplay.titlePage).toEqual(first.screenplay.titlePage);
    expect(second.notes.map((n) => [n.elementIndex, n.text])).toEqual(first.notes.map((n) => [n.elementIndex, n.text]));
  });

  it('forces elements that would otherwise read differently', () => {
    const doc = toFountain({
      title: '', author: '', titlePage: { title: '', credit: '', author: '' },
      elements: [
        { id: '1', type: 'Scene Heading', content: [{ text: 'THE MOON' }] },
        { id: '2', type: 'Action', content: [{ text: 'INT. NOT A HEADING' }] },
        { id: '3', type: 'Action', content: [{ text: 'BANG\nBOOM' }] },
        { id: '4', type: 'Transition', content: [{ text: 'FADE OUT.' }] },
        { id: '5', type: 'Character', content: [{ text: 'McCLANE' }] },
        { id: '6', type: 'Dialogue', content: [{ text: 'Hi.' }] },
      ],
    });
    expect(doc).toBe('.THE MOON\n\n!INT. NOT A HEADING\n\n!BANG\nBOOM\n\n> FADE OUT.\n\n@McCLANE\nHi.\n');
    expect(parseFountain(doc).screenplay.elements.map((el) => el.type)).toEqual(
      ['Scene Heading', 'Action', 'Action', 'Transition', 'Character', 'Dialogue']);
  });

  it('round-trips emphasis, including nesting and escapes', () => {
    for (const markup of ['***bold italic***', '**_bold underline_**', 'a \\*literal\\* star', 'plain']) {
      expect(writeEmphasis(parseEmphasis(markup))).toBe(markup === '**_bold underline_**' ? '_**bold underline**_' : markup);
    }
    expect(parseEmphasis('**_both_**')).toEqual([{ text: 'both', style: 'Bold+Underline' }]);
  });
});
