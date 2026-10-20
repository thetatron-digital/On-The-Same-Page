// OnSet: live production board
import type { StateCreator } from 'zustand';
import type { OnSet, ProductionStatus, LunchStatus, DelayEntry } from '../../types/screenplay';
import { generateId } from '../../utils/fdx';
import type { ScreenplayState, OnSetSlice } from '../types';

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
    const state = get();
    if (!state.onSet) {
      get().initializeOnSet();
    }

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
    const state = get();
    if (!state.onSet) {
      get().initializeOnSet();
    }

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
    const state = get();
    if (!state.onSet) {
      get().initializeOnSet();
    }

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

    // Simple calculation: compare completed strips to expected progress
    const currentDay = state.schedule.shootDays.find(d => d.id === prodStatus.currentDayId);
    if (!currentDay) return;

    const completedCount = prodStatus.completedStrips.length;

    // If day started, calculate expected progress based on elapsed time
    const dayStarted = prodStatus.dayStartedAt;
    if (!dayStarted) return;

    const elapsedMinutes = (new Date().getTime() - new Date(dayStarted).getTime()) / 60000;
    const expectedPerStrip = 60; // Assume 1 hour per strip as baseline (would be calculated from estimates)
    const expectedProgress = elapsedMinutes / expectedPerStrip;
    const aheadBehind = Math.round((completedCount - expectedProgress) * expectedPerStrip);

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
    const state = get();
    if (!state.onSet) {
      get().initializeOnSet();
    }

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

    const aheadBehindNum = prodStatus.aheadBehind;
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
      estimatedWrap: currentDay.estimatedWrap,
      aheadBehind,
      nextUp: nextStrip ? `Scene ${nextStrip.sceneNumber}` : 'Wrap',
      isOnLunch: onSetState.lunchStatus?.isOnLunch || false,
      lunchCountdown,
    };
  },
});
