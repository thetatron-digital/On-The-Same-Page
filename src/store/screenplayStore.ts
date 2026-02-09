import { create } from 'zustand';
import type {
  Screenplay, ScreenplayElement, ElementType, TextRun, TitlePageInfo,
  Beat, BeatBoard, ScriptVersion, ScriptNote,
  StoryOutline, PlotOverview, StoryCharacter, ActsOverview, StoryBeat,
  AutoCompleteState, ScriptCharacter, ScriptLocation, AutoCompleteSuggestion,
  PageLock, WatermarkSettings,
  Breakdown, BreakdownElement, BreakdownScene, BreakdownCategory,
  CustomCategory,
  ArtCart, ArtCartItem, Vendor, ShoppingList, SourcingStatus, ItemPriority
} from '../types/screenplay';
import { LINES_PER_PAGE, DEFAULT_BEAT_STRUCTURE } from '../types/screenplay';
import { createNewScreenplay, generateId, parseFDX, generateFDX, getPlainText } from '../utils/fdx';
import {
  extractCharactersFromScript,
  extractLocationsFromScript,
  mergeCharacterSources,
  getCharacterSuggestions,
  getLocationSuggestions,
  getExtensionSuggestions,
  getTimeOfDaySuggestions
} from '../utils/scriptParser';
import {
  generateBreakdownScenes,
  getElementsForScene,
} from '../utils/breakdown';

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

// View modes (within Re-writer app)
type ViewMode = 'script' | 'split';

// App modes (top-level application switching)
type AppMode = 'blueprint' | 'corkboard' | 'rewriter' | 'breakdown' | 'artcart';

// Split View content (independent from main script)
interface SplitEntry {
  id: string;
  text: string;
}

interface SplitContent {
  audio: SplitEntry[];
  video: SplitEntry[];
  isIndependent: boolean; // true = edit independently, false = sync from main script
  swapped: boolean; // true = video on left, audio on right
}

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
  activeApp: AppMode;
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

  // Split View
  splitContent: SplitContent;

  // Story Outline
  storyOutline: StoryOutline;

  // Auto-Complete / Smart Type
  autoComplete: AutoCompleteState;
  scriptCharacters: Map<string, ScriptCharacter>;
  scriptLocations: ScriptLocation[];

  // Scene Numbers
  showSceneNumbers: boolean;
  sceneNumberStyle: 'numeric' | 'alphanumeric'; // 1, 2, 3 or 1, 1A, 2, etc.

  // Page Locking
  pageLocks: PageLock[];

  // Watermark Settings
  watermarkSettings: WatermarkSettings;

  // Breakdown State
  breakdown: Breakdown | null;
  breakdownScenes: BreakdownScene[];
  selectedBreakdownCategory: BreakdownCategory | null;
  selectedBreakdownSceneId: string | null;

  // ArtCart State
  artCart: ArtCart | null;
  selectedArtCartCategory: string | null;
  selectedArtCartItemId: string | null;
  artCartFilterStatus: SourcingStatus | 'All';

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
  setActiveApp: (app: AppMode) => void;
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
  sendBeatToScript: (boardId: string, beatId: string) => string | undefined;

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

  // Split View actions
  toggleSplitIndependent: () => void;
  toggleSplitSwapped: () => void;
  updateSplitAudio: (entries: SplitEntry[]) => void;
  updateSplitVideo: (entries: SplitEntry[]) => void;
  addSplitEntry: (column: 'audio' | 'video', text?: string) => string;
  updateSplitEntry: (column: 'audio' | 'video', id: string, text: string) => void;
  deleteSplitEntry: (column: 'audio' | 'video', id: string) => void;

  // Story Outline actions
  updatePlotOverview: (updates: Partial<PlotOverview>) => void;
  addCharacter: () => string;
  updateCharacter: (id: string, updates: Partial<StoryCharacter>) => void;
  deleteCharacter: (id: string) => void;
  updateActs: (updates: Partial<ActsOverview>) => void;
  updateBeatContent: (beatId: string, description: string) => void;
  linkBeatToScene: (beatId: string, sceneId: string | undefined) => void;
  initializeBeats: () => void;
  addStoryBeat: (beat: StoryBeat) => void;

  // Auto-Complete / Smart Type actions
  refreshScriptData: () => void;
  openAutoComplete: (triggerType: 'character' | 'location' | 'extension' | 'timeofday', searchText: string, position: { x: number; y: number }) => void;
  closeAutoComplete: () => void;
  updateAutoCompleteSearch: (searchText: string) => void;
  selectAutoCompleteSuggestion: (index: number) => void;
  moveAutoCompleteSelection: (direction: 'up' | 'down') => void;
  getAutoCompleteSuggestions: () => AutoCompleteSuggestion[];

  // Scene Numbers actions
  toggleSceneNumbers: () => void;
  setSceneNumberStyle: (style: 'numeric' | 'alphanumeric') => void;
  generateSceneNumbers: () => void;
  clearSceneNumbers: () => void;

  // Page Locking actions
  lockPage: (pageNumber: number, color?: string) => void;
  unlockPage: (pageNumber: number) => void;
  isPageLocked: (pageNumber: number) => boolean;
  getPageLock: (pageNumber: number) => PageLock | undefined;

  // Watermark actions
  setWatermarkSettings: (settings: Partial<WatermarkSettings>) => void;
  toggleWatermark: () => void;

  // Dual Dialogue actions
  toggleDualDialogue: (characterElementId: string) => void;

  // Breakdown actions
  initializeBreakdown: () => void;
  refreshBreakdownScenes: () => void;
  selectBreakdownCategory: (category: BreakdownCategory | null) => void;
  selectBreakdownScene: (sceneId: string | null) => void;
  addBreakdownElement: (element: BreakdownElement) => void;
  updateBreakdownElement: (elementId: string, updates: Partial<BreakdownElement>) => void;
  deleteBreakdownElement: (elementId: string) => void;
  addCustomCategory: (category: CustomCategory) => void;
  getBreakdownElementsForScene: (sceneId: string) => BreakdownElement[];

  // ArtCart actions
  initializeArtCart: () => void;
  importFromBreakdown: () => void;
  addArtCartItem: (item: Omit<ArtCartItem, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateArtCartItem: (itemId: string, updates: Partial<ArtCartItem>) => void;
  deleteArtCartItem: (itemId: string) => void;
  setArtCartItemStatus: (itemId: string, status: SourcingStatus) => void;
  setArtCartItemPriority: (itemId: string, priority: ItemPriority) => void;
  addVendor: (vendor: Omit<Vendor, 'id'>) => string;
  updateVendor: (vendorId: string, updates: Partial<Vendor>) => void;
  deleteVendor: (vendorId: string) => void;
  createShoppingList: (name: string, itemIds: string[]) => string;
  updateShoppingList: (listId: string, updates: Partial<ShoppingList>) => void;
  deleteShoppingList: (listId: string) => void;
  selectArtCartCategory: (category: string | null) => void;
  selectArtCartItem: (itemId: string | null) => void;
  setArtCartFilterStatus: (status: SourcingStatus | 'All') => void;
  getArtCartItemsByCategory: (category: string) => ArtCartItem[];
  getArtCartItemsByStatus: (status: SourcingStatus) => ArtCartItem[];

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
  activeApp: 'rewriter',
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

  // Split View state
  splitContent: {
    audio: [{ id: generateId(), text: '' }],
    video: [{ id: generateId(), text: '' }],
    isIndependent: false,
    swapped: false,
  },

  // Story Outline state
  storyOutline: {
    plot: {
      title: '',
      logline: '',
      themes: '',
      storyTypes: [],
      genres: [],
      tones: [],
      audience: '',
      setting: '',
      bStory: '',
      otherDetails: '',
    },
    characters: [],
    acts: {
      act1: '',
      act2a: '',
      act2b: '',
      act3: '',
    },
    beats: [],
  },

  // Auto-Complete / Smart Type state
  autoComplete: {
    isOpen: false,
    suggestions: [],
    selectedIndex: 0,
    triggerType: null,
    searchText: '',
    position: { x: 0, y: 0 },
  },
  scriptCharacters: new Map(),
  scriptLocations: [],

  // Scene Numbers state
  showSceneNumbers: false,
  sceneNumberStyle: 'numeric',

  // Page Locking state
  pageLocks: [],

  // Watermark Settings state
  watermarkSettings: {
    enabled: false,
    text: 'DRAFT',
    opacity: 0.15,
    fontSize: 72,
    angle: -45,
    position: 'diagonal',
  },

  // Breakdown state
  breakdown: null,
  breakdownScenes: [],
  selectedBreakdownCategory: null,
  selectedBreakdownSceneId: null,

  // ArtCart state
  artCart: null,
  selectedArtCartCategory: null,
  selectedArtCartItemId: null,
  artCartFilterStatus: 'All',

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
    set((state) => {
      const newTitlePage = { ...state.screenplay.titlePage, ...titlePageUpdate };

      // If title is updated, sync to Blueprint plot title
      const outlineUpdates: Partial<{ storyOutline: typeof state.storyOutline }> = {};
      if (titlePageUpdate.title !== undefined) {
        outlineUpdates.storyOutline = {
          ...state.storyOutline,
          plot: { ...state.storyOutline.plot, title: titlePageUpdate.title },
        };
      }

      return {
        screenplay: {
          ...state.screenplay,
          titlePage: newTitlePage,
        },
        ...outlineUpdates,
        isDirty: true,
      };
    }),

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

  setActiveApp: (app) => set({ activeApp: app }),

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
    if (!beat) return undefined;

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

    return sceneId;
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

  // Split View actions
  toggleSplitIndependent: () =>
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        isIndependent: !state.splitContent.isIndependent,
      },
    })),

  toggleSplitSwapped: () =>
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        swapped: !state.splitContent.swapped,
      },
    })),

  updateSplitAudio: (entries) =>
    set((state) => ({
      splitContent: { ...state.splitContent, audio: entries },
    })),

  updateSplitVideo: (entries) =>
    set((state) => ({
      splitContent: { ...state.splitContent, video: entries },
    })),

  addSplitEntry: (column, text = '') => {
    const id = generateId();
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        [column]: [...state.splitContent[column], { id, text }],
      },
    }));
    return id;
  },

  updateSplitEntry: (column, id, text) =>
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        [column]: state.splitContent[column].map((entry) =>
          entry.id === id ? { ...entry, text } : entry
        ),
      },
    })),

  deleteSplitEntry: (column, id) =>
    set((state) => {
      const filtered = state.splitContent[column].filter((e) => e.id !== id);
      // Keep at least one empty entry
      const entries = filtered.length > 0 ? filtered : [{ id: generateId(), text: '' }];
      return {
        splitContent: {
          ...state.splitContent,
          [column]: entries,
        },
      };
    }),

  // Story Outline actions
  updatePlotOverview: (updates) =>
    set((state) => {
      const newPlot = { ...state.storyOutline.plot, ...updates };

      // If title is updated, sync to screenplay title page
      const screenplayUpdates: Partial<{ screenplay: typeof state.screenplay }> = {};
      if (updates.title !== undefined) {
        screenplayUpdates.screenplay = {
          ...state.screenplay,
          title: updates.title,
          titlePage: { ...state.screenplay.titlePage, title: updates.title },
        };
      }

      return {
        storyOutline: {
          ...state.storyOutline,
          plot: newPlot,
        },
        ...screenplayUpdates,
        isDirty: true,
      };
    }),

  addCharacter: () => {
    const id = generateId();
    const newCharacter: StoryCharacter = {
      id,
      name: '',
      role: 'Other',
      characterArc: 'Positive Arc',
      archetypes: [],
      physicalDescription: '',
      personality: '',
      want: '',
      need: '',
      lie: '',
      ghost: '',
      notes: '',
    };
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        characters: [...state.storyOutline.characters, newCharacter],
      },
      isDirty: true,
    }));
    return id;
  },

  updateCharacter: (id, updates) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        characters: state.storyOutline.characters.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      },
      isDirty: true,
    })),

  deleteCharacter: (id) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        characters: state.storyOutline.characters.filter((c) => c.id !== id),
      },
      isDirty: true,
    })),

  updateActs: (updates) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        acts: { ...state.storyOutline.acts, ...updates },
      },
      isDirty: true,
    })),

  updateBeatContent: (beatId, description) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        beats: state.storyOutline.beats.map((b) =>
          b.id === beatId ? { ...b, description } : b
        ),
      },
      isDirty: true,
    })),

  linkBeatToScene: (beatId, sceneId) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        beats: state.storyOutline.beats.map((b) =>
          b.id === beatId ? { ...b, linkedSceneId: sceneId } : b
        ),
      },
    })),

  initializeBeats: () =>
    set((state) => {
      // Only initialize if beats are empty
      if (state.storyOutline.beats.length > 0) return state;

      const beats: StoryBeat[] = DEFAULT_BEAT_STRUCTURE.map((template) => ({
        id: generateId(),
        name: template.name,
        act: template.act,
        description: '',
      }));

      return {
        storyOutline: {
          ...state.storyOutline,
          beats,
        },
      };
    }),

  addStoryBeat: (beat) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        beats: [...state.storyOutline.beats, beat],
      },
      isDirty: true,
    })),

  // Auto-Complete / Smart Type actions
  refreshScriptData: () => {
    const state = get();
    // Extract characters and locations from script
    const scriptChars = extractCharactersFromScript(state.screenplay.elements);
    // Merge with BluePrint characters
    const mergedChars = mergeCharacterSources(scriptChars, state.storyOutline.characters);
    const locations = extractLocationsFromScript(state.screenplay.elements);

    set({
      scriptCharacters: mergedChars,
      scriptLocations: locations,
    });
  },

  openAutoComplete: (triggerType, searchText, position) => {
    const state = get();
    // Generate suggestions based on trigger type
    let suggestions: AutoCompleteSuggestion[] = [];

    if (triggerType === 'character') {
      suggestions = getCharacterSuggestions(state.scriptCharacters, searchText);
    } else if (triggerType === 'location') {
      suggestions = getLocationSuggestions(state.scriptLocations, searchText);
    } else if (triggerType === 'extension') {
      suggestions = getExtensionSuggestions(searchText);
    } else if (triggerType === 'timeofday') {
      suggestions = getTimeOfDaySuggestions(searchText);
    }

    set({
      autoComplete: {
        isOpen: suggestions.length > 0,
        suggestions,
        selectedIndex: 0,
        triggerType,
        searchText,
        position,
      },
    });
  },

  closeAutoComplete: () =>
    set({
      autoComplete: {
        isOpen: false,
        suggestions: [],
        selectedIndex: 0,
        triggerType: null,
        searchText: '',
        position: { x: 0, y: 0 },
      },
    }),

  updateAutoCompleteSearch: (searchText) => {
    const state = get();
    const { triggerType } = state.autoComplete;

    if (!triggerType) return;

    let suggestions: AutoCompleteSuggestion[] = [];

    if (triggerType === 'character') {
      suggestions = getCharacterSuggestions(state.scriptCharacters, searchText);
    } else if (triggerType === 'location') {
      suggestions = getLocationSuggestions(state.scriptLocations, searchText);
    } else if (triggerType === 'extension') {
      suggestions = getExtensionSuggestions(searchText);
    } else if (triggerType === 'timeofday') {
      suggestions = getTimeOfDaySuggestions(searchText);
    }

    set({
      autoComplete: {
        ...state.autoComplete,
        suggestions,
        selectedIndex: 0,
        searchText,
        isOpen: suggestions.length > 0,
      },
    });
  },

  selectAutoCompleteSuggestion: (index) =>
    set((state) => ({
      autoComplete: {
        ...state.autoComplete,
        selectedIndex: Math.max(0, Math.min(index, state.autoComplete.suggestions.length - 1)),
      },
    })),

  moveAutoCompleteSelection: (direction) =>
    set((state) => {
      const { suggestions, selectedIndex } = state.autoComplete;
      if (suggestions.length === 0) return state;

      let newIndex = selectedIndex;
      if (direction === 'up') {
        newIndex = selectedIndex > 0 ? selectedIndex - 1 : suggestions.length - 1;
      } else {
        newIndex = selectedIndex < suggestions.length - 1 ? selectedIndex + 1 : 0;
      }

      return {
        autoComplete: {
          ...state.autoComplete,
          selectedIndex: newIndex,
        },
      };
    }),

  getAutoCompleteSuggestions: () => get().autoComplete.suggestions,

  // Scene Numbers actions
  toggleSceneNumbers: () => set((state) => ({ showSceneNumbers: !state.showSceneNumbers })),

  setSceneNumberStyle: (style) => set({ sceneNumberStyle: style }),

  generateSceneNumbers: () => {
    const state = get();
    let sceneCount = 0;

    const elements = state.screenplay.elements.map((el) => {
      if (el.type === 'Scene Heading') {
        sceneCount++;
        return { ...el, sceneNumber: String(sceneCount) };
      }
      return el;
    });

    set({
      screenplay: { ...state.screenplay, elements },
      showSceneNumbers: true,
      isDirty: true,
    });
  },

  clearSceneNumbers: () => {
    const state = get();
    const elements = state.screenplay.elements.map((el) => {
      if (el.type === 'Scene Heading') {
        const { sceneNumber, ...rest } = el;
        return rest as typeof el;
      }
      return el;
    });

    set({
      screenplay: { ...state.screenplay, elements },
      showSceneNumbers: false,
      isDirty: true,
    });
  },

  // Page Locking actions
  lockPage: (pageNumber, color = 'white') => {
    const state = get();
    const existingLock = state.pageLocks.find((l) => l.pageNumber === pageNumber);
    if (existingLock) return;

    const newLock: PageLock = {
      pageNumber,
      lockedAt: new Date(),
      color,
    };

    set({
      pageLocks: [...state.pageLocks, newLock],
      isDirty: true,
    });
  },

  unlockPage: (pageNumber) =>
    set((state) => ({
      pageLocks: state.pageLocks.filter((l) => l.pageNumber !== pageNumber),
      isDirty: true,
    })),

  isPageLocked: (pageNumber) => {
    const state = get();
    return state.pageLocks.some((l) => l.pageNumber === pageNumber);
  },

  getPageLock: (pageNumber) => {
    const state = get();
    return state.pageLocks.find((l) => l.pageNumber === pageNumber);
  },

  // Watermark actions
  setWatermarkSettings: (settings) =>
    set((state) => ({
      watermarkSettings: { ...state.watermarkSettings, ...settings },
    })),

  toggleWatermark: () =>
    set((state) => ({
      watermarkSettings: {
        ...state.watermarkSettings,
        enabled: !state.watermarkSettings.enabled,
      },
    })),

  // Dual Dialogue actions
  toggleDualDialogue: (characterElementId) => {
    const state = get();
    const elements = [...state.screenplay.elements];
    const charIndex = elements.findIndex((el) => el.id === characterElementId);

    if (charIndex === -1 || elements[charIndex].type !== 'Character') return;

    const charElement = elements[charIndex];
    const isCurrentlyDual = charElement.isDualDialogue;

    if (isCurrentlyDual) {
      // Turn off dual dialogue for this character and following dialogue
      let i = charIndex;
      while (i < elements.length) {
        const el = elements[i];
        if (el.type === 'Character' || el.type === 'Dialogue' || el.type === 'Parenthetical') {
          elements[i] = { ...el, isDualDialogue: false, dualDialoguePosition: undefined };
          // Stop if we hit the next character after processing current block
          if (el.type === 'Character' && i > charIndex) break;
        } else {
          break;
        }
        i++;
      }
    } else {
      // Turn on dual dialogue - mark this character block as 'right' (appears alongside previous)
      // The previous character block is implicitly 'left'
      let i = charIndex;
      while (i < elements.length) {
        const el = elements[i];
        if (el.type === 'Character' || el.type === 'Dialogue' || el.type === 'Parenthetical') {
          elements[i] = { ...el, isDualDialogue: true, dualDialoguePosition: 'right' };
          if (el.type === 'Character' && i > charIndex) break;
        } else {
          break;
        }
        i++;
      }

      // Mark previous character block as 'left'
      let j = charIndex - 1;
      while (j >= 0) {
        const el = elements[j];
        if (el.type === 'Character') {
          // Found the previous character, mark their block
          let k = j;
          while (k < charIndex) {
            const kEl = elements[k];
            if (kEl.type === 'Character' || kEl.type === 'Dialogue' || kEl.type === 'Parenthetical') {
              elements[k] = { ...kEl, isDualDialogue: true, dualDialoguePosition: 'left' };
            }
            k++;
          }
          break;
        }
        j--;
      }
    }

    state.saveToHistory();
    set({
      screenplay: { ...state.screenplay, elements },
      isDirty: true,
    });
  },

  // Breakdown actions
  initializeBreakdown: () => {
    const state = get();
    const scenes = generateBreakdownScenes(state.screenplay.elements);

    const breakdown: Breakdown = {
      id: generateId(),
      name: `Breakdown - ${state.screenplay.title || 'Untitled'}`,
      scriptVersionId: state.activeVersionId || 'main',
      versionInfo: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        createdAt: new Date(),
        lastSyncedAt: new Date(),
        missingElements: [],
        newScenes: [],
        syncStatus: 'current',
      },
      elements: [],
      scenes,
      customCategories: [],
      castList: [],
      locationsList: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({
      breakdown,
      breakdownScenes: scenes,
      selectedBreakdownSceneId: scenes[0]?.id || null,
    });
  },

  refreshBreakdownScenes: () => {
    const state = get();
    const scenes = generateBreakdownScenes(state.screenplay.elements);

    // Preserve existing element assignments
    const existingElements = state.breakdown?.elements || [];
    const updatedScenes = scenes.map(scene => ({
      ...scene,
      elements: existingElements
        .filter(el => el.sceneId === scene.id)
        .map(el => el.id),
    }));

    set({
      breakdownScenes: updatedScenes,
      breakdown: state.breakdown ? {
        ...state.breakdown,
        scenes: updatedScenes,
        versionInfo: {
          ...state.breakdown.versionInfo,
          lastSyncedAt: new Date(),
          syncStatus: 'current',
        },
        updatedAt: new Date(),
      } : null,
    });
  },

  selectBreakdownCategory: (category) => set({ selectedBreakdownCategory: category }),

  selectBreakdownScene: (sceneId) => set({ selectedBreakdownSceneId: sceneId }),

  addBreakdownElement: (element) => {
    const state = get();
    if (!state.breakdown) return;

    const newElements = [...state.breakdown.elements, element];

    // Update scene's element list
    const updatedScenes = state.breakdown.scenes.map(scene =>
      scene.id === element.sceneId
        ? { ...scene, elements: [...scene.elements, element.id] }
        : scene
    );

    set({
      breakdown: {
        ...state.breakdown,
        elements: newElements,
        scenes: updatedScenes,
        updatedAt: new Date(),
      },
      breakdownScenes: updatedScenes,
      isDirty: true,
    });
  },

  updateBreakdownElement: (elementId, updates) => {
    const state = get();
    if (!state.breakdown) return;

    const newElements = state.breakdown.elements.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    );

    set({
      breakdown: {
        ...state.breakdown,
        elements: newElements,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteBreakdownElement: (elementId) => {
    const state = get();
    if (!state.breakdown) return;

    const elementToDelete = state.breakdown.elements.find(el => el.id === elementId);
    const newElements = state.breakdown.elements.filter(el => el.id !== elementId);

    // Update scene's element list
    const updatedScenes = state.breakdown.scenes.map(scene =>
      scene.id === elementToDelete?.sceneId
        ? { ...scene, elements: scene.elements.filter(id => id !== elementId) }
        : scene
    );

    set({
      breakdown: {
        ...state.breakdown,
        elements: newElements,
        scenes: updatedScenes,
        updatedAt: new Date(),
      },
      breakdownScenes: updatedScenes,
      isDirty: true,
    });
  },

  addCustomCategory: (category) => {
    const state = get();
    if (!state.breakdown) return;

    set({
      breakdown: {
        ...state.breakdown,
        customCategories: [...state.breakdown.customCategories, category],
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  getBreakdownElementsForScene: (sceneId) => {
    const state = get();
    if (!state.breakdown) return [];
    return getElementsForScene(state.breakdown.elements, sceneId);
  },

  // ArtCart actions
  initializeArtCart: () => {
    const state = get();
    const artCart: ArtCart = {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [],
      vendors: [],
      shoppingLists: [],
      budgets: [],
      importedFromBreakdownId: state.breakdown?.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set({ artCart });
  },

  importFromBreakdown: () => {
    const state = get();
    if (!state.breakdown) return;

    // Art-related categories to import
    const artCategories = ['Props', 'Set Dressing', 'Greenery', 'Vehicles', 'Wardrobe', 'Makeup', 'Special Equipment'];

    // Filter breakdown elements to art categories
    const artElements = state.breakdown.elements.filter(el =>
      artCategories.includes(el.category)
    );

    // Create ArtCartItems from breakdown elements
    const newItems: ArtCartItem[] = artElements.map(el => ({
      id: generateId(),
      name: el.text,
      category: el.category,
      status: 'To Find' as SourcingStatus,
      priority: 'Medium' as ItemPriority,
      quantity: 1,
      sceneIds: [el.sceneId],
      breakdownElementId: el.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Merge with existing items (avoid duplicates by breakdownElementId)
    const existingIds = new Set(state.artCart?.items.map(i => i.breakdownElementId) || []);
    const uniqueNewItems = newItems.filter(item =>
      item.breakdownElementId && !existingIds.has(item.breakdownElementId)
    );

    const updatedArtCart: ArtCart = state.artCart ? {
      ...state.artCart,
      items: [...state.artCart.items, ...uniqueNewItems],
      importedFromBreakdownId: state.breakdown.id,
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: uniqueNewItems,
      vendors: [],
      shoppingLists: [],
      budgets: [],
      importedFromBreakdownId: state.breakdown.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
  },

  addArtCartItem: (itemData) => {
    const state = get();
    const id = generateId();
    const newItem: ArtCartItem = {
      ...itemData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedArtCart = state.artCart ? {
      ...state.artCart,
      items: [...state.artCart.items, newItem],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [newItem],
      vendors: [],
      shoppingLists: [],
      budgets: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
    return id;
  },

  updateArtCartItem: (itemId, updates) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId ? { ...item, ...updates, updatedAt: new Date() } : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteArtCartItem: (itemId) => {
    const state = get();
    if (!state.artCart) return;

    set({
      artCart: {
        ...state.artCart,
        items: state.artCart.items.filter(item => item.id !== itemId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  setArtCartItemStatus: (itemId, status) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId ? { ...item, status, updatedAt: new Date() } : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  setArtCartItemPriority: (itemId, priority) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId ? { ...item, priority, updatedAt: new Date() } : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  addVendor: (vendorData) => {
    const state = get();
    const id = generateId();
    const newVendor: Vendor = { ...vendorData, id };

    const updatedArtCart = state.artCart ? {
      ...state.artCart,
      vendors: [...state.artCart.vendors, newVendor],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [],
      vendors: [newVendor],
      shoppingLists: [],
      budgets: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
    return id;
  },

  updateVendor: (vendorId, updates) => {
    const state = get();
    if (!state.artCart) return;

    const updatedVendors = state.artCart.vendors.map(vendor =>
      vendor.id === vendorId ? { ...vendor, ...updates } : vendor
    );

    set({
      artCart: {
        ...state.artCart,
        vendors: updatedVendors,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteVendor: (vendorId) => {
    const state = get();
    if (!state.artCart) return;

    set({
      artCart: {
        ...state.artCart,
        vendors: state.artCart.vendors.filter(v => v.id !== vendorId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  createShoppingList: (name, itemIds) => {
    const state = get();
    const id = generateId();
    const newList: ShoppingList = {
      id,
      name,
      itemIds,
      status: 'Draft',
      createdAt: new Date(),
    };

    const updatedArtCart = state.artCart ? {
      ...state.artCart,
      shoppingLists: [...state.artCart.shoppingLists, newList],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [],
      vendors: [],
      shoppingLists: [newList],
      budgets: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
    return id;
  },

  updateShoppingList: (listId, updates) => {
    const state = get();
    if (!state.artCart) return;

    const updatedLists = state.artCart.shoppingLists.map(list =>
      list.id === listId ? { ...list, ...updates } : list
    );

    set({
      artCart: {
        ...state.artCart,
        shoppingLists: updatedLists,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteShoppingList: (listId) => {
    const state = get();
    if (!state.artCart) return;

    set({
      artCart: {
        ...state.artCart,
        shoppingLists: state.artCart.shoppingLists.filter(l => l.id !== listId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  selectArtCartCategory: (category) => set({ selectedArtCartCategory: category }),

  selectArtCartItem: (itemId) => set({ selectedArtCartItemId: itemId }),

  setArtCartFilterStatus: (status) => set({ artCartFilterStatus: status }),

  getArtCartItemsByCategory: (category) => {
    const state = get();
    if (!state.artCart) return [];
    return state.artCart.items.filter(item => item.category === category);
  },

  getArtCartItemsByStatus: (status) => {
    const state = get();
    if (!state.artCart) return [];
    return state.artCart.items.filter(item => item.status === status);
  },

  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
}));
