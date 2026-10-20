// Whole-project load/reset/serialize (cloud + local storage)
import type { StateCreator } from 'zustand';
import { DEFAULT_BEAT_STRUCTURE } from '../../types/screenplay';
import { createNewScreenplay } from '../../utils/fdx';
import { PROJECT_DATA_VERSION } from '../../types/user';
import { createDefaultProductionData, calculateWritingStats } from '../helpers';
import type { ScreenplayState, ProjectSlice } from '../types';

export const createProjectSlice: StateCreator<ScreenplayState, [], [], ProjectSlice> = (set, get) => ({
  // Project Data actions (for cloud storage)
  loadFromProjectData: (data) => {
    const stats = calculateWritingStats(data.screenplay);
    set({
      screenplay: data.screenplay,
      storyOutline: data.storyOutline || get().storyOutline,
      beatBoards: data.beatBoards || [],
      versions: data.versions || [],
      scriptNotes: data.scriptNotes || [],
      splitContent: data.splitContent || get().splitContent,
      breakdown: data.breakdown || null,
      artCart: data.artCart || null,
      viewFinder: data.viewFinder || null,
      schedule: data.schedule || null,
      onSet: data.onSet || null,
      superVisor: data.superVisor || null,
      productionData: data.productionData || createDefaultProductionData(),
      basecampView: 'dashboard',
      showSceneNumbers: data.showSceneNumbers ?? false,
      sceneNumberStyle: data.sceneNumberStyle || 'numeric',
      pageLocks: data.pageLocks || [],
      watermarkSettings: data.watermarkSettings || get().watermarkSettings,
      selectedElementId: data.screenplay.elements[0]?.id || null,
      isDirty: false,
      documentGeneration: get().documentGeneration + 1,
      documentOrigin: 'project',
      fileName: `${data.screenplay.title || 'Untitled'}.fdx`,
      stats,
      history: [],
      future: [],
    });
  },

  // Data merged from or pulled from a collaborator: same project, so the
  // selection, view, document generation and undo history stay
  applyProjectData: (data) => {
    const state = get();
    set({
      screenplay: data.screenplay,
      storyOutline: data.storyOutline || state.storyOutline,
      beatBoards: data.beatBoards || [],
      versions: data.versions || [],
      scriptNotes: data.scriptNotes || [],
      splitContent: data.splitContent || state.splitContent,
      breakdown: data.breakdown || null,
      artCart: data.artCart || null,
      viewFinder: data.viewFinder || null,
      schedule: data.schedule || null,
      onSet: data.onSet || null,
      superVisor: data.superVisor || null,
      productionData: data.productionData || state.productionData,
      showSceneNumbers: data.showSceneNumbers ?? state.showSceneNumbers,
      sceneNumberStyle: data.sceneNumberStyle || state.sceneNumberStyle,
      pageLocks: data.pageLocks || [],
      watermarkSettings: data.watermarkSettings || state.watermarkSettings,
      selectedElementId: data.screenplay.elements.some((e) => e.id === state.selectedElementId)
        ? state.selectedElementId
        : data.screenplay.elements[0]?.id || null,
      stats: calculateWritingStats(data.screenplay),
    });
  },

  resetToNew: () => {
    const newScript = createNewScreenplay();
    const stats = calculateWritingStats(newScript);
    set({
      screenplay: newScript,
      selectedElementId: newScript.elements[0]?.id || null,
      isDirty: false,
      documentGeneration: get().documentGeneration + 1,
      documentOrigin: 'project',
      fileName: 'Untitled.fdx',
      stats,
      currentPage: 1,
      history: [],
      future: [],
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
        beats: DEFAULT_BEAT_STRUCTURE.map((beat, index) => ({
          id: `beat-${index}`,
          name: beat.name,
          act: beat.act,
          description: '',
          linkedSceneId: undefined,
        })),
      },
      beatBoards: [],
      activeBeatBoardId: null,
      versions: [],
      activeVersionId: null,
      scriptNotes: [],
      splitContent: {
        audio: [],
        video: [],
        isIndependent: false,
        swapped: false,
      },
      breakdown: null,
      breakdownScenes: [],
      selectedBreakdownCategory: null,
      selectedBreakdownSceneId: null,
      artCart: null,
      selectedArtCartCategory: null,
      selectedArtCartItemId: null,
      artCartFilterStatus: 'All',
      viewFinder: null,
      selectedViewFinderSceneId: null,
      selectedShotId: null,
      viewFinderFilterStatus: 'All',
      schedule: null,
      selectedShootDayId: null,
      selectedStripId: null,
      onSet: null,
      superVisor: null,
      productionData: createDefaultProductionData(),
      basecampView: 'dashboard',
      showSceneNumbers: false,
      pageLocks: [],
    });
  },

  getProjectData: () => {
    const state = get();
    return {
      screenplay: state.screenplay,
      storyOutline: state.storyOutline,
      beatBoards: state.beatBoards,
      versions: state.versions,
      scriptNotes: state.scriptNotes,
      splitContent: state.splitContent,
      breakdown: state.breakdown || undefined,
      artCart: state.artCart || undefined,
      viewFinder: state.viewFinder || undefined,
      schedule: state.schedule || undefined,
      onSet: state.onSet || undefined,
      superVisor: state.superVisor || undefined,
      productionData: state.productionData,
      showSceneNumbers: state.showSceneNumbers,
      sceneNumberStyle: state.sceneNumberStyle,
      pageLocks: state.pageLocks,
      watermarkSettings: state.watermarkSettings,
      version: PROJECT_DATA_VERSION,
      savedAt: new Date(),
    };
  },
});
