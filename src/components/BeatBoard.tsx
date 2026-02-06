import { useState, useRef, useCallback } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import type { Beat } from '../types/screenplay';
import './BeatBoard.css';

const BEAT_COLORS = [
  '#4a9eff', // Blue
  '#ff6b6b', // Red
  '#51cf66', // Green
  '#ffd43b', // Yellow
  '#cc5de8', // Purple
  '#ff922b', // Orange
  '#20c997', // Teal
  '#f06595', // Pink
];

interface DragState {
  beatId: string;
  offsetX: number;
  offsetY: number;
}

interface ResizeState {
  beatId: string;
  startWidth: number;
  startHeight: number;
  startX: number;
  startY: number;
}

export const BeatBoard = () => {
  const {
    beatBoards,
    activeBeatBoardId,
    createBeatBoard,
    deleteBeatBoard,
    setActiveBeatBoard,
    addBeat,
    updateBeat,
    deleteBeat,
    sendBeatToScript,
    setViewMode,
  } = useScreenplayStore();

  const [editingBeat, setEditingBeat] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [showNewBoardInput, setShowNewBoardInput] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [beatSizes, setBeatSizes] = useState<Record<string, { width: number; height: number }>>({});
  const boardRef = useRef<HTMLDivElement>(null);

  const activeBoard = beatBoards.find((b) => b.id === activeBeatBoardId);

  const handleCreateBoard = () => {
    if (newBoardName.trim()) {
      createBeatBoard(newBoardName.trim());
      setNewBoardName('');
      setShowNewBoardInput(false);
    }
  };

  const handleAddBeat = () => {
    if (!activeBeatBoardId) return;

    const beat: Omit<Beat, 'id'> = {
      title: 'NEW SCENE',
      description: '',
      color: BEAT_COLORS[Math.floor(Math.random() * BEAT_COLORS.length)],
      position: {
        x: 50 + Math.random() * 200,
        y: 50 + Math.random() * 100,
      },
    };

    const beatId = addBeat(activeBeatBoardId, beat);
    setEditingBeat(beatId);
  };

  // Handle drag from drag handle (works even in edit mode)
  const handleDragHandleMouseDown = useCallback(
    (e: React.MouseEvent, beat: Beat) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = (e.target as HTMLElement).closest('.beat-card')?.getBoundingClientRect();
      if (!rect) return;

      setDragState({
        beatId: beat.id,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      });
    },
    []
  );

  // Handle resize from resize handle
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, beat: Beat) => {
      e.preventDefault();
      e.stopPropagation();

      const size = beatSizes[beat.id] || { width: 180, height: 100 };

      setResizeState({
        beatId: beat.id,
        startWidth: size.width,
        startHeight: size.height,
        startX: e.clientX,
        startY: e.clientY,
      });
    },
    [beatSizes]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Handle resize
      if (resizeState) {
        const deltaX = e.clientX - resizeState.startX;
        const deltaY = e.clientY - resizeState.startY;

        setBeatSizes((prev) => ({
          ...prev,
          [resizeState.beatId]: {
            width: Math.max(150, resizeState.startWidth + deltaX),
            height: Math.max(80, resizeState.startHeight + deltaY),
          },
        }));
        return;
      }

      // Handle drag
      if (!dragState || !activeBeatBoardId || !boardRef.current) return;

      const boardRect = boardRef.current.getBoundingClientRect();
      const beatSize = beatSizes[dragState.beatId] || { width: 180, height: 100 };
      const x = e.clientX - boardRect.left - dragState.offsetX;
      const y = e.clientY - boardRect.top - dragState.offsetY;

      updateBeat(activeBeatBoardId, dragState.beatId, {
        position: {
          x: Math.max(0, Math.min(x, boardRect.width - beatSize.width)),
          y: Math.max(0, Math.min(y, boardRect.height - beatSize.height)),
        },
      });
    },
    [dragState, resizeState, activeBeatBoardId, updateBeat, beatSizes]
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
    setResizeState(null);
  }, []);

  const handleBeatChange = (beatId: string, field: 'title' | 'description', value: string) => {
    if (!activeBeatBoardId) return;
    updateBeat(activeBeatBoardId, beatId, { [field]: value });
  };

  const handleColorChange = (beatId: string, color: string) => {
    if (!activeBeatBoardId) return;
    updateBeat(activeBeatBoardId, beatId, { color });
  };

  const handleSendToScript = (beatId: string) => {
    if (!activeBeatBoardId) return;
    const sceneId = sendBeatToScript(activeBeatBoardId, beatId);

    if (sceneId) {
      // Switch to script view
      setViewMode('script');

      // Scroll to the created element after a short delay (for view to render)
      setTimeout(() => {
        const element = document.querySelector(`[data-element-id="${sceneId}"]`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const handleDeleteBeat = (beatId: string) => {
    if (!activeBeatBoardId) return;
    if (confirm('Delete this beat?')) {
      deleteBeat(activeBeatBoardId, beatId);
    }
  };

  return (
    <div className="beat-board-container">
      {/* Board Tabs */}
      <div className="board-tabs">
        {beatBoards.map((board) => (
          <button
            key={board.id}
            className={`board-tab ${board.id === activeBeatBoardId ? 'active' : ''}`}
            onClick={() => setActiveBeatBoard(board.id)}
          >
            {board.name}
            <span
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete board "${board.name}"?`)) {
                  deleteBeatBoard(board.id);
                }
              }}
            >
              ×
            </span>
          </button>
        ))}

        {showNewBoardInput ? (
          <div className="new-board-input">
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Board name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateBoard();
                if (e.key === 'Escape') setShowNewBoardInput(false);
              }}
              onBlur={() => {
                if (!newBoardName) setShowNewBoardInput(false);
              }}
            />
          </div>
        ) : (
          <button className="board-tab add-tab" onClick={() => setShowNewBoardInput(true)}>
            + New Board
          </button>
        )}
      </div>

      {/* Board Content */}
      {activeBoard ? (
        <div
          ref={boardRef}
          className="board-canvas"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Toolbar */}
          <div className="board-toolbar">
            <button className="board-btn" onClick={handleAddBeat}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Add Beat
            </button>
          </div>

          {/* Beat Cards */}
          {activeBoard.beats.map((beat) => {
            const size = beatSizes[beat.id] || { width: 180, height: 100 };
            return (
            <div
              key={beat.id}
              className={`beat-card ${dragState?.beatId === beat.id ? 'dragging' : ''} ${
                resizeState?.beatId === beat.id ? 'resizing' : ''
              } ${editingBeat === beat.id ? 'editing' : ''}`}
              style={{
                left: beat.position.x,
                top: beat.position.y,
                width: size.width,
                minHeight: size.height,
                borderTopColor: beat.color,
              }}
              onDoubleClick={() => setEditingBeat(beat.id)}
            >
              {/* Drag Handle - always visible */}
              <div
                className="beat-drag-handle"
                onMouseDown={(e) => handleDragHandleMouseDown(e, beat)}
                title="Drag to move"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5" />
                  <circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" />
                  <circle cx="15" cy="18" r="1.5" />
                </svg>
              </div>

              {/* Color Indicator */}
              <div className="beat-color-bar" style={{ background: beat.color }} />

              {/* Card Content */}
              {editingBeat === beat.id ? (
                <div className="beat-edit-mode">
                  <input
                    type="text"
                    className="beat-title-input"
                    value={beat.title}
                    onChange={(e) => handleBeatChange(beat.id, 'title', e.target.value)}
                    placeholder="Scene heading..."
                    autoFocus
                  />
                  <textarea
                    className="beat-desc-input"
                    value={beat.description}
                    onChange={(e) => handleBeatChange(beat.id, 'description', e.target.value)}
                    placeholder="Description..."
                    rows={3}
                  />
                  <div className="beat-colors">
                    {BEAT_COLORS.map((color) => (
                      <button
                        key={color}
                        className={`color-btn ${beat.color === color ? 'active' : ''}`}
                        style={{ background: color }}
                        onClick={() => handleColorChange(beat.id, color)}
                      />
                    ))}
                  </div>
                  <div className="beat-actions">
                    <button onClick={() => handleSendToScript(beat.id)} title="Send to Script">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                        <path d="M12 18v-6" />
                        <path d="M9 15l3-3 3 3" />
                      </svg>
                    </button>
                    <button onClick={() => handleDeleteBeat(beat.id)} title="Delete">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                    <button onClick={() => setEditingBeat(null)} title="Done">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="beat-view-mode">
                  <div className="beat-title">{beat.title || 'Untitled'}</div>
                  {beat.description && (
                    <div className="beat-description">{beat.description}</div>
                  )}
                  {beat.linkedSceneId && (
                    <div className="beat-linked">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      Linked to script
                    </div>
                  )}
                </div>
              )}

              {/* Resize Handle */}
              <div
                className="beat-resize-handle"
                onMouseDown={(e) => handleResizeMouseDown(e, beat)}
                title="Drag to resize"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
                </svg>
              </div>
            </div>
          );
          })}

          {/* Empty State */}
          {activeBoard.beats.length === 0 && (
            <div className="board-empty">
              <p>No beats yet. Click "Add Beat" to start planning your story.</p>
              <p className="hint">
                Tip: Use the Beat Board to outline scenes and story structure before writing.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="no-board-selected">
          <p>Create a new Beat Board to start planning your story.</p>
          <button className="create-board-btn" onClick={() => setShowNewBoardInput(true)}>
            + Create Beat Board
          </button>
        </div>
      )}
    </div>
  );
};
