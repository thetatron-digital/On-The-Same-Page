import { describe, expect, it } from 'vitest';
import type { ElementType, ScreenplayElement } from '../types/screenplay';
import { generatePDF } from '../utils/pdf';
import { paginate } from './paginate';
import { planSides } from './sides';

let n = 0;
const el = (type: ElementType, text: string): ScreenplayElement => ({ id: `s${n++}`, type, content: [{ text }] });
const scene = (name: string, beats: number) => [
  el('Scene Heading', `INT. ${name} - DAY`),
  ...Array.from({ length: beats }, (_, i) => el('Action', `${name} beat ${i + 1}.`)),
];

describe('sides', () => {
  // 12-line pages: scene A fills page 1, B straddles pages 1-2, C sits on page 2-3
  const script = [...scene('A', 3), ...scene('B', 3), ...scene('C', 4)];
  const pagination = paginate(script, { linesPerPage: 12 });
  const id = (name: string) => script.find((e) => e.content[0].text === `INT. ${name} - DAY`)!.id;

  it('prints only the pages a chosen scene touches, keeping page numbers', () => {
    const plan = planSides(pagination, script, [id('B')]);
    const bPages = new Set(script.map((e, i) => (e.content[0].text.startsWith('B') || e.id === id('B') ? pagination.elementPages[i] : 0)).filter(Boolean));
    expect(plan.map((p) => p.page.number)).toEqual([...bPages]);
    expect(plan.length).toBeLessThan(pagination.pageCount);
  });

  it('crosses out the other scenes on those pages, and nothing of the chosen one', () => {
    const plan = planSides(pagination, script, [id('B')]);
    for (const { page, crossOut } of plan) {
      for (const item of page.items) {
        if (item.kind !== 'element') continue;
        const inB = script[item.elementIndex].content[0].text.includes('B');
        const crossed = crossOut.some((r) => item.top >= r.top && item.top < r.bottom);
        expect(crossed).toBe(!inB);
      }
    }
  });

  it('makes a PDF with a cover page', () => {
    const titlePage = { title: 'T', credit: '', author: '' };
    const header = { production: 'T', date: '2026-10-20', shootDay: '3', callTime: '7:00 AM', notes: '' };
    const plan = planSides(paginate(script), script, [id('C')]);
    const doc = generatePDF({ title: 'T', author: '', titlePage, elements: script }, { sides: { sceneIds: [id('C')], header, cover: true } });
    expect(doc.getNumberOfPages()).toBe(plan.length + 1);
  });
});
