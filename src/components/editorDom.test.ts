import { describe, expect, it } from 'vitest';
import { DECORATION_ATTR, editableText, offsetInElement, positionAt } from './editorDom';

// <div>INT. HALL<span decoration>1</span> - DAY</div>
const makeDiv = () => {
  const div = document.createElement('div');
  div.append('INT. HALL');
  const span = document.createElement('span');
  span.setAttribute(DECORATION_ATTR, '');
  span.textContent = '(MORE)';
  div.append(span, ' - DAY');
  return { div, first: div.childNodes[0], span, last: div.childNodes[2] };
};

describe('editorDom', () => {
  it('reads text without decorations', () => {
    expect(editableText(makeDiv().div)).toBe('INT. HALL - DAY');
  });

  it('maps DOM positions to text offsets and back, skipping decorations', () => {
    const { div, first, last } = makeDiv();
    expect(offsetInElement(div, first, 4)).toBe(4);
    expect(offsetInElement(div, last, 2)).toBe(11);
    expect(offsetInElement(div, div, 2)).toBe(9); // just after the decoration
    expect(offsetInElement(div, div, 0)).toBe(0);

    expect(positionAt(div, 11)).toEqual({ node: last, offset: 2 });
    expect(positionAt(div, 3)).toEqual({ node: first, offset: 3 });
    expect(positionAt(div, 99)).toEqual({ node: last, offset: 6 });
  });
});
