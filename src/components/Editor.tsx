import { useRef, useCallback } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { useShallow } from 'zustand/react/shallow';
import { ScriptEditor } from './ScriptEditor';
import { Navigator } from './Navigator';
import { WritingStats } from './WritingStats';
import { TitlePageEditor } from './TitlePageEditor';
import { SceneNavigator } from './SceneNavigator';
import { BeatBoard } from './BeatBoard';
import { SplitView } from './SplitView';
import { StoryMode } from './StoryMode';
import { ScenePanel } from './SceneViews';
import type { PanelView } from '../store/types';
import { NotePopover } from './ScriptNotes';
import { useCommandShortcuts } from '../commands/useCommandShortcuts';
import { TagsPanel } from './TagsPanel';
import { useTagHighlights } from './useTagHighlights';
import { TableReadBar } from './TableRead';
import { paginateScript } from '../engine/paginate';
import { getRevisionSettings, pageRevision } from '../engine/production';
import { ELEMENT_BEHAVIOR, createDefaultPageLayout, type HeaderFooterLine } from '../types/screenplay';
import { fillFields, getHeaderFooter, headerContext, showsFooter, showsHeader, type HeaderContext } from '../utils/headerFooter';
import { PAGE_GAP, PAGE_HEIGHT } from './pageLayout';
import './Editor.css';

// One header or footer line on an on-screen page, at the PDF's positions
const HeaderRow = ({ line, ctx, top }: { line: HeaderFooterLine; ctx: HeaderContext; top: number }) => (
  <div className="page-header-row" style={{ top: `${top}px` }}>
    <span>{fillFields(line.left, ctx)}</span>
    <span>{fillFields(line.center, ctx)}</span>
    <span>{fillFields(line.right, ctx)}</span>
  </div>
);

export const Editor = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scriptEditorRef = useRef<HTMLDivElement>(null);

  const {
    screenplay,
    currentElementType,
    selectedElementId,
    selectElement,
    addElement,
    panels,
    visibility,
    activeApp,
    viewMode,
    stats,
    zoom,
    fileName,
    panelLayout,
  } = useScreenplayStore(
    useShallow((s) => ({
      screenplay: s.screenplay,
      currentElementType: s.currentElementType,
      selectedElementId: s.selectedElementId,
      selectElement: s.selectElement,
      addElement: s.addElement,
      panels: s.panels,
      visibility: s.visibility,
      activeApp: s.activeApp,
      viewMode: s.viewMode,
      stats: s.stats,
      zoom: s.zoom,
      fileName: s.fileName,
      panelLayout: s.panelLayout,
    }))
  );

  // Page count and page numbers come from the shared pagination engine (same as the PDF)
  const pagination = paginateScript(screenplay);
  const pageCount = pagination.pageCount;
  const selectedIndex = screenplay.elements.findIndex((el) => el.id === selectedElementId);
  const currentPage = selectedIndex >= 0 ? pagination.elementPages[selectedIndex] : 1;
  const revisions = getRevisionSettings(screenplay);
  const layout = screenplay.pageLayout ?? createDefaultPageLayout();
  const headerFooter = getHeaderFooter(screenplay);
  const activeSet = revisions.sets.find((set) => set.id === revisions.activeSetId);

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

  // Menu commands from the keyboard (undo, save, element shortcuts, ...)
  useCommandShortcuts(activeApp === 'rewriter');
  // Tags Mode colors tagged words in the script
  useTagHighlights();

  // Calculate zoom scale
  const scale = zoom / 100;

  // Find current scene heading for status bar
  const currentSceneHeading = screenplay.elements.find(el => el.type === 'Scene Heading')?.content[0]?.text || 'No Scene';

  // Get element hints for status bar
  const behavior = ELEMENT_BEHAVIOR[currentElementType] ?? ELEMENT_BEHAVIOR['Action'];
  const hints = { tab: behavior.tabKey, enter: behavior.returnKey };

  // One panel, or two side by side / stacked (View > Split)
  const renderPanels = (scriptArea: React.ReactNode) => {
    const { primary, split } = panelLayout;
    const secondary = primary === 'script' && panelLayout.secondary === 'script' ? 'cardsSummary' : panelLayout.secondary;
    const panelFor = (view: PanelView, slot: 'primary' | 'secondary') => (
      <div className="view-panel" key={slot}>
        {view === 'script' ? scriptArea : <ScenePanel view={view} slot={slot} />}
      </div>
    );
    if (split === 'none') return panelFor(primary, 'primary');
    return <div className={`view-panels ${split}`}>{panelFor(primary, 'primary')}{panelFor(secondary, 'secondary')}</div>;
  };

  // Render the appropriate view based on activeApp
  const renderMainContent = () => {
    // BluePrint app - Story Development
    if (activeApp === 'blueprint') {
      return <StoryMode />;
    }

    // CorkBoard app - Visual Planning
    if (activeApp === 'corkboard') {
      return <BeatBoard />;
    }

    // ReWriter app - Screenwriting
    if (viewMode === 'split') {
      return <SplitView />;
    }

    // The paged script (only ever shown in one panel)
    const scriptArea = (
          <div className="script-area" onClick={handlePageClick}>
            <div
              className="script-wrapper"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
              }}
            >
              {/* Ruler aligned with page */}
              {visibility.ruler && (
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
              )}

              {/* Pages container with fixed height pages */}
              <div
                className="pages-container"
                ref={contentRef}
                style={{ height: `${totalHeight}px` }}
              >
                {/* Page backgrounds - positioned absolutely at fixed intervals */}
                {pagination.pages.map((page, i) => {
                  const revised = pageRevision(page, screenplay.elements, revisions);
                  return (
                    <div
                      key={`page-bg-${i}`}
                      className={`page page-background${revised && revisions.showPageColors ? ' revised-page' : ''}`}
                      style={{
                        top: `${i * (PAGE_HEIGHT + PAGE_GAP)}px`,
                        // Tint rather than replace the page so text stays readable in dark themes
                        ...(revised && revisions.showPageColors ? { background: `color-mix(in srgb, ${revised.pageColor} 40%, var(--script-bg))` } : {}),
                      }}
                    >
                      {/* Document > Header and Footer (same fields as the PDF) */}
                      {showsHeader(headerFooter, page.number) && (
                        <HeaderRow line={headerFooter.header} ctx={headerContext(page, screenplay, fileName)} top={layout.headerMargin * 96 - 13} />
                      )}
                      {showsFooter(headerFooter, page.number) && (
                        <HeaderRow line={headerFooter.footer} ctx={headerContext(page, screenplay, fileName)} top={PAGE_HEIGHT - layout.footerMargin * 96 - 13} />
                      )}
                    </div>
                  );
                })}

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
                  <div className="page-content" ref={scriptEditorRef} style={{ paddingTop: `${layout.topMargin * 96}px` }}>
                    <ScriptEditor />
                    <div className="script-end-area" />
                  </div>
                </div>
              </div>
            </div>
          </div>
    );

    // Default: script view
    return (
      <>
        {/* Title Page Editor Modal */}
        {panels.titlePage && <TitlePageEditor />}

        {/* Scene Navigator - fixed at top */}
        <SceneNavigator />

        {/* Script and scene panels (View > Script / Scene View / Index Cards, View > Split) */}
        {renderPanels(scriptArea)}

        {/* ScriptNote popover (opened from a margin marker or the Navigator) */}
        <NotePopover />
        <TagsPanel />
        <TableReadBar />

        {/* Status bar */}
        <div className="status-bar">
          <div className="status-left">
            <span className="status-page">
              {pagination.pages[currentPage - 1]?.label ?? currentPage} of {pagination.pages[pageCount - 1]?.label ?? pageCount}
            </span>
            {revisions.revisionMode && (
              <span className="status-revision" title="Revision Mode is on">
                Revision: {activeSet?.label}
              </span>
            )}
            {screenplay.lockedPages && <span className="status-locked" title="Pages are locked">Locked</span>}
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
      </>
    );
  };

  return (
    <div className="editor-container">
      {/* Left Panel - Navigator */}
      {panels.navigator && <Navigator />}

      {/* Main Editor Area */}
      <div className="editor" ref={editorRef}>
        {renderMainContent()}
      </div>

      {/* Right Panel - Writing Stats */}
      {panels.writingStats && <WritingStats />}
    </div>
  );
};
