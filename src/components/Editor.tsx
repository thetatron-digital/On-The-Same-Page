import { useEffect, useRef } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { ElementLine } from './ElementLine';
import { Navigator } from './Navigator';
import { WritingStats } from './WritingStats';
import { TitlePageEditor } from './TitlePageEditor';
import {
  PAGE_WIDTH_INCHES,
  PAGE_HEIGHT_INCHES,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  MARGIN_TOP,
  MARGIN_BOTTOM,
  DEFAULT_PPI,
} from '../types/screenplay';
import './Editor.css';

export const Editor = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const {
    screenplay,
    selectedElementId,
    selectElement,
    zoom,
    panels,
    stats,
  } = useScreenplayStore();

  // Calculate page dimensions based on zoom
  const scale = zoom / 100;
  const pageWidth = PAGE_WIDTH_INCHES * DEFAULT_PPI * scale;
  const pageHeight = PAGE_HEIGHT_INCHES * DEFAULT_PPI * scale;
  const marginLeft = MARGIN_LEFT * DEFAULT_PPI * scale;
  const marginRight = MARGIN_RIGHT * DEFAULT_PPI * scale;
  const marginTop = MARGIN_TOP * DEFAULT_PPI * scale;
  const marginBottom = MARGIN_BOTTOM * DEFAULT_PPI * scale;

  // Auto-resize textareas
  useEffect(() => {
    const textareas = editorRef.current?.querySelectorAll('textarea');
    textareas?.forEach((textarea) => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, [screenplay.elements, zoom]);

  // Handle click on empty area - focus last element
  const handleEditorClick = (e: React.MouseEvent) => {
    if (e.target === pageRef.current || (e.target as HTMLElement).classList.contains('page-content')) {
      const lastElement = screenplay.elements[screenplay.elements.length - 1];
      if (lastElement) {
        selectElement(lastElement.id);
      }
    }
  };

  // Handle keyboard shortcuts at editor level
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N - New document
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        useScreenplayStore.getState().newScreenplay();
      }

      // Ctrl/Cmd + S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const fdxContent = useScreenplayStore.getState().exportToFDX();
        const fileName = useScreenplayStore.getState().fileName;
        const blob = new Blob([fdxContent], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.fdx') ? fileName : `${fileName}.fdx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        useScreenplayStore.getState().setDirty(false);
      }

      // Ctrl/Cmd + O - Open
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.fdx';
        input.onchange = async (ev) => {
          const file = (ev.target as HTMLInputElement).files?.[0];
          if (file) {
            try {
              const content = await file.text();
              useScreenplayStore.getState().loadFromFDX(content);
              useScreenplayStore.getState().setFileName(file.name);
            } catch (error) {
              alert('Failed to open file.');
            }
          }
        };
        input.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="editor-container">
      {/* Left Panel - Navigator */}
      {panels.navigator && <Navigator />}

      {/* Main Editor Area */}
      <div className="editor" ref={editorRef}>
        {/* Title Page Editor Modal */}
        {panels.titlePage && <TitlePageEditor />}

        <div className="editor-scroll-area">
          {/* Page representation */}
          <div
            className="screenplay-page"
            ref={pageRef}
            onClick={handleEditorClick}
            style={{
              width: `${pageWidth}px`,
              minHeight: `${pageHeight}px`,
              paddingLeft: `${marginLeft}px`,
              paddingRight: `${marginRight}px`,
              paddingTop: `${marginTop}px`,
              paddingBottom: `${marginBottom}px`,
            }}
          >
            {/* Script content */}
            <div className="page-content">
              {screenplay.elements.map((element) => (
                <ElementLine
                  key={element.id}
                  element={element}
                  isSelected={selectedElementId === element.id}
                  onFocus={() => selectElement(element.id)}
                />
              ))}
            </div>
          </div>

          {/* Page indicator */}
          {stats.pageCount > 0 && (
            <div className="page-indicator">
              {stats.pageCount} {stats.pageCount === 1 ? 'page' : 'pages'} | {stats.estimatedRuntime}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Writing Stats */}
      {panels.writingStats && <WritingStats />}
    </div>
  );
};
