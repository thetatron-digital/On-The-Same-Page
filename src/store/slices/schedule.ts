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
import { stripColorFor } from '../../types/screenplay';
import { generateId } from '../../utils/fdx';
import type { ScreenplayState, ScheduleSlice, StripSortLevel } from '../types';
import type { StripboardSnapshot } from '../../types/screenplay';
import { shootDates } from '../../engine/schedule/calendar';
import { DEFAULT_DOOD_SETTINGS } from '../../engine/schedule/dood';
import { DEFAULT_RED_FLAG_NAMES, doodFlagClash } from '../../engine/schedule/redFlags';
import { autoDayBreaks, sortStrips, type SortLevel } from '../../engine/schedule/stripboard';

// Scheduled strips in board order (day by day)
const scheduledStripIds = (schedule: Schedule) => schedule.shootDays.flatMap((d) => d.strips);

// Give shoot days their numbers, and dates from the calendar if there is one
const stampDays = (schedule: Schedule): Schedule => {
  const dates = schedule.calendar ? shootDates(schedule.calendar, schedule.shootDays.length) : null;
  const shootDays = schedule.shootDays.map((day, i) => ({
    ...day,
    dayNumber: i + 1,
    ...(dates ? { date: new Date(`${dates[i]}T12:00:00`) } : {}),
  }));
  return {
    ...schedule,
    shootDays,
    totalShootDays: shootDays.length,
    ...(dates ? { startDate: shootDays[0]?.date, estimatedEndDate: shootDays[shootDays.length - 1]?.date } : {}),
    updatedAt: new Date(),
  };
};

// Point each strip at the day that holds it on the active board
const assignStripDays = (schedule: Schedule): Schedule => {
  const dayOf = new Map<string, { dayId: string; order: number }>();
  schedule.shootDays.forEach((d) => d.strips.forEach((id, order) => dayOf.set(id, { dayId: d.id, order })));
  return {
    ...schedule,
    strips: schedule.strips.map((s) => {
      const at = dayOf.get(s.id);
      return { ...s, scheduledDayId: at?.dayId, orderInDay: at?.order };
    }),
  };
};

const DEFAULT_BOARD_NAME = 'Main Board';

// Snapshot of the active board, for when another board becomes active
const snapshotActive = (schedule: Schedule): StripboardSnapshot => ({
  id: schedule.activeBoardId ?? 'board-main',
  name: schedule.activeBoardName ?? DEFAULT_BOARD_NAME,
  description: schedule.activeBoardDescription,
  shootDays: schedule.shootDays,
  unscheduledStrips: schedule.unscheduledStrips,
  calendar: schedule.calendar,
});

// Re-date days after they are added, removed or reordered
const restamp = (schedule: Schedule): Schedule => (schedule.calendar ? stampDays(schedule) : schedule);

// Put `groups` of strip ids into shoot days, reusing existing days in order
const fillDays = (schedule: Schedule, groups: string[][]): Schedule => {
  const template = (): ShootDay => ({
    id: generateId(),
    dayNumber: 0,
    strips: [],
    shotPackages: [],
    callTime: schedule.defaultCallTime || '7:00 AM',
    estimatedWrap: '7:00 PM',
    lunchDuration: schedule.defaultLunchDuration || 30,
    isLocked: false,
    hasNightWork: false,
  });
  const days = schedule.shootDays.map((d, i) => ({ ...d, strips: groups[i] ?? [] }));
  for (let i = days.length; i < groups.length; i++) days.push({ ...template(), strips: groups[i] });
  // Drop trailing days left with nothing scheduled
  while (days.length > 1 && days[days.length - 1].strips.length === 0 && days[days.length - 1].shotPackages.length === 0) {
    days.pop();
  }
  const dayOf = new Map<string, { dayId: string; order: number }>();
  days.forEach((d) => d.strips.forEach((id, order) => dayOf.set(id, { dayId: d.id, order })));
  const strips = schedule.strips.map((s) =>
    dayOf.has(s.id) ? { ...s, scheduledDayId: dayOf.get(s.id)!.dayId, orderInDay: dayOf.get(s.id)!.order } : s
  );
  return stampDays({ ...schedule, shootDays: days, strips });
};

const SORT_KEYS: Record<StripSortLevel['field'], (s: SceneStrip) => string | number | undefined> = {
  sceneNumber: (s) => s.sceneNumber,
  intExt: (s) => s.intExt,
  location: (s) => s.location,
  timeOfDay: (s) => s.timeOfDay,
  pageCount: (s) => s.pageCount,
  color: (s) => s.color,
  castCount: (s) => s.castIds.length,
  firstCast: (s) => (s.castNumbers.length ? Math.min(...s.castNumbers) : undefined),
};

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

  // Movie Magic model: one strip per breakdown sheet. Re-importing updates
  // existing strips in place (keeping their day and lock) and adds new
  // sheets to the Unscheduled area.
  importStripsFromBreakdown: () => {
    const state = get();
    if (!state.schedule) {
      get().initializeSchedule();
    }
    get().syncElements();
    const breakdown = get().breakdown;
    const schedule = get().schedule!;
    const records = new Map((breakdown?.elementList ?? []).map((e) => [e.id, e]));
    const existing = new Map(schedule.strips.map((s) => [s.sceneId, s]));

    const fromSheets = state.breakdownScenes.map((scene) => {
      const sheet = breakdown?.sheets?.[scene.id] ?? {};
      const tags = (breakdown?.elements ?? []).filter((t) => t.sceneId === scene.id);
      const cast = [...new Map(
        tags
          .filter((t) => t.category === 'Cast Members' && t.elementRefId && records.has(t.elementRefId))
          .map((t) => [t.elementRefId!, records.get(t.elementRefId!)!])
      ).values()].sort((a, b) => (Number(a.boardId) || Infinity) - (Number(b.boardId) || Infinity));
      const has = (category: string) => tags.some((t) => t.category === category);
      const fields = {
        sceneNumber: scene.sceneNumber,
        intExt: scene.intExt,
        location: sheet.set || scene.location,
        timeOfDay: scene.timeOfDay,
        description: (sheet.synopsis || scene.description).substring(0, 80),
        pageCount: scene.eighths / 8,
        color: stripColorFor(scene.intExt, scene.timeOfDay || scene.dayNight),
        castIds: cast.map((c) => c.id),
        castNumbers: cast.map((c) => Number(c.boardId)).filter((n) => !Number.isNaN(n)),
        hasStunts: has('Stunts'),
        hasVFX: has('Visual Effects'),
        hasSpecialEquipment: has('Special Equipment'),
      };
      const old = existing.get(scene.id);
      return old ? { ...old, ...fields } : { id: generateId(), sceneId: scene.id, isLocked: false, ...fields } as SceneStrip;
    });

    const sheetSceneIds = new Set(fromSheets.map((s) => s.sceneId));
    const strips = [...schedule.strips.filter((s) => !sheetSceneIds.has(s.sceneId)), ...fromSheets];
    const scheduled = new Set(schedule.shootDays.flatMap((d) => d.strips));
    const unscheduledStrips = [
      ...schedule.unscheduledStrips.filter((id) => strips.some((s) => s.id === id)),
      ...fromSheets.filter((s) => !scheduled.has(s.id) && !schedule.unscheduledStrips.includes(s.id)).map((s) => s.id),
    ];

    set({
      schedule: { ...schedule, strips, unscheduledStrips, updatedAt: new Date() },
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
        const color = stripColorFor(scene.intExt, scene.dayNight);

        return {
          id: generateId(),
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          intExt: scene.intExt,
          location: scene.set,
          timeOfDay: (scene.dayNight || 'Day').toUpperCase(),
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
      schedule: restamp({
        ...state.schedule!,
        shootDays: [...state.schedule!.shootDays, newDay],
        totalShootDays: dayNumber,
        updatedAt: new Date(),
      }),
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

    // Strips sent back to Unscheduled no longer belong to a day
    const released = new Set(day.strips);
    const strips = state.schedule.strips.map(s =>
      released.has(s.id) ? { ...s, scheduledDayId: undefined, orderInDay: undefined } : s
    );

    set({
      schedule: restamp({
        ...state.schedule,
        strips,
        shootDays: remainingDays,
        unscheduledStrips: unassignedStrips,
        unscheduledPackages: unassignedPackages,
        totalShootDays: remainingDays.length,
        updatedAt: new Date(),
      }),
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
      schedule: restamp({
        ...state.schedule,
        shootDays: reorderedDays,
        updatedAt: new Date(),
      }),
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

  setScheduleCalendar: (calendar) => {
    const state = get();
    if (!state.schedule) get().initializeSchedule();
    const schedule = get().schedule!;
    set({ schedule: stampDays({ ...schedule, calendar: calendar ?? undefined }), isDirty: true });
  },

  autoAssignDayBreaks: (options) => {
    const schedule = get().schedule;
    if (!schedule) return 'There is no schedule yet.';
    const ids = scheduledStripIds(schedule);
    if (ids.length === 0) return 'Schedule some strips first.';
    const byId = new Map(schedule.strips.map((s) => [s.id, s]));
    if (ids.some((id) => byId.get(id)?.isLocked)) return 'Unlock all scheduled strips before using Auto Day Breaks.';
    try {
      const groups = autoDayBreaks(
        ids.map((id) => ({ id, eighths: Math.round((byId.get(id)?.pageCount ?? 0) * 8) })),
        options
      );
      set({ schedule: fillDays(schedule, groups.map((g) => g.map((s) => s.id))), isDirty: true });
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Auto Day Breaks failed.';
    }
  },

  // Like Movie Magic, sorting removes all day breaks: the sorted strips
  // land on the first day, ready for Auto Day Breaks.
  sortScheduledStrips: (levels) => {
    const schedule = get().schedule;
    if (!schedule) return 'There is no schedule yet.';
    if (levels.length === 0) return 'Add at least one sort level.';
    const byId = new Map(schedule.strips.map((s) => [s.id, s]));
    const ids = scheduledStripIds(schedule);
    if (ids.some((id) => byId.get(id)?.isLocked)) return 'Unlock all scheduled strips before sorting.';
    const engineLevels: SortLevel<SceneStrip>[] = levels.map((l) => ({ key: SORT_KEYS[l.field], direction: l.direction }));
    const sorted = sortStrips(ids.map((id) => byId.get(id)!).filter(Boolean), engineLevels);
    set({ schedule: fillDays(schedule, [sorted.map((s) => s.id)]), isDirty: true });
    return null;
  },

  // Movie Magic's Insert Day Break: the strips after `stripId` start a new day
  insertDayBreakAfter: (stripId) => {
    const schedule = get().schedule;
    if (!schedule) return 'There is no schedule yet.';
    const dayIndex = schedule.shootDays.findIndex((d) => d.strips.includes(stripId));
    if (dayIndex < 0) return 'Select a scheduled strip first.';
    const day = schedule.shootDays[dayIndex];
    const cut = day.strips.indexOf(stripId) + 1;
    if (cut >= day.strips.length) return 'That strip already ends its day.';
    const moving = new Set(day.strips.slice(cut));
    const groups = schedule.shootDays.flatMap((d, i) =>
      i === dayIndex ? [d.strips.slice(0, cut), d.strips.slice(cut)] : [d.strips]
    );
    // Banners travel with the strip they sit before; end-of-day banners go to the new day
    const keep = (day.banners ?? []).filter((b) => b.beforeStripId && !moving.has(b.beforeStripId));
    const move = (day.banners ?? []).filter((b) => !b.beforeStripId || moving.has(b.beforeStripId));
    const newDay: ShootDay = {
      id: generateId(), dayNumber: 0, strips: [], shotPackages: [], banners: move,
      callTime: day.callTime, estimatedWrap: day.estimatedWrap, lunchDuration: day.lunchDuration,
      isLocked: false, hasNightWork: false,
    };
    const shootDays = [...schedule.shootDays];
    shootDays.splice(dayIndex, 1, { ...day, banners: keep }, newDay);
    set({ schedule: fillDays({ ...schedule, shootDays }, groups), isDirty: true });
    return null;
  },

  // Movie Magic's Delete All Day Breaks: every scheduled strip on one day
  deleteAllDayBreaks: () => {
    const schedule = get().schedule;
    if (!schedule) return 'There is no schedule yet.';
    const ids = scheduledStripIds(schedule);
    if (ids.length === 0) return 'Schedule some strips first.';
    // Banners from every day follow their strips onto the one day
    const banners = schedule.shootDays.flatMap((d) => d.banners ?? []);
    const shootDays = schedule.shootDays.map((d, i) => ({ ...d, banners: i === 0 ? banners : [] }));
    set({ schedule: fillDays({ ...schedule, shootDays }, [ids]), isDirty: true });
    return null;
  },

  addBanner: (dayId, text, options = {}) => {
    const schedule = get().schedule;
    if (!schedule) return null;
    const id = generateId();
    const banner = { id, text: text.trim() || 'BANNER', ...options };
    set({
      schedule: {
        ...schedule,
        shootDays: schedule.shootDays.map((d) => (d.id === dayId ? { ...d, banners: [...(d.banners ?? []), banner] } : d)),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    return id;
  },

  updateBanner: (dayId, bannerId, updates) => {
    const schedule = get().schedule;
    if (!schedule) return;
    set({
      schedule: {
        ...schedule,
        shootDays: schedule.shootDays.map((d) =>
          d.id === dayId ? { ...d, banners: (d.banners ?? []).map((b) => (b.id === bannerId ? { ...b, ...updates } : b)) } : d
        ),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteBanner: (dayId, bannerId) => {
    const schedule = get().schedule;
    if (!schedule) return;
    set({
      schedule: {
        ...schedule,
        shootDays: schedule.shootDays.map((d) =>
          d.id === dayId ? { ...d, banners: (d.banners ?? []).filter((b) => b.id !== bannerId) } : d
        ),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  // Stripboard Manager: a new board over the same strips, copying the
  // active board's days or starting with everything in the Boneyard
  createStripboard: (name, mode, description) => {
    if (!get().schedule) get().initializeSchedule();
    const schedule = get().schedule!;
    const id = generateId();
    const shootDays: ShootDay[] =
      mode === 'copy'
        ? schedule.shootDays.map((d) => ({ ...d, id: generateId(), banners: d.banners?.map((b) => ({ ...b, id: generateId() })) }))
        : [];
    const unscheduledStrips =
      mode === 'copy' ? [...schedule.unscheduledStrips] : schedule.strips.map((s) => s.id);
    const next: Schedule = {
      ...schedule,
      otherBoards: [...(schedule.otherBoards ?? []), snapshotActive(schedule)],
      activeBoardId: id,
      activeBoardName: name.trim() || 'New Board',
      activeBoardDescription: description,
      shootDays,
      unscheduledStrips,
      calendar: schedule.calendar, // new boards start on the active board's calendar
    };
    set({ schedule: stampDays(assignStripDays(next)), selectedShootDayId: null, selectedStripId: null, isDirty: true });
    return id;
  },

  switchStripboard: (boardId) => {
    const schedule = get().schedule;
    if (!schedule || boardId === (schedule.activeBoardId ?? 'board-main')) return;
    const target = schedule.otherBoards?.find((b) => b.id === boardId);
    if (!target) return;
    const next: Schedule = {
      ...schedule,
      otherBoards: [...(schedule.otherBoards ?? []).filter((b) => b.id !== boardId), snapshotActive(schedule)],
      activeBoardId: target.id,
      activeBoardName: target.name,
      activeBoardDescription: target.description,
      shootDays: target.shootDays,
      unscheduledStrips: target.unscheduledStrips,
      calendar: target.calendar,
    };
    set({ schedule: restamp(assignStripDays({ ...next, totalShootDays: target.shootDays.length })), selectedShootDayId: null, selectedStripId: null, isDirty: true });
  },

  renameStripboard: (boardId, name, description) => {
    const schedule = get().schedule;
    if (!schedule || !name.trim()) return;
    if (boardId === (schedule.activeBoardId ?? 'board-main')) {
      set({ schedule: { ...schedule, activeBoardName: name.trim(), activeBoardDescription: description, updatedAt: new Date() }, isDirty: true });
    } else {
      set({
        schedule: {
          ...schedule,
          otherBoards: (schedule.otherBoards ?? []).map((b) => (b.id === boardId ? { ...b, name: name.trim(), description } : b)),
          updatedAt: new Date(),
        },
        isDirty: true,
      });
    }
  },

  deleteStripboard: (boardId) => {
    const schedule = get().schedule;
    if (!schedule) return null;
    if (boardId === (schedule.activeBoardId ?? 'board-main')) return 'Switch to another board before deleting this one.';
    set({ schedule: { ...schedule, otherBoards: (schedule.otherBoards ?? []).filter((b) => b.id !== boardId), updatedAt: new Date() }, isDirty: true });
    return null;
  },

  // Movie Magic's "Move All Strips to Unscheduled"
  moveAllStripsToBoneyard: () => {
    const schedule = get().schedule;
    if (!schedule) return;
    const scheduled = scheduledStripIds(schedule);
    const next: Schedule = {
      ...schedule,
      shootDays: schedule.shootDays.map((d) => ({ ...d, strips: [] })),
      unscheduledStrips: [...schedule.unscheduledStrips, ...scheduled.filter((id) => !schedule.unscheduledStrips.includes(id))],
      updatedAt: new Date(),
    };
    set({ schedule: assignStripDays(next), isDirty: true });
  },

  addRedFlag: (flag) => {
    if (!get().schedule) get().initializeSchedule();
    const schedule = get().schedule!;
    const flags = schedule.redFlags ?? [];
    const clash = doodFlagClash(flags, flag);
    if (clash) return `${clash.name} is already set for this element on ${clash.date}. Only one Day Out of Days red flag per element per day.`;
    set({ schedule: { ...schedule, redFlags: [...flags, { ...flag, id: generateId() }], updatedAt: new Date() }, isDirty: true });
    return null;
  },

  updateRedFlag: (id, updates) => {
    const schedule = get().schedule;
    if (!schedule) return null;
    const flags = schedule.redFlags ?? [];
    const current = flags.find((f) => f.id === id);
    if (!current) return null;
    const clash = doodFlagClash(flags, { ...current, ...updates });
    if (clash) return `${clash.name} is already set for this element on ${clash.date}. Only one Day Out of Days red flag per element per day.`;
    set({ schedule: { ...schedule, redFlags: flags.map((f) => (f.id === id ? { ...f, ...updates } : f)), updatedAt: new Date() }, isDirty: true });
    return null;
  },

  deleteRedFlag: (id) => {
    const schedule = get().schedule;
    if (!schedule) return;
    set({ schedule: { ...schedule, redFlags: (schedule.redFlags ?? []).filter((f) => f.id !== id), updatedAt: new Date() }, isDirty: true });
  },

  addRedFlagName: (name) => {
    if (!get().schedule) get().initializeSchedule();
    const schedule = get().schedule!;
    const names = schedule.redFlagNames ?? DEFAULT_RED_FLAG_NAMES;
    if (!name.trim() || names.includes(name.trim())) return;
    set({ schedule: { ...schedule, redFlagNames: [...names, name.trim()], updatedAt: new Date() }, isDirty: true });
  },

  updateDOODSettings: (updates) => {
    const state = get();
    if (!state.schedule) get().initializeSchedule();
    const schedule = get().schedule!;
    const current = schedule.doodSettings ?? DEFAULT_DOOD_SETTINGS;
    set({
      schedule: { ...schedule, doodSettings: { ...current, ...updates }, updatedAt: new Date() },
      isDirty: true,
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
