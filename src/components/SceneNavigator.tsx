import { useState, useRef, useMemo } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { getPlainText } from '../utils/fdx';
import './SceneNavigator.css';

interface SceneInfo {
  sceneNumber: number;
  heading: string;
  firstAction: string;
  elementId: string;
  pageNumber: number;
}

export const SceneNavigator = () => {
  const { screenplay, stats, selectElement, visibility } = useScreenplayStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredScene, setHoveredScene] = useState<SceneInfo | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  // Calculate scenes with their page positions
  const scenes = useMemo(() => {
    const sceneList: SceneInfo[] = [];
    let currentPage = 1;
    let linesOnCurrentPage = 0;
    const LINES_PER_PAGE = 55;

    screenplay.elements.forEach((element, index) => {
      const text = getPlainText(element.content);
      // More accurate line count: consider element type spacing and line wrapping
      const charsPerLine = element.type === 'Dialogue' ? 35 : 60;
      const baseLines = Math.max(1, Math.ceil(text.length / charsPerLine));
      // Add spacing for element types (scene headings have more space above/below)
      const spacing = element.type === 'Scene Heading' ? 2 : 1;
      const lineCount = baseLines + spacing;

      // Check if adding this element would exceed the page BEFORE processing
      if (linesOnCurrentPage + lineCount > LINES_PER_PAGE && linesOnCurrentPage > 0) {
        currentPage++;
        linesOnCurrentPage = 0;
      }

      if (element.type === 'Scene Heading') {
        // Find the next action element for the first action line
        let firstAction = '';
        for (let i = index + 1; i < screenplay.elements.length; i++) {
          if (screenplay.elements[i].type === 'Action') {
            const actionText = getPlainText(screenplay.elements[i].content);
            firstAction = actionText.length > 80
              ? actionText.substring(0, 80) + '...'
              : actionText;
            break;
          }
          if (screenplay.elements[i].type === 'Scene Heading') {
            break;
          }
        }

        sceneList.push({
          sceneNumber: sceneList.length + 1,
          heading: text,
          firstAction,
          elementId: element.id,
          pageNumber: currentPage,
        });
      }

      linesOnCurrentPage += lineCount;
    });

    return sceneList;
  }, [screenplay.elements]);

  // Don't render if hidden
  if (!visibility.sceneNavigator) {
    return null;
  }

  const handleSceneClick = (scene: SceneInfo) => {
    selectElement(scene.elementId);
    // Scroll to the element
    const element = document.querySelector(`[data-element-id="${scene.elementId}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSceneHover = (scene: SceneInfo, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPopupPosition({ x: rect.left, y: rect.bottom + 5 });
    setHoveredScene(scene);
  };

  const handleSceneLeave = () => {
    setHoveredScene(null);
  };

  // Group scenes by page - use the max page from scenes OR stats, whichever is higher
  const maxScenePage = scenes.length > 0 ? Math.max(...scenes.map(s => s.pageNumber)) : 1;
  const pageCount = Math.max(stats.pageCount || 1, maxScenePage);
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <div className="scene-navigator">
      <div className="scene-navigator-scroll" ref={scrollRef}>
        {/* Page Numbers Row */}
        <div className="page-numbers-row">
          <div className="nav-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          {pages.map((page) => (
            <div key={page} className="page-number-cell">
              {page}
            </div>
          ))}
        </div>

        {/* Scene Headings Row */}
        <div className="scene-headings-row">
          <div className="nav-label">Script</div>
          {pages.map((page) => {
            const scenesOnPage = scenes.filter((s) => s.pageNumber === page);
            return (
              <div key={page} className="scene-cell">
                {scenesOnPage.map((scene) => (
                  <div
                    key={scene.elementId}
                    className="scene-heading-chip"
                    onClick={() => handleSceneClick(scene)}
                    onMouseEnter={(e) => handleSceneHover(scene, e)}
                    onMouseLeave={handleSceneLeave}
                  >
                    {scene.heading.length > 25
                      ? scene.heading.substring(0, 25) + '...'
                      : scene.heading}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover Popup */}
      {hoveredScene && (
        <div
          className="scene-popup"
          style={{ left: popupPosition.x, top: popupPosition.y }}
        >
          <div className="popup-heading">{hoveredScene.heading}</div>
          {hoveredScene.firstAction && (
            <div className="popup-action">{hoveredScene.firstAction}</div>
          )}
        </div>
      )}
    </div>
  );
};
