// BaseCamp scheduling: strips, shoot days, shot packages, DOOD
import type { StateCreator } from 'zustand';
import type {
  Schedule,
  SceneStrip,
  ShotPackage,
  ShootDay,
  StripColor,
  DOODEntry,
  DOODStatus,
} from '../../types/screenplay';
import { STRIP_COLOR_MAP } from '../../types/screenplay';
import { generateId } from '../../utils/fdx';
import type { ScreenplayState, ScheduleSlice } from '../types';

export const createScheduleSlice: StateCreator<ScreenplayState, [], [], ScheduleSlice> = (set, get) => ({
  // BaseCamp state
  schedule: null,
  selectedShootDayId: null,
  selectedStripId: null,

  // ============================================
  // BASECAMP ACTIONS (Scheduling)
  // ============================================
  initializeSchedule: () => {
    const state = get();
    if (state.schedule) return;

    const schedule: Schedule = {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      strips: [],
      unscheduledStrips: [],
      shotPackages: [],
      unscheduledPackages: [],
      shootDays: [],
      dayBreaks: [],
      companyMoves: [],
      dood: [],
      totalShootDays: 0,
      defaultCallTime: '7:00 AM',
      defaultLunchDuration: 30,
      showLunchOnBoard: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ schedule, isDirty: true });
  },

  importStripsFromBreakdown: () => {
    const state = get();
    if (!state.schedule) {
      get().initializeSchedule();
    }

    // Convert breakdown scenes to strips
    const strips: SceneStrip[] = state.breakdownScenes.map(scene => {
      const colorKey = `${scene.intExt}-${scene.dayNight}`;
      const color = STRIP_COLOR_MAP[colorKey] || 'White';

      return {
        id: generateId(),
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        intExt: scene.intExt,
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        description: scene.description.substring(0, 50),
        pageCount: scene.eighths / 8,
        color: color as StripColor,
        castIds: scene.castIds,
        castNumbers: [],
        isLocked: false,
        hasStunts: false,
        hasVFX: false,
        hasSpecialEquipment: false,
      };
    });

    const stripIds = strips.map(s => s.id);

    set({
      schedule: {
        ...state.schedule!,
        strips,
        unscheduledStrips: stripIds,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  importProductionScenesAsStrips: () => {
    const state = get();
    if (!state.schedule) {
      get().initializeSchedule();
    }
    const currentSchedule = get().schedule!;
    const existingSceneIds = new Set(currentSchedule.strips.map(s => s.sceneId));

    // Convert production scenes to strips (skip already-imported ones)
    const newStrips: SceneStrip[] = state.productionData.scenes
      .filter(scene => !existingSceneIds.has(scene.id))
      .map(scene => {
        const dayNightMap: Record<string, string> = { 'Day': 'DAY', 'Night': 'NIGHT', 'Dawn': 'DAWN', 'Dusk': 'DUSK' };
        const colorKey = `${scene.intExt}-${dayNightMap[scene.dayNight] || 'DAY'}`;
        const color = STRIP_COLOR_MAP[colorKey] || 'White';

        return {
          id: generateId(),
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          intExt: scene.intExt,
          location: scene.set,
          timeOfDay: dayNightMap[scene.dayNight] || 'DAY',
          description: scene.description.substring(0, 50),
          pageCount: scene.pageCount,
          color: color as StripColor,
          castIds: scene.castIds,
          castNumbers: [],
          isLocked: false,
          hasStunts: false,
          hasVFX: false,
          hasSpecialEquipment: false,
        };
      });

    if (newStrips.length === 0) return;

    const newStripIds = newStrips.map(s => s.id);
    set({
      schedule: {
        ...currentSchedule,
        strips: [...currentSchedule.strips, ...newStrips],
        unscheduledStrips: [...currentSchedule.unscheduledStrips, ...newStripIds],
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  createShotPackagesFromViewFinder: () => {
    const state = get();
    if (!state.schedule || !state.viewFinder) return;

    // Group shots by scene
    const shotsByScene = new Map<string, typeof state.viewFinder.shots>();
    state.viewFinder.shots.forEach(shot => {
      const existing = shotsByScene.get(shot.sceneId) || [];
      shotsByScene.set(shot.sceneId, [...existing, shot]);
    });

    // Create one package per scene
    const packages: ShotPackage[] = [];
    shotsByScene.forEach((shots, sceneId) => {
      const scene = state.breakdownScenes.find(s => s.id === sceneId);
      if (!scene) return;

      packages.push({
        id: generateId(),
        name: `Scene ${scene.sceneNumber} Coverage`,
        sceneId,
        sceneNumber: scene.sceneNumber,
        shotIds: shots.map(s => s.id),
        estimatedDuration: shots.reduce((sum, s) => sum + (s.duration || 0), 0) / 60, // Convert to minutes
        equipment: [],
        castIds: scene.castIds,
      });
    });

    const packageIds = packages.map(p => p.id);

    set({
      schedule: {
        ...state.schedule,
        shotPackages: packages,
        unscheduledPackages: packageIds,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  addShootDay: () => {
    const state = get();
    if (!state.schedule) {
      get().initializeSchedule();
    }

    const id = generateId();
    const dayNumber = (state.schedule?.shootDays.length || 0) + 1;

    const newDay: ShootDay = {
      id,
      dayNumber,
      strips: [],
      shotPackages: [],
      callTime: state.schedule?.defaultCallTime || '7:00 AM',
      estimatedWrap: '7:00 PM',
      lunchDuration: state.schedule?.defaultLunchDuration || 30,
      isLocked: false,
      hasNightWork: false,
    };

    set({
      schedule: {
        ...state.schedule!,
        shootDays: [...state.schedule!.shootDays, newDay],
        totalShootDays: dayNumber,
        updatedAt: new Date(),
      },
      isDirty: true,
    });

    return id;
  },

  updateShootDay: (dayId, updates) => {
    const state = get();
    if (!state.schedule) return;

    const updatedDays = state.schedule.shootDays.map(day =>
      day.id === dayId ? { ...day, ...updates } : day
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteShootDay: (dayId) => {
    const state = get();
    if (!state.schedule) return;

    const day = state.schedule.shootDays.find(d => d.id === dayId);
    if (!day) return;

    // Move strips back to unscheduled
    const unassignedStrips = [...state.schedule.unscheduledStrips, ...day.strips];
    const unassignedPackages = [...state.schedule.unscheduledPackages, ...day.shotPackages];

    // Remove day and renumber
    const remainingDays = state.schedule.shootDays
      .filter(d => d.id !== dayId)
      .map((d, index) => ({ ...d, dayNumber: index + 1 }));

    set({
      schedule: {
        ...state.schedule,
        shootDays: remainingDays,
        unscheduledStrips: unassignedStrips,
        unscheduledPackages: unassignedPackages,
        totalShootDays: remainingDays.length,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  reorderShootDays: (dayIds) => {
    const state = get();
    if (!state.schedule) return;

    const reorderedDays = dayIds
      .map((id, index) => {
        const day = state.schedule!.shootDays.find(d => d.id === id);
        return day ? { ...day, dayNumber: index + 1 } : null;
      })
      .filter((d): d is ShootDay => d !== null);

    set({
      schedule: {
        ...state.schedule,
        shootDays: reorderedDays,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  updateStrip: (stripId, updates) => {
    const state = get();
    if (!state.schedule) return;

    const updatedStrips = state.schedule.strips.map(strip =>
      strip.id === stripId ? { ...strip, ...updates } : strip
    );

    set({
      schedule: {
        ...state.schedule,
        strips: updatedStrips,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  assignStripToDay: (stripId, dayId, position) => {
    const state = get();
    if (!state.schedule) return;

    const strip = state.schedule.strips.find(s => s.id === stripId);
    if (!strip || strip.isLocked) return;

    // Remove from current location
    const updatedDays = state.schedule.shootDays.map(day => ({
      ...day,
      strips: day.strips.filter(id => id !== stripId),
    }));

    // Add to target day
    const targetDay = updatedDays.find(d => d.id === dayId);
    if (targetDay) {
      if (position !== undefined) {
        targetDay.strips.splice(position, 0, stripId);
      } else {
        targetDay.strips.push(stripId);
      }
    }

    // Remove from unscheduled
    const unscheduledStrips = state.schedule.unscheduledStrips.filter(id => id !== stripId);

    // Update strip's scheduled day
    const updatedStrips = state.schedule.strips.map(s =>
      s.id === stripId ? { ...s, scheduledDayId: dayId } : s
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        strips: updatedStrips,
        unscheduledStrips,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  unassignStrip: (stripId) => {
    const state = get();
    if (!state.schedule) return;

    const strip = state.schedule.strips.find(s => s.id === stripId);
    if (!strip || strip.isLocked) return;

    // Remove from all days
    const updatedDays = state.schedule.shootDays.map(day => ({
      ...day,
      strips: day.strips.filter(id => id !== stripId),
    }));

    // Add to unscheduled
    const unscheduledStrips = [...state.schedule.unscheduledStrips, stripId];

    // Update strip
    const updatedStrips = state.schedule.strips.map(s =>
      s.id === stripId ? { ...s, scheduledDayId: undefined } : s
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        strips: updatedStrips,
        unscheduledStrips,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  reorderStripsInDay: (dayId, stripIds) => {
    const state = get();
    if (!state.schedule) return;

    const updatedDays = state.schedule.shootDays.map(day =>
      day.id === dayId ? { ...day, strips: stripIds } : day
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  lockStrip: (stripId, locked) => {
    const state = get();
    if (!state.schedule) return;

    const updatedStrips = state.schedule.strips.map(strip =>
      strip.id === stripId ? { ...strip, isLocked: locked } : strip
    );

    set({
      schedule: {
        ...state.schedule,
        strips: updatedStrips,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  createShotPackage: (sceneId, name, shotIds) => {
    const state = get();
    if (!state.schedule) {
      get().initializeSchedule();
    }

    const id = generateId();
    const scene = state.breakdownScenes.find(s => s.id === sceneId);

    const newPackage: ShotPackage = {
      id,
      name,
      sceneId,
      sceneNumber: scene?.sceneNumber || '',
      shotIds,
      estimatedDuration: 0,
      equipment: [],
      castIds: scene?.castIds || [],
    };

    set({
      schedule: {
        ...state.schedule!,
        shotPackages: [...state.schedule!.shotPackages, newPackage],
        unscheduledPackages: [...state.schedule!.unscheduledPackages, id],
        updatedAt: new Date(),
      },
      isDirty: true,
    });

    return id;
  },

  updateShotPackage: (packageId, updates) => {
    const state = get();
    if (!state.schedule) return;

    const updatedPackages = state.schedule.shotPackages.map(pkg =>
      pkg.id === packageId ? { ...pkg, ...updates } : pkg
    );

    set({
      schedule: {
        ...state.schedule,
        shotPackages: updatedPackages,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteShotPackage: (packageId) => {
    const state = get();
    if (!state.schedule) return;

    // Remove from days
    const updatedDays = state.schedule.shootDays.map(day => ({
      ...day,
      shotPackages: day.shotPackages.filter(id => id !== packageId),
    }));

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        shotPackages: state.schedule.shotPackages.filter(p => p.id !== packageId),
        unscheduledPackages: state.schedule.unscheduledPackages.filter(id => id !== packageId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  assignPackageToDay: (packageId, dayId, position) => {
    const state = get();
    if (!state.schedule) return;

    // Remove from current location
    const updatedDays = state.schedule.shootDays.map(day => ({
      ...day,
      shotPackages: day.shotPackages.filter(id => id !== packageId),
    }));

    // Add to target day
    const targetDay = updatedDays.find(d => d.id === dayId);
    if (targetDay) {
      if (position !== undefined) {
        targetDay.shotPackages.splice(position, 0, packageId);
      } else {
        targetDay.shotPackages.push(packageId);
      }
    }

    // Remove from unscheduled
    const unscheduledPackages = state.schedule.unscheduledPackages.filter(id => id !== packageId);

    // Update package
    const updatedPackages = state.schedule.shotPackages.map(p =>
      p.id === packageId ? { ...p, scheduledDayId: dayId } : p
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        shotPackages: updatedPackages,
        unscheduledPackages,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  unassignPackage: (packageId) => {
    const state = get();
    if (!state.schedule) return;

    // Remove from all days
    const updatedDays = state.schedule.shootDays.map(day => ({
      ...day,
      shotPackages: day.shotPackages.filter(id => id !== packageId),
    }));

    // Add to unscheduled
    const unscheduledPackages = [...state.schedule.unscheduledPackages, packageId];

    // Update package
    const updatedPackages = state.schedule.shotPackages.map(p =>
      p.id === packageId ? { ...p, scheduledDayId: undefined } : p
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        shotPackages: updatedPackages,
        unscheduledPackages,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  splitPackage: (packageId, shotIds, newName) => {
    const state = get();
    if (!state.schedule) return '';

    const originalPackage = state.schedule.shotPackages.find(p => p.id === packageId);
    if (!originalPackage) return '';

    const newId = generateId();

    // Create new package with selected shots
    const newPackage: ShotPackage = {
      id: newId,
      name: newName,
      sceneId: originalPackage.sceneId,
      sceneNumber: originalPackage.sceneNumber,
      shotIds,
      estimatedDuration: 0,
      equipment: originalPackage.equipment,
      castIds: originalPackage.castIds,
      splitFromPackageId: packageId,
    };

    // Remove shots from original package
    const updatedOriginal = {
      ...originalPackage,
      shotIds: originalPackage.shotIds.filter(id => !shotIds.includes(id)),
    };

    const updatedPackages = state.schedule.shotPackages.map(p =>
      p.id === packageId ? updatedOriginal : p
    );

    set({
      schedule: {
        ...state.schedule,
        shotPackages: [...updatedPackages, newPackage],
        unscheduledPackages: [...state.schedule.unscheduledPackages, newId],
        updatedAt: new Date(),
      },
      isDirty: true,
    });

    return newId;
  },

  updateDOOD: (castId, dayId, status) => {
    const state = get();
    if (!state.schedule) return;

    const day = state.schedule.shootDays.find(d => d.id === dayId);
    if (!day) return;

    const updatedDOOD = state.schedule.dood.map(entry => {
      if (entry.castId !== castId) return entry;

      const updatedStatuses = entry.dayStatuses.map(ds =>
        ds.dayId === dayId ? { ...ds, status } : ds
      );

      // Add if not exists
      if (!updatedStatuses.find(ds => ds.dayId === dayId)) {
        updatedStatuses.push({ dayId, dayNumber: day.dayNumber, status });
      }

      return { ...entry, dayStatuses: updatedStatuses };
    });

    set({
      schedule: {
        ...state.schedule,
        dood: updatedDOOD,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  recalculateDOOD: () => {
    const state = get();
    if (!state.schedule || !state.breakdown) return;

    // Get all cast from breakdown
    const allCast = state.breakdown.castList || [];

    // Build DOOD entries
    const dood: DOODEntry[] = allCast.map(cast => {
      const dayStatuses: DOODEntry['dayStatuses'] = state.schedule!.shootDays.map(day => {
        // Check if cast is needed in any strips scheduled for this day
        const isWorking = day.strips.some(stripId => {
          const strip = state.schedule!.strips.find(s => s.id === stripId);
          return strip?.castIds.includes(cast.id);
        });

        return {
          dayId: day.id,
          dayNumber: day.dayNumber,
          status: isWorking ? 'W' : '' as DOODStatus,
        };
      });

      return {
        castId: cast.id,
        castName: cast.actorName || cast.characterName,
        characterName: cast.characterName,
        dayStatuses,
      };
    });

    set({
      schedule: {
        ...state.schedule,
        dood,
        updatedAt: new Date(),
      },
    });
  },

  updateScheduleSettings: (settings) => {
    const state = get();
    if (!state.schedule) return;

    set({
      schedule: {
        ...state.schedule,
        ...settings,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  selectShootDay: (dayId) => set({ selectedShootDayId: dayId }),
  selectStrip: (stripId) => set({ selectedStripId: stripId }),
});
