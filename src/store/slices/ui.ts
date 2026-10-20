// App shell: active app, zoom, panels, theme, writing stats
import type { StateCreator } from 'zustand';
import type { ThemeId } from '../../types/screenplay';
import { calculateWritingStats } from '../helpers';
import type { ScreenplayState, UiSlice } from '../types';

export const createUiSlice: StateCreator<ScreenplayState, [], [], UiSlice> = (set) => ({
  darkMode: true,
  activeTheme: 'default',

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

  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

  setTheme: (themeId: ThemeId) => set(() => ({ activeTheme: themeId })),
});
