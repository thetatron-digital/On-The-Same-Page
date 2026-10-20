// Production > Tags Mode: tag script text for the breakdown from inside
// ReWriter. Tags go into the same breakdown store BreakDown uses, through
// addBreakdownElement, which also links each tag to its master element.
import { create } from 'zustand';
import { useScreenplayStore } from '../store/screenplayStore';
import type { BreakdownCategory, BreakdownElement, ScreenplayElement } from '../types/screenplay';
import { sceneHeadingIndex } from '../engine/production';
import { speakerName } from '../utils/reports';
import { offsetInElement } from '../components/editorDom';

interface TaggingState {
  on: boolean;
  toggle: () => void;
}

export const useTagging = create<TaggingState>((set) => ({
  on: false,
  toggle: () => set((s) => ({ on: !s.on })),
}));

const store = () => useScreenplayStore.getState();

// The breakdown exists and knows every scene in the script
const ensureBreakdown = () => {
  if (!store().breakdown) store().initializeBreakdown();
  else store().refreshBreakdownScenes();
};

let tagIds = 0;
const newTag = (el: ScreenplayElement, sceneId: string, category: BreakdownCategory | string, text: string, start: number, end: number): BreakdownElement => ({
  id: `be_${Date.now()}_${tagIds++}`,
  text,
  category,
  sceneId,
  sourceElementId: el.id,
  startOffset: start,
  endOffset: end,
});

// Tags the text selected in the script. Returns a message when it can't.
export const tagSelection = (category: BreakdownCategory | string): string | null => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return 'Select the words to tag first.';
  const range = selection.getRangeAt(0);
  const divOf = (node: Node) => (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement)?.closest('[data-element-id]');
  const div = divOf(range.startContainer);
  if (!div || div !== divOf(range.endContainer)) return 'Tag within one paragraph at a time.';
  const { elements } = store().screenplay;
  const el = elements.find((e) => e.id === div.getAttribute('data-element-id'));
  if (!el) return 'Select text in the script.';
  const headingIndex = sceneHeadingIndex(elements, el.id);
  if (headingIndex < 0) return 'Tagged text needs to be inside a scene.';
  const start = offsetInElement(div, range.startContainer, range.startOffset);
  const end = offsetInElement(div, range.endContainer, range.endOffset);
  const text = el.content.map((r) => r.text).join('').slice(start, end).trim();
  if (!text) return 'Select the words to tag first.';
  ensureBreakdown();
  store().addBreakdownElement(newTag(el, elements[headingIndex].id, category, text, start, start + text.length));
  selection.removeAllRanges();
  return null;
};

// Production > Tag All Characters: every speaking character, once per scene, as Cast Members
export const tagAllCharacters = (): number => {
  ensureBreakdown();
  const { screenplay, breakdown } = store();
  const existing = new Set((breakdown?.elements ?? [])
    .filter((t) => t.category === 'Cast Members')
    .map((t) => `${t.sceneId}|${t.text.toUpperCase()}`));
  let added = 0;
  let sceneId = '';
  for (const el of screenplay.elements) {
    if (el.type === 'Scene Heading') sceneId = el.id;
    if (el.type !== 'Character' || !sceneId) continue;
    const name = speakerName(el.content.map((r) => r.text).join(''));
    if (!name || existing.has(`${sceneId}|${name}`)) continue;
    existing.add(`${sceneId}|${name}`);
    store().addBreakdownElement(newTag(el, sceneId, 'Cast Members', name, 0, name.length));
    added++;
  }
  return added;
};
