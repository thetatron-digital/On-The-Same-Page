import { useEffect, useRef } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { ElementLine } from './ElementLine';
import { Navigator } from './Navigator';
import { WritingStats } from './WritingStats';
import { TitlePageEditor } from './TitlePageEditor';
import './Editor.css';

export const Editor = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    screenplay,
    selectedElementId,
    selectElement,
    addElement,
    panels,
    stats,
    zoom,
  } = useScreenplayStore();

  // Auto-resize textareas
  useEffect(() => {
    const textareas = editorRef.current?.querySelectorAll('textarea');
    textareas?.forEach((textarea) => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, [screenplay.elements, zoom]);

  // Handle click on empty area - create new element or focus last
  const handleEditorClick = (e: React.MouseEvent) => {
    if (e.target === contentRef.current || (e.target as HTMLElement).classList.contains('script-content') || (e.target as HTMLElement).classList.contains('page')) {
      const lastElement = screenplay.elements[screenplay.elements.length - 1];
      if (lastElement) {
        selectElement(lastElement.id);
      } else {
        // Create first element if empty
        addElement(undefined, 'Scene Heading');
      }
    }
  };

  // Handle keyboard shortcuts at editor level
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useScreenplayStore.getState().undo();
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' && e.shiftKey || e.key === 'y')) {
        e.preventDefault();
        useScreenplayStore.getState().redo();
      }

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

  // Calculate zoom scale
  const scale = zoom / 100;

  // Find current scene heading for status bar
  const currentSceneHeading = screenplay.elements.find(el => el.type === 'Scene Heading')?.content[0]?.text || 'No Scene';

  return (
    <div className="editor-container">
      {/* Left Panel - Navigator */}
      {panels.navigator && <Navigator />}

      {/* Main Editor Area */}
      <div className="editor" ref={editorRef}>
        {/* Title Page Editor Modal */}
        {panels.titlePage && <TitlePageEditor />}

        {/* Script content area with ruler */}
        <div className="script-area" onClick={handleEditorClick}>
          <div
            className="script-wrapper"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
            }}
          >
            {/* Ruler aligned with page */}
            <div className="page-ruler">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((inch) => (
                <div key={inch} className="ruler-mark" style={{ left: `${inch * 96}px` }}>
                  <span className="ruler-number">{inch}</span>
                </div>
              ))}
              <div className="ruler-mark ruler-end" style={{ left: `${8.5 * 96}px` }}>
                <span className="ruler-number">8.5"</span>
              </div>
            </div>

            {/* Pages */}
            <div className="pages-container" ref={contentRef}>
              <div className="page first-page">
                <div className="page-content">
                  {screenplay.elements.map((element, index) => (
                    <ElementLine
                      key={element.id}
                      element={element}
                      isSelected={selectedElementId === element.id}
                      onFocus={() => selectElement(element.id)}
                      prevElementType={index > 0 ? screenplay.elements[index - 1].type : undefined}
                    />
                  ))}
                  <div className="script-end-area" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="status-bar">
          <div className="status-left">
            <span className="status-page">{stats.pageCount} of {stats.pageCount}</span>
            <span className="status-scene">{currentSceneHeading.substring(0, 40)}</span>
          </div>
          <div className="status-center">
            <span className="status-ready">Ready</span>
          </div>
          <div className="status-right">
            <span className="status-runtime">{stats.estimatedRuntime}</span>
            <div className="status-zoom">
              <input
                type="range"
                className="zoom-slider"
                min="50"
                max="200"
                step="10"
                value={zoom}
                onChange={(e) => useScreenplayStore.getState().setZoom(parseInt(e.target.value, 10))}
                title={`Zoom: ${zoom}%`}
              />
              <span className="zoom-level">{zoom}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Writing Stats */}
      {panels.writingStats && <WritingStats />}
    </div>
  );
};
