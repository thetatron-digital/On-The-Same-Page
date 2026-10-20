// ViewFinder: shots, storyboards, camera packages, coverage
import type { StateCreator } from 'zustand';
import type {
  ViewFinder,
  Shot,
  Storyboard,
  StoryboardFrame,
  CameraPackage,
  SceneCoverage,
} from '../../types/screenplay';
import { generateId } from '../../utils/fdx';
import type { ScreenplayState, ViewFinderSlice } from '../types';

export const createViewFinderSlice: StateCreator<ScreenplayState, [], [], ViewFinderSlice> = (set, get) => ({
  // ViewFinder state
  viewFinder: null,
  selectedViewFinderSceneId: null,
  selectedShotId: null,
  viewFinderFilterStatus: 'All',

  // ============================================
  // VIEWFINDER ACTIONS
  // ============================================
  initializeViewFinder: () => {
    const state = get();
    if (state.viewFinder) return;

    const viewFinder: ViewFinder = {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      shots: [],
      storyboards: [],
      cameraPackages: [],
      sceneCoverage: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ viewFinder, isDirty: true });
  },

  importScenesForViewFinder: () => {
    const state = get();
    if (!state.viewFinder) {
      get().initializeViewFinder();
    }

    // Get scenes from breakdown or directly from screenplay
    const scenes = state.breakdownScenes.length > 0
      ? state.breakdownScenes
      : [];

    // Create scene coverage entries for each scene
    const sceneCoverage: SceneCoverage[] = scenes.map(scene => ({
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      shotCount: 0,
      completedShots: 0,
      estimatedDuration: 0,
      coverageComplete: false,
    }));

    set({
      viewFinder: {
        ...state.viewFinder!,
        sceneCoverage,
        importedFromBreakdownId: state.breakdown?.id,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  checkViewFinderScriptSync: () => {
    const state = get();
    if (!state.viewFinder) return;

    const latestVersionId = state.activeVersionId || 'main';
    const isOutdated = state.viewFinder.scriptSync.scriptVersionId !== latestVersionId;

    set({
      viewFinder: {
        ...state.viewFinder,
        scriptSync: {
          ...state.viewFinder.scriptSync,
          isOutdated,
          latestVersionId: isOutdated ? latestVersionId : undefined,
          latestVersionName: isOutdated ? 'Latest' : undefined,
        },
      },
    });
  },

  addShot: (shot) => {
    const state = get();
    const id = generateId();

    const newShot: Shot = {
      ...shot,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedViewFinder = state.viewFinder ? {
      ...state.viewFinder,
      shots: [...state.viewFinder.shots, newShot],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      shots: [newShot],
      storyboards: [],
      cameraPackages: [],
      sceneCoverage: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ viewFinder: updatedViewFinder, isDirty: true });
    get().calculateSceneCoverage();
    return id;
  },

  updateShot: (shotId, updates) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedShots = state.viewFinder.shots.map(shot =>
      shot.id === shotId ? { ...shot, ...updates, updatedAt: new Date() } : shot
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        shots: updatedShots,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    get().calculateSceneCoverage();
  },

  deleteShot: (shotId) => {
    const state = get();
    if (!state.viewFinder) return;

    set({
      viewFinder: {
        ...state.viewFinder,
        shots: state.viewFinder.shots.filter(shot => shot.id !== shotId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    get().calculateSceneCoverage();
  },

  setShotStatus: (shotId, status) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedShots = state.viewFinder.shots.map(shot =>
      shot.id === shotId ? { ...shot, status, updatedAt: new Date() } : shot
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        shots: updatedShots,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    get().calculateSceneCoverage();
  },

  reorderShots: (sceneId, shotIds) => {
    const state = get();
    if (!state.viewFinder) return;

    const sceneShots = state.viewFinder.shots.filter(s => s.sceneId === sceneId);
    const otherShots = state.viewFinder.shots.filter(s => s.sceneId !== sceneId);

    // Reorder scene shots based on shotIds array
    const reorderedSceneShots = shotIds
      .map((id, index) => {
        const shot = sceneShots.find(s => s.id === id);
        return shot ? { ...shot, priority: index + 1 } : null;
      })
      .filter((s): s is Shot => s !== null);

    set({
      viewFinder: {
        ...state.viewFinder,
        shots: [...otherShots, ...reorderedSceneShots],
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  duplicateShot: (shotId) => {
    const state = get();
    if (!state.viewFinder) return '';

    const sourceShot = state.viewFinder.shots.find(s => s.id === shotId);
    if (!sourceShot) return '';

    const id = generateId();
    const newShot: Shot = {
      ...sourceShot,
      id,
      shotNumber: sourceShot.shotNumber + '-copy',
      status: 'Planned',
      takes: undefined,
      selectedTake: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({
      viewFinder: {
        ...state.viewFinder,
        shots: [...state.viewFinder.shots, newShot],
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    get().calculateSceneCoverage();
    return id;
  },

  createStoryboard: (sceneId, sceneNumber) => {
    const state = get();
    const id = generateId();

    const newStoryboard: Storyboard = {
      id,
      sceneId,
      sceneNumber,
      frames: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedViewFinder = state.viewFinder ? {
      ...state.viewFinder,
      storyboards: [...state.viewFinder.storyboards, newStoryboard],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      shots: [],
      storyboards: [newStoryboard],
      cameraPackages: [],
      sceneCoverage: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ viewFinder: updatedViewFinder, isDirty: true });
    return id;
  },

  addStoryboardFrame: (storyboardId, frame) => {
    const state = get();
    if (!state.viewFinder) return '';

    const id = generateId();
    const newFrame: StoryboardFrame = {
      ...frame,
      id,
    };

    const updatedStoryboards = state.viewFinder.storyboards.map(sb =>
      sb.id === storyboardId
        ? { ...sb, frames: [...sb.frames, newFrame], updatedAt: new Date() }
        : sb
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        storyboards: updatedStoryboards,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    return id;
  },

  updateStoryboardFrame: (storyboardId, frameId, updates) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedStoryboards = state.viewFinder.storyboards.map(sb => {
      if (sb.id !== storyboardId) return sb;

      return {
        ...sb,
        frames: sb.frames.map(f =>
          f.id === frameId ? { ...f, ...updates } : f
        ),
        updatedAt: new Date(),
      };
    });

    set({
      viewFinder: {
        ...state.viewFinder,
        storyboards: updatedStoryboards,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteStoryboardFrame: (storyboardId, frameId) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedStoryboards = state.viewFinder.storyboards.map(sb => {
      if (sb.id !== storyboardId) return sb;

      return {
        ...sb,
        frames: sb.frames.filter(f => f.id !== frameId),
        updatedAt: new Date(),
      };
    });

    set({
      viewFinder: {
        ...state.viewFinder,
        storyboards: updatedStoryboards,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  reorderStoryboardFrames: (storyboardId, frameIds) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedStoryboards = state.viewFinder.storyboards.map(sb => {
      if (sb.id !== storyboardId) return sb;

      const reorderedFrames = frameIds
        .map((id, index) => {
          const frame = sb.frames.find(f => f.id === id);
          return frame ? { ...frame, order: index + 1 } : null;
        })
        .filter((f): f is StoryboardFrame => f !== null);

      return {
        ...sb,
        frames: reorderedFrames,
        updatedAt: new Date(),
      };
    });

    set({
      viewFinder: {
        ...state.viewFinder,
        storyboards: updatedStoryboards,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  linkFrameToShot: (storyboardId, frameId, shotId) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedStoryboards = state.viewFinder.storyboards.map(sb => {
      if (sb.id !== storyboardId) return sb;

      return {
        ...sb,
        frames: sb.frames.map(f =>
          f.id === frameId ? { ...f, shotId } : f
        ),
        updatedAt: new Date(),
      };
    });

    set({
      viewFinder: {
        ...state.viewFinder,
        storyboards: updatedStoryboards,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  addCameraPackage: (pkg) => {
    const state = get();
    const id = generateId();

    const newPackage: CameraPackage = {
      ...pkg,
      id,
    };

    const updatedViewFinder = state.viewFinder ? {
      ...state.viewFinder,
      cameraPackages: [...state.viewFinder.cameraPackages, newPackage],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      shots: [],
      storyboards: [],
      cameraPackages: [newPackage],
      sceneCoverage: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ viewFinder: updatedViewFinder, isDirty: true });
    return id;
  },

  updateCameraPackage: (packageId, updates) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedPackages = state.viewFinder.cameraPackages.map(pkg =>
      pkg.id === packageId ? { ...pkg, ...updates } : pkg
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        cameraPackages: updatedPackages,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteCameraPackage: (packageId) => {
    const state = get();
    if (!state.viewFinder) return;

    set({
      viewFinder: {
        ...state.viewFinder,
        cameraPackages: state.viewFinder.cameraPackages.filter(pkg => pkg.id !== packageId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  updateSceneCoverage: (sceneId, updates) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedCoverage = state.viewFinder.sceneCoverage.map(sc =>
      sc.sceneId === sceneId ? { ...sc, ...updates } : sc
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        sceneCoverage: updatedCoverage,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  markSceneCoverageComplete: (sceneId, complete) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedCoverage = state.viewFinder.sceneCoverage.map(sc =>
      sc.sceneId === sceneId ? { ...sc, coverageComplete: complete } : sc
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        sceneCoverage: updatedCoverage,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  calculateSceneCoverage: () => {
    const state = get();
    if (!state.viewFinder) return;

    // Group shots by scene
    const shotsByScene = new Map<string, Shot[]>();
    state.viewFinder.shots.forEach(shot => {
      const existing = shotsByScene.get(shot.sceneId) || [];
      shotsByScene.set(shot.sceneId, [...existing, shot]);
    });

    // Update coverage for each scene
    const updatedCoverage = state.viewFinder.sceneCoverage.map(sc => {
      const sceneShots = shotsByScene.get(sc.sceneId) || [];
      const completedShots = sceneShots.filter(s => s.status === 'Completed').length;
      const estimatedDuration = sceneShots.reduce((sum, s) => sum + (s.duration || 0), 0);

      return {
        ...sc,
        shotCount: sceneShots.length,
        completedShots,
        estimatedDuration,
      };
    });

    set({
      viewFinder: {
        ...state.viewFinder,
        sceneCoverage: updatedCoverage,
      },
    });
  },

  selectViewFinderScene: (sceneId) => set({ selectedViewFinderSceneId: sceneId }),
  selectShot: (shotId) => set({ selectedShotId: shotId }),
  setViewFinderFilterStatus: (status) => set({ viewFinderFilterStatus: status }),

  getShotsByScene: (sceneId) => {
    const state = get();
    if (!state.viewFinder) return [];
    return state.viewFinder.shots
      .filter(s => s.sceneId === sceneId)
      .sort((a, b) => a.priority - b.priority);
  },

  getShotsByStatus: (status) => {
    const state = get();
    if (!state.viewFinder) return [];
    return state.viewFinder.shots.filter(s => s.status === status);
  },
});
