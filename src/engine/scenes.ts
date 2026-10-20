// Scene-level edits used by Index Cards, the Navigator and Edit > Rename
// Character. Pure functions over script elements.

import type { ScreenplayElement } from '../types/screenplay';

export interface SceneRange {
  headingIndex: number;
  start: number; // first element (the heading)
  end: number; // one past the last element of the scene
}

export const sceneRanges = (elements: ScreenplayElement[]): SceneRange[] => {
  const ranges: SceneRange[] = [];
  elements.forEach((el, i) => {
    if (el.type !== 'Scene Heading') return;
    if (ranges.length) ranges[ranges.length - 1].end = i;
    ranges.push({ headingIndex: i, start: i, end: elements.length });
  });
  return ranges;
};

// Moves scene `from` so it becomes scene `to` (by position among scenes).
// Anything before the first scene heading stays where it is.
export const moveScene = (elements: ScreenplayElement[], from: number, to: number): ScreenplayElement[] => {
  const ranges = sceneRanges(elements);
  if (from === to || !ranges[from] || !ranges[to]) return elements;
  const lead = elements.slice(0, ranges[0].start);
  const scenes = ranges.map((r) => elements.slice(r.start, r.end));
  const [moved] = scenes.splice(from, 1);
  scenes.splice(to, 0, moved);
  return [...lead, ...scenes.flat()];
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m) => m.toUpperCase());

// Edit > Rename Character: the character's name on every Character line
// (extensions kept), and optionally where the name appears in other text,
// in capitals or in title case
export const renameCharacter = (
  elements: ScreenplayElement[],
  from: string,
  to: string,
  alsoInText: boolean,
): { elements: ScreenplayElement[]; count: number } => {
  const oldName = from.trim().toUpperCase();
  const newName = to.trim().toUpperCase();
  if (!oldName || !newName || oldName === newName) return { elements, count: 0 };
  const word = (name: string) => new RegExp(`(?<![\\p{L}\\p{N}_])${escape(name)}(?![\\p{L}\\p{N}_])`, 'gu');
  let count = 0;
  const out = elements.map((el) => {
    const text = el.content.map((r) => r.text).join('');
    let next = text;
    if (el.type === 'Character') {
      const m = /^(\s*)(.*?)(\s*\(.*)?$/.exec(text)!;
      if (m[2].trim().toUpperCase() === oldName) next = `${m[1]}${newName}${m[3] ?? ''}`;
    } else if (alsoInText) {
      next = text.replace(word(oldName), newName).replace(word(titleCase(oldName)), titleCase(newName));
    }
    if (next === text) return el;
    count++;
    return { ...el, content: [{ text: next }] };
  });
  return { elements: out, count };
};
