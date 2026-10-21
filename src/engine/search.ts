// Find anything in the project: scenes, characters, breakdown elements,
// people, locations, shots, call sheets, dailies, references, budget
// accounts. Pure: builds an index from project data and ranks matches.
import type { ProjectData } from '../types/user';
import type { AppMode } from '../store/types';

export type SearchKind = 'scene' | 'character' | 'element' | 'person' | 'location' | 'shot' | 'callsheet' | 'clip' | 'reference' | 'account';

export interface SearchItem {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  app: AppMode;
  /** what to select on arrival (scene id, element id…) */
  target?: string;
}

const text = (runs: { text: string }[]) => runs.map((r) => r.text).join('');
const speaker = (s: string) => s.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\^$/, '').trim().toUpperCase();

export function buildSearchIndex(data: ProjectData): SearchItem[] {
  const items: SearchItem[] = [];
  const els = data.screenplay.elements;
  let sceneNo = 0;
  let sceneId = '';
  const characters = new Map<string, { firstElement: string; scenes: Set<string>; lines: number }>();
  for (const el of els) {
    if (el.type === 'Scene Heading') {
      sceneNo++;
      sceneId = el.id;
      const number = el.sceneNumber || String(sceneNo);
      // A taste of the scene's action for context
      const next = els.slice(els.indexOf(el) + 1, els.indexOf(el) + 4).find((e) => e.type === 'Action');
      items.push({ kind: 'scene', id: el.id, title: `${number}. ${text(el.content)}`, subtitle: next ? text(next.content).slice(0, 80) : 'Scene', app: 'rewriter', target: el.id });
    } else if (el.type === 'Character') {
      const name = speaker(text(el.content));
      if (!name) continue;
      const c = characters.get(name) ?? { firstElement: el.id, scenes: new Set<string>(), lines: 0 };
      c.lines++;
      if (sceneId) c.scenes.add(sceneId);
      characters.set(name, c);
    }
  }
  for (const [name, c] of characters) {
    items.push({ kind: 'character', id: `char:${name}`, title: name, subtitle: `${c.lines} line${c.lines === 1 ? '' : 's'} in ${c.scenes.size} scene${c.scenes.size === 1 ? '' : 's'}`, app: 'rewriter', target: c.firstElement });
  }
  for (const rec of data.breakdown?.elementList ?? []) {
    items.push({ kind: 'element', id: rec.id, title: rec.name, subtitle: `Breakdown · ${rec.category}`, app: 'breakdown' });
  }
  for (const p of data.productionData?.people ?? []) {
    const role = p.roles[0];
    items.push({
      kind: 'person', id: p.id, title: `${p.firstName} ${p.lastName}`.trim() || p.email,
      subtitle: [p.group, role?.characterName || role?.position, role?.department, p.email].filter(Boolean).join(' · '), app: 'basecamp', target: 'people',
    });
  }
  for (const l of data.productionData?.locations ?? []) {
    items.push({ kind: 'location', id: l.id, title: l.name, subtitle: [l.streetAddress, l.city].filter(Boolean).join(', ') || 'Location', app: 'basecamp', target: 'locations' });
  }
  for (const cs of data.productionData?.callSheets ?? []) {
    items.push({ kind: 'callsheet', id: cs.id, title: `Call Sheet · Day ${cs.dayNumber}`, subtitle: [cs.title, cs.date].filter(Boolean).join(' · '), app: 'basecamp', target: 'callsheets' });
  }
  for (const sh of data.viewFinder?.shots ?? []) {
    items.push({ kind: 'shot', id: sh.id, title: `Shot ${sh.sceneNumber}-${sh.shotNumber} · ${sh.size}`, subtitle: sh.description || sh.subject || 'Shot', app: 'viewfinder', target: sh.sceneId });
  }
  for (const c of data.dailies?.clips ?? []) {
    items.push({ kind: 'clip', id: c.id, title: c.name, subtitle: `Dailies · V${c.version}`, app: 'supervisor', target: c.id });
  }
  for (const r of data.references?.images ?? []) {
    const k = [r.credits.title, r.credits.year, r.credits.dp, ...r.keywords].filter(Boolean);
    items.push({ kind: 'reference', id: r.id, title: r.credits.title || r.media.fileName, subtitle: `Reference${k.length > 1 ? ` · ${k.slice(1).join(', ')}` : ''}`, app: 'viewfinder', target: r.id });
  }
  for (const cat of data.budget?.categories ?? []) {
    for (const a of cat.accounts) {
      items.push({ kind: 'account', id: a.id, title: `${a.number} ${a.name}`, subtitle: `Budget · ${cat.number} ${cat.name}`, app: 'bottomline', target: a.id });
    }
  }
  return items;
}

/** Rank: whole title starts with the query, then a word does, then anywhere; all words must match */
export function searchIndex(items: SearchItem[], query: string, limit = 30): SearchItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of items) {
    const title = item.title.toLowerCase();
    const hay = `${title} ${item.subtitle.toLowerCase()}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const q = words.join(' ');
    let score = title.startsWith(q) ? 0 : new RegExp(`(^|[^a-z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title) ? 1 : title.includes(q) ? 2 : 3;
    score += Math.min(1, title.length / 200);
    scored.push({ item, score });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.item);
}
