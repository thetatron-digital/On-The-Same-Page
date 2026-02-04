import { create } from 'zustand';
import type { Screenplay, ScreenplayElement, ElementType, TextRun, TitlePageInfo } from '../types/screenplay';
import { LINES_PER_PAGE } from '../types/screenplay';
import { createNewScreenplay, generateId, parseFDX, generateFDX, getPlainText } from '../utils/fdx';

// Panel visibility options
interface PanelState {
  navigator: boolean;
  elements: boolean;
  writingStats: boolean;
  titlePage: boolean;
}

// View modes
type ViewMode = 'script' | 'outline' | 'split';

// Writing statistics
interface WritingStats {
  pageCount: number;
  wordCount: number;
  characterCount: number;
  sceneCount: number;
  dialogueCount: number;
  estimatedRuntime: string; // e.g., "1h 32m"
}

interface ScreenplayState {
  screenplay: Screenplay;
  selectedElementId: string | null;
  currentElementType: ElementType;
  isDirty: boolean;
  fileName: string;
  darkMode: boolean;

  // UI State
  zoom: number;
  viewMode: ViewMode;
  panels: PanelState;
  stats: WritingStats;
  currentPage: number;
  cursorLine: number;

  // Actions
  setScreenplay: (screenplay: Screenplay) => void;
  newScreenplay: () => void;
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
  setCurrentPage: (page: number) => void;
  setCursorLine: (line: number) => void;
  calculateStats: () => void;

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

export const useScreenplayStore = create<ScreenplayState>((set, get) => ({
  screenplay: createNewScreenplay(),
  selectedElementId: null,
  currentElementType: 'Scene Heading',
  isDirty: false,
  fileName: 'Untitled.fdx',
  darkMode: true,

  // UI State defaults
  zoom: 100,
  viewMode: 'script',
  panels: {
    navigator: false,
    elements: false,
    writingStats: false,
    titlePage: false,
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

  setScreenplay: (screenplay) => {
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

  deleteElement: (id) =>
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
    }),

  selectElement: (id) => set({ selectedElementId: id }),

  setCurrentElementType: (type) => set({ currentElementType: type }),

  mergeWithPrevious: (id) => {
    const state = get();
    const elements = [...state.screenplay.elements];
    const index = elements.findIndex((el) => el.id === id);

    if (index <= 0) return null;

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

  setCurrentPage: (page) => set({ currentPage: page }),

  setCursorLine: (line) => set({ cursorLine: line }),

  calculateStats: () =>
    set((state) => ({
      stats: calculateWritingStats(state.screenplay),
    })),

  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
}));
