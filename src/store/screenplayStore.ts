import { create } from 'zustand';
import type { Screenplay, ScreenplayElement, ElementType, TextRun, TitlePageInfo, Beat, BeatBoard, ScriptVersion, ScriptNote } from '../types/screenplay';
import { LINES_PER_PAGE } from '../types/screenplay';
import { createNewScreenplay, generateId, parseFDX, generateFDX, getPlainText } from '../utils/fdx';

// Panel visibility options
interface PanelState {
  navigator: boolean;
  elements: boolean;
  writingStats: boolean;
  titlePage: boolean;
  beatBoard: boolean;
}

// Visibility toggles for Show/Hide menu
interface VisibilityState {
  ruler: boolean;
  sceneNavigator: boolean;
  scriptNotes: boolean;
}

// View modes
type ViewMode = 'script' | 'split' | 'beatBoard';

// Writing statistics
interface WritingStats {
  pageCount: number;
  wordCount: number;
  characterCount: number;
  sceneCount: number;
  dialogueCount: number;
  estimatedRuntime: string; // e.g., "1h 32m"
}

// History entry for undo/redo
interface HistoryEntry {
  screenplay: Screenplay;
  selectedElementId: string | null;
}

interface ScreenplayState {
  screenplay: Screenplay;
  selectedElementId: string | null;
  currentElementType: ElementType;
  isDirty: boolean;
  fileName: string;
  darkMode: boolean;

  // Undo/Redo
  history: HistoryEntry[];
  future: HistoryEntry[];
  historyIndex: number;

  // UI State
  zoom: number;
  viewMode: ViewMode;
  panels: PanelState;
  visibility: VisibilityState;
  stats: WritingStats;
  currentPage: number;
  cursorLine: number;

  // Beat Board
  beatBoards: BeatBoard[];
  activeBeatBoardId: string | null;

  // Version Management
  versions: ScriptVersion[];
  activeVersionId: string | null;

  // Script Notes
  scriptNotes: ScriptNote[];

  // Actions
  setScreenplay: (screenplay: Screenplay) => void;
  newScreenplay: () => void;

  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveToHistory: () => void;
  setTitle: (title: string) => void;
  setAuthor: (author: string) => void;
  updateTitlePage: (titlePage: Partial<TitlePageInfo>) => void;

  // Element actions
  addElement: (afterId?: string, type?: ElementType) => string;
  updateElement: (id: string, content: TextRun[]) => void;
  updateElementType: (id: string, type: ElementType) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  setCurrentElementType: (type: ElementType) => void;
  mergeWithPrevious: (id: string) => string | null;

  // File actions
  loadFromFDX: (content: string) => void;
  exportToFDX: () => string;
  setFileName: (name: string) => void;
  setDirty: (dirty: boolean) => void;

  // UI actions
  setZoom: (zoom: number) => void;
  setViewMode: (mode: ViewMode) => void;
  togglePanel: (panel: keyof PanelState) => void;
  toggleVisibility: (item: keyof VisibilityState) => void;
  setCurrentPage: (page: number) => void;
  setCursorLine: (line: number) => void;
  calculateStats: () => void;

  // Beat Board actions
  createBeatBoard: (name: string) => string;
  deleteBeatBoard: (id: string) => void;
  setActiveBeatBoard: (id: string | null) => void;
  addBeat: (boardId: string, beat: Omit<Beat, 'id'>) => string;
  updateBeat: (boardId: string, beatId: string, updates: Partial<Beat>) => void;
  deleteBeat: (boardId: string, beatId: string) => void;
  sendBeatToScript: (boardId: string, beatId: string) => void;

  // Version Management actions
  createVersion: (name: string) => string;
  switchVersion: (versionId: string) => void;
  deleteVersion: (versionId: string) => void;
  renameVersion: (versionId: string, name: string) => void;

  // Script Notes actions
  addNote: (elementId: string, content: string, author?: string) => string;
  updateNote: (noteId: string, content: string) => void;
  deleteNote: (noteId: string) => void;
  resolveNote: (noteId: string) => void;

  // Theme
  toggleDarkMode: () => void;
}

// Calculate writing statistics from screenplay
const calculateWritingStats = (screenplay: Screenplay): WritingStats => {
  let wordCount = 0;
  let characterCount = 0;
  let sceneCount = 0;
  let dialogueCount = 0;
  let totalLines = 0;

  screenplay.elements.forEach((element) => {
    const text = getPlainText(element.content);
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    wordCount += words.length;
    characterCount += text.length;

    if (element.type === 'Scene Heading') {
      sceneCount++;
    }
    if (element.type === 'Dialogue') {
      dialogueCount++;
    }

    // Estimate lines (rough calculation based on 60 chars per line)
    const lineCount = Math.max(1, Math.ceil(text.length / 60));
    totalLines += lineCount;
  });

  const pageCount = Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE));

  // 1 page ≈ 1 minute of screen time
  const totalMinutes = pageCount;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const estimatedRuntime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return {
    pageCount,
    wordCount,
    characterCount,
    sceneCount,
    dialogueCount,
    estimatedRuntime,
  };
};

// Max history entries to prevent memory issues
const MAX_HISTORY = 100;

export const useScreenplayStore = create<ScreenplayState>((set, get) => ({
  screenplay: createNewScreenplay(),
  selectedElementId: null,
  currentElementType: 'Scene Heading',
  isDirty: false,
  fileName: 'Untitled.fdx',
  darkMode: true,

  // Undo/Redo state
  history: [],
  future: [],
  historyIndex: -1,

  // UI State defaults
  zoom: 100,
  viewMode: 'script',
  panels: {
    navigator: false,
    elements: false,
    writingStats: false,
    titlePage: false,
    beatBoard: false,
  },
  visibility: {
    ruler: true,
    sceneNavigator: true,
    scriptNotes: true,
  },
  stats: {
    pageCount: 1,
    wordCount: 0,
    characterCount: 0,
    sceneCount: 0,
    dialogueCount: 0,
    estimatedRuntime: '0m',
  },
  currentPage: 1,
  cursorLine: 1,

  // Beat Board state
  beatBoards: [],
  activeBeatBoardId: null,

  // Version Management state
  versions: [],
  activeVersionId: null,

  // Script Notes state
  scriptNotes: [],

  // Save current state to history (call before making changes)
  saveToHistory: () => {
    const state = get();
    const entry: HistoryEntry = {
      screenplay: JSON.parse(JSON.stringify(state.screenplay)),
      selectedElementId: state.selectedElementId,
    };

    // Trim history if too long
    let newHistory = [...state.history, entry];
    if (newHistory.length > MAX_HISTORY) {
      newHistory = newHistory.slice(-MAX_HISTORY);
    }

    set({
      history: newHistory,
      future: [], // Clear redo stack on new action
    });
  },

  undo: () => {
    const state = get();
    if (state.history.length === 0) return;

    // Save current state to future (for redo)
    const currentEntry: HistoryEntry = {
      screenplay: JSON.parse(JSON.stringify(state.screenplay)),
      selectedElementId: state.selectedElementId,
    };

    // Pop last history entry
    const newHistory = [...state.history];
    const previousEntry = newHistory.pop();

    if (previousEntry) {
      const stats = calculateWritingStats(previousEntry.screenplay);
      set({
        screenplay: previousEntry.screenplay,
        selectedElementId: previousEntry.selectedElementId,
        history: newHistory,
        future: [currentEntry, ...state.future],
        stats,
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;

    // Save current state to history
    const currentEntry: HistoryEntry = {
      screenplay: JSON.parse(JSON.stringify(state.screenplay)),
      selectedElementId: state.selectedElementId,
    };

    // Pop first future entry
    const [nextEntry, ...newFuture] = state.future;

    if (nextEntry) {
      const stats = calculateWritingStats(nextEntry.screenplay);
      set({
        screenplay: nextEntry.screenplay,
        selectedElementId: nextEntry.selectedElementId,
        history: [...state.history, currentEntry],
        future: newFuture,
        stats,
      });
    }
  },

  canUndo: () => get().history.length > 0,
  canRedo: () => get().future.length > 0,

  setScreenplay: (screenplay) => {
    get().saveToHistory();
    const stats = calculateWritingStats(screenplay);
    set({ screenplay, isDirty: true, stats });
  },

  newScreenplay: () => {
    const newScript = createNewScreenplay();
    const stats = calculateWritingStats(newScript);
    set({
      screenplay: newScript,
      selectedElementId: newScript.elements[0]?.id || null,
      isDirty: false,
      fileName: 'Untitled.fdx',
      stats,
      currentPage: 1,
    });
  },

  setTitle: (title) =>
    set((state) => ({
      screenplay: {
        ...state.screenplay,
        title,
        titlePage: { ...state.screenplay.titlePage, title }
      },
      isDirty: true,
    })),

  setAuthor: (author) =>
    set((state) => ({
      screenplay: {
        ...state.screenplay,
        author,
        titlePage: { ...state.screenplay.titlePage, author }
      },
      isDirty: true,
    })),

  updateTitlePage: (titlePageUpdate) =>
    set((state) => ({
      screenplay: {
        ...state.screenplay,
        titlePage: { ...state.screenplay.titlePage, ...titlePageUpdate },
      },
      isDirty: true,
    })),

  addElement: (afterId, type) => {
    const state = get();
    state.saveToHistory(); // Save before change

    const elementType = type || state.currentElementType;
    const newElement: ScreenplayElement = {
      id: generateId(),
      type: elementType,
      content: [{ text: '' }],
    };

    const elements = [...state.screenplay.elements];

    if (afterId) {
      const index = elements.findIndex((el) => el.id === afterId);
      if (index !== -1) {
        elements.splice(index + 1, 0, newElement);
      } else {
        elements.push(newElement);
      }
    } else {
      elements.push(newElement);
    }

    const newScreenplay = { ...state.screenplay, elements };
    const stats = calculateWritingStats(newScreenplay);

    set({
      screenplay: newScreenplay,
      selectedElementId: newElement.id,
      isDirty: true,
      stats,
    });

    return newElement.id;
  },

  updateElement: (id, content) =>
    set((state) => {
      const elements = state.screenplay.elements.map((el) =>
        el.id === id ? { ...el, content } : el
      );
      const newScreenplay = { ...state.screenplay, elements };
      const stats = calculateWritingStats(newScreenplay);
      return {
        screenplay: newScreenplay,
        isDirty: true,
        stats,
      };
    }),

  updateElementType: (id, type) =>
    set((state) => {
      const elements = state.screenplay.elements.map((el) =>
        el.id === id ? { ...el, type } : el
      );
      const newScreenplay = { ...state.screenplay, elements };
      const stats = calculateWritingStats(newScreenplay);
      return {
        screenplay: newScreenplay,
        currentElementType: type,
        isDirty: true,
        stats,
      };
    }),

  deleteElement: (id) => {
    get().saveToHistory(); // Save before change
    set((state) => {
      const elements = state.screenplay.elements.filter((el) => el.id !== id);

      if (elements.length === 0) {
        elements.push({
          id: generateId(),
          type: 'Scene Heading',
          content: [{ text: '' }],
        });
      }

      let newSelectedId = state.selectedElementId;
      if (state.selectedElementId === id) {
        const deletedIndex = state.screenplay.elements.findIndex((el) => el.id === id);
        if (deletedIndex > 0) {
          newSelectedId = elements[deletedIndex - 1]?.id || elements[0]?.id;
        } else {
          newSelectedId = elements[0]?.id;
        }
      }

      const newScreenplay = { ...state.screenplay, elements };
      const stats = calculateWritingStats(newScreenplay);

      return {
        screenplay: newScreenplay,
        selectedElementId: newSelectedId,
        isDirty: true,
        stats,
      };
    });
  },

  selectElement: (id) => set({ selectedElementId: id }),

  setCurrentElementType: (type) => set({ currentElementType: type }),

  mergeWithPrevious: (id) => {
    const state = get();
    const elements = [...state.screenplay.elements];
    const index = elements.findIndex((el) => el.id === id);

    if (index <= 0) return null;

    state.saveToHistory(); // Save before change

    const currentElement = elements[index];
    const previousElement = elements[index - 1];

    const mergedContent = [
      ...previousElement.content,
      ...currentElement.content,
    ];

    elements[index - 1] = {
      ...previousElement,
      content: mergedContent,
    };

    elements.splice(index, 1);

    const newScreenplay = { ...state.screenplay, elements };
    const stats = calculateWritingStats(newScreenplay);

    set({
      screenplay: newScreenplay,
      selectedElementId: previousElement.id,
      isDirty: true,
      stats,
    });

    return previousElement.id;
  },

  loadFromFDX: (content) => {
    try {
      const screenplay = parseFDX(content);
      const stats = calculateWritingStats(screenplay);
      set({
        screenplay,
        selectedElementId: screenplay.elements[0]?.id || null,
        isDirty: false,
        stats,
        currentPage: 1,
      });
    } catch (error) {
      console.error('Failed to parse FDX file:', error);
      throw error;
    }
  },

  exportToFDX: () => {
    const state = get();
    return generateFDX(state.screenplay);
  },

  setFileName: (name) => set({ fileName: name }),

  setDirty: (dirty) => set({ isDirty: dirty }),

  // UI actions
  setZoom: (zoom) => set({ zoom: Math.max(50, Math.min(200, zoom)) }),

  setViewMode: (mode) => set({ viewMode: mode }),

  togglePanel: (panel) =>
    set((state) => ({
      panels: {
        ...state.panels,
        [panel]: !state.panels[panel],
      },
    })),

  toggleVisibility: (item) =>
    set((state) => ({
      visibility: {
        ...state.visibility,
        [item]: !state.visibility[item],
      },
    })),

  setCurrentPage: (page) => set({ currentPage: page }),

  setCursorLine: (line) => set({ cursorLine: line }),

  calculateStats: () =>
    set((state) => ({
      stats: calculateWritingStats(state.screenplay),
    })),

  // Beat Board actions
  createBeatBoard: (name) => {
    const id = generateId();
    set((state) => ({
      beatBoards: [...state.beatBoards, { id, name, beats: [] }],
      activeBeatBoardId: id,
    }));
    return id;
  },

  deleteBeatBoard: (id) =>
    set((state) => ({
      beatBoards: state.beatBoards.filter((b) => b.id !== id),
      activeBeatBoardId: state.activeBeatBoardId === id ? null : state.activeBeatBoardId,
    })),

  setActiveBeatBoard: (id) => set({ activeBeatBoardId: id }),

  addBeat: (boardId, beat) => {
    const id = generateId();
    set((state) => ({
      beatBoards: state.beatBoards.map((board) =>
        board.id === boardId
          ? { ...board, beats: [...board.beats, { ...beat, id }] }
          : board
      ),
      isDirty: true,
    }));
    return id;
  },

  updateBeat: (boardId, beatId, updates) =>
    set((state) => ({
      beatBoards: state.beatBoards.map((board) =>
        board.id === boardId
          ? {
              ...board,
              beats: board.beats.map((beat) =>
                beat.id === beatId ? { ...beat, ...updates } : beat
              ),
            }
          : board
      ),
      isDirty: true,
    })),

  deleteBeat: (boardId, beatId) =>
    set((state) => ({
      beatBoards: state.beatBoards.map((board) =>
        board.id === boardId
          ? { ...board, beats: board.beats.filter((b) => b.id !== beatId) }
          : board
      ),
      isDirty: true,
    })),

  sendBeatToScript: (boardId, beatId) => {
    const state = get();
    const board = state.beatBoards.find((b) => b.id === boardId);
    const beat = board?.beats.find((b) => b.id === beatId);
    if (!beat) return;

    // Create a scene heading from the beat
    const sceneId = state.addElement(undefined, 'Scene Heading');
    state.updateElement(sceneId, [{ text: beat.title }]);

    // If there's a description, add it as action
    if (beat.description) {
      const actionId = state.addElement(sceneId, 'Action');
      state.updateElement(actionId, [{ text: beat.description }]);
    }

    // Link the beat to the scene
    state.updateBeat(boardId, beatId, { linkedSceneId: sceneId });
  },

  // Version Management actions
  createVersion: (name) => {
    const state = get();
    const id = generateId();
    const version: ScriptVersion = {
      id,
      name,
      timestamp: new Date(),
      screenplay: JSON.parse(JSON.stringify(state.screenplay)),
      isActive: false,
    };
    set((state) => ({
      versions: [...state.versions, version],
    }));
    return id;
  },

  switchVersion: (versionId) => {
    const state = get();
    const version = state.versions.find((v) => v.id === versionId);
    if (!version) return;

    // Save current to active version before switching
    const updatedVersions = state.versions.map((v) =>
      v.id === state.activeVersionId
        ? { ...v, screenplay: JSON.parse(JSON.stringify(state.screenplay)), isActive: false }
        : v.id === versionId
        ? { ...v, isActive: true }
        : v
    );

    const stats = calculateWritingStats(version.screenplay);
    set({
      screenplay: JSON.parse(JSON.stringify(version.screenplay)),
      versions: updatedVersions,
      activeVersionId: versionId,
      stats,
      isDirty: false,
    });
  },

  deleteVersion: (versionId) =>
    set((state) => ({
      versions: state.versions.filter((v) => v.id !== versionId),
      activeVersionId: state.activeVersionId === versionId ? null : state.activeVersionId,
    })),

  renameVersion: (versionId, name) =>
    set((state) => ({
      versions: state.versions.map((v) =>
        v.id === versionId ? { ...v, name } : v
      ),
    })),

  // Script Notes actions
  addNote: (elementId, content, author = 'You') => {
    const id = generateId();
    const note: ScriptNote = {
      id,
      elementId,
      author,
      content,
      timestamp: new Date(),
      resolved: false,
    };
    set((state) => ({
      scriptNotes: [...state.scriptNotes, note],
    }));
    return id;
  },

  updateNote: (noteId, content) =>
    set((state) => ({
      scriptNotes: state.scriptNotes.map((n) =>
        n.id === noteId ? { ...n, content } : n
      ),
    })),

  deleteNote: (noteId) =>
    set((state) => ({
      scriptNotes: state.scriptNotes.filter((n) => n.id !== noteId),
    })),

  resolveNote: (noteId) =>
    set((state) => ({
      scriptNotes: state.scriptNotes.map((n) =>
        n.id === noteId ? { ...n, resolved: true } : n
      ),
    })),

  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
}));
