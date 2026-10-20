// BaseCamp production management: people, locations, scenes, departments, call sheets
import type { StateCreator } from 'zustand';
import type {
  ProductionPerson,
  ProductionLocation,
  ProductionScene,
  Department,
  CallSheet,
} from '../../types/screenplay';
import { DEFAULT_DEPARTMENTS, AVATAR_COLORS } from '../../types/screenplay';
import { generateId } from '../../utils/fdx';
import { createDefaultProductionData } from '../helpers';
import type { ScreenplayState, ProductionSlice } from '../types';

export const createProductionSlice: StateCreator<ScreenplayState, [], [], ProductionSlice> = (set, get) => ({
  // Production Management state
  productionData: createDefaultProductionData(),
  basecampView: 'dashboard' as const,

  // PRODUCTION MANAGEMENT ACTIONS
  setBasecampView: (view) => set({ basecampView: view }),

  initializeProductionData: () => {
    const state = get();
    if (state.productionData.departments.length > 0) return;
    set({
      productionData: {
        ...state.productionData,
        departments: DEFAULT_DEPARTMENTS.map((d, i) => ({ ...d, id: `dept-default-${i}` })),
      },
    });
  },

  addPerson: (person) => {
    const state = get();
    const id = generateId();
    const colorIndex = state.productionData.people.length % AVATAR_COLORS.length;
    const newPerson: ProductionPerson = { ...person, id, avatarColor: AVATAR_COLORS[colorIndex] };
    set({
      productionData: {
        ...state.productionData,
        people: [...state.productionData.people, newPerson],
      },
      isDirty: true,
    });
    return id;
  },

  updatePerson: (id, updates) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        people: state.productionData.people.map(p => p.id === id ? { ...p, ...updates } : p),
      },
      isDirty: true,
    });
  },

  deletePerson: (id) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        people: state.productionData.people.filter(p => p.id !== id),
      },
      isDirty: true,
    });
  },

  addLocation: (location) => {
    const state = get();
    const id = generateId();
    const newLocation: ProductionLocation = { ...location, id };
    set({
      productionData: {
        ...state.productionData,
        locations: [...state.productionData.locations, newLocation],
      },
      isDirty: true,
    });
    return id;
  },

  updateLocation: (id, updates) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        locations: state.productionData.locations.map(l => l.id === id ? { ...l, ...updates } : l),
      },
      isDirty: true,
    });
  },

  deleteLocation: (id) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        locations: state.productionData.locations.filter(l => l.id !== id),
      },
      isDirty: true,
    });
  },

  addProductionScene: (scene) => {
    const state = get();
    const id = generateId();
    const newScene: ProductionScene = { ...scene, id };
    set({
      productionData: {
        ...state.productionData,
        scenes: [...state.productionData.scenes, newScene],
      },
      isDirty: true,
    });
    return id;
  },

  updateProductionScene: (id, updates) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        scenes: state.productionData.scenes.map(s => s.id === id ? { ...s, ...updates } : s),
      },
      isDirty: true,
    });
  },

  deleteProductionScene: (id) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        scenes: state.productionData.scenes.filter(s => s.id !== id),
      },
      isDirty: true,
    });
  },

  addDepartment: (name) => {
    const state = get();
    const id = generateId();
    const newDept: Department = { id, name, positions: [] };
    set({
      productionData: {
        ...state.productionData,
        departments: [...state.productionData.departments, newDept],
      },
      isDirty: true,
    });
    return id;
  },

  updateDepartment: (id, updates) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        departments: state.productionData.departments.map(d => d.id === id ? { ...d, ...updates } : d),
      },
      isDirty: true,
    });
  },

  deleteDepartment: (id) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        departments: state.productionData.departments.filter(d => d.id !== id),
      },
      isDirty: true,
    });
  },

  addPosition: (departmentId, position) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        departments: state.productionData.departments.map(d =>
          d.id === departmentId
            ? { ...d, positions: [...d.positions, position] }
            : d
        ),
      },
      isDirty: true,
    });
  },

  removePosition: (departmentId, position) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        departments: state.productionData.departments.map(d =>
          d.id === departmentId
            ? { ...d, positions: d.positions.filter(p => p !== position) }
            : d
        ),
      },
      isDirty: true,
    });
  },

  addCallSheet: (callSheet) => {
    const state = get();
    const id = generateId();
    const newCS: CallSheet = { ...callSheet, id, createdAt: new Date(), updatedAt: new Date() };
    set({
      productionData: {
        ...state.productionData,
        callSheets: [...state.productionData.callSheets, newCS],
      },
      isDirty: true,
    });
    return id;
  },

  updateCallSheet: (id, updates) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        callSheets: state.productionData.callSheets.map(cs =>
          cs.id === id ? { ...cs, ...updates, updatedAt: new Date() } : cs
        ),
      },
      isDirty: true,
    });
  },

  deleteCallSheet: (id) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        callSheets: state.productionData.callSheets.filter(cs => cs.id !== id),
      },
      isDirty: true,
    });
  },

  updateProductionSettings: (settings) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        settings: { ...state.productionData.settings, ...settings },
      },
      isDirty: true,
    });
  },
});
