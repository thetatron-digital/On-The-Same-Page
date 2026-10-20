// Sides: the pages an actor needs for a shoot day. Pick scenes; every page
// holding part of them prints (with its script page number), and anything on
// those pages from other scenes is crossed out.

import type { ScreenplayElement } from '../types/screenplay';
import type { Page, Pagination } from './paginate';

export interface SidesHeader {
  production: string;
  date: string;
  shootDay: string;
  callTime: string;
  notes: string;
}

export interface SidesPage {
  page: Page;
  // Line ranges (top inclusive, bottom exclusive) to cross out
  crossOut: { top: number; bottom: number }[];
}

// Scene heading id each element belongs to ('' before the first heading)
export const sceneOfElements = (elements: ScreenplayElement[]): string[] => {
  let scene = '';
  return elements.map((el) => {
    if (el.type === 'Scene Heading') scene = el.id;
    return scene;
  });
};

export const planSides = (pagination: Pagination, elements: ScreenplayElement[], sceneIds: string[]): SidesPage[] => {
  const wanted = new Set(sceneIds);
  const sceneOf = sceneOfElements(elements);
  const out: SidesPage[] = [];

  for (const page of pagination.pages) {
    // Which scene each item belongs to; (MORE)/(CONT'D) follow the speech they mark
    let scene = '';
    const owners = page.items.map((item) => {
      if (item.kind === 'element') scene = sceneOf[item.elementIndex];
      else if (item.kind === 'dual') scene = sceneOf[item.left[0].elementIndex];
      else if (item.kind === 'contd' && !scene) {
        const next = page.items.find((i) => i.kind === 'element');
        if (next?.kind === 'element') scene = sceneOf[next.elementIndex];
      }
      return scene;
    });
    if (!owners.some((s) => wanted.has(s))) continue;

    // Merge neighbouring unwanted items into runs of lines
    const crossOut: SidesPage['crossOut'] = [];
    page.items.forEach((item, i) => {
      if (wanted.has(owners[i])) return;
      const top = item.top;
      const height = item.kind === 'element' ? item.lines.length : item.kind === 'dual' ? item.height : 1;
      const previousUnwanted = i > 0 && !wanted.has(owners[i - 1]);
      const last = crossOut[crossOut.length - 1];
      if (last && previousUnwanted) last.bottom = top + height;
      else crossOut.push({ top, bottom: top + height });
    });
    out.push({ page, crossOut });
  }
  return out;
};
