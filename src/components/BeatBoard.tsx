import { useState, useRef, useCallback, useEffect } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import type { Beat, StoryBeat } from '../types/screenplay';
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

// Color mapping for story beats by act
const ACT_COLORS: Record<string, string> = {
  'act1': '#4a9eff',  // Blue for Act 1
  'act2a': '#51cf66', // Green for Act 2A
  'act2b': '#ffd43b', // Yellow for Act 2B
  'act3': '#ff6b6b',  // Red for Act 3
};

interface DragState {
  beatId: string;
  offsetX: number;
  offsetY: number;
  isStoryBeat?: boolean;
}

interface ResizeState {
  beatId: string;
  startWidth: number;
  startHeight: number;
  startX: number;
  startY: number;
}

// Convert story beats to card-compatible format with positions
interface StoryBeatCard extends StoryBeat {
  position: { x: number; y: number };
  color: string;
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
    storyOutline,
    initializeBeats,
    updateBeatContent,
  } = useScreenplayStore();

  const [editingBeat, setEditingBeat] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [showNewBoardInput, setShowNewBoardInput] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [beatSizes, setBeatSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [storyBeatPositions, setStoryBeatPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [activeTab, setActiveTab] = useState<'beatSheet' | string>('beatSheet');
  const boardRef = useRef<HTMLDivElement>(null);

  // Initialize story beats on mount
  useEffect(() => {
    initializeBeats();
  }, [initializeBeats]);

  // Calculate initial positions for story beats (grid layout by act)
  useEffect(() => {
    if (storyOutline.beats.length > 0 && Object.keys(storyBeatPositions).length === 0) {
      const positions: Record<string, { x: number; y: number }> = {};
      const actCounts = { act1: 0, act2a: 0, act2b: 0, act3: 0 };
      const CARD_HEIGHT = 130;
      const PADDING = 20;
      const ACT_START_Y = { act1: 60, act2a: 60, act2b: 60, act3: 60 };
      const ACT_START_X = { act1: 20, act2a: 250, act2b: 480, act3: 710 };

      storyOutline.beats.forEach((beat) => {
        const count = actCounts[beat.act];
        positions[beat.id] = {
          x: ACT_START_X[beat.act],
          y: ACT_START_Y[beat.act] + count * (CARD_HEIGHT + PADDING),
        };
        actCounts[beat.act]++;
      });

      setStoryBeatPositions(positions);
    }
  }, [storyOutline.beats, storyBeatPositions]);

  const activeBoard = beatBoards.find((b) => b.id === activeBeatBoardId);

  const handleCreateBoard = () => {
    if (newBoardName.trim()) {
      const id = createBeatBoard(newBoardName.trim());
      setNewBoardName('');
      setShowNewBoardInput(false);
      setActiveTab(id);
      setActiveBeatBoard(id);
    }
  };

  const handleAddBeat = () => {
    if (activeTab === 'beatSheet') return; // Can't add to beat sheet directly
    if (!activeBeatBoardId) return;

    const beat: Omit<Beat, 'id'> = {
      title: 'NEW SCENE',
      description: '',
      color: BEAT_COLORS[Math.floor(Math.random() * BEAT_COLORS.length)],
      position: {
        x: 50 + Math.random() * 200,
        y: 80 + Math.random() * 100,
      },
    };

    const beatId = addBeat(activeBeatBoardId, beat);
    setEditingBeat(beatId);
  };

  // Handle drag from drag handle
  const handleDragHandleMouseDown = useCallback(
    (e: React.MouseEvent, beat: Beat | StoryBeatCard, isStoryBeat = false) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = (e.target as HTMLElement).closest('.beat-card')?.getBoundingClientRect();
      if (!rect) return;

      setDragState({
        beatId: beat.id,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        isStoryBeat,
      });
    },
    []
  );

  // Handle resize from resize handle
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, beat: Beat | StoryBeatCard) => {
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
      if (!dragState || !boardRef.current) return;

      const boardRect = boardRef.current.getBoundingClientRect();
      const beatSize = beatSizes[dragState.beatId] || { width: 180, height: 100 };
      const x = e.clientX - boardRect.left - dragState.offsetX;
      const y = e.clientY - boardRect.top - dragState.offsetY;

      const newX = Math.max(0, Math.min(x, boardRect.width - beatSize.width));
      const newY = Math.max(0, Math.min(y, boardRect.height - beatSize.height));

      if (dragState.isStoryBeat) {
        // Update story beat position locally
        setStoryBeatPositions((prev) => ({
          ...prev,
          [dragState.beatId]: { x: newX, y: newY },
        }));
      } else if (activeBeatBoardId) {
        // Update custom board beat
        updateBeat(activeBeatBoardId, dragState.beatId, {
          position: { x: newX, y: newY },
        });
      }
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

  const handleStoryBeatChange = (beatId: string, value: string) => {
    updateBeatContent(beatId, value);
  };

  const handleColorChange = (beatId: string, color: string) => {
    if (!activeBeatBoardId) return;
    updateBeat(activeBeatBoardId, beatId, { color });
  };

  const handleSendToScript = (beatId: string) => {
    if (!activeBeatBoardId) return;
    const sceneId = sendBeatToScript(activeBeatBoardId, beatId);

    if (sceneId) {
      setViewMode('script');
      setTimeout(() => {
        const element = document.querySelector(`[data-element-id="${sceneId}"]`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const handleDeleteBeat = (beatId: string) => {
    if (!activeBeatBoardId) return;
    if (confirm('Delete this card?')) {
      deleteBeat(activeBeatBoardId, beatId);
    }
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId !== 'beatSheet') {
      setActiveBeatBoard(tabId);
    }
  };

  // Convert story beats to card format - only show beats with content
  const filledBeats = storyOutline.beats.filter((beat) => beat.description.trim() !== '');
  const storyBeatCards: StoryBeatCard[] = filledBeats.map((beat) => ({
    ...beat,
    position: storyBeatPositions[beat.id] || { x: 50, y: 50 },
    color: ACT_COLORS[beat.act] || '#4a9eff',
  }));

  // For manual card adding to beat sheet
  const [showAddBeatModal, setShowAddBeatModal] = useState(false);
  const [newBeatTitle, setNewBeatTitle] = useState('');
  const [newBeatAct, setNewBeatAct] = useState<'act1' | 'act2a' | 'act2b' | 'act3'>('act1');

  const handleAddBeatSheetCard = () => {
    if (!newBeatTitle.trim()) return;

    // Add a new beat to the story outline
    const newBeat: StoryBeat = {
      id: `manual-${Date.now()}`,
      name: newBeatTitle.trim(),
      act: newBeatAct,
      description: '',
    };

    // Add the beat via store (we need to add this method)
    useScreenplayStore.getState().addStoryBeat(newBeat);

    // Calculate position for new card
    const actCounts = { act1: 0, act2a: 0, act2b: 0, act3: 0 };
    const CARD_HEIGHT = 130;
    const PADDING = 20;
    const ACT_START_Y = { act1: 60, act2a: 60, act2b: 60, act3: 60 };
    const ACT_START_X = { act1: 20, act2a: 250, act2b: 480, act3: 710 };

    storyOutline.beats.forEach((beat) => {
      actCounts[beat.act]++;
    });

    setStoryBeatPositions((prev) => ({
      ...prev,
      [newBeat.id]: {
        x: ACT_START_X[newBeatAct],
        y: ACT_START_Y[newBeatAct] + actCounts[newBeatAct] * (CARD_HEIGHT + PADDING),
      },
    }));

    setNewBeatTitle('');
    setShowAddBeatModal(false);
  };

  // Render a beat card (shared between story beats and custom beats)
  const renderBeatCard = (
    beat: Beat | StoryBeatCard,
    isStoryBeat: boolean = false
  ) => {
    const size = beatSizes[beat.id] || { width: 180, height: isStoryBeat ? 120 : 100 };
    const isEditing = editingBeat === beat.id;
    const isDragging = dragState?.beatId === beat.id;
    const isResizing = resizeState?.beatId === beat.id;

    return (
      <div
        key={beat.id}
        className={`beat-card ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} ${isEditing ? 'editing' : ''} ${isStoryBeat ? 'story-beat' : ''}`}
        style={{
          left: beat.position.x,
          top: beat.position.y,
          width: size.width,
          minHeight: size.height,
          borderTopColor: beat.color,
        }}
        onDoubleClick={() => setEditingBeat(beat.id)}
      >
        {/* Drag Handle */}
        <div
          className="beat-drag-handle"
          onMouseDown={(e) => handleDragHandleMouseDown(e, beat, isStoryBeat)}
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

        {/* Color Bar */}
        <div className="beat-color-bar" style={{ background: beat.color }} />

        {/* Card Content */}
        {isStoryBeat ? (
          // Story beat card (from beat sheet)
          <div className="beat-story-mode">
            <div className="beat-story-name">{(beat as StoryBeatCard).name}</div>
            <textarea
              className="beat-story-desc"
              value={(beat as StoryBeatCard).description}
              onChange={(e) => handleStoryBeatChange(beat.id, e.target.value)}
              placeholder="Describe this beat..."
              rows={3}
            />
            <div className="beat-story-act">
              {(beat as StoryBeatCard).act.replace('act', 'Act ').replace('a', 'A').replace('b', 'B')}
            </div>
          </div>
        ) : isEditing ? (
          // Custom beat edit mode
          <div className="beat-edit-mode">
            <input
              type="text"
              className="beat-title-input"
              value={(beat as Beat).title}
              onChange={(e) => handleBeatChange(beat.id, 'title', e.target.value)}
              placeholder="Scene heading..."
              autoFocus
            />
            <textarea
              className="beat-desc-input"
              value={(beat as Beat).description}
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
          // Custom beat view mode
          <div className="beat-view-mode">
            <div className="beat-title">{(beat as Beat).title || 'Untitled'}</div>
            {(beat as Beat).description && (
              <div className="beat-description">{(beat as Beat).description}</div>
            )}
            {(beat as Beat).linkedSceneId && (
              <div className="beat-linked">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Linked
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
  };

  return (
    <div className="beat-board-container">
      {/* Board Tabs */}
      <div className="board-tabs">
        {/* Beat Sheet Tab (auto-populated from Development) */}
        <button
          className={`board-tab beat-sheet-tab ${activeTab === 'beatSheet' ? 'active' : ''}`}
          onClick={() => handleTabClick('beatSheet')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          Beat Sheet
        </button>

        {/* Custom Boards */}
        {beatBoards.map((board) => (
          <button
            key={board.id}
            className={`board-tab ${activeTab === board.id ? 'active' : ''}`}
            onClick={() => handleTabClick(board.id)}
          >
            {board.name}
            <span
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete board "${board.name}"?`)) {
                  deleteBeatBoard(board.id);
                  if (activeTab === board.id) {
                    setActiveTab('beatSheet');
                  }
                }
              }}
            >
              ×
            </span>
          </button>
        ))}

        {/* New Board */}
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
      <div
        ref={boardRef}
        className="board-canvas"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {activeTab === 'beatSheet' ? (
          <>
            {/* Beat Sheet Header */}
            <div className="board-toolbar beat-sheet-header">
              <div className="beat-sheet-info">
                <span className="info-label">Filled beats from Blueprint → Beats</span>
                <span className="info-count">{storyBeatCards.length} of {storyOutline.beats.length} beats</span>
              </div>
              <button className="board-btn" onClick={() => setShowAddBeatModal(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Add Card
              </button>
              <div className="act-legend">
                <span className="legend-item" style={{ '--legend-color': ACT_COLORS.act1 } as React.CSSProperties}>Act 1</span>
                <span className="legend-item" style={{ '--legend-color': ACT_COLORS.act2a } as React.CSSProperties}>Act 2A</span>
                <span className="legend-item" style={{ '--legend-color': ACT_COLORS.act2b } as React.CSSProperties}>Act 2B</span>
                <span className="legend-item" style={{ '--legend-color': ACT_COLORS.act3 } as React.CSSProperties}>Act 3</span>
              </div>
            </div>

            {/* Add Beat Modal */}
            {showAddBeatModal && (
              <div className="add-beat-modal-overlay" onClick={() => setShowAddBeatModal(false)}>
                <div className="add-beat-modal" onClick={(e) => e.stopPropagation()}>
                  <h3>Add Custom Beat</h3>
                  <div className="modal-field">
                    <label>Beat Name</label>
                    <input
                      type="text"
                      value={newBeatTitle}
                      onChange={(e) => setNewBeatTitle(e.target.value)}
                      placeholder="e.g., Character Revelation"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddBeatSheetCard();
                        if (e.key === 'Escape') setShowAddBeatModal(false);
                      }}
                    />
                  </div>
                  <div className="modal-field">
                    <label>Act</label>
                    <select value={newBeatAct} onChange={(e) => setNewBeatAct(e.target.value as 'act1' | 'act2a' | 'act2b' | 'act3')}>
                      <option value="act1">Act 1</option>
                      <option value="act2a">Act 2A</option>
                      <option value="act2b">Act 2B</option>
                      <option value="act3">Act 3</option>
                    </select>
                  </div>
                  <div className="modal-actions">
                    <button className="modal-btn cancel" onClick={() => setShowAddBeatModal(false)}>Cancel</button>
                    <button className="modal-btn confirm" onClick={handleAddBeatSheetCard}>Add Beat</button>
                  </div>
                </div>
              </div>
            )}

            {/* Story Beat Cards */}
            {storyBeatCards.map((beat) => renderBeatCard(beat, true))}

            {storyBeatCards.length === 0 && (
              <div className="board-empty">
                <p>No filled beats yet.</p>
                <p className="hint">
                  Go to <strong>Blueprint → Beats</strong> to fill out your story structure,
                  or click <strong>Add Card</strong> to create a custom beat.
                </p>
              </div>
            )}
          </>
        ) : activeBoard ? (
          <>
            {/* Custom Board Toolbar */}
            <div className="board-toolbar">
              <button className="board-btn" onClick={handleAddBeat}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Add Card
              </button>
            </div>

            {/* Custom Board Cards */}
            {activeBoard.beats.map((beat) => renderBeatCard(beat, false))}

            {activeBoard.beats.length === 0 && (
              <div className="board-empty">
                <p>No cards yet. Click "Add Card" to start.</p>
                <p className="hint">
                  Use this board for additional scenes, ideas, or alternate storylines.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="board-empty">
            <p>Select a board or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
};
