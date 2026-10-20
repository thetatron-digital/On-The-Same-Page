// Find / Replace over script paragraphs (Edit > Find…). Options follow Final
// Draft's Find dialog: match case, whole words, and an element filter.

import type { ElementType, ScreenplayElement } from '../types/screenplay';

export interface FindOptions {
  matchCase: boolean;
  wholeWord: boolean;
  element: ElementType | 'All';
}

export interface FindMatch {
  elementId: string;
  index: number; // element index
  start: number; // character offsets in the paragraph's text
  end: number;
}

const textOf = (el: ScreenplayElement) => el.content.map((r) => r.text).join('');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pattern = (query: string, options: FindOptions) =>
  new RegExp(options.wholeWord ? `(?<![\\p{L}\\p{N}_])${escape(query)}(?![\\p{L}\\p{N}_])` : escape(query),
    `g${options.matchCase ? '' : 'i'}u`);

// Every match, in script order. Non-printing paragraphs are skipped.
export const findAll = (elements: ScreenplayElement[], query: string, options: FindOptions): FindMatch[] => {
  if (!query) return [];
  const re = pattern(query, options);
  const out: FindMatch[] = [];
  elements.forEach((el, index) => {
    if (el.outline || (options.element !== 'All' && el.type !== options.element)) return;
    const text = textOf(el);
    for (const m of text.matchAll(re)) out.push({ elementId: el.id, index, start: m.index!, end: m.index! + m[0].length });
  });
  return out;
};

// The next match after (or, backwards, before) a position in the script; wraps around
export const findNext = (
  matches: FindMatch[],
  from: { index: number; offset: number },
  backward = false,
): FindMatch | undefined => {
  if (matches.length === 0) return undefined;
  const after = (m: FindMatch) => m.index > from.index || (m.index === from.index && m.start >= from.offset);
  if (!backward) return matches.find(after) ?? matches[0];
  const before = matches.filter((m) => m.index < from.index || (m.index === from.index && m.end <= from.offset));
  return before[before.length - 1] ?? matches[matches.length - 1];
};

// Replaces one match. Paragraph styling collapses to one run, as when typing.
export const replaceMatch = (elements: ScreenplayElement[], match: FindMatch, replacement: string): ScreenplayElement[] =>
  elements.map((el) => {
    if (el.id !== match.elementId) return el;
    const text = textOf(el);
    return { ...el, content: [{ text: text.slice(0, match.start) + replacement + text.slice(match.end) }] };
  });

export const replaceAll = (
  elements: ScreenplayElement[],
  query: string,
  replacement: string,
  options: FindOptions,
): { elements: ScreenplayElement[]; count: number } => {
  const matches = findAll(elements, query, options);
  if (matches.length === 0) return { elements, count: 0 };
  const byElement = new Map<string, FindMatch[]>();
  matches.forEach((m) => byElement.set(m.elementId, [...(byElement.get(m.elementId) ?? []), m]));
  const updated = elements.map((el) => {
    const found = byElement.get(el.id);
    if (!found) return el;
    let text = textOf(el);
    for (const m of [...found].reverse()) text = text.slice(0, m.start) + replacement + text.slice(m.end);
    return { ...el, content: [{ text }] };
  });
  return { elements: updated, count: matches.length };
};
