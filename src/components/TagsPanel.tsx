// Production > Tags Mode panel: pick a breakdown category for the selected
// script text; lists the current scene's tags. Same store as BreakDown.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../store/screenplayStore';
import { BREAKDOWN_CATEGORY_INFO, type BreakdownCategory } from '../types/screenplay';
import { sceneHeadingIndex } from '../engine/production';
import { tagAllCharacters, tagSelection, useTagging } from '../commands/tagging';
import './TagsPanel.css';

export const TagsPanel = () => {
  const { on, toggle } = useTagging();
  const { breakdown, elements, selectedElementId, deleteBreakdownElement } = useScreenplayStore(
    useShallow((s) => ({
      breakdown: s.breakdown,
      elements: s.screenplay.elements,
      selectedElementId: s.selectedElementId,
      deleteBreakdownElement: s.deleteBreakdownElement,
    }))
  );
  const [message, setMessage] = useState('');
  const categories = useMemo(() => [
    ...Object.entries(BREAKDOWN_CATEGORY_INFO).map(([name, info]) => ({ name, color: info.color })),
    ...(breakdown?.customCategories ?? []).map((c) => ({ name: c.name, color: c.color })),
  ], [breakdown?.customCategories]);
  if (!on) return null;

  const headingIndex = selectedElementId ? sceneHeadingIndex(elements, selectedElementId) : -1;
  const sceneId = headingIndex >= 0 ? elements[headingIndex].id : '';
  const sceneTags = (breakdown?.elements ?? []).filter((t) => t.sceneId === sceneId);
  const heading = headingIndex >= 0 ? elements[headingIndex].content.map((r) => r.text).join('') : '';

  return (
    <div className="tags-panel" role="complementary" aria-label="Tags Mode">
      <div className="tags-header">
        <strong>Tags Mode</strong>
        <button className="find-close" onClick={toggle} aria-label="Leave Tags Mode">×</button>
      </div>
      <p className="tags-hint">Select words in the script, then choose a category.</p>
      <div className="tags-categories">
        {categories.map((c) => (
          <button
            key={c.name}
            className="tag-category"
            // Keep the script selection when clicking
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setMessage(tagSelection(c.name as BreakdownCategory) ?? `Tagged as ${c.name}.`)}
          >
            <span className="tag-swatch" style={{ background: c.color }} />
            {c.name}
          </button>
        ))}
      </div>
      <div className="tags-actions">
        <button onClick={() => setMessage(`${tagAllCharacters()} character tags added.`)}>Tag All Characters</button>
      </div>
      {message && <p className="tags-message" aria-live="polite">{message}</p>}
      <div className="tags-scene">
        <div className="tags-scene-title">{heading || 'No scene selected'}</div>
        {sceneTags.length === 0 ? <div className="tags-empty">No tags in this scene.</div> : (
          <ul>
            {sceneTags.map((t) => (
              <li key={t.id}>
                <span className="tag-swatch" style={{ background: categories.find((c) => c.name === t.category)?.color }} />
                <span className="tag-text">{t.text}</span>
                <span className="tag-cat">{t.category}</span>
                <button onClick={() => deleteBreakdownElement(t.id)} aria-label={`Remove tag ${t.text}`}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
