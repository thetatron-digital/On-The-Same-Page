// Single pagination engine for ReWriter.
//
// The editor (page breaks, page numbers) and the PDF export both lay out the
// script through paginate(), so they always agree on where pages break and how
// many pages there are. The engine works in lines of 12pt Courier: 10 characters
// per inch across, LINES_PER_PAGE lines down.
//
// Rules (our own, based on common screenplay conventions):
// - Blank lines between elements = max(previous spaceAfterLines, current
//   spaceBeforeLines) from ELEMENT_FORMATTING. Inside a dialogue block
//   (Character → Parenthetical/Dialogue) there are none. None at the top of a page.
// - Lines wrap at word boundaries (after spaces and inside hyphenated words) to
//   each element's width; a word longer than the line is cut.
// - Scene Headings, Shots and Characters stay with what follows them; a
//   Parenthetical stays with the dialogue after it; the element before a
//   Transition stays with the Transition.
// - Action, General and Dialogue may split across pages, keeping at least
//   MIN_SPLIT_LINES on each side, preferring a break after a sentence.
// - A dialogue block that breaks across pages gets (MORE) under the last line
//   and the speaker's name with (CONT'D) at the top of the next page.
// - Dual dialogue is one block, as tall as its taller column, and never splits.

import type { ElementType, ScreenplayElement } from '../types/screenplay';
import { ELEMENT_FORMATTING, LINES_PER_PAGE } from '../types/screenplay';

export const CHARS_PER_INCH = 10; // Courier 12pt
export const MIN_SPLIT_LINES = 2;
export const DUAL_COLUMN_CHARS = 25; // 2.5" per dual dialogue column

export interface PaginateOptions {
  linesPerPage?: number;
  moreText?: string;
  contdText?: string;
}

export interface WrappedLine {
  text: string; // display text, trailing spaces trimmed
  start: number; // character offset into the element's plain text
  end: number; // offset where the next line starts
}

export interface ElementItem {
  kind: 'element';
  top: number; // line on the page (0 = first line)
  spaceBefore: number; // blank lines above this item
  elementIndex: number;
  elementId: string;
  type: ElementType;
  firstLine: number; // index into the element's wrapped lines
  lines: WrappedLine[];
  continued: boolean; // began on an earlier page
  continues: boolean; // carries on to the next page
}

export interface MarkerItem {
  kind: 'more' | 'contd';
  top: number;
  text: string;
}

export interface DualColumnPart {
  elementIndex: number;
  elementId: string;
  type: ElementType;
  top: number; // line offset within the dual block
  lines: WrappedLine[];
}

export interface DualItem {
  kind: 'dual';
  top: number;
  spaceBefore: number;
  height: number;
  left: DualColumnPart[];
  right: DualColumnPart[];
}

export type PageItem = ElementItem | MarkerItem | DualItem;

export interface Page {
  number: number;
  items: PageItem[];
  linesUsed: number;
}

// Where a new page begins. line 0 means the page starts with this element;
// line k > 0 means the element splits and the page starts at its line k.
export interface PageBreak {
  page: number;
  elementIndex: number;
  elementId: string;
  line: number;
  offset: number; // character offset in the element where the page starts
  more?: string; // marker printed at the bottom of the previous page
  contd?: string; // speaker line printed at the top of this page
}

export interface Pagination {
  pages: Page[];
  pageCount: number;
  breaks: PageBreak[];
  elementPages: number[]; // page each element starts on, by element index
  linesPerPage: number;
}

// ---------------------------------------------------------------------------
// Wrapping

const plainText = (el: ScreenplayElement): string => el.content.map((r) => r.text).join('');

export const elementWidthChars = (type: ElementType): number => {
  const f = ELEMENT_FORMATTING[type];
  return Math.round((f.rightEdge - f.leftEdge) * CHARS_PER_INCH);
};

// A line may end before index j when j closes a run of spaces, or follows a
// hyphen inside a word ("self-|aware", "wait--|what").
const canBreakBefore = (text: string, j: number, lineStart: number): boolean => {
  const prev = text[j - 1];
  const next = text[j];
  if (next === undefined || next === ' ') return false;
  if (prev === ' ') return true;
  if (prev === '-') {
    const beforeHyphen = text[j - 2];
    return j - 1 > lineStart && beforeHyphen !== ' ' && next !== '-' && !/\d/.test(next);
  }
  return false;
};

const wrapHardLine = (text: string, base: number, width: number, out: WrappedLine[]) => {
  let start = 0;
  for (;;) {
    const rest = text.slice(start);
    if (rest.trimEnd().length <= width) {
      out.push({ text: rest.trimEnd(), start: base + start, end: base + text.length });
      return;
    }
    // Last break opportunity whose line (trailing spaces aside) still fits
    let brk = -1;
    let lastInk = start - 1;
    for (let j = start; j < text.length; j++) {
      if (j > start && canBreakBefore(text, j, start)) brk = j;
      if (text[j] !== ' ') {
        lastInk = j;
        if (lastInk - start + 1 > width) break;
      }
    }
    if (brk === -1) brk = start + width; // word longer than the line
    out.push({ text: text.slice(start, brk).trimEnd(), start: base + start, end: base + brk });
    start = brk;
  }
};

// Wraps text to a width in characters. Hard line breaks ("\n") are kept.
export const wrapText = (text: string, width: number): WrappedLine[] => {
  const out: WrappedLine[] = [];
  let base = 0;
  for (const hard of text.split('\n')) {
    wrapHardLine(hard, base, Math.max(1, width), out);
    out[out.length - 1].end = base + hard.length + 1;
    base += hard.length + 1;
  }
  out[out.length - 1].end = text.length;
  return out;
};

const displayText = (el: ScreenplayElement): string => {
  const text = plainText(el);
  if (!ELEMENT_FORMATTING[el.type].allCaps) return text;
  const upper = text.toUpperCase();
  return upper.length === text.length ? upper : text; // keep offsets aligned
};

export const wrapElement = (el: ScreenplayElement, width = elementWidthChars(el.type)): WrappedLine[] =>
  wrapText(displayText(el), width);

// ---------------------------------------------------------------------------
// Units: single elements, or a dual dialogue block

interface SingleUnit {
  kind: 'single';
  index: number;
  el: ScreenplayElement;
  type: ElementType;
  lines: WrappedLine[];
}

interface DualUnit {
  kind: 'dual';
  index: number; // first element of the block
  left: DualColumnPart[];
  right: DualColumnPart[];
  height: number;
}

type Unit = SingleUnit | DualUnit;

const DIALOGUE_BLOCK: ReadonlySet<ElementType> = new Set(['Character', 'Dialogue', 'Parenthetical']);

const buildColumn = (elements: ScreenplayElement[], from: number, to: number): DualColumnPart[] => {
  const parts: DualColumnPart[] = [];
  let top = 0;
  for (let i = from; i < to; i++) {
    const el = elements[i];
    const lines = wrapElement(el, DUAL_COLUMN_CHARS);
    parts.push({ elementIndex: i, elementId: el.id, type: el.type, top, lines });
    top += lines.length;
  }
  return parts;
};

const columnHeight = (col: DualColumnPart[]): number =>
  col.reduce((sum, p) => sum + p.lines.length, 0);

const buildUnits = (elements: ScreenplayElement[]): Unit[] => {
  const units: Unit[] = [];
  let i = 0;
  while (i < elements.length) {
    const el = elements[i];
    if (el.isDualDialogue && el.dualDialoguePosition === 'left') {
      let j = i;
      while (j < elements.length && elements[j].isDualDialogue && elements[j].dualDialoguePosition === 'left') j++;
      const mid = j;
      while (j < elements.length && elements[j].isDualDialogue && elements[j].dualDialoguePosition === 'right') j++;
      if (j > mid) {
        const left = buildColumn(elements, i, mid);
        const right = buildColumn(elements, mid, j);
        units.push({ kind: 'dual', index: i, left, right, height: Math.max(columnHeight(left), columnHeight(right)) });
        i = j;
        continue;
      }
    }
    units.push({ kind: 'single', index: i, el, type: el.type, lines: wrapElement(el) });
    i++;
  }
  return units;
};

const unitHeight = (u: Unit): number => (u.kind === 'dual' ? u.height : u.lines.length);

// A dual block spaces like a Character before it and like Dialogue after it.
const spaceBeforeOf = (u: Unit): number =>
  ELEMENT_FORMATTING[u.kind === 'dual' ? 'Character' : u.type].spaceBeforeLines;
const spaceAfterOf = (u: Unit): number =>
  ELEMENT_FORMATTING[u.kind === 'dual' ? 'Dialogue' : u.type].spaceAfterLines;

// True when u continues the dialogue block of the unit before it.
const inDialogueBlock = (prev: Unit | undefined, u: Unit): boolean =>
  !!prev && prev.kind === 'single' && u.kind === 'single' &&
  DIALOGUE_BLOCK.has(prev.type) && (u.type === 'Dialogue' || u.type === 'Parenthetical');

const spacingBetween = (prev: Unit | undefined, u: Unit): number => {
  if (!prev) return 0;
  if (inDialogueBlock(prev, u)) return 0;
  return Math.max(spaceAfterOf(prev), spaceBeforeOf(u));
};

const keepsWithNext = (u: Unit, next: Unit | undefined): boolean => {
  if (!next || u.kind === 'dual') return false;
  if (next.kind === 'single' && next.type === 'Transition') return true;
  if (u.type === 'Scene Heading' || u.type === 'Shot' || u.type === 'Character') return true;
  return u.type === 'Parenthetical' && inDialogueBlock(u, next);
};

const isSplittable = (u: Unit): u is SingleUnit =>
  u.kind === 'single' && (u.type === 'Action' || u.type === 'General' || u.type === 'Dialogue');

const SENTENCE_END = /([.!?…]["')\]]*|--)$/;

const characterName = (el: ScreenplayElement): string =>
  displayText(el).replace(/\s*\(CONT['’]D\)\s*$/i, '').trim().toUpperCase();

// ---------------------------------------------------------------------------
// Pagination

export const paginate = (elements: ScreenplayElement[], options: PaginateOptions = {}): Pagination => {
  const cap = Math.max(4, options.linesPerPage ?? LINES_PER_PAGE);
  const moreText = options.moreText ?? '(MORE)';
  const contdText = options.contdText ?? "(CONT'D)";

  const units = buildUnits(elements);
  const pages: Page[] = [{ number: 1, items: [], linesUsed: 0 }];
  const breaks: PageBreak[] = [];
  const elementPages: number[] = new Array(elements.length).fill(1);

  let page = pages[0];
  let speaker = ''; // current dialogue block's character name

  const newPage = (brk: Omit<PageBreak, 'page'>) => {
    page = { number: pages.length + 1, items: [], linesUsed: 0 };
    pages.push(page);
    breaks.push({ ...brk, page: page.number });
    if (brk.contd) {
      page.items.push({ kind: 'contd', top: 0, text: brk.contd });
      page.linesUsed = 1;
    }
  };

  const addMore = () => {
    page.items.push({ kind: 'more', top: page.linesUsed, text: moreText });
    page.linesUsed += 1;
  };

  // Lines unit k needs on the current page if it starts there (without its own spacing).
  const minLead = (k: number): number => {
    const u = units[k];
    const n = unitHeight(u);
    const next = units[k + 1];
    if (isSplittable(u) && n >= 2 * MIN_SPLIT_LINES) {
      return MIN_SPLIT_LINES + (u.type === 'Dialogue' ? 1 : 0);
    }
    if (keepsWithNext(u, next)) return n + spacingBetween(u, next) + minLead(k + 1);
    // A block that carries on past this unit needs a line for (MORE).
    return n + (next && inDialogueBlock(u, next) ? 1 : 0);
  };

  // Lines from unit k to the end of its dialogue block, including spacing.
  const restOfBlock = (k: number): number => {
    let total = unitHeight(units[k]);
    for (let j = k + 1; j < units.length && inDialogueBlock(units[j - 1], units[j]); j++) {
      total += unitHeight(units[j]);
    }
    return total;
  };

  const placeElement = (u: SingleUnit, from: number, to: number, space: number, continued: boolean) => {
    page.items.push({
      kind: 'element',
      top: page.linesUsed + space,
      spaceBefore: space,
      elementIndex: u.index,
      elementId: u.el.id,
      type: u.type,
      firstLine: from,
      lines: u.lines.slice(from, to),
      continued,
      continues: to < u.lines.length,
    });
    page.linesUsed += space + (to - from);
  };

  // Chooses how many of lines[from..] stay on this page, or 0 to move them all.
  const chooseSplit = (u: SingleUnit, from: number, avail: number, mustSplit: boolean): number => {
    const remaining = u.lines.length - from;
    const minBefore = mustSplit ? 1 : MIN_SPLIT_LINES;
    const maxK = Math.min(avail, remaining - MIN_SPLIT_LINES);
    if (maxK < minBefore) return mustSplit ? Math.max(1, Math.min(avail, remaining - 1)) : 0;
    for (let k = maxK; k >= minBefore; k--) {
      if (SENTENCE_END.test(u.lines[from + k - 1].text)) return k;
    }
    return maxK;
  };

  for (let k = 0; k < units.length; k++) {
    const u = units[k];
    const prev = units[k - 1];
    const next = units[k + 1];
    const n = unitHeight(u);

    if (u.kind === 'single') {
      if (u.type === 'Character') speaker = characterName(u.el);
      else if (!inDialogueBlock(prev, u)) speaker = '';
    } else {
      speaker = '';
    }
    const continuesBlock = inDialogueBlock(prev, u) && speaker !== '';
    const isDialogue = u.kind === 'single' && u.type === 'Dialogue' && speaker !== '';

    const atTop = () => page.linesUsed === 0 || (page.linesUsed === 1 && page.items[0]?.kind === 'contd');
    const spacing = () => (atTop() ? 0 : spacingBetween(prev, u));

    const s = spacing();
    const free = cap - page.linesUsed - s;
    const nextInBlock = !!next && inDialogueBlock(u, next) && speaker !== '';
    // Leave a line for (MORE) if the block will have to break after this unit.
    const reserve = nextInBlock && !keepsWithNext(u, next) && restOfBlock(k) > free ? 1 : 0;
    const keepOk = !keepsWithNext(u, next) || atTop() ||
      n + spacingBetween(u, next) + minLead(k + 1) <= free;

    elementPages[u.index] = page.number;

    if (n + reserve <= free && keepOk) {
      if (u.kind === 'dual') {
        page.items.push({ kind: 'dual', top: page.linesUsed + s, spaceBefore: s, height: n, left: u.left, right: u.right });
        page.linesUsed += s + n;
        for (const p of [...u.left, ...u.right]) elementPages[p.elementIndex] = page.number;
      } else {
        placeElement(u, 0, n, s, false);
      }
      continue;
    }

    // Try to split a long Action/General/Dialogue across the break.
    if (isSplittable(u) && !atTop()) {
      const kept = chooseSplit(u, 0, free - (isDialogue ? 1 : 0), false);
      if (kept > 0) {
        placeElement(u, 0, kept, s, false);
        let from = kept;
        while (from < u.lines.length) {
          if (isDialogue) addMore();
          newPage({
            elementIndex: u.index,
            elementId: u.el.id,
            line: from,
            offset: u.lines[from].start,
            more: isDialogue ? moreText : undefined,
            contd: isDialogue ? `${speaker} ${contdText}` : undefined,
          });
          const room = cap - page.linesUsed;
          const left = u.lines.length - from;
          if (left <= room) {
            placeElement(u, from, u.lines.length, 0, true);
            from = u.lines.length;
          } else {
            const more = chooseSplit(u, from, room - (isDialogue ? 1 : 0), true);
            placeElement(u, from, from + more, 0, true);
            from += more;
          }
        }
        continue;
      }
    }

    // Move the whole unit to a new page (unless it already starts one).
    if (!atTop()) {
      if (continuesBlock) addMore();
      newPage({
        elementIndex: u.index,
        elementId: u.kind === 'single' ? u.el.id : elements[u.index].id,
        line: 0,
        offset: 0,
        more: continuesBlock ? moreText : undefined,
        contd: continuesBlock ? `${speaker} ${contdText}` : undefined,
      });
      elementPages[u.index] = page.number;
    }

    if (u.kind === 'dual') {
      page.items.push({ kind: 'dual', top: page.linesUsed, spaceBefore: 0, height: n, left: u.left, right: u.right });
      page.linesUsed += n;
      for (const p of [...u.left, ...u.right]) elementPages[p.elementIndex] = page.number;
      continue;
    }

    // Taller than a page: cut it into page-sized pieces.
    let from = 0;
    for (;;) {
      const room = cap - page.linesUsed;
      const left = u.lines.length - from;
      if (left <= room) {
        placeElement(u, from, u.lines.length, 0, from > 0);
        break;
      }
      const kept = isSplittable(u)
        ? chooseSplit(u, from, room - (isDialogue ? 1 : 0), true)
        : Math.max(1, room);
      placeElement(u, from, from + kept, 0, from > 0);
      from += kept;
      if (isDialogue) addMore();
      newPage({
        elementIndex: u.index,
        elementId: u.el.id,
        line: from,
        offset: u.lines[from].start,
        more: isDialogue ? moreText : undefined,
        contd: isDialogue ? `${speaker} ${contdText}` : undefined,
      });
    }
  }

  return { pages, pageCount: pages.length, breaks, elementPages, linesPerPage: cap };
};

// The editor, stats and navigator all paginate the same elements array on each
// change; cache by array identity so the work happens once.
const cache = new WeakMap<ScreenplayElement[], Pagination>();

export const paginateScript = (elements: ScreenplayElement[]): Pagination => {
  let result = cache.get(elements);
  if (!result) {
    result = paginate(elements);
    cache.set(elements, result);
  }
  return result;
};
