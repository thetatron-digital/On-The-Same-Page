// BreakDown: tagging and breakdown scenes
import type { StateCreator } from 'zustand';
import type { Breakdown } from '../../types/screenplay';
import { generateId } from '../../utils/fdx';
import { generateBreakdownScenes, getElementsForScene } from '../../utils/breakdown';
import { deleteElement, mergeElements, renumberBoardIds, syncElementList } from '../../utils/elements';
import type { ScreenplayState, BreakdownSlice } from '../types';

export const createBreakdownSlice: StateCreator<ScreenplayState, [], [], BreakdownSlice> = (set, get) => ({
  // Breakdown state
  breakdown: null,
  breakdownScenes: [],
  selectedBreakdownCategory: null,
  selectedBreakdownSceneId: null,

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
      // Every new tag joins (or creates) its master element
      breakdown: syncElementList({
        ...state.breakdown,
        elements: newElements,
        scenes: updatedScenes,
        updatedAt: new Date(),
      }),
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

  updateBreakdownSheet: (sceneId, updates) => {
    const { breakdown } = get();
    if (!breakdown) return;
    const sheets = breakdown.sheets ?? {};
    set({
      breakdown: { ...breakdown, sheets: { ...sheets, [sceneId]: { ...sheets[sceneId], ...updates } }, updatedAt: new Date() },
      isDirty: true,
    });
  },

  syncElements: () => {
    const { breakdown } = get();
    if (!breakdown) return;
    const synced = syncElementList(breakdown);
    if (synced !== breakdown) set({ breakdown: synced });
  },

  updateElementRecord: (id, updates) => {
    const { breakdown } = get();
    if (!breakdown) return;
    set({
      breakdown: {
        ...breakdown,
        elementList: (breakdown.elementList ?? []).map((e) => (e.id === id ? { ...e, ...updates } : e)),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  mergeElementRecords: (targetId, sourceIds) => {
    const { breakdown } = get();
    if (!breakdown) return;
    set({ breakdown: { ...mergeElements(breakdown, targetId, sourceIds), updatedAt: new Date() }, isDirty: true });
  },

  renumberElementBoardIds: (category) => {
    const { breakdown, breakdownScenes } = get();
    if (!breakdown) return;
    // Script order first; scenes only known to the saved breakdown go last
    const known = new Set(breakdownScenes.map((sc) => sc.id));
    const scenes = [...breakdownScenes, ...breakdown.scenes.filter((sc) => !known.has(sc.id))];
    set({ breakdown: { ...renumberBoardIds(syncElementList(breakdown), scenes, category), updatedAt: new Date() }, isDirty: true });
  },

  deleteElementRecord: (id) => {
    const { breakdown } = get();
    if (!breakdown) return;
    const next = deleteElement(breakdown, id);
    set({ breakdown: { ...next, updatedAt: new Date() }, breakdownScenes: next.scenes, isDirty: true });
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
});
