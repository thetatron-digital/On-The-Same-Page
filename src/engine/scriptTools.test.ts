import { describe, expect, it } from 'vitest';
import type { ElementType, ScreenplayElement } from '../types/screenplay';
import { createDefaultMacros } from '../types/screenplay';
import { addAlt, altCount, applyMacro, bookmarks, cycleAlt, findMacro, macroBank, removeAlt, setBookmark } from './scriptTools';

const el = (id: string, type: ElementType, text: string): ScreenplayElement => ({ id, type, content: [{ text }] });
const text = (e: ScreenplayElement) => e.content.map((r) => r.text).join('');

describe('alts', () => {
  it('adds, cycles and removes alternate lines', () => {
    let script = [el('a', 'Dialogue', 'First take.')];
    script = addAlt(script, 'a');
    script = [{ ...script[0], content: [{ text: 'Second take.' }] }];
    expect(altCount(script[0])).toBe(2);
    script = cycleAlt(script, 'a', 1);
    expect(text(script[0])).toBe('First take.');
    script = cycleAlt(script, 'a', -1);
    expect(text(script[0])).toBe('Second take.');
    script = removeAlt(script, 'a');
    expect(text(script[0])).toBe('First take.');
    expect(script[0].alts).toBeUndefined();
  });
});

describe('bookmarks', () => {
  it('names and lists places', () => {
    let script = [el('a', 'Action', 'One.'), el('b', 'Action', 'Two.')];
    script = setBookmark(script, 'b', ' Midpoint ');
    expect(bookmarks(script)).toEqual([{ id: 'b', name: 'Midpoint', text: 'Two.' }]);
    expect(bookmarks(setBookmark(script, 'b', null))).toEqual([]);
  });
});

describe('macros', () => {
  const macros = createDefaultMacros();

  it('types text into the paragraph, switching its element', () => {
    const { elements, caret } = applyMacro([el('a', 'Action', '')], 'a', 0, findMacro(macros, 1, '1')!);
    expect(elements[0]).toMatchObject({ type: 'Scene Heading', content: [{ text: 'INT. ' }] });
    expect(caret).toEqual({ id: 'a', offset: 5 });
  });

  it('starts the transition paragraph after', () => {
    const script = [el('a', 'Scene Heading', 'INT. KITCHEN')];
    const { elements, caret } = applyMacro(script, 'a', 12, findMacro(macros, 1, '4')!);
    expect(elements.map((e) => [e.type, text(e)])).toEqual([['Scene Heading', 'INT. KITCHEN - DAY'], ['Action', '']]);
    expect(caret).toEqual({ id: elements[1].id, offset: 0 });
  });

  it('reads the macro chord per platform', () => {
    const k = (ctrlKey: boolean, altKey: boolean, shiftKey: boolean, metaKey = false) => ({ ctrlKey, altKey, shiftKey, metaKey });
    expect(macroBank(k(true, true, false), true)).toBe(1);
    expect(macroBank(k(true, true, true), true)).toBe(2);
    expect(macroBank(k(false, true, false, true), true)).toBe(0); // Cmd+Opt: element shortcut
    expect(macroBank(k(false, true, true), false)).toBe(1);
    expect(macroBank(k(true, true, true), false)).toBe(2);
    expect(macroBank(k(true, true, false), false)).toBe(0); // Ctrl+Alt: element shortcut
  });
});
