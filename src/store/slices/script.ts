// ReWriter document: elements, undo/redo, file I/O, SmartType, scene numbers, page locks, watermark
import type { StateCreator } from 'zustand';
import type { ScreenplayElement, AutoCompleteSuggestion, PageLock } from '../../types/screenplay';
import { createNewScreenplay, generateId, parseFDX, generateFDX } from '../../utils/fdx';
import {
  extractCharactersFromScript,
  extractLocationsFromScript,
  mergeCharacterSources,
  getCharacterSuggestions,
  getLocationSuggestions,
  getExtensionSuggestions,
  getTimeOfDaySuggestions,
} from '../../utils/scriptParser';
import { calculateWritingStats, MAX_HISTORY } from '../helpers';
import type { HistoryEntry, ScreenplayState, ScriptSlice } from '../types';

export const createScriptSlice: StateCreator<ScreenplayState, [], [], ScriptSlice> = (set, get) => ({
  screenplay: createNewScreenplay(),
  selectedElementId: null,
  currentElementType: 'Scene Heading',
  isDirty: false,
  documentGeneration: 0,
  documentOrigin: 'project',
  fileName: 'Untitled.fdx',
  // Undo/Redo state
  history: [],
  future: [],
  historyIndex: -1,

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
      documentGeneration: get().documentGeneration + 1,
      documentOrigin: 'file',
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
        documentGeneration: get().documentGeneration + 1,
        documentOrigin: 'file',
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

  setDocumentOrigin: (origin) => set({ documentOrigin: origin }),

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
});
