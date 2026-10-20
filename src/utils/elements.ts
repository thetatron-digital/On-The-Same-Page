// ============================================
// ELEMENT MANAGER (master element list)
// ============================================
// Movie Magic keeps one record per element (a prop, a cast member...)
// and every breakdown sheet references it. OTSP's tags are occurrences
// in the script text; this module keeps a master list in step with them.

import type { Breakdown, BreakdownScene } from '../types/screenplay';
import { generateId } from './fdx';

export const normalizeElementName = (text: string) => text.trim().replace(/\s+/g, ' ').toUpperCase();

const keyOf = (category: string, name: string) => `${category}\u0000${normalizeElementName(name)}`;

/** Make sure every tag points at a master element, creating records as needed. Idempotent. */
export function syncElementList(breakdown: Breakdown): Breakdown {
  const list = [...(breakdown.elementList ?? [])];
  const byId = new Map(list.map((e) => [e.id, e]));
  const byKey = new Map(list.map((e) => [keyOf(e.category, e.name), e]));
  let changed = !breakdown.elementList;

  const elements = breakdown.elements.map((tag) => {
    if (tag.elementRefId && byId.has(tag.elementRefId)) return tag;
    const name = normalizeElementName(tag.text);
    if (!name) return tag;
    const key = keyOf(tag.category, name);
    let record = byKey.get(key);
    if (!record) {
      record = { id: generateId(), name, category: tag.category, lockBoardId: false, excludeFromStripboard: false };
      list.push(record);
      byId.set(record.id, record);
      byKey.set(key, record);
    }
    changed = true;
    return { ...tag, elementRefId: record.id };
  });

  return changed ? { ...breakdown, elements, elementList: list } : breakdown;
}

export interface ElementUsage {
  sceneIds: string[]; // scenes (breakdown sheets) referencing the element, script order
  occurrences: number; // number of sheets, as in MMS "Total Occurrences"
}

export function elementUsage(breakdown: Breakdown, scenes: BreakdownScene[]): Map<string, ElementUsage> {
  const order = new Map(scenes.map((s, i) => [s.id, i]));
  const sceneSets = new Map<string, Set<string>>();
  for (const tag of breakdown.elements) {
    if (!tag.elementRefId) continue;
    const set = sceneSets.get(tag.elementRefId) ?? new Set<string>();
    set.add(tag.sceneId);
    sceneSets.set(tag.elementRefId, set);
  }
  const usage = new Map<string, ElementUsage>();
  for (const record of breakdown.elementList ?? []) {
    const sceneIds = [...(sceneSets.get(record.id) ?? [])].sort(
      (a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity)
    );
    usage.set(record.id, { sceneIds, occurrences: sceneIds.length });
  }
  return usage;
}

/**
 * Renumber Board IDs in one category by order of first appearance in the
 * script (1, 2, 3...). Locked IDs are kept and their numbers skipped.
 * Elements that never appear keep no number.
 */
export function renumberBoardIds(breakdown: Breakdown, scenes: BreakdownScene[], category: string): Breakdown {
  const list = breakdown.elementList ?? [];
  const usage = elementUsage(breakdown, scenes);
  const order = new Map(scenes.map((s, i) => [s.id, i]));
  const firstAppearance = (id: string) => {
    const first = usage.get(id)?.sceneIds[0];
    return first === undefined ? Infinity : (order.get(first) ?? Infinity);
  };
  const taken = new Set(list.filter((e) => e.category === category && e.lockBoardId && e.boardId).map((e) => e.boardId!));
  const toNumber = list
    .filter((e) => e.category === category && !e.lockBoardId && firstAppearance(e.id) !== Infinity)
    .sort((a, b) => firstAppearance(a.id) - firstAppearance(b.id) || a.name.localeCompare(b.name));

  const assigned = new Map<string, string>();
  let next = 1;
  for (const e of toNumber) {
    while (taken.has(String(next))) next++;
    assigned.set(e.id, String(next));
    taken.add(String(next));
  }
  return {
    ...breakdown,
    elementList: list.map((e) =>
      e.category !== category || e.lockBoardId ? e : { ...e, boardId: assigned.get(e.id) }
    ),
  };
}

/** Merge `sourceIds` into `targetId`: their tags now reference the target, and the sources are removed. */
export function mergeElements(breakdown: Breakdown, targetId: string, sourceIds: string[]): Breakdown {
  const sources = new Set(sourceIds.filter((id) => id !== targetId));
  if (sources.size === 0) return breakdown;
  return {
    ...breakdown,
    elements: breakdown.elements.map((t) => (t.elementRefId && sources.has(t.elementRefId) ? { ...t, elementRefId: targetId } : t)),
    elementList: (breakdown.elementList ?? []).filter((e) => !sources.has(e.id)),
  };
}

/** Remove an element and all of its tags (occurrences). */
export function deleteElement(breakdown: Breakdown, elementId: string): Breakdown {
  const removedTagIds = new Set(breakdown.elements.filter((t) => t.elementRefId === elementId).map((t) => t.id));
  return {
    ...breakdown,
    elements: breakdown.elements.filter((t) => !removedTagIds.has(t.id)),
    elementList: (breakdown.elementList ?? []).filter((e) => e.id !== elementId),
    scenes: breakdown.scenes.map((s) => ({ ...s, elements: s.elements.filter((id) => !removedTagIds.has(id)) })),
  };
}
