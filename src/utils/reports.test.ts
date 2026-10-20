import { describe, expect, it } from 'vitest';
import type { ElementType, Screenplay, ScreenplayElement } from '../types/screenplay';
import { castReport, characterReport, formatEighths, listCharacters, locationReport, parseHeading, reportToCSV, reportToPDF, sceneReport } from './reports';

let n = 0;
const el = (type: ElementType, text: string): ScreenplayElement => ({ id: `e${n++}`, type, content: [{ text }] });
const script = (elements: ScreenplayElement[]): Screenplay => ({ title: 'T', author: '', titlePage: { title: 'T', credit: '', author: '' }, elements });

const sample = () => script([
  el('Scene Heading', 'INT. KITCHEN - DAY'),
  el('Action', 'ALEX cooks. SAM watches.'),
  el('Character', 'ALEX'), el('Dialogue', 'Hungry?'),
  el('Character', 'ALEX (CONT\'D)'), el('Dialogue', 'Well?'),
  el('Scene Heading', 'EXT. GARDEN - NIGHT'),
  el('Character', 'SAM'), el('Dialogue', 'Out here.'),
  el('Scene Heading', 'INT. KITCHEN - NIGHT'),
  el('Action', 'Empty.'),
]);

describe('reports', () => {
  it('parses headings and formats eighths', () => {
    expect(parseHeading('INT. KITCHEN - DAY')).toEqual({ intExt: 'INT', location: 'KITCHEN', time: 'DAY' });
    expect(parseHeading('EXT. ROOF')).toEqual({ intExt: 'EXT', location: 'ROOF', time: '' });
    expect([0, 3, 8, 11].map(formatEighths)).toEqual(['0', '3/8', '1', '1 3/8']);
  });

  it('lists scenes with pages, lengths and speakers', () => {
    const r = sceneReport(sample());
    expect(r.columns).toEqual(['Scene', 'Heading', 'Page', 'Length', 'Characters']);
    expect(r.rows.map((row) => [row[0], row[1], row[2], row[4]])).toEqual([
      ['1', 'INT. KITCHEN - DAY', '1', 'ALEX'],
      ['2', 'EXT. GARDEN - NIGHT', '1', 'SAM'],
      ['3', 'INT. KITCHEN - NIGHT', '1', ''],
    ]);
    expect(r.rows.every((row) => /\/8|^\d/.test(row[3]))).toBe(true);
  });

  it('groups scenes by location', () => {
    const r = locationReport(sample(), 'scenes');
    expect(r.rows.map((row) => [row[0], row[1], row[2], row[3], row[4]])).toEqual([
      ['KITCHEN', 'INT', 'DAY, NIGHT', '1, 3', '2'],
      ['GARDEN', 'EXT', 'NIGHT', '2', '1'],
    ]);
  });

  it('reports one character', () => {
    const r = characterReport(sample(), 'alex');
    expect(r.subtitle).toBe('2 speeches in 1 scenes');
    expect(r.rows).toEqual([['1', '1', 'INT. KITCHEN - DAY', '2', 'Hungry? / Well?']]);
  });

  it('counts the cast, speaking and not', () => {
    expect(listCharacters(sample())).toEqual(['ALEX', 'SAM']);
    const r = castReport(sample());
    expect(r.rows).toEqual([
      ['ALEX', '2', '1', '1', '0'],
      ['SAM', '1', '2', '1', '1'],
    ]);
  });

  it('writes CSV and PDF', () => {
    const r = castReport(sample());
    expect(reportToCSV({ ...r, rows: [['A, B', 'say "hi"']] }).split('\n')[1]).toBe('"A, B","say ""hi"""');
    expect(reportToPDF(sceneReport(sample())).getNumberOfPages()).toBe(1);
  });
});
