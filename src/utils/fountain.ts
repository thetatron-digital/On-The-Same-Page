// Fountain import and export (https://fountain.io/syntax, v1.1).
// Our own small parser and writer, built from the public syntax description.
//
// Mapping:
// - Title page keys -> TitlePageInfo (Title, Credit, Author/Authors, Source,
//   Draft date, Contact, Copyright)
// - Scene heading (INT/EXT/EST/INT./EXT/I/E or forced ".") with #number#
// - Character (all caps, or forced "@"), extensions, dual dialogue "^",
//   parentheticals and dialogue (a two-space line is a blank dialogue line)
// - Transition (all caps ending "TO:", or forced ">"), centered ">text<"
// - Action (default, or forced "!"), lyrics "~"
// - Page break "===", sections "#", synopses "=", boneyard "/* */" (kept as
//   non-printing paragraphs), notes "[[ ]]" (returned as ScriptNotes)
// - Emphasis *italic*, **bold**, ***bold italic***, _underline_

import type { ElementType, Screenplay, ScreenplayElement, ScriptNote, TextRun, TitlePageInfo } from '../types/screenplay';
import { generateId } from './fdx';

export interface FountainNote {
  elementIndex: number; // the paragraph the note belongs to
  text: string;
}

export interface FountainImport {
  screenplay: Screenplay;
  notes: FountainNote[];
}

// ---------------------------------------------------------------------------
// Emphasis

type Style = NonNullable<TextRun['style']>;

const styleOf = (bold: boolean, italic: boolean, underline: boolean): Style | undefined => {
  const parts = [bold && 'Bold', italic && 'Italic', underline && 'Underline'].filter(Boolean);
  return parts.length ? (parts.join('+') as Style) : undefined;
};

const EMPHASIS = /(\*{3}|\*{2}|\*|_)(?=\S)([\s\S]*?\S)\1/;

// Markup -> runs. Backslash escapes a literal * or _.
const ESC_STAR = '\uE001';
const ESC_UNDER = '\uE002';

const emphasisRuns = (text: string, bold: boolean, italic: boolean, underline: boolean, runs: TextRun[]) => {
  const push = (t: string, s: Style | undefined) => {
    const value = t.replace(/\uE001/g, '*').replace(/\uE002/g, '_');
    if (!value) return;
    const last = runs[runs.length - 1];
    if (last && last.style === s) last.text += value;
    else runs.push(s ? { text: value, style: s } : { text: value });
  };
  let rest = text;
  for (let m = EMPHASIS.exec(rest); m; m = EMPHASIS.exec(rest)) {
    push(rest.slice(0, m.index), styleOf(bold, italic, underline));
    const marker = m[1];
    emphasisRuns(m[2], bold || marker === '**' || marker === '***', italic || marker === '*' || marker === '***', underline || marker === '_', runs);
    rest = rest.slice(m.index + m[0].length);
  }
  push(rest, styleOf(bold, italic, underline));
};

export const parseEmphasis = (text: string): TextRun[] => {
  const runs: TextRun[] = [];
  emphasisRuns(text.replace(/\\\*/g, ESC_STAR).replace(/\\_/g, ESC_UNDER), false, false, false, runs);
  return runs.length ? runs : [{ text: '' }];
};

// Runs -> markup, escaping literal * and _
export const writeEmphasis = (runs: TextRun[]): string =>
  runs.map((run) => {
    const text = run.text.replace(/\*/g, '\\*').replace(/_/g, '\\_');
    if (!run.style || !text.trim()) return text;
    const bold = run.style.includes('Bold');
    const italic = run.style.includes('Italic');
    const stars = bold && italic ? '***' : bold ? '**' : italic ? '*' : '';
    const lead = text.match(/^\s*/)![0];
    const trail = text.match(/\s*$/)![0];
    let core = text.trim();
    if (stars) core = `${stars}${core}${stars}`;
    if (run.style.includes('Underline')) core = `_${core}_`;
    return `${lead}${core}${trail}`;
  }).join('');

const plain = (runs: TextRun[]) => runs.map((r) => r.text).join('');

// ---------------------------------------------------------------------------
// Import

const TITLE_KEYS = new Set(['title', 'credit', 'author', 'authors', 'source', 'draft date', 'date', 'contact', 'copyright', 'notes', 'revision']);
const HEADING = /^(INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)[.\s]/i;
const TRANSITION = /^[A-Z0-9 .'-]+TO:$/;
const SCENE_NUMBER = /\s+#([\w.-]+)#\s*$/;
const NOTE = /\[\[([\s\S]*?)\]\]/g;
const BONEYARD_TOKEN = /\uE000B(\d+)\uE000/g;

const isBlank = (line: string) => line.trim() === '' && line !== '  ';

// All caps with at least one letter, ignoring a trailing (extension) and ^
const withoutNotes = (line: string) => line.replace(/\[\[[\s\S]*?\]\]/g, '').trim();

const looksLikeCharacter = (line: string) => {
  const name = withoutNotes(line).replace(/\^\s*$/, '').replace(/\(.*?\)/g, '').trim();
  return /[A-Z]/.test(name) && name === name.toUpperCase() && !/^[!.#=~>@]/.test(line.trim());
};

const parseTitlePage = (lines: string[]): { info: Partial<TitlePageInfo>; used: number } => {
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  const first = /^([A-Za-z][A-Za-z ]*):(.*)$/.exec(lines[i] ?? '');
  if (!first || !TITLE_KEYS.has(first[1].trim().toLowerCase())) return { info: {}, used: 0 };

  const values = new Map<string, string[]>();
  let key = '';
  for (; i < lines.length && lines[i].trim() !== ''; i++) {
    const kv = /^([A-Za-z][A-Za-z ]*):(.*)$/.exec(lines[i]);
    if (kv && !/^\s/.test(lines[i])) {
      key = kv[1].trim().toLowerCase();
      values.set(key, kv[2].trim() ? [kv[2].trim()] : []);
    } else if (key) {
      values.get(key)!.push(lines[i].trim());
    }
  }
  const get = (...keys: string[]) => {
    for (const k of keys) if (values.has(k)) return values.get(k)!.map((v) => plain(parseEmphasis(v))).join('\n');
    return undefined;
  };
  const info: Partial<TitlePageInfo> = {};
  const set = <K extends keyof TitlePageInfo>(k: K, v: string | undefined) => { if (v !== undefined) info[k] = v as TitlePageInfo[K]; };
  set('title', get('title'));
  set('credit', get('credit'));
  set('author', get('author', 'authors'));
  set('source', get('source'));
  set('draftDate', get('draft date', 'date'));
  set('contact', get('contact'));
  set('copyright', get('copyright'));
  return { info, used: i };
};

export const parseFountain = (source: string): FountainImport => {
  // Boneyard first (it may hide anything), then title page
  const boneyards: string[] = [];
  const text = source.replace(/\r\n?/g, '\n').replace(/\/\*([\s\S]*?)\*\//g, (_, inner: string) => {
    boneyards.push(inner);
    return `\uE000B${boneyards.length - 1}\uE000`;
  });
  const allLines = text.split('\n');
  const { info, used } = parseTitlePage(allLines);
  const lines = allLines.slice(used);

  const elements: ScreenplayElement[] = [];
  const notes: FountainNote[] = [];
  let pendingNotes: string[] = []; // notes standing alone, for the next paragraph
  let pageBreak = false;

  // Adds a paragraph, pulling out its notes and boneyard pieces
  const add = (type: ElementType, raw: string, extra: Partial<ScreenplayElement> = {}) => {
    const found: string[] = [];
    const later: string[] = [];
    const cleaned = raw
      .replace(NOTE, (_, note: string) => { found.push(note.trim()); return ''; })
      .replace(BONEYARD_TOKEN, (_, n: string) => { later.push(boneyards[+n]); return ''; })
      .replace(/[ \t]+$/gm, '')
      .replace(/\n+$/, '');
    const el: ScreenplayElement = { id: generateId(), type, content: parseEmphasis(cleaned), ...extra };
    if (pageBreak) { el.pageBreakBefore = true; pageBreak = false; }
    elements.push(el);
    const index = elements.length - 1;
    [...pendingNotes, ...found].forEach((note) => notes.push({ elementIndex: index, text: note }));
    pendingNotes = [];
    later.forEach((b) => elements.push({ id: generateId(), type: 'General', content: [{ text: b }], outline: { kind: 'boneyard' } }));
    return el;
  };

  // Paragraphs: runs of non-blank lines (a two-space line is not blank)
  const paragraphs: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (isBlank(line)) {
      if (current.length) paragraphs.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) paragraphs.push(current);

  let lastCharacterBlock: ScreenplayElement[] = [];

  for (const para of paragraphs) {
    const trimmed = withoutNotes(para[0]);
    const note = (para[0].match(/\[\[[\s\S]*?\]\]/g) ?? []).join(' ');

    // Whole-paragraph structure
    if (para.length === 1 && /^={3,}$/.test(trimmed)) { pageBreak = true; continue; }
    if (para.every((l) => /^\s*\uE000B\d+\uE000\s*$/.test(l))) {
      para.forEach((l) => { const n = +/\uE000B(\d+)\uE000/.exec(l)![1]; elements.push({ id: generateId(), type: 'General', content: [{ text: boneyards[n] }], outline: { kind: 'boneyard' } }); });
      continue;
    }
    if (para.join('\n').replace(NOTE, '').trim() === '') {
      for (const m of para.join('\n').matchAll(NOTE)) pendingNotes.push(m[1].trim());
      continue;
    }
    if (para.every((l) => /^\s*#/.test(l))) {
      para.forEach((l) => {
        const m = /^\s*(#+)\s*(.*)$/.exec(l)!;
        add('General', m[2], { outline: { kind: 'section', depth: m[1].length } });
      });
      continue;
    }
    if (para.every((l) => /^\s*=(?!==)/.test(l))) {
      para.forEach((l) => add('General', l.replace(/^\s*=\s*/, ''), { outline: { kind: 'synopsis' } }));
      continue;
    }
    if (para.every((l) => /^\s*>.*<\s*$/.test(l))) {
      add('Action', para.map((l) => l.trim().replace(/^>\s*/, '').replace(/\s*<$/, '')).join('\n'), { centered: true });
      continue;
    }
    if (para.every((l) => /^\s*~/.test(l))) {
      add('Action', para.map((l) => l.replace(/^\s*~\s?/, '')).join('\n'), { lyric: true });
      continue;
    }

    // Scene heading: forced ".", or INT/EXT... on a line of its own
    if (para.length === 1 && (/^\.(?!\.)/.test(trimmed) || HEADING.test(trimmed))) {
      let heading = /^\.(?!\.)/.test(trimmed) ? trimmed.slice(1) : trimmed;
      const number = SCENE_NUMBER.exec(heading);
      if (number) heading = heading.slice(0, number.index);
      add('Scene Heading', `${heading.trim()} ${note}`, number ? { sceneNumber: number[1] } : {});
      lastCharacterBlock = [];
      continue;
    }

    // Transition: forced ">", or all caps ending TO:
    if (para.length === 1 && (/^>/.test(trimmed) || TRANSITION.test(trimmed))) {
      add('Transition', `${trimmed.replace(/^>\s*/, '')} ${note}`);
      continue;
    }

    // Character with dialogue
    if (para.length > 1 && (/^@/.test(trimmed) || looksLikeCharacter(trimmed))) {
      const dual = /\^\s*$/.test(trimmed);
      const name = trimmed.replace(/^@/, '').replace(/\s*\^\s*$/, '');
      const block: ScreenplayElement[] = [add('Character', `${name} ${note}`)];
      let speech: string[] = [];
      const flush = () => {
        if (speech.length) block.push(add('Dialogue', speech.join('\n')));
        speech = [];
      };
      for (const line of para.slice(1)) {
        const l = line === '  ' ? '' : line.trim();
        if (/^\(.*\)$/.test(l)) {
          flush();
          block.push(add('Parenthetical', l));
        } else {
          speech.push(l);
        }
      }
      flush();
      if (dual && lastCharacterBlock.length) {
        lastCharacterBlock.forEach((el) => { el.isDualDialogue = true; el.dualDialoguePosition = 'left'; });
        block.forEach((el) => { el.isDualDialogue = true; el.dualDialoguePosition = 'right'; });
      }
      lastCharacterBlock = block;
      continue;
    }

    // Action (default; "!" forces it)
    const action = para.map((l, i) => (i === 0 ? l.replace(/^(\s*)!/, '$1') : l)).join('\n');
    add('Action', action);
    lastCharacterBlock = [];
  }

  // Notes with nothing after them belong to the last paragraph
  if (pendingNotes.length && elements.length) {
    pendingNotes.forEach((note) => notes.push({ elementIndex: elements.length - 1, text: note }));
  }
  if (elements.length === 0) elements.push({ id: generateId(), type: 'Scene Heading', content: [{ text: '' }] });

  const title = info.title ?? '';
  const titlePage: TitlePageInfo = {
    title,
    credit: info.credit ?? 'Written by',
    author: info.author ?? '',
    source: info.source ?? '',
    draftDate: info.draftDate ?? '',
    contact: info.contact ?? '',
    copyright: info.copyright ?? '',
  };
  return { screenplay: { title, author: titlePage.author, titlePage, elements }, notes };
};

// ---------------------------------------------------------------------------
// Export

// Lines that would read as something else unless forced as action
const needsForcedAction = (text: string) => {
  const firstLine = text.split('\n')[0].trim();
  return HEADING.test(firstLine) || TRANSITION.test(firstLine) || /^[!@#=~>.]|^\[\[|^={3,}$/.test(firstLine) ||
    (text.includes('\n') && looksLikeCharacter(firstLine));
};

export const toFountain = (screenplay: Screenplay, notes: ScriptNote[] = []): string => {
  const out: string[] = [];
  const tp = screenplay.titlePage;

  // Title page
  const titleLines: string[] = [];
  const field = (key: string, value: string | undefined) => {
    if (!value) return;
    const [head, ...rest] = value.split('\n');
    titleLines.push(rest.length ? `${key}:\n    ${[head, ...rest].join('\n    ')}` : `${key}: ${head}`);
  };
  field('Title', tp?.title || screenplay.title);
  field('Credit', tp?.credit);
  field('Author', tp?.author || screenplay.author);
  field('Source', tp?.source);
  field('Draft date', tp?.draftDate);
  field('Contact', tp?.contact);
  field('Copyright', tp?.copyright);
  if (titleLines.length) out.push(titleLines.join('\n'));

  const notesFor = new Map<string, string[]>();
  for (const note of notes) {
    if (!note.elementId) continue;
    const text = [note.title, note.content].filter(Boolean).join(': ').replace(/\n+/g, ' ');
    if (text) notesFor.set(note.elementId, [...(notesFor.get(note.elementId) ?? []), text]);
  }
  const withNotes = (el: ScreenplayElement, text: string) =>
    [text, ...(notesFor.get(el.id) ?? []).map((n) => `[[${n}]]`)].filter(Boolean).join(' ');

  const els = screenplay.elements;
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (el.pageBreakBefore) out.push('===');
    const text = writeEmphasis(el.content);

    if (el.outline?.kind === 'section') { out.push(`${'#'.repeat(el.outline.depth)} ${plain(el.content)}`); continue; }
    if (el.outline?.kind === 'synopsis') { out.push(`= ${plain(el.content)}`); continue; }
    if (el.outline?.kind === 'boneyard') { out.push(`/*${plain(el.content)}*/`); continue; }

    switch (el.type) {
      case 'Scene Heading': {
        const forced = HEADING.test(plain(el.content).trim()) ? '' : '.';
        out.push(withNotes(el, `${forced}${text}${el.sceneNumber ? ` #${el.sceneNumber}#` : ''}`));
        break;
      }
      case 'Transition':
        out.push(withNotes(el, TRANSITION.test(plain(el.content).trim()) ? text : `> ${text}`));
        break;
      case 'Character': {
        // The character and the speech that follows go in one paragraph
        const name = plain(el.content);
        const forced = /[a-z]/.test(name) || !/[A-Za-z]/.test(name) || /^[!.#=~>@]/.test(name);
        const firstRight = el.dualDialoguePosition === 'right' && els[i - 1]?.dualDialoguePosition !== 'right';
        const block = [withNotes(el, `${forced ? '@' : ''}${name}${firstRight ? ' ^' : ''}`)];
        while (els[i + 1] && (els[i + 1].type === 'Dialogue' || els[i + 1].type === 'Parenthetical') && !els[i + 1].pageBreakBefore) {
          i++;
          const line = withNotes(els[i], writeEmphasis(els[i].content));
          block.push(...(els[i].type === 'Dialogue' ? line.split('\n').map((l) => (l === '' ? '  ' : l)) : [line]));
        }
        out.push(block.join('\n'));
        break;
      }
      default: {
        // Action, General, Shot, and dialogue without a speaker
        if (el.centered) { out.push(withNotes(el, text.split('\n').map((l) => `> ${l} <`).join('\n'))); break; }
        if (el.lyric) { out.push(withNotes(el, text.split('\n').map((l) => `~${l}`).join('\n'))); break; }
        const forced = el.type === 'Shot' || el.type === 'Dialogue' || el.type === 'Parenthetical' || needsForcedAction(plain(el.content));
        out.push(withNotes(el, `${forced ? '!' : ''}${text}`));
      }
    }
  }
  return `${out.join('\n\n')}\n`;
};
