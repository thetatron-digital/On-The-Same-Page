import { describe, expect, it } from 'vitest';
import type { ElementType, ScreenplayElement } from '../types/screenplay';
import { createDefaultAutoCompleteLists } from '../types/screenplay';
import { listSuggestions, rebuildAutoCompleteLists } from './autoCompleteLists';
import { detectAutoCompleteTrigger } from './scriptParser';

const el = (type: ElementType, text: string): ScreenplayElement => ({ id: text, type, content: [{ text }] });

describe('Auto-Complete Lists', () => {
  it('rebuilds characters and locations from the script and adds new intros, times, extensions, transitions', () => {
    const script = [
      el('Scene Heading', 'EXT. ROOFTOP - MAGIC HOUR'), el('Character', 'SAM (ON PHONE)'), el('Dialogue', 'Hi.'),
      el('Scene Heading', 'INT. KITCHEN - DAY'), el('Character', "ALEX (CONT'D)"), el('Transition', 'WHIP PAN TO:'),
    ];
    const lists = rebuildAutoCompleteLists(script, { ...createDefaultAutoCompleteLists(), characters: ['OLD NAME'] });
    expect(lists.characters).toEqual(['ALEX', 'SAM']);
    expect(lists.locations).toEqual(['KITCHEN', 'ROOFTOP']);
    expect(lists.times).toContain('MAGIC HOUR');
    expect(lists.extensions).toContain('(ON PHONE)');
    expect(lists.extensions.filter((e) => e.includes('CONT'))).toEqual(["(CONT'D)"]); // the default, not a duplicate
    expect(lists.transitions).toContain('WHIP PAN TO:');
  });

  it('suggests entries that start with, then contain, the typed text', () => {
    expect(listSuggestions(['CUT TO:', 'SMASH CUT TO:', 'FADE IN:'], 'cut', 'transition').map((s) => s.value)).toEqual(['CUT TO:', 'SMASH CUT TO:']);
    expect(listSuggestions(['(V.O.)', '(O.S.)'], '(v', 'extension').map((s) => s.value)).toEqual(['(V.O.)']);
  });

  it('suggests scene intros and transitions while typing them', () => {
    expect(detectAutoCompleteTrigger(el('Scene Heading', 'IN'), 2, 'IN')).toEqual({ triggerType: 'intro', searchText: 'IN' });
    expect(detectAutoCompleteTrigger(el('Transition', 'DIS'), 3, 'DIS')).toEqual({ triggerType: 'transition', searchText: 'DIS' });
    expect(detectAutoCompleteTrigger(el('Scene Heading', 'INT. HALL / NI'), 14, 'INT. HALL / NI', ' / ').triggerType).toBe('timeofday');
  });
});
