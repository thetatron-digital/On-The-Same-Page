import { describe, expect, it } from 'vitest';
import type { ElementType, ScreenplayElement } from '../types/screenplay';
import { createDefaultTableReadSettings } from '../types/screenplay';
import { buildReadQueue, defaultVoiceName, NARRATOR, speakableHeading } from './tableRead';

const el = (id: string, type: ElementType, text: string, extra: Partial<ScreenplayElement> = {}): ScreenplayElement => ({ id, type, content: [{ text }], ...extra });
const script = [
  el('h', 'Scene Heading', 'INT. KITCHEN - DAY'),
  el('a', 'Action', 'Alex waits.'),
  el('c', 'Character', 'ALEX (V.O.)'),
  el('p', 'Parenthetical', '(softly)'),
  el('d', 'Dialogue', 'Hello?'),
  el('s', 'General', 'A synopsis', { outline: { kind: 'synopsis' } }),
  el('c2', 'Character', 'SAM'),
  el('d2', 'Dialogue', 'Here.'),
];

describe('table read', () => {
  it('reads headings and action as the narrator and speeches in each character voice', () => {
    const queue = buildReadQueue(script, createDefaultTableReadSettings());
    expect(queue.map((q) => [q.speaker === NARRATOR ? 'N' : q.speaker, q.text])).toEqual([
      ['N', 'Interior. Kitchen, day.'], ['N', 'Alex waits.'], ['ALEX', 'Hello?'], ['SAM', 'Here.'],
    ]);
  });

  it('can read character names and parentheticals, or skip narration', () => {
    const settings = { ...createDefaultTableReadSettings(), readNarration: false, readCharacterNames: true, readParentheticals: true };
    expect(buildReadQueue(script, settings).map((q) => q.text)).toEqual(['ALEX', 'softly', 'Hello?', 'SAM', 'Here.']);
  });

  it('starts from a paragraph inside a speech with the right speaker', () => {
    expect(buildReadQueue(script, createDefaultTableReadSettings(), 4)[0]).toMatchObject({ speaker: 'ALEX', text: 'Hello?' });
  });

  it('says scene headings naturally and spreads voices over characters', () => {
    expect(speakableHeading('EXT. ROOF - NIGHT')).toBe('Exterior. Roof, night.');
    expect(speakableHeading('INT./EXT. CAR - MOVING')).toBe('Interior, exterior. Car, moving.');
    const voices = ['A', 'B', 'C'];
    expect(defaultVoiceName('ALEX', voices)).toBe(defaultVoiceName('ALEX', voices));
    expect(new Set(['ALEX', 'SAM', 'JO', 'KIM'].map((n) => defaultVoiceName(n, voices))).size).toBeGreaterThan(1);
    expect(defaultVoiceName('ALEX', [])).toBeUndefined();
    expect(['A', 'B', 'C', 'D'].map((n) => defaultVoiceName(n, ['Jester', 'Samantha']))).toEqual(['Samantha', 'Samantha', 'Samantha', 'Samantha']);
  });
});
