import { useEffect, useMemo, useState } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { useShallow } from 'zustand/react/shallow';
import { BREAKDOWN_CATEGORY_INFO } from '../types/screenplay';
import type { BreakdownCategory, BreakdownElement } from '../types/screenplay';
import { getPlainText } from '../utils/fdx';
import { formatEighths } from '../utils/breakdown';
import './Breakdown.css';
import { ElementManager } from './breakdown/ElementManager';
import { SheetFields } from './breakdown/SheetFields';
import { pendingLinkedElements } from '../utils/elements';

// Category colors as CSS variables for consistent styling
const CATEGORY_COLORS = Object.fromEntries(
  Object.entries(BREAKDOWN_CATEGORY_INFO).map(([category, info]) => [category, info.color])
) as Record<BreakdownCategory, string>;

export const Breakdown = () => {
  const {
    screenplay,
    breakdown,
    breakdownScenes,
    selectedBreakdownCategory,
    selectedBreakdownSceneId,
    darkMode,
    initializeBreakdown,
    refreshBreakdownScenes,
    selectBreakdownCategory,
    selectBreakdownScene,
    addBreakdownElement,
    deleteBreakdownElement,
    getBreakdownElementsForScene,
  } = useScreenplayStore(
    useShallow((s) => ({
      screenplay: s.screenplay,
      breakdown: s.breakdown,
      breakdownScenes: s.breakdownScenes,
      selectedBreakdownCategory: s.selectedBreakdownCategory,
      selectedBreakdownSceneId: s.selectedBreakdownSceneId,
      darkMode: s.darkMode,
      initializeBreakdown: s.initializeBreakdown,
      refreshBreakdownScenes: s.refreshBreakdownScenes,
      selectBreakdownCategory: s.selectBreakdownCategory,
      selectBreakdownScene: s.selectBreakdownScene,
      addBreakdownElement: s.addBreakdownElement,
      deleteBreakdownElement: s.deleteBreakdownElement,
      getBreakdownElementsForScene: s.getBreakdownElementsForScene,
    }))
  );

  const [showSceneList, setShowSceneList] = useState(true);
  const [showElementManager, setShowElementManager] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionInfo, setSelectionInfo] = useState<{
    elementId: string;
    startOffset: number;
    endOffset: number;
  } | null>(null);

  // Initialize breakdown when component mounts
  useEffect(() => {
    if (!breakdown) {
      initializeBreakdown();
    }
  }, [breakdown, initializeBreakdown]);

  // Refresh scenes when screenplay changes
  useEffect(() => {
    if (breakdown) {
      refreshBreakdownScenes();
    }
  }, [screenplay.elements.length]);

  // Get current scene
  const currentScene = breakdownScenes.find(s => s.id === selectedBreakdownSceneId);
  const elementRecords = useMemo(
    () => new Map((breakdown?.elementList ?? []).map(e => [e.id, e])),
    [breakdown]
  );

  // Get elements for current scene
  const sceneElements = currentScene
    ? screenplay.elements.filter((_, idx) => {
        const sceneIdx = screenplay.elements.findIndex(e => e.id === currentScene.id);
        const nextSceneIdx = screenplay.elements.findIndex((e, i) =>
          i > sceneIdx && e.type === 'Scene Heading'
        );
        return idx >= sceneIdx && (nextSceneIdx === -1 || idx < nextSceneIdx);
      })
    : [];

  // Get breakdown elements for current scene
  const breakdownElements = selectedBreakdownSceneId
    ? getBreakdownElementsForScene(selectedBreakdownSceneId)
    : [];

  // Group breakdown elements by category
  // Master element (Element Manager) for a tag, for its name and Board ID
  const recordOf = (el: BreakdownElement) =>
    el.elementRefId ? elementRecords.get(el.elementRefId) : undefined;

  const elementsByCategory = breakdownElements.reduce((acc, el) => {
    const category = el.category as BreakdownCategory;
    if (!acc[category]) acc[category] = [];
    acc[category].push(el);
    return acc;
  }, {} as Record<BreakdownCategory, BreakdownElement[]>);

  // Handle text selection in script view
  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectedText('');
      setSelectionInfo(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setSelectedText('');
      setSelectionInfo(null);
      return;
    }

    // Get the element ID from the selection
    const anchorNode = selection.anchorNode;
    const element = anchorNode?.parentElement?.closest('[data-element-id]');
    if (!element) return;

    const elementId = element.getAttribute('data-element-id');
    if (!elementId) return;

    setSelectedText(text);
    setSelectionInfo({
      elementId,
      startOffset: selection.anchorOffset,
      endOffset: selection.focusOffset,
    });
  };

  // Handle adding a tagged element
  const handleTagElement = (category: BreakdownCategory) => {
    if (!selectedText || !selectionInfo || !selectedBreakdownSceneId) return;

    const newElement: BreakdownElement = {
      id: `be_${Date.now()}`,
      text: selectedText,
      category,
      sceneId: selectedBreakdownSceneId,
      sourceElementId: selectionInfo.elementId,
      startOffset: selectionInfo.startOffset,
      endOffset: selectionInfo.endOffset,
    };

    addBreakdownElement(newElement);

    // Element Linking: tagging an anchor can bring its linked elements
    const store = useScreenplayStore.getState();
    const tagged = store.breakdown?.elements.find(e => e.id === newElement.id);
    const mode = store.breakdown?.elementLinkMode ?? 'confirm';
    if (tagged?.elementRefId && store.breakdown && mode !== 'never') {
      const pending = pendingLinkedElements(store.breakdown, newElement.sceneId, tagged.elementRefId);
      if (pending.length > 0 && (mode === 'auto' ||
          confirm(`Also add the elements linked to ${tagged.text.toUpperCase()}?\n\n${pending.map(p => `${p.category}: ${p.name}`).join('\n')}`))) {
        store.addLinkedElementsToScene(newElement.sceneId, tagged.elementRefId);
      }
    }

    setSelectedText('');
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  if (showElementManager) {
    return (
      <div className={`breakdown-container ${darkMode ? 'dark' : 'light'}`}>
        <ElementManager onClose={() => setShowElementManager(false)} />
      </div>
    );
  }

  return (
    <div className={`breakdown-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Scene List Sidebar */}
      <div className={`breakdown-scene-list ${showSceneList ? 'open' : 'collapsed'}`}>
        <div className="scene-list-header">
          <h3>Scenes</h3>
          <button
            className="collapse-btn"
            onClick={() => setShowSceneList(!showSceneList)}
            title={showSceneList ? 'Collapse' : 'Expand'}
          >
            {showSceneList ? '◀' : '▶'}
          </button>
        </div>
        {showSceneList && (
          <div className="scene-list-content">
            {breakdownScenes.map(scene => {
              const sceneEls = getBreakdownElementsForScene(scene.id);
              return (
                <div
                  key={scene.id}
                  className={`scene-item ${selectedBreakdownSceneId === scene.id ? 'selected' : ''}`}
                  onClick={() => selectBreakdownScene(scene.id)}
                >
                  <div className="scene-number">{scene.sceneNumber}</div>
                  <div className="scene-info">
                    <div className="scene-heading">
                      {scene.intExt}. {scene.location}
                    </div>
                    <div className="scene-meta">
                      <span className={`day-night ${scene.dayNight.toLowerCase()}`}>
                        {scene.dayNight}
                      </span>
                      <span className="eighths">{formatEighths(scene.eighths)}</span>
                      {sceneEls.length > 0 && (
                        <span className="element-count">{sceneEls.length} tagged</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="breakdown-main">
        {/* Tag Palette */}
        <div className="tag-palette">
          <div className="palette-header">
            <h4>Categories</h4>
            <button className="collapse-btn element-manager-btn" onClick={() => setShowElementManager(true)} title="All elements, Board IDs and Day Out of Days figures">
              Element Manager
            </button>
            {selectedText && (
              <div className="selection-hint">
                Select category to tag: "{selectedText.slice(0, 30)}{selectedText.length > 30 ? '...' : ''}"
              </div>
            )}
          </div>
          <div className="category-grid">
            {(Object.keys(BREAKDOWN_CATEGORY_INFO) as BreakdownCategory[]).map(category => (
              <button
                key={category}
                className={`category-btn ${selectedBreakdownCategory === category ? 'selected' : ''}`}
                style={{ '--category-color': CATEGORY_COLORS[category] } as React.CSSProperties}
                onClick={() => {
                  if (selectedText) {
                    handleTagElement(category);
                  } else {
                    selectBreakdownCategory(
                      selectedBreakdownCategory === category ? null : category
                    );
                  }
                }}
                title={BREAKDOWN_CATEGORY_INFO[category].description}
              >
                <span className="category-dot" />
                <span>{category}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Script View */}
        <div className="breakdown-script-view" onMouseUp={handleTextSelect}>
          {currentScene ? (
            <>
              <div className="script-view-header">
                <h3>
                  Scene {currentScene.sceneNumber}: {currentScene.intExt}. {currentScene.location} - {currentScene.timeOfDay}
                </h3>
              </div>
              <div className="script-content">
                {sceneElements.map(element => {
                  const text = getPlainText(element.content);
                  const elementTags = breakdownElements.filter(
                    be => be.sourceElementId === element.id
                  );

                  return (
                    <div
                      key={element.id}
                      data-element-id={element.id}
                      className={`script-element ${element.type.toLowerCase().replace(' ', '-')}`}
                    >
                      {/* Render text with highlights for tagged portions */}
                      {elementTags.length > 0 ? (
                        <span className="tagged-text">
                          {text}
                          <div className="element-tags">
                            {elementTags.map(tag => (
                              <span
                                key={tag.id}
                                className="tag-chip"
                                style={{ backgroundColor: CATEGORY_COLORS[tag.category as BreakdownCategory] }}
                                title={`${tag.category}: ${tag.text}`}
                              >
                                {tag.text.slice(0, 15)}{tag.text.length > 15 ? '...' : ''}
                                <button
                                  className="tag-remove"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteBreakdownElement(tag.id);
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </span>
                      ) : (
                        text
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="no-scene-selected">
              <p>Select a scene from the list to begin breakdown</p>
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Sheet Sidebar */}
      <div className="breakdown-sheet">
        <div className="sheet-header">
          <h3>Breakdown Sheet</h3>
          {currentScene && (
            <div className="sheet-scene-info">
              Scene {currentScene.sceneNumber} • {formatEighths(currentScene.eighths)} page
            </div>
          )}
        </div>

        {currentScene ? (
          <div className="sheet-content">
            <SheetFields scene={currentScene} sheetIndex={breakdownScenes.indexOf(currentScene)} />

            {/* Elements by category */}
            {(Object.keys(BREAKDOWN_CATEGORY_INFO) as BreakdownCategory[]).map(category => {
              const categoryElements = elementsByCategory[category] || [];
              if (categoryElements.length === 0) return null;

              return (
                <div key={category} className="sheet-section">
                  <h4 style={{ color: CATEGORY_COLORS[category] }}>{category}</h4>
                  <ul className="element-list">
                    {categoryElements.map(el => (
                      <li key={el.id}>
                        <span>
                          {recordOf(el)?.boardId && <span className="element-board-id">{recordOf(el)!.boardId}.</span>}
                          {recordOf(el)?.name ?? el.text}
                        </span>
                        <button
                          className="remove-btn"
                          onClick={() => deleteBreakdownElement(el.id)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {breakdownElements.length === 0 && (
              <div className="empty-sheet">
                <p>No elements tagged yet.</p>
                <p className="hint">Select text in the script and click a category to tag it.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-sheet">
            <p>Select a scene to view its breakdown sheet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
