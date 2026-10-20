// Tags Mode: colors tagged words in the script with their category color,
// using the CSS Custom Highlight API (no change to the editable text)
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../store/screenplayStore';
import { BREAKDOWN_CATEGORY_INFO } from '../types/screenplay';
import { useTagging } from '../commands/tagging';
import { positionAt } from './editorDom';

// Stable empties: a fresh [] on every read would re-render forever
const NO_TAGS: never[] = [];
const NO_CATEGORIES: never[] = [];

const slug = (category: string) => `otsp-tag-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

type HighlightRegistry = Map<string, unknown>;
const highlightApi = () => {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  const Ctor = (globalThis as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  return css?.highlights && Ctor ? { registry: css.highlights, Highlight: Ctor } : null;
};

export const useTagHighlights = () => {
  const on = useTagging((s) => s.on);
  const { tags, screenplay, customCategories } = useScreenplayStore(
    useShallow((s) => ({ tags: s.breakdown?.elements ?? NO_TAGS, screenplay: s.screenplay, customCategories: s.breakdown?.customCategories ?? NO_CATEGORIES }))
  );
  useEffect(() => {
    const api = highlightApi();
    if (!api) return;
    const names = [...api.registry.keys()].filter((k) => k.startsWith('otsp-tag-'));
    names.forEach((k) => api.registry.delete(k));
    if (!on) return;
    const colors = new Map<string, string>([
      ...Object.entries(BREAKDOWN_CATEGORY_INFO).map(([k, v]) => [k, v.color] as [string, string]),
      ...customCategories.map((c) => [c.name, c.color] as [string, string]),
    ]);
    // After the editor has rebuilt its text for this script
    const timer = window.setTimeout(() => {
      const byCategory = new Map<string, Range[]>();
      for (const tag of tags) {
        const div = document.querySelector(`[data-element-id="${tag.sourceElementId}"]`);
        if (!div) continue;
        const start = positionAt(div, tag.startOffset);
        const end = positionAt(div, tag.endOffset);
        const range = document.createRange();
        try { range.setStart(start.node, start.offset); range.setEnd(end.node, end.offset); } catch { continue; }
        byCategory.set(tag.category, [...(byCategory.get(tag.category) ?? []), range]);
      }
      let css = '';
      byCategory.forEach((ranges, category) => {
        api.registry.set(slug(category), new api.Highlight(...ranges));
        css += `::highlight(${slug(category)}) { background-color: ${colors.get(category) ?? '#888888'}66; }\n`;
      });
      let style = document.getElementById('otsp-tag-styles');
      if (!style) {
        style = document.createElement('style');
        style.id = 'otsp-tag-styles';
        document.head.appendChild(style);
      }
      style.textContent = css;
    }, 400);
    return () => window.clearTimeout(timer);
  }, [on, tags, screenplay, customCategories]);
};

