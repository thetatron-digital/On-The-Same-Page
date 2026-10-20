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
// - Locked pages: each locked page starts exactly where it did when locked.
//   Text that no longer fits before the next locked page flows onto A-pages
//   (12A, 12B, ...); a page that shrinks keeps its place and ends short.

import type { ElementType, LockedPage, Screenplay, ScreenplayElement } from '../types/screenplay';
import { ELEMENT_FORMATTING, LINES_PER_PAGE } from '../types/screenplay';

export const CHARS_PER_INCH = 10; // Courier 12pt
export const MIN_SPLIT_LINES = 2;
export const DUAL_COLUMN_CHARS = 25; // 2.5" per dual dialogue column

export interface PaginateOptions {
  lockedPages?: LockedPage[];
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
  number: number; // position in the document, from 1
  label: string; // printed page number: "12", or "12A" for an A-page while locked
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
    // Non-printing structure (sections, synopses, boneyard) takes no space
    if (el.outline) { i++; continue; }
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

// Label of the page after `label` while pages are locked: 12 → 12A → 12B
export const nextPageLabel = (label: string): string => {
  const m = /^(.*\d)([A-Z]*)$/.exec(label);
  if (!m) return `${label}A`;
  const [, base, letters] = m;
  if (!letters) return `${base}A`;
  const last = letters[letters.length - 1];
  return last === 'Z' ? `${base}${letters}A` : `${base}${letters.slice(0, -1)}${String.fromCharCode(last.charCodeAt(0) + 1)}`;
};

export const paginate = (elements: ScreenplayElement[], options: PaginateOptions = {}): Pagination => {
  const cap = Math.max(4, options.linesPerPage ?? LINES_PER_PAGE);
  const moreText = options.moreText ?? '(MORE)';
  const contdText = options.contdText ?? "(CONT'D)";

  const continuedCharacters: number[] = [];
  const units = buildUnits(elements, options.autoCharacterContinueds ?? true, contdText, continuedCharacters);
  const breaks: PageBreak[] = [];
  const elementPages: number[] = new Array(elements.length).fill(1);

  // Locked page boundaries by element id, in text order
  const locked = !!options.lockedPages?.length;
  const locks = new Map<string, LockedPage[]>();
  for (const lock of options.lockedPages ?? []) {
    locks.set(lock.elementId, [...(locks.get(lock.elementId) ?? []), lock].sort((a, b) => a.offset - b.offset));
  }
  const lockAtStart = (k: number): LockedPage | undefined => {
    const u = units[k];
    return u && locks.get(elements[u.index].id)?.find((l) => l.offset === 0);
  };
  const midLocks = (u: SingleUnit): LockedPage[] =>
    (locks.get(u.el.id) ?? []).filter((l) => l.offset > 0 && l.offset < u.text.length);

  const pages: Page[] = [{ number: 1, label: lockAtStart(0)?.label ?? '1', items: [], linesUsed: 0 }];
  let page = pages[0];
  let speaker = ''; // current dialogue block's character name

  // Starts a page. A locked boundary brings its own label; any other page is
  // the next number, or the next A-page while pages are locked.
  const newPage = (brk: Omit<PageBreak, 'page'>, label?: string) => {
    const number = pages.length + 1;
    page = { number, label: label ?? (locked ? nextPageLabel(page.label) : String(number)), items: [], linesUsed: 0 };
    pages.push(page);
    breaks.push({ ...brk, page: number });
    if (brk.contd) {
      page.items.push({ kind: 'contd', top: 0, text: brk.contd });
      page.linesUsed = 1;
    }
  };

  const addMore = () => {
    page.items.push({ kind: 'more', top: page.linesUsed, text: moreText });
    page.linesUsed += 1;
  };

  const atTop = () => page.linesUsed === 0 || (page.linesUsed === 1 && page.items[0]?.kind === 'contd');

  // Keep-with-next never reaches across a locked page boundary
  // A page break the writer inserted (Insert > Page Break, Fountain ===)
  const breakBefore = (k: number): boolean => !!units[k] && !!elements[units[k].index].pageBreakBefore;
  const keeps = (k: number): boolean =>
    keepsWithNext(units[k], units[k + 1]) && !lockAtStart(k + 1) && !breakBefore(k + 1);

  // Lines unit k needs on the current page if it starts there (without its own spacing)
  const minLead = (k: number): number => {
    const u = units[k];
    const n = unitHeight(u);
    const next = units[k + 1];
    if (u.kind === 'single' && isSplittable(u) && n >= 2 * MIN_SPLIT_LINES && sentenceStarts(u.text).length > 0) {
      return MIN_SPLIT_LINES + (u.type === 'Dialogue' ? 1 : 0);
    }
    if (keeps(k)) return n + spaceBeforeOf(next) + minLead(k + 1);
    // A block that carries on past this unit needs a line for (MORE)
    return n + (next && inDialogueBlock(u, next) ? 1 : 0);
  };

  // Lines from unit k to the end of its dialogue block
  const restOfBlock = (k: number): number => {
    let total = unitHeight(units[k]);
    for (let j = k + 1; j < units.length && inDialogueBlock(units[j - 1], units[j]) && !lockAtStart(j) && !breakBefore(j); j++) {
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

  // Where to cut u's text between `from` and `to` so the first piece fits in
  // `avail` lines: the latest sentence start that leaves MIN_SPLIT_LINES on
  // both sides, or -1 when there is none. With mustSplit (the text is taller
  // than a page) fall back to cutting after the last line that fits.
  const chooseCut = (u: SingleUnit, from: number, to: number, avail: number, mustSplit: boolean): number => {
    const minBefore = mustSplit ? 1 : MIN_SPLIT_LINES;
    const starts = sentenceStarts(u.text).filter((s) => s > from && s < to);
    for (let i = starts.length - 1; i >= 0; i--) {
      const kept = wrapRange(u, from, starts[i]).length;
      if (kept > avail) continue;
      if (kept < minBefore) break;
      if (wrapRange(u, starts[i], to).length >= MIN_SPLIT_LINES) return starts[i];
    }
    if (!mustSplit) return -1;
    const lines = wrapRange(u, from, to);
    return lines[Math.max(1, Math.min(avail, lines.length - 1))].start;
  };

  // Places u's text from `cut` to `to` on following pages, splitting again as
  // needed. `tail` lines stay free on the last page (for a (MORE) to come).
  const continueElement = (u: SingleUnit, cut: number, to: number, placed: number, isDialogue: boolean, tail: number): number => {
    while (cut < to) {
      if (isDialogue) addMore();
      newPage({
        elementIndex: u.index,
        elementId: u.el.id,
        line: placed,
        offset: cut,
        more: isDialogue ? moreText : undefined,
        contd: isDialogue ? `${speaker} ${contdText}` : undefined,
      });
      const rest = wrapRange(u, cut, to);
      const room = cap - page.linesUsed;
      if (rest.length + tail <= room) {
        placeElement(u, rest, placed, 0);
        return placed + rest.length;
      }
      const next = chooseCut(u, cut, to, room - (isDialogue ? 1 : 0), true);
      const piece = wrapRange(u, cut, next);
      placeElement(u, piece, placed, 0);
      placed += piece.length;
      cut = next;
    }
    return placed;
  };

  for (let k = 0; k < units.length; k++) {
    const u = units[k];
    const prev = units[k - 1];
    const next = units[k + 1];

    if (u.kind === 'single') {
      if (u.type === 'Character') speaker = characterName(u.text);
      else if (!inDialogueBlock(prev, u)) speaker = '';
    } else {
      speaker = '';
    }
    const continuesBlock = inDialogueBlock(prev, u) && speaker !== '';
    const isDialogue = u.kind === 'single' && u.type === 'Dialogue' && speaker !== '';

    // A locked page, or an inserted page break, starts here
    const lock = lockAtStart(k);
    if ((lock && k > 0) || (breakBefore(k) && !atTop())) {
      if (continuesBlock) addMore();
      newPage({
        elementIndex: u.index,
        elementId: elements[u.index].id,
        line: 0,
        offset: 0,
        more: continuesBlock ? moreText : undefined,
        contd: continuesBlock ? `${speaker} ${contdText}` : undefined,
      }, lock?.label);
    }

    elementPages[u.index] = page.number;

    if (u.kind === 'dual') {
      const n = u.height;
      const s = atTop() ? 0 : spaceBeforeOf(u);
      if (n > cap - page.linesUsed - s && !atTop()) {
        newPage({ elementIndex: u.index, elementId: elements[u.index].id, line: 0, offset: 0 });
        elementPages[u.index] = page.number;
      }
      const space = atTop() ? 0 : s;
      page.items.push({ kind: 'dual', top: page.linesUsed + space, spaceBefore: space, height: n, left: u.left, right: u.right });
      page.linesUsed += space + n;
      for (const p of [...u.left, ...u.right]) elementPages[p.elementIndex] = page.number;
      continue;
    }

    // The element's text in segments between locked boundaries inside it
    const cuts = midLocks(u);
    const bounds = [0, ...cuts.map((l) => l.offset), u.text.length];
    let placed = 0;

    for (let seg = 0; seg < bounds.length - 1; seg++) {
      const from = bounds[seg];
      const to = bounds[seg + 1];
      const last = seg === bounds.length - 2;

      if (seg > 0) {
        if (isDialogue) addMore();
        newPage({
          elementIndex: u.index,
          elementId: u.el.id,
          line: placed,
          offset: from,
          more: isDialogue ? moreText : undefined,
          contd: isDialogue ? `${speaker} ${contdText}` : undefined,
        }, cuts[seg - 1].label);
      }

      const lines = from === 0 && last ? u.lines : wrapRange(u, from, to);
      const n = lines.length;
      const s = from === 0 && !atTop() ? spaceBeforeOf(u) : 0;
      const free = cap - page.linesUsed - s;
      // Lines to keep free below this piece for a (MORE)
      const tail = !last
        ? (isDialogue ? 1 : 0)
        : (next && inDialogueBlock(u, next) && speaker !== '' && !keeps(k) &&
          (!!lockAtStart(k + 1) || breakBefore(k + 1) || restOfBlock(k) > free)) ? 1 : 0;
      const keepOk = !last || !keeps(k) || atTop() || n + spaceBeforeOf(next!) + minLead(k + 1) <= free;

      if (n + tail <= free && keepOk) {
        placeElement(u, lines, placed, s);
        placed += n;
        continue;
      }

      // Split a long Action/General/Dialogue at a sentence end
      if (isSplittable(u) && !atTop()) {
        const cut = chooseCut(u, from, to, free - (isDialogue ? 1 : 0), false);
        if (cut > 0) {
          const piece = wrapRange(u, from, cut);
          placeElement(u, piece, placed, s);
          placed = continueElement(u, cut, to, placed + piece.length, isDialogue, last ? 0 : tail);
          continue;
        }
      }

      // Move the whole piece to a new page (unless it already starts one)
      if (!atTop()) {
        const block = from === 0 && continuesBlock;
        if (block) addMore();
        newPage({
          elementIndex: u.index,
          elementId: u.el.id,
          line: placed,
          offset: from,
          more: block ? moreText : undefined,
          contd: block ? `${speaker} ${contdText}` : undefined,
        });
        if (from === 0) elementPages[u.index] = page.number;
      }

      const room = cap - page.linesUsed;
      if (n + (last ? 0 : tail) <= room) {
        placeElement(u, lines, placed, 0);
        placed += n;
        continue;
      }

      // Taller than a page: cut it into page-sized pieces
      const cut = isSplittable(u)
        ? chooseCut(u, from, to, room - (isDialogue ? 1 : 0), true)
        : lines[Math.max(1, Math.min(room, n - 1))].start;
      const piece = wrapRange(u, from, cut);
      placeElement(u, piece, placed, 0);
      placed = continueElement(u, cut, to, placed + piece.length, isDialogue, last ? 0 : tail);
    }
  }

  // Non-printing paragraphs sit on the page of the paragraph before them
  elements.forEach((el, idx) => { if (el.outline && idx > 0) elementPages[idx] = elementPages[idx - 1]; });

  return { pages, pageCount: pages.length, breaks, elementPages, continuedCharacters, contdText, linesPerPage: cap };
};

// The editor, stats, navigator and PDF all paginate the same script on each
// change; cache by the elements array (and locks) so the work happens once.
const cache = new WeakMap<ScreenplayElement[], { locks?: LockedPage[]; result: Pagination }>();

export const paginateScript = (script: Pick<Screenplay, 'elements' | 'lockedPages'>): Pagination => {
  const hit = cache.get(script.elements);
  if (hit && hit.locks === script.lockedPages) return hit.result;
  const result = paginate(script.elements, { lockedPages: script.lockedPages });
  cache.set(script.elements, { locks: script.lockedPages, result });
  return result;
};
