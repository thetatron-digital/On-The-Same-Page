import { useEffect, useRef, useState, useCallback } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { ScriptEditor } from './ScriptEditor';
import { Navigator } from './Navigator';
import { WritingStats } from './WritingStats';
import { TitlePageEditor } from './TitlePageEditor';
import './Editor.css';

// Page dimensions at 96 DPI
const PAGE_HEIGHT = 1056; // 11 inches at 96 DPI
const PAGE_GAP = 48; // Gap between pages for page break visual

// Content margins per Final Draft standard (in pixels at 96 DPI)
const TOP_MARGIN = 96;     // 1 inch top margin
const BOTTOM_MARGIN = 96;  // 1 inch bottom margin

// Element type hints for the status bar (Tab cycles through this order)
const ELEMENT_HINTS: Record<string, { tab: string; enter: string }> = {
  'Scene Heading': { tab: 'Action', enter: 'Action' },
  'Action': { tab: 'Character', enter: 'Action' },
  'Character': { tab: 'Dialogue', enter: 'Dialogue' },
  'Dialogue': { tab: 'Parenthetical', enter: 'Action' },
  'Parenthetical': { tab: 'Transition', enter: 'Dialogue' },
  'Transition': { tab: 'Scene Heading', enter: 'Scene Heading' },
  'Shot': { tab: 'Action', enter: 'Action' },
  'General': { tab: 'Action', enter: 'Action' },
};

export const Editor = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scriptEditorRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(PAGE_HEIGHT);

  const {
    screenplay,
    currentElementType,
    selectElement,
    addElement,
    panels,
    stats,
    zoom,
  } = useScreenplayStore();

  // Monitor content height to determine page count
  useEffect(() => {
    const checkContentHeight = () => {
      const scriptContent = scriptEditorRef.current?.querySelector('.script-editor-content');
      if (scriptContent) {
        // Get actual content height
        const height = scriptContent.scrollHeight;
        setContentHeight(height);
      }
    };

    checkContentHeight();

    // Also observe for mutations
    const observer = new MutationObserver(checkContentHeight);
    const scriptContent = scriptEditorRef.current?.querySelector('.script-editor-content');
    if (scriptContent) {
      observer.observe(scriptContent, { childList: true, subtree: true, characterData: true });
    }

    return () => observer.disconnect();
  }, [screenplay.elements]);

  // Calculate page count from content height
  // Content height includes page break spacers, so divide by PAGE_HEIGHT
  const totalContentWithPadding = contentHeight + TOP_MARGIN + BOTTOM_MARGIN;
  const pageCount = Math.max(1, Math.ceil(totalContentWithPadding / PAGE_HEIGHT));

  // Calculate total container height including gaps
  const totalHeight = pageCount * PAGE_HEIGHT + (pageCount - 1) * PAGE_GAP;

  // Focus and position cursor at end of content
  const focusAtEnd = useCallback(() => {
    const scriptEditor = scriptEditorRef.current?.querySelector('.script-editor-content') as HTMLElement;
    if (!scriptEditor) return;

    scriptEditor.focus();

    const elements = screenplay.elements;
    if (elements.length > 0) {
      const lastElement = elements[elements.length - 1];
      selectElement(lastElement.id);

      // Position cursor at end of last element
      setTimeout(() => {
        const lastDiv = scriptEditor.querySelector(`[data-element-id="${lastElement.id}"]`);
        if (lastDiv) {
          const textNode = lastDiv.firstChild;
          const selection = window.getSelection();
          const range = document.createRange();

          try {
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
              const len = textNode.textContent?.length || 0;
              range.setStart(textNode, len);
              range.collapse(true);
            } else {
              range.selectNodeContents(lastDiv);
              range.collapse(false);
            }
            selection?.removeAllRanges();
            selection?.addRange(range);
          } catch {
            // Ignore
          }
        }
      }, 10);
    } else {
      addElement(undefined, 'Scene Heading');
    }
  }, [screenplay.elements, selectElement, addElement]);

  // Handle click on page area to focus editor and position cursor at end
  const handlePageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Check if click is on page area (not on actual script content elements)
    if (
      target.classList.contains('page') ||
      target.classList.contains('page-content') ||
      target.classList.contains('pages-container') ||
      target.classList.contains('script-area') ||
      target.classList.contains('script-wrapper') ||
      target.classList.contains('page-break-marker') ||
      target.classList.contains('script-end-area') ||
      target.classList.contains('page-background')
    ) {
      focusAtEnd();
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
            } catch {
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

  // Get element hints for status bar
  const hints = ELEMENT_HINTS[currentElementType] || ELEMENT_HINTS['Action'];

  return (
    <div className="editor-container">
      {/* Left Panel - Navigator */}
      {panels.navigator && <Navigator />}

      {/* Main Editor Area */}
      <div className="editor" ref={editorRef}>
        {/* Title Page Editor Modal */}
        {panels.titlePage && <TitlePageEditor />}

        {/* Script content area with ruler */}
        <div className="script-area" onClick={handlePageClick}>
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

            {/* Pages container with fixed height pages */}
            <div
              className="pages-container"
              ref={contentRef}
              style={{ height: `${totalHeight}px` }}
            >
              {/* Page backgrounds - positioned absolutely at fixed intervals */}
              {Array.from({ length: pageCount }, (_, i) => (
                <div
                  key={`page-bg-${i}`}
                  className="page page-background"
                  style={{
                    top: `${i * (PAGE_HEIGHT + PAGE_GAP)}px`,
                  }}
                >
                  {i > 0 && <div className="page-number">{i + 1}.</div>}
                </div>
              ))}

              {/* Page break markers between pages */}
              {Array.from({ length: pageCount - 1 }, (_, i) => (
                <div
                  key={`break-${i}`}
                  className="page-break-marker"
                  style={{
                    top: `${(i + 1) * PAGE_HEIGHT + i * PAGE_GAP}px`,
                  }}
                />
              ))}

              {/* Content layer - flows continuously, no border */}
              <div className="content-layer" style={{ minHeight: `${PAGE_HEIGHT}px` }}>
                <div className="page-content" ref={scriptEditorRef}>
                  <ScriptEditor />
                  <div className="script-end-area" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="status-bar">
          <div className="status-left">
            <span className="status-page">{pageCount} of {pageCount}</span>
            <span className="status-scene">{currentSceneHeading.substring(0, 40)}</span>
          </div>
          <div className="status-center">
            <span className="status-element-hints">
              [Tab] {hints.tab}, [Enter] {hints.enter}
            </span>
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
