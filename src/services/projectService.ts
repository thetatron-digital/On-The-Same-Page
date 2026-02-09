// ============================================
// PROJECT SERVICE
// ============================================
// Unified interface for project management
// Handles both cloud (Google Drive) and local storage

import { create } from 'zustand';
import { googleAuth } from './googleAuth';
import { googleDrive, localStorage_service } from './googleDrive';
import type { User, Project, ProjectData } from '../types/user';

// ============================================
// AUTH STORE
// ============================================

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: () => void;
  signOut: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isInitialized: false,
  error: null,

  initialize: async () => {
    try {
      await googleAuth.initialize();

      // Check for stored user
      const storedUser = googleAuth.getStoredUser();

      // Subscribe to auth changes
      googleAuth.onAuthStateChange((user) => {
        set({ user, isLoading: false });
        if (user) {
          // Clear drive cache on login
          googleDrive.clearCache();
        }
      });

      set({
        user: storedUser,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize auth',
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  signIn: () => {
    set({ isLoading: true, error: null });
    googleAuth.signIn();
  },

  signOut: () => {
    googleAuth.signOut();
    googleDrive.clearCache();
    set({ user: null, error: null });
  },

  clearError: () => set({ error: null }),
}));

// ============================================
// PROJECTS STORE
// ============================================

interface ProjectsStore {
  projects: Project[];
  currentProjectId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastSyncedAt: Date | null;

  // Actions
  fetchProjects: () => Promise<void>;
  createProject: (name: string, data: ProjectData) => Promise<Project>;
  loadProject: (projectId: string) => Promise<ProjectData>;
  saveProject: (projectId: string, data: ProjectData) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  renameProject: (projectId: string, newName: string) => Promise<void>;
  duplicateProject: (projectId: string, newName: string) => Promise<Project>;
  setCurrentProject: (projectId: string | null) => void;
  clearError: () => void;
}

export const useProjectsStore = create<ProjectsStore>((set, get) => ({
  projects: [],
  currentProjectId: localStorage_service.getCurrentProject(),
  isLoading: false,
  isSaving: false,
  error: null,
  lastSyncedAt: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });

    try {
      const { user } = useAuthStore.getState();
      let projects: Project[] = [];

      // Get local projects first
      const localProjects = localStorage_service.listProjects();

      if (user) {
        // If signed in, get cloud projects
        const cloudProjects = await googleDrive.listProjects();
        projects = [...cloudProjects, ...localProjects];
      } else {
        projects = localProjects;
      }

      set({
        projects,
        isLoading: false,
        lastSyncedAt: new Date(),
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch projects',
        isLoading: false,
      });
    }
  },

  createProject: async (name: string, data: ProjectData) => {
    set({ isSaving: true, error: null });

    try {
      const { user } = useAuthStore.getState();
      let project: Project;

      if (user) {
        // Save to Google Drive
        project = await googleDrive.createProject(name, data);
      } else {
        // Save locally
        const id = localStorage_service.generateId();
        localStorage_service.saveProject(id, data);
        project = {
          id,
          name,
          createdAt: new Date(),
          updatedAt: new Date(),
          ownerId: 'local',
          ownerEmail: 'local',
          isShared: false,
          isLocal: true,
        };
      }

      set((state) => ({
        projects: [project, ...state.projects],
        currentProjectId: project.id,
        isSaving: false,
      }));

      localStorage_service.setCurrentProject(project.id);
      return project;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create project',
        isSaving: false,
      });
      throw error;
    }
  },

  loadProject: async (projectId: string) => {
    set({ isLoading: true, error: null });

    try {
      const project = get().projects.find((p) => p.id === projectId);
      let data: ProjectData;

      if (project?.isLocal) {
        // Load from local storage
        const localData = localStorage_service.loadProject(projectId);
        if (!localData) throw new Error('Project not found');
        data = localData;
      } else {
        // Load from Google Drive
        data = await googleDrive.loadProject(projectId);
      }

      set({ isLoading: false, currentProjectId: projectId });
      localStorage_service.setCurrentProject(projectId);
      return data;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load project',
        isLoading: false,
      });
      throw error;
    }
  },

  saveProject: async (projectId: string, data: ProjectData) => {
    set({ isSaving: true, error: null });

    try {
      const project = get().projects.find((p) => p.id === projectId);

      if (project?.isLocal) {
        // Save to local storage
        localStorage_service.saveProject(projectId, data);
      } else {
        // Save to Google Drive
        await googleDrive.saveProject(projectId, data);
      }

      // Update project in list
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, updatedAt: new Date() } : p
        ),
        isSaving: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save project',
        isSaving: false,
      });
      throw error;
    }
  },

  deleteProject: async (projectId: string) => {
    set({ isLoading: true, error: null });

    try {
      const project = get().projects.find((p) => p.id === projectId);

      if (project?.isLocal) {
        localStorage_service.deleteProject(projectId);
      } else {
        await googleDrive.deleteProject(projectId);
      }

      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        currentProjectId:
          state.currentProjectId === projectId ? null : state.currentProjectId,
        isLoading: false,
      }));

      if (get().currentProjectId === null) {
        localStorage_service.setCurrentProject(null);
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete project',
        isLoading: false,
      });
      throw error;
    }
  },

  renameProject: async (projectId: string, newName: string) => {
    set({ isSaving: true, error: null });

    try {
      const project = get().projects.find((p) => p.id === projectId);

      if (!project?.isLocal) {
        await googleDrive.renameProject(projectId, newName);
      }

      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, name: newName, updatedAt: new Date() } : p
        ),
        isSaving: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to rename project',
        isSaving: false,
      });
      throw error;
    }
  },

  duplicateProject: async (projectId: string, newName: string) => {
    set({ isSaving: true, error: null });

    try {
      const project = get().projects.find((p) => p.id === projectId);
      let newProject: Project;

      if (project?.isLocal) {
        // Duplicate locally
        const data = localStorage_service.loadProject(projectId);
        if (!data) throw new Error('Project not found');
        const id = localStorage_service.generateId();
        localStorage_service.saveProject(id, data);
        newProject = {
          id,
          name: newName,
          createdAt: new Date(),
          updatedAt: new Date(),
          ownerId: 'local',
          ownerEmail: 'local',
          isShared: false,
          isLocal: true,
        };
      } else {
        newProject = await googleDrive.duplicateProject(projectId, newName);
      }

      set((state) => ({
        projects: [newProject, ...state.projects],
        isSaving: false,
      }));

      return newProject;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to duplicate project',
        isSaving: false,
      });
      throw error;
    }
  },

  setCurrentProject: (projectId: string | null) => {
    set({ currentProjectId: projectId });
    localStorage_service.setCurrentProject(projectId);
  },

  clearError: () => set({ error: null }),
}));

// ============================================
// AUTO-SAVE HOOK
// ============================================

let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

export function scheduleAutoSave(
  projectId: string,
  getData: () => ProjectData,
  delay: number = 30000 // 30 seconds default
): void {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }

  autoSaveTimeout = setTimeout(async () => {
    try {
      const data = getData();
      await useProjectsStore.getState().saveProject(projectId, data);
      console.log('Auto-saved project');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, delay);
}

export function cancelAutoSave(): void {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
}
