import { describe, expect, it } from 'vitest';
import type { Screenplay } from '../types/screenplay';
import { createDefaultRevisionSettings } from '../types/screenplay';
import { generateFDX, parseFDX } from './fdx';

const titlePage = { title: 'Rain', credit: 'Written by', author: 'A. Writer' };
const script = (elements: Screenplay['elements'], extra: Partial<Screenplay> = {}): Screenplay => ({
  title: 'Rain', author: 'A. Writer', titlePage, elements, ...extra,
});
const roundTrip = (s: Screenplay) => parseFDX(generateFDX(s));
const strip = (s: Screenplay) => s.elements.map(({ id: _id, ...rest }) => (void _id, rest));

describe('FDX round-trip', () => {
  it('keeps revision sets, settings and RevisionIDs', () => {
    const revisions = { ...createDefaultRevisionSettings(), activeSetId: 2, revisionMode: true, marksShown: 'all' as const, showPageColors: true };
    revisions.sets[1] = { ...revisions.sets[1], label: 'Pink Rev. 10/19', mark: '+' };
    const back = roundTrip(script([
      { id: 'a', type: 'Action', content: [{ text: 'Old.' }] },
      { id: 'b', type: 'Action', content: [{ text: 'New.' }], revisionId: 2 },
      { id: 'c', type: 'Action', content: [{ text: 'Mixed ' }, { text: 'run.', revisionId: 1 }] },
    ], { revisions }));

    expect(back.revisions).toEqual(revisions);
    expect(back.elements.map((e) => e.revisionId)).toEqual([undefined, 2, 1]);
    expect(back.elements[1].content[0].revisionId).toBe(2);
    expect(back.elements[2].content.map((r) => r.revisionId)).toEqual([undefined, 1]);
    expect(generateFDX(script([], { revisions }))).toContain('PageColor="#FFFFD9D9E3E3"');
  });

  it('writes no Revisions block for a script that never used them', () => {
    expect(generateFDX(script([{ id: 'a', type: 'Action', content: [{ text: 'x' }] }]))).not.toContain('<Revisions');
  });

  it('keeps an omitted scene and its text', () => {
    const omitted = [
      { id: 'h', type: 'Scene Heading' as const, content: [{ text: 'INT. B - DAY' }], sceneNumber: '2' },
      { id: 'x', type: 'Action' as const, content: [{ text: 'b.' }] },
    ];
    const back = roundTrip(script([
      { id: 'h', type: 'Scene Heading', content: [{ text: 'OMITTED' }], sceneNumber: '2', omitted },
      { id: 'c', type: 'Scene Heading', content: [{ text: 'INT. C - DAY' }], sceneNumber: '3' },
    ]));
    expect(back.elements).toHaveLength(2);
    expect(back.elements[0].content[0].text).toBe('OMITTED');
    expect(back.elements[0].sceneNumber).toBe('2');
    expect(back.elements[0].omitted?.map((e) => e.content[0].text)).toEqual(['INT. B - DAY', 'b.']);
  });

  it('keeps centered paragraphs and inserted page breaks', () => {
    const back = roundTrip(script([{ id: 'a', type: 'Action', content: [{ text: 'THE END' }], centered: true, pageBreakBefore: true }]));
    expect(back.elements[0]).toMatchObject({ centered: true, pageBreakBefore: true });
  });

  it('keeps scene titles, colors and summaries', () => {
    const back = roundTrip(script([
      { id: 'h', type: 'Scene Heading', content: [{ text: 'INT. A - DAY' }], scene: { title: 'The meeting', color: 'Green', summary: 'They meet & talk.' } },
      { id: 'a', type: 'Action', content: [{ text: 'Rain.' }] },
    ]));
    expect(back.elements).toHaveLength(2);
    expect(back.elements[0].scene).toEqual({ title: 'The meeting', color: 'Green', summary: 'They meet & talk.' });
  });

  it('keeps bookmarks', () => {
    const back = roundTrip(script([{ id: 'a', type: 'Action', content: [{ text: 'x' }], bookmark: 'Midpoint & "twist"' }]));
    expect(back.elements[0].bookmark).toBe('Midpoint & "twist"');
  });

  it('keeps dual dialogue side by side', () => {
    const original = script([
      { id: '1', type: 'Character', content: [{ text: 'ALEX' }], isDualDialogue: true, dualDialoguePosition: 'left' },
      { id: '2', type: 'Dialogue', content: [{ text: 'No.' }], isDualDialogue: true, dualDialoguePosition: 'left' },
      { id: '3', type: 'Character', content: [{ text: 'SAM' }], isDualDialogue: true, dualDialoguePosition: 'right' },
      { id: '4', type: 'Dialogue', content: [{ text: 'Yes.' }], isDualDialogue: true, dualDialoguePosition: 'right' },
      { id: '5', type: 'Action', content: [{ text: 'Done.' }] },
    ]);
    expect(strip(roundTrip(original))).toEqual(strip(original));
  });
});
