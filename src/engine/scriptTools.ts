// Writing tools for ReWriter: Alt lines, Bookmarks and Macros (Final Draft's
// Insert and Document menus). Pure functions over script elements.

import type { Macro, ScreenplayElement, ScriptNote, TextRun } from '../types/screenplay';
import { createDefaultMacros } from '../types/screenplay';

const textOf = (runs: TextRun[]) => runs.map((r) => r.text).join('');
const update = (elements: ScreenplayElement[], id: string, fn: (el: ScreenplayElement) => ScreenplayElement) =>
  elements.map((el) => (el.id === id ? fn(el) : el));

// ---------------------------------------------------------------------------
// Alts: alternate versions of a line. `content` is the version in use; `alts`
// holds the others, in the order they cycle.

// Add Alt: keep the current line as an alt and carry on editing a copy of it
export const addAlt = (elements: ScreenplayElement[], id: string): ScreenplayElement[] =>
  update(elements, id, (el) => ({ ...el, alts: [...(el.alts ?? []), el.content.map((r) => ({ ...r }))] }));

// Remove Alt: drop the version in use; the next alt takes its place
export const removeAlt = (elements: ScreenplayElement[], id: string): ScreenplayElement[] =>
  update(elements, id, (el) => {
    if (!el.alts?.length) return el;
    const [next, ...rest] = el.alts;
    const out: ScreenplayElement = { ...el, content: next, alts: rest };
    if (rest.length === 0) delete out.alts;
    return out;
  });

// Show the next (or previous) alt in place of the current line
export const cycleAlt = (elements: ScreenplayElement[], id: string, direction: 1 | -1): ScreenplayElement[] =>
  update(elements, id, (el) => {
    if (!el.alts?.length) return el;
    const versions = [el.content, ...el.alts];
    const rotated = direction === 1
      ? [...versions.slice(1), versions[0]]
      : [versions[versions.length - 1], ...versions.slice(0, -1)];
    return { ...el, content: rotated[0], alts: rotated.slice(1) };
  });

export const altCount = (el: ScreenplayElement) => (el.alts?.length ?? 0) + 1;

// ---------------------------------------------------------------------------
// Bookmarks

export const setBookmark = (elements: ScreenplayElement[], id: string, name: string | null): ScreenplayElement[] =>
  update(elements, id, (el) => {
    const out = { ...el };
    if (name && name.trim()) out.bookmark = name.trim();
    else delete out.bookmark;
    return out;
  });

export const bookmarks = (elements: ScreenplayElement[]) =>
  elements.filter((el) => el.bookmark).map((el) => ({ id: el.id, name: el.bookmark!, text: textOf(el.content) }));

// ---------------------------------------------------------------------------
// Macros

export const getMacros = (script: { macros?: Macro[] }): Macro[] => script.macros ?? createDefaultMacros();

export const findMacro = (macros: Macro[], bank: 1 | 2, key: string): Macro | undefined =>
  macros.find((m) => m.bank === bank && m.key === key && (m.text || m.element !== 'None'));

let macroIds = 0;
const newId = () => `elem_${Date.now()}_m${macroIds++}`;

// Runs a macro at a caret: switch the paragraph to the macro's element, type
// its text at the caret, then start a paragraph of the transition element.
// Returns the new elements and where the caret goes.
export const applyMacro = (
  elements: ScreenplayElement[],
  id: string,
  offset: number,
  macro: Macro,
): { elements: ScreenplayElement[]; caret: { id: string; offset: number } } => {
  const index = elements.findIndex((el) => el.id === id);
  if (index < 0) return { elements, caret: { id, offset } };
  const el = elements[index];
  const text = textOf(el.content);
  const at = Math.max(0, Math.min(offset, text.length));
  const typed = text.slice(0, at) + macro.text + text.slice(at);
  const out = [...elements];
  out[index] = {
    ...el,
    type: macro.element === 'None' ? el.type : macro.element,
    content: [{ text: typed }],
  };
  if (macro.transition === 'None') {
    return { elements: out, caret: { id, offset: at + macro.text.length } };
  }
  const next: ScreenplayElement = { id: newId(), type: macro.transition, content: [{ text: '' }] };
  out.splice(index + 1, 0, next);
  return { elements: out, caret: { id: next.id, offset: 0 } };
};

// The shortcut a macro answers to, for display (spec §1.1: Mac Ctrl+Opt+N,
// elsewhere Alt+Shift+N; bank 2 adds Shift / Ctrl)
export const macroShortcut = (macro: Pick<Macro, 'bank' | 'key'>, mac: boolean): string =>
  mac
    ? `${macro.bank === 2 ? '⌃⌥⇧' : '⌃⌥'}${macro.key}`
    : `${macro.bank === 2 ? 'Ctrl+Alt+Shift+' : 'Alt+Shift+'}${macro.key}`;

// Which macro bank a key event asks for, or 0 for none
export const macroBank = (e: { ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }, mac: boolean): 0 | 1 | 2 => {
  if (e.metaKey) return 0;
  if (mac) return e.ctrlKey && e.altKey ? (e.shiftKey ? 2 : 1) : 0;
  if (e.altKey && e.shiftKey) return e.ctrlKey ? 2 : 1;
  return 0;
};

// ---------------------------------------------------------------------------
// ScriptNotes

// Notes in script order (General Notes first, then by date)
export const notesInScriptOrder = (notes: ScriptNote[], elementIds: string[]): ScriptNote[] => {
  const position = new Map(elementIds.map((id, i) => [id, i]));
  const at = (n: ScriptNote) => (n.elementId ? position.get(n.elementId) ?? Infinity : -1);
  return [...notes].sort((a, b) => at(a) - at(b) || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};
