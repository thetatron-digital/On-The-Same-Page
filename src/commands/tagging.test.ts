import { beforeEach, describe, expect, it } from 'vitest';
import { useScreenplayStore } from '../store/screenplayStore';
import type { ElementType, ScreenplayElement } from '../types/screenplay';
import { tagAllCharacters, tagSelection } from './tagging';

const store = () => useScreenplayStore.getState();
const el = (id: string, type: ElementType, text: string): ScreenplayElement => ({ id, type, content: [{ text }] });

describe('Tags Mode', () => {
  beforeEach(() => {
    store().resetToNew();
    store().setScreenplay({
      ...store().screenplay,
      elements: [
        el('s1', 'Scene Heading', 'INT. KITCHEN - DAY'), el('a1', 'Action', 'Alex lights a candle.'),
        el('c1', 'Character', 'ALEX'), el('d1', 'Dialogue', 'Hi.'), el('c2', 'Character', 'ALEX (V.O.)'), el('d2', 'Dialogue', 'Again.'),
        el('s2', 'Scene Heading', 'EXT. GARDEN - NIGHT'), el('c3', 'Character', 'SAM'), el('d3', 'Dialogue', 'Out here.'),
      ],
    });
  });

  it('tags every speaking character once per scene as Cast Members, linked to master elements', () => {
    expect(tagAllCharacters()).toBe(2);
    expect(tagAllCharacters()).toBe(0); // already tagged
    const tags = store().breakdown!.elements;
    expect(tags.map((t) => [t.sceneId, t.text, t.category])).toEqual([['s1', 'ALEX', 'Cast Members'], ['s2', 'SAM', 'Cast Members']]);
    expect(tags.every((t) => t.elementRefId)).toBe(true);
    expect((store().breakdown!.elementList ?? []).map((e) => e.name).sort()).toEqual(['ALEX', 'SAM']);
  });

  it('tags the words selected in the script', () => {
    const div = document.createElement('div');
    div.setAttribute('data-element-id', 'a1');
    div.textContent = 'Alex lights a candle.';
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 14);
    range.setEnd(div.firstChild!, 20);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    expect(tagSelection('Props')).toBeNull();
    const [tag] = store().breakdown!.elements;
    expect(tag).toMatchObject({ text: 'candle', category: 'Props', sceneId: 's1', sourceElementId: 'a1', startOffset: 14, endOffset: 20 });
    expect(tag.elementRefId).toBeTruthy();
    div.remove();
  });

  it('explains when nothing is selected', () => {
    window.getSelection()!.removeAllRanges();
    expect(tagSelection('Props')).toMatch(/Select/);
  });
});
