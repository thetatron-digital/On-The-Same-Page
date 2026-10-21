// OnSet: live production board
import type { StateCreator } from 'zustand';
import type { OnSet, ProductionStatus, LunchStatus, DelayEntry, Schedule, ShootDay } from '../../types/screenplay';
import { clockFromMinutes, dayProgress, planDay } from '../../engine/schedule/dayPlan';
import { generateId } from '../../utils/fdx';
import type { ScreenplayState, OnSetSlice } from '../types';

// Lunch minutes so far today (still counting while on lunch)
function lunchTakenMinutes(lunch: LunchStatus | null): number {
  if (!lunch?.lunchStartedAt) return 0;
  if (lunch.actualDuration !== undefined) return lunch.actualDuration;
  return lunch.isOnLunch ? (Date.now() - new Date(lunch.lunchStartedAt).getTime()) / 60000 : 0;
}

// Scheduled wrap moved by how far ahead or behind the day is
function projectedWrap(schedule: Schedule, day: ShootDay, status: ProductionStatus, lunch: LunchStatus | null): string | null {
  if (!status.dayStartedAt) return null;
  const plan = planDay(day, new Map(schedule.strips.map(s => [s.id, s])), schedule.companyMoves, schedule.defaultLunchDuration ?? 60);
  const p = dayProgress(plan, new Set(status.completedStrips), new Date(status.dayStartedAt), new Date(), lunchTakenMinutes(lunch));
  return p.projectedWrapMinutes !== null ? clockFromMinutes(p.projectedWrapMinutes) : null;
}

export const createOnSetSlice: StateCreator<ScreenplayState, [], [], OnSetSlice> = (set, get) => ({
  // OnSet state
  onSet: null,

  // ONSET ACTIONS
  initializeOnSet: () => {
    const state = get();
    if (state.onSet) return;

    const onSet: OnSet = {
      productionStatus: null,
      displaySettings: {
        showLunchCountdown: state.schedule?.showLunchOnBoard ?? true,
        showProgressBar: true,
        showNextShot: true,
        showStoryboard: false,
        autoAdvance: true,
        fontSize: 'large',
      },
      viewMode: 'control',
      lunchStatus: null,
      delays: [],
      isLive: false,
    };

    set({ onSet, isDirty: true });
  },

  setOnSetViewMode: (mode) => {
    if (!get().onSet) get().initializeOnSet();
    // Read after initializing, so a fresh project doesn't crash here
    const state = get();

    set({
      onSet: {
        ...state.onSet!,
        viewMode: mode,
      },
    });
  },

  updateOnSetDisplaySettings: (settings) => {
    const state = get();
    if (!state.onSet) return;

    set({
      onSet: {
        ...state.onSet,
        displaySettings: {
          ...state.onSet.displaySettings,
          ...settings,
        },
      },
      isDirty: true,
    });
  },

  startProductionDay: (dayId) => {
    if (!get().onSet) get().initializeOnSet();
    // Read after initializing, so a fresh project doesn't crash here
    const state = get();

    const productionStatus: ProductionStatus = {
      currentDayId: dayId,
      currentStripIndex: 0,
      currentShotPackageIndex: 0,
      dayStartedAt: new Date(),
      completedStrips: [],
      completedPackages: [],
      actualTimes: [],
      aheadBehind: 0,
      lastUpdated: new Date(),
    };

    set({
      onSet: {
        ...state.onSet!,
        productionStatus,
        isLive: true,
      },
      isDirty: true,
    });
  },

  markStripComplete: (stripId) => {
    const state = get();
    const onSetState = state.onSet;
    const prodStatus = onSetState?.productionStatus;
    if (!onSetState || !prodStatus) return;

    const completedStrips = [...prodStatus.completedStrips, stripId];
    const currentDay = state.schedule?.shootDays.find(d => d.id === prodStatus.currentDayId);
    const nextIndex = currentDay ? currentDay.strips.indexOf(stripId) + 1 : prodStatus.currentStripIndex + 1;

    set({
      onSet: {
        ...onSetState,
        productionStatus: {
          ...prodStatus,
          completedStrips,
          currentStripIndex: nextIndex,
          lastUpdated: new Date(),
        },
      },
      isDirty: true,
    });
  },

  markStripInProgress: (stripId) => {
    const state = get();
    const onSetState = state.onSet;
    const prodStatus = onSetState?.productionStatus;
    if (!onSetState || !prodStatus) return;

    const currentDay = state.schedule?.shootDays.find(d => d.id === prodStatus.currentDayId);
    const stripIndex = currentDay ? currentDay.strips.indexOf(stripId) : 0;

    set({
      onSet: {
        ...onSetState,
        productionStatus: {
          ...prodStatus,
          currentStripIndex: stripIndex,
          currentSetupStartedAt: new Date(),
          lastUpdated: new Date(),
        },
      },
      isDirty: true,
    });
  },

  startLunch: () => {
    const state = get();
    if (!state.onSet) return;

    const lunchStatus: LunchStatus = {
      isOnLunch: true,
      lunchStartedAt: new Date(),
      scheduledDuration: state.schedule?.defaultLunchDuration || 30,
    };

    set({
      onSet: {
        ...state.onSet,
        lunchStatus,
      },
      isDirty: true,
    });
  },

  endLunch: () => {
    const state = get();
    if (!state.onSet?.lunchStatus) return;

    const startedAt = state.onSet.lunchStatus.lunchStartedAt;
    const actualDuration = startedAt
      ? Math.round((new Date().getTime() - new Date(startedAt).getTime()) / 60000)
      : 0;

    set({
      onSet: {
        ...state.onSet,
        lunchStatus: {
          ...state.onSet.lunchStatus,
          isOnLunch: false,
          actualDuration,
        },
      },
      isDirty: true,
    });
  },

  addDelay: (reason, category, notes) => {
    if (!get().onSet) get().initializeOnSet();
    // Read after initializing, so a fresh project doesn't crash here
    const state = get();

    const id = generateId();
    const delay: DelayEntry = {
      id,
      reason,
      category,
      notes,
      startedAt: new Date(),
    };

    set({
      onSet: {
        ...state.onSet!,
        delays: [...state.onSet!.delays, delay],
      },
      isDirty: true,
    });

    return id;
  },

  endDelay: (delayId) => {
    const state = get();
    if (!state.onSet) return;

    const delays = state.onSet.delays.map(d => {
      if (d.id === delayId && !d.endedAt) {
        const duration = Math.round((new Date().getTime() - new Date(d.startedAt).getTime()) / 60000);
        return { ...d, endedAt: new Date(), duration };
      }
      return d;
    });

    set({
      onSet: {
        ...state.onSet,
        delays,
      },
      isDirty: true,
    });
  },

  updateAheadBehind: () => {
    const state = get();
    const onSetState = state.onSet;
    const prodStatus = onSetState?.productionStatus;
    if (!onSetState || !prodStatus || !state.schedule) return;

    // Planned minutes of the scenes finished vs minutes worked (less lunch)
    const currentDay = state.schedule.shootDays.find(d => d.id === prodStatus.currentDayId);
    if (!currentDay || !prodStatus.dayStartedAt) return;
    const plan = planDay(currentDay, new Map(state.schedule.strips.map(s => [s.id, s])), state.schedule.companyMoves, state.schedule.defaultLunchDuration ?? 60);
    const aheadBehind = dayProgress(plan, new Set(prodStatus.completedStrips), new Date(prodStatus.dayStartedAt), new Date(), lunchTakenMinutes(onSetState.lunchStatus)).aheadMinutes;

    set({
      onSet: {
        ...onSetState,
        productionStatus: {
          ...prodStatus,
          aheadBehind,
          lastUpdated: new Date(),
        },
      },
    });
  },

  goLive: () => {
    if (!get().onSet) get().initializeOnSet();
    // Read after initializing, so a fresh project doesn't crash here
    const state = get();

    set({
      onSet: {
        ...state.onSet!,
        isLive: true,
      },
    });
  },

  goOffline: () => {
    const state = get();
    if (!state.onSet) return;

    set({
      onSet: {
        ...state.onSet,
        isLive: false,
      },
    });
  },

  getQuickStatus: () => {
    const state = get();
    const onSetState = state.onSet;
    const prodStatus = onSetState?.productionStatus;
    if (!onSetState || !prodStatus || !state.schedule) return null;

    const currentDay = state.schedule.shootDays.find(d => d.id === prodStatus.currentDayId);
    if (!currentDay) return null;

    const currentStripId = currentDay.strips[prodStatus.currentStripIndex];
    const currentStrip = state.schedule.strips.find(s => s.id === currentStripId);
    const nextStripId = currentDay.strips[prodStatus.currentStripIndex + 1];
    const nextStrip = nextStripId ? state.schedule.strips.find(s => s.id === nextStripId) : null;

    // Live: recomputed whenever the board asks (it refreshes every second)
    const aheadBehindNum = prodStatus.dayStartedAt
      ? dayProgress(
          planDay(currentDay, new Map(state.schedule.strips.map(s => [s.id, s])), state.schedule.companyMoves, state.schedule.defaultLunchDuration ?? 60),
          new Set(prodStatus.completedStrips), new Date(prodStatus.dayStartedAt), new Date(), lunchTakenMinutes(onSetState.lunchStatus)
        ).aheadMinutes
      : prodStatus.aheadBehind;
    const aheadBehind = aheadBehindNum >= 0 ? `+${aheadBehindNum} min` : `${aheadBehindNum} min`;

    // Calculate lunch countdown if on lunch
    let lunchCountdown: string | undefined;
    if (onSetState.lunchStatus?.isOnLunch && onSetState.lunchStatus.lunchStartedAt) {
      const elapsed = (new Date().getTime() - new Date(onSetState.lunchStatus.lunchStartedAt).getTime()) / 60000;
      const remaining = onSetState.lunchStatus.scheduledDuration - elapsed;
      if (remaining > 0) {
        const mins = Math.floor(remaining);
        const secs = Math.floor((remaining - mins) * 60);
        lunchCountdown = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    }

    return {
      currentScene: currentStrip ? `Scene ${currentStrip.sceneNumber}` : 'N/A',
      currentSetup: currentStrip ? `${currentStrip.intExt}. ${currentStrip.location}` : '',
      estimatedWrap: projectedWrap(state.schedule, currentDay, prodStatus, onSetState.lunchStatus) ?? currentDay.estimatedWrap,
      aheadBehind,
      nextUp: nextStrip ? `Scene ${nextStrip.sceneNumber}` : 'Wrap',
      isOnLunch: onSetState.lunchStatus?.isOnLunch || false,
      lunchCountdown,
    };
  },
});
