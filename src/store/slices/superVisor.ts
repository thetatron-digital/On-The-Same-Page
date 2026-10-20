// SuperVisor: takes, continuity, daily reports
import type { StateCreator } from 'zustand';
import type {
  SuperVisor,
  SupervisorSession,
  TakeEntry,
  ContinuityLog,
  DailyReport,
} from '../../types/screenplay';
import { generateId } from '../../utils/fdx';
import type { ScreenplayState, SuperVisorSlice } from '../types';

export const createSuperVisorSlice: StateCreator<ScreenplayState, [], [], SuperVisorSlice> = (set, get) => ({
  // SuperVisor state
  superVisor: null,

  // SUPERVISOR ACTIONS
  initializeSuperVisor: () => {
    const state = get();
    if (state.superVisor) return;

    const superVisor: SuperVisor = {
      currentSession: null,
      sessions: [],
      continuityLogs: [],
      dailyReports: [],
      currentSlate: null,
      selectedSceneId: null,
      selectedShotId: null,
      filterCamera: 'All',
    };

    set({ superVisor, isDirty: true });
  },

  startSupervisorSession: (shootDayId) => {
    const state = get();
    if (!state.superVisor) {
      get().initializeSuperVisor();
    }

    const id = generateId();
    const session: SupervisorSession = {
      id,
      shootDayId,
      date: new Date(),
      takes: [],
      coverage: [],
      totalSetups: 0,
      totalTakes: 0,
      totalPrints: 0,
      exportedToEditor: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({
      superVisor: {
        ...state.superVisor!,
        currentSession: session,
        sessions: [...state.superVisor!.sessions, session],
      },
      isDirty: true,
    });

    return id;
  },

  endSupervisorSession: () => {
    const state = get();
    if (!state.superVisor?.currentSession) return;

    set({
      superVisor: {
        ...state.superVisor,
        currentSession: null,
      },
      isDirty: true,
    });
  },

  setCurrentSlate: (slate) => {
    const state = get();
    if (!state.superVisor) {
      get().initializeSuperVisor();
    }

    set({
      superVisor: {
        ...state.superVisor!,
        currentSlate: state.superVisor!.currentSlate
          ? { ...state.superVisor!.currentSlate, ...slate }
          : {
              scene: slate.scene || '',
              shot: slate.shot || '',
              take: slate.take || 1,
              camera: slate.camera || 'A',
              roll: slate.roll || '',
              date: slate.date || new Date(),
            },
      },
    });
  },

  logTake: (take) => {
    const state = get();
    const superVisorState = state.superVisor;
    const session = superVisorState?.currentSession;
    if (!superVisorState || !session) return '';

    const id = generateId();
    const newTake: TakeEntry = {
      ...take,
      id,
      createdAt: new Date(),
    };

    const updatedSession = {
      ...session,
      takes: [...session.takes, newTake],
      totalTakes: session.totalTakes + 1,
      totalPrints: take.circled ? session.totalPrints + 1 : session.totalPrints,
      updatedAt: new Date(),
    };

    // Update sessions array too
    const updatedSessions = superVisorState.sessions.map(s =>
      s.id === session.id ? updatedSession : s
    );

    set({
      superVisor: {
        ...superVisorState,
        currentSession: updatedSession,
        sessions: updatedSessions,
        currentSlate: superVisorState.currentSlate
          ? { ...superVisorState.currentSlate, take: superVisorState.currentSlate.take + 1 }
          : null,
      },
      isDirty: true,
    });

    return id;
  },

  updateTake: (takeId, updates) => {
    const state = get();
    const superVisorState = state.superVisor;
    const session = superVisorState?.currentSession;
    if (!superVisorState || !session) return;

    const updatedTakes = session.takes.map(t =>
      t.id === takeId ? { ...t, ...updates } : t
    );

    const updatedSession = {
      ...session,
      takes: updatedTakes,
      updatedAt: new Date(),
    };

    const updatedSessions = superVisorState.sessions.map(s =>
      s.id === session.id ? updatedSession : s
    );

    set({
      superVisor: {
        ...superVisorState,
        currentSession: updatedSession,
        sessions: updatedSessions,
      },
      isDirty: true,
    });
  },

  deleteTake: (takeId) => {
    const state = get();
    const superVisorState = state.superVisor;
    const session = superVisorState?.currentSession;
    if (!superVisorState || !session) return;

    const takeToDelete = session.takes.find(t => t.id === takeId);
    const updatedTakes = session.takes.filter(t => t.id !== takeId);

    const updatedSession = {
      ...session,
      takes: updatedTakes,
      totalTakes: session.totalTakes - 1,
      totalPrints: takeToDelete?.circled ? session.totalPrints - 1 : session.totalPrints,
      updatedAt: new Date(),
    };

    const updatedSessions = superVisorState.sessions.map(s =>
      s.id === session.id ? updatedSession : s
    );

    set({
      superVisor: {
        ...superVisorState,
        currentSession: updatedSession,
        sessions: updatedSessions,
      },
      isDirty: true,
    });
  },

  circleTake: (takeId, circled) => {
    const state = get();
    const superVisorState = state.superVisor;
    const session = superVisorState?.currentSession;
    if (!superVisorState || !session) return;

    const take = session.takes.find(t => t.id === takeId);
    if (!take || take.circled === circled) return;

    const updatedTakes = session.takes.map(t =>
      t.id === takeId ? { ...t, circled, rating: circled ? 'Print' as const : '' as const } : t
    );

    const updatedSession = {
      ...session,
      takes: updatedTakes,
      totalPrints: circled ? session.totalPrints + 1 : session.totalPrints - 1,
      updatedAt: new Date(),
    };

    const updatedSessions = superVisorState.sessions.map(s =>
      s.id === session.id ? updatedSession : s
    );

    set({
      superVisor: {
        ...superVisorState,
        currentSession: updatedSession,
        sessions: updatedSessions,
      },
      isDirty: true,
    });
  },

  addContinuityLog: (sceneId) => {
    const state = get();
    if (!state.superVisor) {
      get().initializeSuperVisor();
    }

    const scene = state.breakdownScenes.find(s => s.id === sceneId);
    const id = generateId();
    const log: ContinuityLog = {
      id,
      sceneId,
      sceneNumber: scene?.sceneNumber || '',
      wardrobeNotes: '',
      propsNotes: '',
      hairMakeupNotes: '',
      actionNotes: '',
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({
      superVisor: {
        ...state.superVisor!,
        continuityLogs: [...state.superVisor!.continuityLogs, log],
      },
      isDirty: true,
    });

    return id;
  },

  updateContinuityLog: (logId, updates) => {
    const state = get();
    if (!state.superVisor) return;

    const updatedLogs = state.superVisor.continuityLogs.map(log =>
      log.id === logId ? { ...log, ...updates, updatedAt: new Date() } : log
    );

    set({
      superVisor: {
        ...state.superVisor,
        continuityLogs: updatedLogs,
      },
      isDirty: true,
    });
  },

  generateDailyReport: (shootDayId) => {
    const state = get();
    if (!state.superVisor) {
      get().initializeSuperVisor();
    }

    const session = state.superVisor!.sessions.find(s => s.shootDayId === shootDayId);
    if (!session) return '';

    // Gather takes by camera
    const cameraMap = new Map<string, { takes: number; prints: number }>();
    session.takes.forEach(take => {
      const existing = cameraMap.get(take.camera) || { takes: 0, prints: 0 };
      cameraMap.set(take.camera, {
        takes: existing.takes + 1,
        prints: take.circled ? existing.prints + 1 : existing.prints,
      });
    });

    const cameraInventory = Array.from(cameraMap.entries()).map(([camera, stats]) => ({
      camera,
      takes: stats.takes,
      prints: stats.prints,
    }));

    // Get unique scenes
    const scenesSet = new Set(session.takes.map(t => t.sceneNumber));

    const id = generateId();
    const report: DailyReport = {
      id,
      shootDayId,
      date: session.date,
      scenesCompleted: Array.from(scenesSet),
      scenesPartial: [],
      pagesShot: 0, // Would calculate from schedule
      minutesShot: 0,
      setupsTotal: session.totalSetups,
      takesTotal: session.totalTakes,
      printsTotal: session.totalPrints,
      ngTotal: session.takes.filter(t => t.rating === 'NG').length,
      cameraInventory,
      productionNotes: session.notes || '',
      editorNotes: '',
      approved: false,
    };

    set({
      superVisor: {
        ...state.superVisor!,
        dailyReports: [...state.superVisor!.dailyReports, report],
      },
      isDirty: true,
    });

    return id;
  },

  approveDailyReport: (reportId, approvedBy) => {
    const state = get();
    if (!state.superVisor) return;

    const updatedReports = state.superVisor.dailyReports.map(report =>
      report.id === reportId
        ? { ...report, approved: true, approvedBy, approvedAt: new Date() }
        : report
    );

    set({
      superVisor: {
        ...state.superVisor,
        dailyReports: updatedReports,
      },
      isDirty: true,
    });
  },

  selectSuperVisorScene: (sceneId) => {
    const state = get();
    if (!state.superVisor) return;

    set({
      superVisor: {
        ...state.superVisor,
        selectedSceneId: sceneId,
      },
    });
  },

  selectSuperVisorShot: (shotId) => {
    const state = get();
    if (!state.superVisor) return;

    set({
      superVisor: {
        ...state.superVisor,
        selectedShotId: shotId,
      },
    });
  },

  setSuperVisorCameraFilter: (camera) => {
    const state = get();
    if (!state.superVisor) return;

    set({
      superVisor: {
        ...state.superVisor,
        filterCamera: camera,
      },
    });
  },

  getTakesForScene: (sceneNumber) => {
    const state = get();
    if (!state.superVisor?.currentSession) return [];
    return state.superVisor.currentSession.takes.filter(t => t.sceneNumber === sceneNumber);
  },

  getTakesForShot: (shotId) => {
    const state = get();
    if (!state.superVisor?.currentSession) return [];
    return state.superVisor.currentSession.takes.filter(t => t.shotId === shotId);
  },

  getCircledTakes: () => {
    const state = get();
    if (!state.superVisor?.currentSession) return [];
    return state.superVisor.currentSession.takes.filter(t => t.circled);
  },
});
