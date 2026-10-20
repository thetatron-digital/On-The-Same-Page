// ReWriter reports (Tools > Reports): Scene, Location, Character and Cast.
// Each report is a table that can be shown, saved as CSV or printed to PDF.
// Page numbers and scene lengths come from the pagination engine.

import jsPDF from 'jspdf';
import type { Screenplay } from '../types/screenplay';
import { LINES_PER_PAGE } from '../types/screenplay';
import { paginateScript } from '../engine/paginate';

export interface Report {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: string[][];
}

const textOf = (runs: { text: string }[]) => runs.map((r) => r.text).join('');

// Character name without extensions or (CONT'D): "ALEX (V.O.)" -> "ALEX"
export const speakerName = (text: string): string => text.replace(/\s*\(.*$/, '').trim().toUpperCase();

// "INT. KITCHEN - NIGHT" -> { intExt: 'INT', location: 'KITCHEN', time: 'NIGHT' }
export const parseHeading = (heading: string) => {
  const m = /^\s*((?:INT|EXT|I\/E|INT\.?\/EXT|EXT\.?\/INT|EST)\.?)\s*(.*)$/i.exec(heading.trim());
  const intExt = m ? m[1].replace(/\.$/, '').toUpperCase() : '';
  const rest = (m ? m[2] : heading).trim();
  const dash = rest.lastIndexOf(' - ');
  return {
    intExt,
    location: (dash >= 0 ? rest.slice(0, dash) : rest).trim().toUpperCase(),
    time: dash >= 0 ? rest.slice(dash + 3).trim().toUpperCase() : '',
  };
};

// Page length in eighths, written the way schedules write it: "1 3/8"
// (same output as BaseCamp's formatEighths)
export const formatEighths = (eighths: number): string => {
  if (eighths <= 0) return '0';
  const pages = Math.floor(eighths / 8);
  const rest = eighths % 8;
  if (pages === 0) return `${rest}/8`;
  return rest === 0 ? `${pages}` : `${pages} ${rest}/8`;
};

export interface SceneInfo {
  number: string; // scene number, or position when unnumbered
  heading: string;
  page: string; // label of the page the scene starts on
  eighths: number;
  speakers: string[]; // characters with dialogue, in order of first line
  dialogue: { speaker: string; text: string }[];
  action: string; // all action text, for non-speaking appearances
  omitted: boolean;
}

// The script's scenes with pages, lengths and who speaks in them
export const scenesOf = (screenplay: Screenplay): SceneInfo[] => {
  const { elements } = screenplay;
  const pagination = paginateScript(screenplay);
  const sceneOfElement: number[] = [];
  const scenes: SceneInfo[] = [];

  let current = -1;
  let speaker = '';
  elements.forEach((el, i) => {
    if (el.type === 'Scene Heading') {
      current = scenes.length;
      scenes.push({
        number: el.sceneNumber ?? String(scenes.length + 1),
        heading: textOf(el.content),
        page: pagination.pages[pagination.elementPages[i] - 1]?.label ?? '1',
        eighths: 0,
        speakers: [],
        dialogue: [],
        action: '',
        omitted: !!el.omitted,
      });
    }
    sceneOfElement[i] = current;
    const scene = scenes[current];
    if (!scene) return;
    const text = textOf(el.content);
    if (el.type === 'Character') {
      speaker = speakerName(text);
      if (speaker && !scene.speakers.includes(speaker)) scene.speakers.push(speaker);
    } else if (el.type === 'Dialogue' && speaker) {
      scene.dialogue.push({ speaker, text });
    } else if (el.type === 'Action' || el.type === 'General') {
      scene.action += ` ${text}`;
    }
  });

  // Lines each scene fills on the page, including its spacing and markers
  const lines = new Array(scenes.length).fill(0);
  let last = -1;
  for (const page of pagination.pages) {
    for (const item of page.items) {
      if (item.kind === 'element') last = sceneOfElement[item.elementIndex];
      else if (item.kind === 'dual') last = sceneOfElement[item.left[0].elementIndex];
      if (last < 0) continue;
      lines[last] += item.kind === 'element' ? item.spaceBefore + item.lines.length
        : item.kind === 'dual' ? item.spaceBefore + item.height : 1;
    }
  }
  scenes.forEach((scene, i) => {
    scene.eighths = scene.omitted ? 0 : Math.max(1, Math.round((lines[i] * 8) / LINES_PER_PAGE));
  });
  return scenes;
};

// Everyone who speaks, by number of speeches
export const listCharacters = (screenplay: Screenplay): string[] => {
  const counts = new Map<string, number>();
  for (const el of screenplay.elements) {
    if (el.type !== 'Character') continue;
    const name = speakerName(textOf(el.content));
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
};

const appearsIn = (name: string, text: string) =>
  new RegExp(`(^|[^A-Z0-9'])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Z0-9']|$)`, 'i').test(text);

// ---------------------------------------------------------------------------
// Reports

export type SceneSort = 'script' | 'length' | 'heading';

export const sceneReport = (screenplay: Screenplay, sort: SceneSort = 'script'): Report => {
  const scenes = scenesOf(screenplay);
  const sorted = sort === 'length' ? [...scenes].sort((a, b) => b.eighths - a.eighths)
    : sort === 'heading' ? [...scenes].sort((a, b) => a.heading.localeCompare(b.heading))
    : scenes;
  return {
    title: 'Scene Report',
    subtitle: `${scenes.length} scenes`,
    columns: ['Scene', 'Heading', 'Page', 'Length', 'Characters'],
    rows: sorted.map((s) => [s.number, s.heading, s.page, s.omitted ? 'OMITTED' : formatEighths(s.eighths), s.speakers.join(', ')]),
  };
};

export type LocationSort = 'name' | 'scenes' | 'length';

export const locationReport = (screenplay: Screenplay, sort: LocationSort = 'name'): Report => {
  const byLocation = new Map<string, { intExt: Set<string>; times: Set<string>; scenes: string[]; eighths: number }>();
  for (const s of scenesOf(screenplay)) {
    if (s.omitted) continue;
    const { intExt, location, time } = parseHeading(s.heading);
    const key = location || '(none)';
    const entry = byLocation.get(key) ?? { intExt: new Set(), times: new Set(), scenes: [], eighths: 0 };
    if (intExt) entry.intExt.add(intExt);
    if (time) entry.times.add(time);
    entry.scenes.push(s.number);
    entry.eighths += s.eighths;
    byLocation.set(key, entry);
  }
  const rows = [...byLocation.entries()];
  if (sort === 'scenes') rows.sort((a, b) => b[1].scenes.length - a[1].scenes.length || a[0].localeCompare(b[0]));
  else if (sort === 'length') rows.sort((a, b) => b[1].eighths - a[1].eighths || a[0].localeCompare(b[0]));
  else rows.sort((a, b) => a[0].localeCompare(b[0]));
  return {
    title: 'Location Report',
    subtitle: `${rows.length} locations`,
    columns: ['Location', 'Int/Ext', 'Time', 'Scenes', 'Count', 'Length'],
    rows: rows.map(([location, e]) => [
      location, [...e.intExt].join(', '), [...e.times].join(', '), e.scenes.join(', '), String(e.scenes.length), formatEighths(e.eighths),
    ]),
  };
};

export interface CharacterReportOptions {
  includeDialogue: boolean;
  includeSceneHeadings: boolean;
}

export const characterReport = (
  screenplay: Screenplay,
  name: string,
  options: CharacterReportOptions = { includeDialogue: true, includeSceneHeadings: true },
): Report => {
  const who = speakerName(name);
  const scenes = scenesOf(screenplay).filter((s) => s.speakers.includes(who));
  const speeches = screenplay.elements.filter((el) => el.type === 'Character' && speakerName(textOf(el.content)) === who).length;
  const columns = ['Scene', 'Page', ...(options.includeSceneHeadings ? ['Heading'] : []), 'Speeches', ...(options.includeDialogue ? ['Dialogue'] : [])];
  const rows = scenes.map((s) => {
    const lines = s.dialogue.filter((d) => d.speaker === who);
    return [
      s.number, s.page,
      ...(options.includeSceneHeadings ? [s.heading] : []),
      String(lines.length),
      ...(options.includeDialogue ? [lines.map((d) => d.text).join(' / ')] : []),
    ];
  });
  return {
    title: `Character Report: ${who}`,
    subtitle: `${speeches} speeches in ${scenes.length} scenes`,
    columns,
    rows,
  };
};

export type CastSort = 'dialogues' | 'scenes' | 'speaking' | 'nonSpeaking';

export const castReport = (screenplay: Screenplay, sort: CastSort = 'dialogues'): Report => {
  const scenes = scenesOf(screenplay);
  const cast = listCharacters(screenplay).map((name) => {
    const speaking = scenes.filter((s) => s.speakers.includes(name)).length;
    const nonSpeaking = scenes.filter((s) => !s.speakers.includes(name) && appearsIn(name, s.action)).length;
    const dialogues = screenplay.elements.filter((el) => el.type === 'Character' && speakerName(textOf(el.content)) === name).length;
    return { name, dialogues, speaking, nonSpeaking, scenes: speaking + nonSpeaking };
  });
  const key = sort === 'scenes' ? 'scenes' : sort === 'speaking' ? 'speaking' : sort === 'nonSpeaking' ? 'nonSpeaking' : 'dialogues';
  cast.sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name));
  return {
    title: 'Cast Report',
    subtitle: `${cast.length} speaking characters`,
    columns: ['Character', 'Total dialogues', 'Scene appearances', 'Speaking scenes', 'Non-speaking scenes'],
    rows: cast.map((c) => [c.name, String(c.dialogues), String(c.scenes), String(c.speaking), String(c.nonSpeaking)]),
  };
};

// ---------------------------------------------------------------------------
// Output

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export const reportToCSV = (report: Report): string =>
  [report.columns, ...report.rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';

// A simple paginated table in Courier: columns share the width by content
export const reportToPDF = (report: Report, scriptTitle = ''): jsPDF => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const left = 54;
  const right = 558;
  const lineHeight = 12;
  const charWidth = 6; // Courier 10pt
  doc.setFont('Courier', 'normal');
  doc.setFontSize(10);

  // Column widths in characters, proportional to their longest cell (capped)
  const total = Math.floor((right - left) / charWidth);
  const longest = report.columns.map((c, i) => Math.min(60, Math.max(c.length, ...report.rows.map((r) => (r[i] ?? '').length))));
  const sum = longest.reduce((a, b) => a + b + 2, 0);
  const widths = longest.map((w) => Math.max(4, Math.floor(((w + 2) * total) / Math.max(sum, total)) - 1));

  const wrap = (text: string, width: number): string[] => {
    const out: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (w.length > width) {
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, width));
        w = w.slice(width);
      }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= width) line += ` ${w}`;
      else { out.push(line); line = w; }
    }
    out.push(line);
    return out;
  };

  let y = 54;
  let page = 1;
  const header = () => {
    doc.setFont('Courier', 'bold');
    doc.text(report.title, left, y);
    doc.setFont('Courier', 'normal');
    doc.text(scriptTitle ? `${scriptTitle} - page ${page}` : `Page ${page}`, right, y, { align: 'right' });
    y += lineHeight;
    if (report.subtitle) { doc.text(report.subtitle, left, y); y += lineHeight; }
    y += lineHeight / 2;
    drawRow(report.columns, true);
    doc.line(left, y - lineHeight + 3, right, y - lineHeight + 3);
  };
  const drawRow = (row: string[], bold = false) => {
    const cells = row.map((cell, i) => wrap(cell ?? '', widths[i]));
    const height = Math.max(...cells.map((c) => c.length));
    if (!bold && y + height * lineHeight > 756) {
      doc.addPage();
      page += 1;
      y = 54;
      header();
    }
    doc.setFont('Courier', bold ? 'bold' : 'normal');
    let x = left;
    cells.forEach((lines, i) => {
      lines.forEach((line, li) => doc.text(line, x, y + li * lineHeight));
      x += (widths[i] + 1) * charWidth;
    });
    y += height * lineHeight + (bold ? 4 : 2);
  };

  header();
  report.rows.forEach((row) => drawRow(row));
  return doc;
};
