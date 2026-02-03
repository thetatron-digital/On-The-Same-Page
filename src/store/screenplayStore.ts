import { create } from 'zustand';
import type { Screenplay, ScreenplayElement, ElementType, TextRun } from '../types/screenplay';
import { createNewScreenplay, generateId, parseFDX, generateFDX } from '../utils/fdx';

interface ScreenplayState {
  screenplay: Screenplay;
  selectedElementId: string | null;
  currentElementType: ElementType;
  isDirty: boolean;
  fileName: string;
  darkMode: boolean;

  // Actions
  setScreenplay: (screenplay: Screenplay) => void;
  newScreenplay: () => void;
  setTitle: (title: string) => void;
  setAuthor: (author: string) => void;

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

  // Theme
  toggleDarkMode: () => void;
}

export const useScreenplayStore = create<ScreenplayState>((set, get) => ({
  screenplay: createNewScreenplay(),
  selectedElementId: null,
  currentElementType: 'Scene Heading',
  isDirty: false,
  fileName: 'Untitled.fdx',
  darkMode: true, // Default to dark mode

  setScreenplay: (screenplay) => set({ screenplay, isDirty: true }),

  newScreenplay: () => {
    const newScript = createNewScreenplay();
    set({
      screenplay: newScript,
      selectedElementId: newScript.elements[0]?.id || null,
      isDirty: false,
      fileName: 'Untitled.fdx',
    });
  },

  setTitle: (title) =>
    set((state) => ({
      screenplay: { ...state.screenplay, title },
      isDirty: true,
    })),

  setAuthor: (author) =>
    set((state) => ({
      screenplay: { ...state.screenplay, author },
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

    set({
      screenplay: { ...state.screenplay, elements },
      selectedElementId: newElement.id,
      isDirty: true,
    });

    return newElement.id;
  },

  updateElement: (id, content) =>
    set((state) => {
      const elements = state.screenplay.elements.map((el) =>
        el.id === id ? { ...el, content } : el
      );
      return {
        screenplay: { ...state.screenplay, elements },
        isDirty: true,
      };
    }),

  updateElementType: (id, type) =>
    set((state) => {
      const elements = state.screenplay.elements.map((el) =>
        el.id === id ? { ...el, type } : el
      );
      return {
        screenplay: { ...state.screenplay, elements },
        currentElementType: type,
        isDirty: true,
      };
    }),

  deleteElement: (id) =>
    set((state) => {
      const elements = state.screenplay.elements.filter((el) => el.id !== id);

      // Ensure there's always at least one element
      if (elements.length === 0) {
        elements.push({
          id: generateId(),
          type: 'Scene Heading',
          content: [{ text: '' }],
        });
      }

      // Update selection
      let newSelectedId = state.selectedElementId;
      if (state.selectedElementId === id) {
        const deletedIndex = state.screenplay.elements.findIndex((el) => el.id === id);
        if (deletedIndex > 0) {
          newSelectedId = elements[deletedIndex - 1]?.id || elements[0]?.id;
        } else {
          newSelectedId = elements[0]?.id;
        }
      }

      return {
        screenplay: { ...state.screenplay, elements },
        selectedElementId: newSelectedId,
        isDirty: true,
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

    // Merge content
    const mergedContent = [
      ...previousElement.content,
      ...currentElement.content,
    ];

    elements[index - 1] = {
      ...previousElement,
      content: mergedContent,
    };

    elements.splice(index, 1);

    set({
      screenplay: { ...state.screenplay, elements },
      selectedElementId: previousElement.id,
      isDirty: true,
    });

    return previousElement.id;
  },

  loadFromFDX: (content) => {
    try {
      const screenplay = parseFDX(content);
      set({
        screenplay,
        selectedElementId: screenplay.elements[0]?.id || null,
        isDirty: false,
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

  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
}));
