// Single pagination engine for ReWriter.
//
// The editor (page breaks, page numbers) and the PDF export both lay out the
// script through paginate(), so they always agree on where pages break and how
// many pages there are. The engine works in lines of 12pt Courier: 10 characters
// per inch across, LINES_PER_PAGE lines down.
//
// The rules follow Final Draft's default screenplay behavior as observed in
// findings/final-draft-13.md (§3.4 "MOREs and CONT'Ds", §4.1 PageLayout,
// ElementSettings and MoresAndContinueds). The implementation is our own.
// - Each element gets its spaceBeforeLines from ELEMENT_FORMATTING, except at
//   the top of a page.
// - Lines wrap at word boundaries (after spaces and inside hyphenated words) to
//   each element's width; a word longer than the line is cut. A hanging first
//   indent (Parenthetical) gives the first line one more character.
// - Scene Headings, Shots and Characters stay with what follows them; a
//   Parenthetical stays with the dialogue after it; the element before a
//   Transition stays with the Transition.
// - Action, General and Dialogue split across pages only at the end of a
//   sentence (Final Draft's "break dialogue and action at sentences"), keeping
//   at least MIN_SPLIT_LINES on each side. The continued text re-wraps on the
//   next page. Only an element taller than a page is cut mid-sentence.
// - A speech that breaks across pages gets (MORE) under its last line and the
//   speaker's name with (CONT'D) at the top of the next page.
// - Automatic character continueds: when the same character speaks again in a
//   scene with no other speaker in between, their name gets (CONT'D).
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
  autoCharacterContinueds?: boolean;
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
  firstLine: number; // lines of this element placed on earlier pages
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
// line > 0 means the element splits, with `line` of its lines on earlier pages,
// and the page starts at character `offset` of its text.
export interface PageBreak {
  page: number;
  elementIndex: number;
  elementId: string;
  line: number;
  offset: number;
  more?: string; // marker printed at the bottom of the previous page
  contd?: string; // speaker line printed at the top of this page
}

export interface Pagination {
  pages: Page[];
  pageCount: number;
  breaks: PageBreak[];
  elementPages: number[]; // page each element starts on, by element index
  continuedCharacters: number[]; // Character elements shown with an automatic (CONT'D)
  contdText: string;
  linesPerPage: number;
}

// ---------------------------------------------------------------------------
// Wrapping

const plainText = (el: ScreenplayElement): string => el.content.map((r) => r.text).join('');

const toChars = (inches: number): number => Math.floor(inches * CHARS_PER_INCH + 1e-6);

// Characters per line
export const elementWidthChars = (type: ElementType): number => {
  const f = ELEMENT_FORMATTING[type];
  return toChars(f.rightEdge - f.leftEdge);
};

// Characters on the first line, which a hanging indent widens
export const firstLineWidthChars = (type: ElementType): number =>
  elementWidthChars(type) - Math.round((ELEMENT_FORMATTING[type].firstIndent ?? 0) * CHARS_PER_INCH);

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

const wrapHardLine = (text: string, base: number, firstWidth: number, width: number, out: WrappedLine[]) => {
  let start = 0;
  let w = firstWidth;
  for (;;) {
    const rest = text.slice(start);
    if (rest.trimEnd().length <= w) {
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
        if (lastInk - start + 1 > w) break;
      }
    }
    if (brk === -1) brk = start + w; // word longer than the line
    out.push({ text: text.slice(start, brk).trimEnd(), start: base + start, end: base + brk });
    start = brk;
    w = width;
  }
};

// Wraps text to a width in characters (firstWidth for the very first line).
// Hard line breaks ("\n") are kept.
export const wrapText = (text: string, width: number, firstWidth = width): WrappedLine[] => {
  const out: WrappedLine[] = [];
  let base = 0;
  text.split('\n').forEach((hard, i) => {
    wrapHardLine(hard, base, Math.max(1, i === 0 ? firstWidth : width), Math.max(1, width), out);
    out[out.length - 1].end = base + hard.length + 1;
    base += hard.length + 1;
  });
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
  wrapText(displayText(el), width, width + firstLineWidthChars(el.type) - elementWidthChars(el.type));

// Offsets where a new sentence starts: after . ! ? … (and closing quotes or
// brackets) plus spaces, and after a hard line break
const sentenceStarts = (text: string): number[] => {
  const starts: number[] = [];
  const re = /[.!?…]+["'”’)\]]*( +)|\n/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const at = m.index + m[0].length;
    if (at < text.length) starts.push(at);
  }
  return starts;
};

// ---------------------------------------------------------------------------
// Units: single elements, or a dual dialogue block

interface SingleUnit {
  kind: 'single';
  index: number;
  el: ScreenplayElement;
  type: ElementType;
  text: string; // display text (with any automatic CONT'D)
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

const CONTD_RE = /\s*\(CONT['’]D\)\s*$/i;

// Speaker name for the (CONT'D) line: the Character text without a trailing (CONT'D)
const characterName = (text: string): string => text.replace(CONTD_RE, '').trim().toUpperCase();

// The bare name, without extensions such as (V.O.), to tell speakers apart
const speakerKey = (text: string): string => characterName(text).replace(/\s*\(.*$/, '').trim();

const buildUnits = (
  elements: ScreenplayElement[],
  autoContd: boolean,
  contdText: string,
  continuedCharacters: number[],
): Unit[] => {
  const units: Unit[] = [];
  let lastSpeaker = ''; // previous speaker in this scene
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
        lastSpeaker = '';
        i = j;
        continue;
      }
    }

    let text = displayText(el);
    if (el.type === 'Scene Heading') lastSpeaker = '';
    if (el.type === 'Character') {
      const speaker = speakerKey(text);
      if (autoContd && speaker && speaker === lastSpeaker && !CONTD_RE.test(text)) {
        text = `${text.trimEnd()} ${contdText}`;
        continuedCharacters.push(i);
      }
      lastSpeaker = speaker;
    }
    const lines = wrapText(text, elementWidthChars(el.type), firstLineWidthChars(el.type));
    units.push({ kind: 'single', index: i, el, type: el.type, text, lines });
    i++;
  }
  return units;
};

const unitHeight = (u: Unit): number => (u.kind === 'dual' ? u.height : u.lines.length);

// A dual block spaces like a Character
const spaceBeforeOf = (u: Unit): number =>
  ELEMENT_FORMATTING[u.kind === 'dual' ? 'Character' : u.type].spaceBeforeLines;

// True when u continues the dialogue block of the unit before it
const inDialogueBlock = (prev: Unit | undefined, u: Unit): boolean =>
  !!prev && prev.kind === 'single' && u.kind === 'single' &&
  (prev.type === 'Character' || prev.type === 'Dialogue' || prev.type === 'Parenthetical') &&
  (u.type === 'Dialogue' || u.type === 'Parenthetical');

const keepsWithNext = (u: Unit, next: Unit | undefined): next is Unit => {
  if (!next || u.kind === 'dual') return false;
  if (next.kind === 'single' && next.type === 'Transition') return true;
  if (u.type === 'Scene Heading' || u.type === 'Shot' || u.type === 'Character') return true;
  return u.type === 'Parenthetical' && inDialogueBlock(u, next);
};

const isSplittable = (u: Unit): boolean =>
  u.kind === 'single' && (u.type === 'Action' || u.type === 'General' || u.type === 'Dialogue');

// Lines of u's text from offset `from` up to `to`, wrapped as a fresh piece
// (the first piece keeps the element's first-line indent)
const wrapRange = (u: SingleUnit, from: number, to = u.text.length): WrappedLine[] => {
  const width = elementWidthChars(u.type);
  const piece = u.text.slice(from, to).replace(/\n$/, ''); // a cut after a line break adds no blank line
  const lines = wrapText(piece, width, from === 0 ? firstLineWidthChars(u.type) : width)
    .map((l) => ({ ...l, start: l.start + from, end: l.end + from }));
  lines[lines.length - 1].end = to;
  return lines;
};

// ---------------------------------------------------------------------------
// Pagination

export const paginate = (elements: ScreenplayElement[], options: PaginateOptions = {}): Pagination => {
  const cap = Math.max(4, options.linesPerPage ?? LINES_PER_PAGE);
  const moreText = options.moreText ?? '(MORE)';
  const contdText = options.contdText ?? "(CONT'D)";

  const continuedCharacters: number[] = [];
  const units = buildUnits(elements, options.autoCharacterContinueds ?? true, contdText, continuedCharacters);
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

  // Lines unit k needs on the current page if it starts there (without its own spacing)
  const minLead = (k: number): number => {
    const u = units[k];
    const n = unitHeight(u);
    const next = units[k + 1];
    if (u.kind === 'single' && isSplittable(u) && n >= 2 * MIN_SPLIT_LINES && sentenceStarts(u.text).length > 0) {
      return MIN_SPLIT_LINES + (u.type === 'Dialogue' ? 1 : 0);
    }
    if (keepsWithNext(u, next)) return n + spaceBeforeOf(next) + minLead(k + 1);
    // A block that carries on past this unit needs a line for (MORE)
    return n + (next && inDialogueBlock(u, next) ? 1 : 0);
  };

  // Lines from unit k to the end of its dialogue block
  const restOfBlock = (k: number): number => {
    let total = unitHeight(units[k]);
    for (let j = k + 1; j < units.length && inDialogueBlock(units[j - 1], units[j]); j++) {
      total += unitHeight(units[j]);
    }
    return total;
  };

  const placeElement = (u: SingleUnit, lines: WrappedLine[], placedBefore: number, space: number) => {
    page.items.push({
      kind: 'element',
      top: page.linesUsed + space,
      spaceBefore: space,
      elementIndex: u.index,
      elementId: u.el.id,
      type: u.type,
      firstLine: placedBefore,
      lines,
      continued: placedBefore > 0,
      continues: lines[lines.length - 1].end < u.text.length,
    });
    page.linesUsed += space + lines.length;
  };

  // Where to cut u's text (from offset `from`) so the first piece fits in
  // `avail` lines: the latest sentence start that leaves MIN_SPLIT_LINES on
  // both sides, or -1 when there is none. With mustSplit (the text is taller
  // than a page) fall back to cutting after the last line that fits.
  const chooseCut = (u: SingleUnit, from: number, avail: number, mustSplit: boolean): number => {
    const minBefore = mustSplit ? 1 : MIN_SPLIT_LINES;
    const starts = sentenceStarts(u.text).filter((s) => s > from);
    for (let i = starts.length - 1; i >= 0; i--) {
      const kept = wrapRange(u, from, starts[i]).length;
      if (kept > avail) continue;
      if (kept < minBefore) break;
      if (wrapRange(u, starts[i]).length >= MIN_SPLIT_LINES) return starts[i];
    }
    if (!mustSplit) return -1;
    const lines = wrapRange(u, from);
    return lines[Math.max(1, Math.min(avail, lines.length - 1))].start;
  };

  // Places u's text from offset `cut` onwards on following pages, splitting again as needed
  const continueElement = (u: SingleUnit, cut: number, placed: number, isDialogue: boolean) => {
    while (cut < u.text.length) {
      if (isDialogue) addMore();
      newPage({
        elementIndex: u.index,
        elementId: u.el.id,
        line: placed,
        offset: cut,
        more: isDialogue ? moreText : undefined,
        contd: isDialogue ? `${speaker} ${contdText}` : undefined,
      });
      const rest = wrapRange(u, cut);
      const room = cap - page.linesUsed;
      if (rest.length <= room) {
        placeElement(u, rest, placed, 0);
        return;
      }
      const next = chooseCut(u, cut, room - (isDialogue ? 1 : 0), true);
      const piece = wrapRange(u, cut, next);
      placeElement(u, piece, placed, 0);
      placed += piece.length;
      cut = next;
    }
  };

  for (let k = 0; k < units.length; k++) {
    const u = units[k];
    const prev = units[k - 1];
    const next = units[k + 1];
    const n = unitHeight(u);

    if (u.kind === 'single') {
      if (u.type === 'Character') speaker = characterName(u.text);
      else if (!inDialogueBlock(prev, u)) speaker = '';
    } else {
      speaker = '';
    }
    const continuesBlock = inDialogueBlock(prev, u) && speaker !== '';
    const isDialogue = u.kind === 'single' && u.type === 'Dialogue' && speaker !== '';

    const atTop = page.linesUsed === 0 || (page.linesUsed === 1 && page.items[0]?.kind === 'contd');
    const s = atTop ? 0 : spaceBeforeOf(u);
    const free = cap - page.linesUsed - s;
    const nextInBlock = !!next && inDialogueBlock(u, next) && speaker !== '';
    // Leave a line for (MORE) if the block will have to break after this unit
    const reserve = nextInBlock && !keepsWithNext(u, next) && restOfBlock(k) > free ? 1 : 0;
    const keepOk = !keepsWithNext(u, next) || atTop ||
      n + spaceBeforeOf(next) + minLead(k + 1) <= free;

    elementPages[u.index] = page.number;

    if (n + reserve <= free && keepOk) {
      if (u.kind === 'dual') {
        page.items.push({ kind: 'dual', top: page.linesUsed + s, spaceBefore: s, height: n, left: u.left, right: u.right });
        page.linesUsed += s + n;
        for (const p of [...u.left, ...u.right]) elementPages[p.elementIndex] = page.number;
      } else {
        placeElement(u, u.lines, 0, s);
      }
      continue;
    }

    // Split a long Action/General/Dialogue at a sentence end
    if (u.kind === 'single' && isSplittable(u) && !atTop) {
      const cut = chooseCut(u, 0, free - (isDialogue ? 1 : 0), false);
      if (cut > 0) {
        const piece = wrapRange(u, 0, cut);
        placeElement(u, piece, 0, s);
        continueElement(u, cut, piece.length, isDialogue);
        continue;
      }
    }

    // Move the whole unit to a new page (unless it already starts one)
    if (!atTop) {
      if (continuesBlock) addMore();
      newPage({
        elementIndex: u.index,
        elementId: elements[u.index].id,
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

    const room = cap - page.linesUsed;
    if (n <= room) {
      placeElement(u, u.lines, 0, 0);
      continue;
    }

    // Taller than a page: cut it into page-sized pieces
    const cut = isSplittable(u)
      ? chooseCut(u, 0, room - (isDialogue ? 1 : 0), true)
      : u.lines[Math.max(1, room)].start;
    const piece = wrapRange(u, 0, cut);
    placeElement(u, piece, 0, 0);
    continueElement(u, cut, piece.length, isDialogue);
  }

  return { pages, pageCount: pages.length, breaks, elementPages, continuedCharacters, contdText, linesPerPage: cap };
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
