// Production-draft tools for ReWriter (Final Draft's Production menu):
// revision sets and marks, locked pages, scene numbers and omitted scenes.
// Pure functions over script elements; the store and UI call these.

import type { LockedPage, RevisionSettings, Screenplay, ScreenplayElement } from '../types/screenplay';
import { createDefaultRevisionSettings } from '../types/screenplay';
import { nextPageLabel, type Page, type Pagination } from './paginate';

const textOf = (el: ScreenplayElement) => el.content.map((r) => r.text).join('');

// ---------------------------------------------------------------------------
// Revisions

export const getRevisionSettings = (script: Pick<Screenplay, 'revisions'>): RevisionSettings =>
  script.revisions ?? createDefaultRevisionSettings();

export const activeRevisionSet = (settings: RevisionSettings) =>
  settings.sets.find((s) => s.id === settings.activeSetId) ?? settings.sets[0];

// In Revision Mode, every element that is new or whose text or type changed is
// stamped with the active revision set. Returns `next` unchanged when nothing is.
export const stampRevisions = (
  prev: ScreenplayElement[],
  next: ScreenplayElement[],
  setId: number,
): ScreenplayElement[] => {
  const before = new Map(prev.map((el) => [el.id, el]));
  let changed = false;
  const stamped = next.map((el) => {
    const old = before.get(el.id);
    const edited = !old || old.type !== el.type || textOf(old) !== textOf(el);
    if (!edited || el.revisionId === setId) return el;
    changed = true;
    return { ...el, revisionId: setId };
  });
  return changed ? stamped : next;
};

// Mark Revised / Clear Revised on a set of elements
export const markRevised = (elements: ScreenplayElement[], ids: Set<string>, setId: number): ScreenplayElement[] =>
  elements.map((el) => (ids.has(el.id) ? { ...el, revisionId: setId, content: el.content.map((r) => ({ ...r, revisionId: setId })) } : el));

export const clearRevised = (elements: ScreenplayElement[], ids: Set<string>): ScreenplayElement[] =>
  elements.map((el) => {
    if (!ids.has(el.id)) return el;
    const cleared = { ...el, content: el.content.map((run) => ({ ...run })) };
    delete cleared.revisionId;
    cleared.content.forEach((run) => delete run.revisionId);
    return cleared;
  });

// Whether an element's revision mark shows, per "Show text and marks"
export const showsRevisionMark = (revisionId: number | undefined, settings: RevisionSettings): boolean =>
  !!revisionId && (settings.marksShown === 'all' || revisionId === settings.activeSetId);

// Revision sets that touch a page (for revised-pages-only output and page colors)
export const pageRevisionIds = (page: Page, elements: ScreenplayElement[]): number[] => {
  const ids = new Set<number>();
  for (const item of page.items) {
    if (item.kind === 'element') {
      const id = elements[item.elementIndex]?.revisionId;
      if (id) ids.add(id);
    } else if (item.kind === 'dual') {
      for (const part of [...item.left, ...item.right]) {
        const id = elements[part.elementIndex]?.revisionId;
        if (id) ids.add(id);
      }
    }
  }
  return [...ids].sort((a, b) => a - b);
};

// The page shows as revised (color, header label) for the latest set on it
// that is being shown
export const pageRevision = (page: Page, elements: ScreenplayElement[], settings: RevisionSettings) => {
  const shown = pageRevisionIds(page, elements).filter((id) => showsRevisionMark(id, settings));
  const latest = shown[shown.length - 1];
  return latest ? settings.sets.find((s) => s.id === latest) : undefined;
};

// ---------------------------------------------------------------------------
// Locked pages

// Lock (or relock) every page where it currently starts, with its current label
export const lockPagesAt = (pagination: Pagination, elements: ScreenplayElement[]): LockedPage[] => {
  if (elements.length === 0) return [];
  return [
    { label: pagination.pages[0].label, elementId: elements[0].id, offset: 0 },
    ...pagination.breaks.map((b) => ({ label: pagination.pages[b.page - 1].label, elementId: b.elementId, offset: b.offset })),
  ];
};

// Unlock "A" Pages: drop the locks on A/B pages so their text flows back
export const unlockAPages = (locks: LockedPage[]): LockedPage[] => locks.filter((l) => !/[A-Z]$/.test(l.label));

// ---------------------------------------------------------------------------
// Scene numbers

export type SceneNumberScheme = '1A' | 'A2';

export interface SceneNumberOptions {
  scheme: SceneNumberScheme; // "1A: 1, 1A, 2, 3" or "A2: 1, A2, 2, 3"
  keepExisting: boolean; // locked scene numbers: only new scenes get numbers
  startAt: number;
  fromElementId?: string; // "Number from current scene"
}

const intPart = (n: string) => parseInt(n.replace(/^[A-Z]+/, ''), 10);

export const numberScenes = (elements: ScreenplayElement[], options: SceneNumberOptions): ScreenplayElement[] => {
  const out = elements.map((el) => ({ ...el }));
  const headings = out.filter((el) => el.type === 'Scene Heading');

  if (!options.keepExisting) {
    let n = options.startAt;
    let started = !options.fromElementId;
    for (const h of headings) {
      if (h.id === options.fromElementId) started = true;
      if (started) h.sceneNumber = String(n++);
    }
    return out;
  }

  // Keep existing numbers; number new scenes around them
  headings.forEach((h, i) => {
    if (h.sceneNumber) return;
    const prev = headings.slice(0, i).reverse().find((x) => x.sceneNumber)?.sceneNumber;
    const next = headings.slice(i + 1).find((x) => x.sceneNumber)?.sceneNumber;
    if (!next) {
      // After the last numbered scene: carry on counting
      h.sceneNumber = String(prev ? intPart(prev) + 1 : options.startAt);
    } else if (options.scheme === '1A' && prev) {
      h.sceneNumber = nextPageLabel(prev); // 5 → 5A, 5A → 5B
    } else {
      // A2 scheme (or nothing before): a letter in front of the next number
      const base = String(intPart(next));
      const prefix = prev && prev.endsWith(base) && /^[A-Z]+/.test(prev) ? prev.slice(0, -base.length) : '';
      const letter = prefix ? String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1) : 'A';
      h.sceneNumber = `${prefix.slice(0, -1)}${letter}${base}`;
    }
  });
  return out;
};

export const removeSceneNumbers = (elements: ScreenplayElement[]): ScreenplayElement[] =>
  elements.map((el) => {
    if (el.type !== 'Scene Heading' || !el.sceneNumber) return el;
    const rest = { ...el };
    delete rest.sceneNumber;
    return rest;
  });

// ---------------------------------------------------------------------------
// Omit Scene

export const OMITTED_TEXT = 'OMITTED';

// The Scene Heading that starts the scene containing element `id`
export const sceneHeadingIndex = (elements: ScreenplayElement[], id: string): number => {
  for (let i = elements.findIndex((el) => el.id === id); i >= 0; i--) {
    if (elements[i].type === 'Scene Heading') return i;
  }
  return -1;
};

// Omit the scene containing `id`: its heading keeps its number and reads
// OMITTED, and the scene's text is kept on the heading so it can be restored.
// Run again on an omitted scene to restore it.
export const toggleOmitScene = (elements: ScreenplayElement[], id: string): ScreenplayElement[] => {
  const start = sceneHeadingIndex(elements, id);
  if (start < 0) return elements;
  const heading = elements[start];

  if (heading.omitted) {
    const restored = heading.omitted.map((el, i) => (i === 0 ? { ...el, sceneNumber: heading.sceneNumber ?? el.sceneNumber } : el));
    return [...elements.slice(0, start), ...restored, ...elements.slice(start + 1)];
  }

  let end = start + 1;
  while (end < elements.length && elements[end].type !== 'Scene Heading') end++;
  const placeholder: ScreenplayElement = {
    id: heading.id,
    type: 'Scene Heading',
    content: [{ text: OMITTED_TEXT }],
    sceneNumber: heading.sceneNumber,
    revisionId: heading.revisionId,
    omitted: elements.slice(start, end),
  };
  return [...elements.slice(0, start), placeholder, ...elements.slice(end)];
};
