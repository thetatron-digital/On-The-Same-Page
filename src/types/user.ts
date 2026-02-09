// ============================================
// USER & PROJECT TYPES
// ============================================

// Google user profile
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

// Project metadata (stored in Drive)
export interface Project {
  id: string;               // Google Drive file ID
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;

  // Sharing
  isShared: boolean;
  sharedWith?: SharedUser[];
  shareLink?: string;

  // Local state
  isLocal?: boolean;        // True if not yet synced to cloud
  lastSyncedAt?: Date;

  // Thumbnail/preview
  thumbnail?: string;
}

// Shared user permission
export interface SharedUser {
  email: string;
  name?: string;
  permission: 'view' | 'edit';
  addedAt: Date;
}

// Auth state
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Project list state
export interface ProjectsState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  lastFetched: Date | null;
}

// Google API configuration
export const GOOGLE_CONFIG = {
  // OAuth client ID - This is a PUBLIC client ID for the web app
  // Users will need to create their own at console.cloud.google.com
  // For now, using a placeholder that will work with localhost
  CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',

  // Scopes we need
  SCOPES: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.file',  // Only files created by this app
  ].join(' '),

  // App folder name in Drive
  APP_FOLDER_NAME: 'OTSP Projects',

  // File MIME types
  MIME_TYPES: {
    FOLDER: 'application/vnd.google-apps.folder',
    JSON: 'application/json',
  },
};

// Local storage keys
export const STORAGE_KEYS = {
  USER: 'otsp-user',
  CURRENT_PROJECT: 'otsp-current-project',
  LOCAL_PROJECTS: 'otsp-local-projects',
  PREFERENCES: 'otsp-preferences',
};

// Export type for project data (the actual screenplay content)
export interface ProjectData {
  // Core screenplay data
  screenplay: import('./screenplay').Screenplay;

  // Story outline
  storyOutline?: import('./screenplay').StoryOutline;

  // Beat boards
  beatBoards?: import('./screenplay').BeatBoard[];

  // Script versions
  versions?: import('./screenplay').ScriptVersion[];

  // Script notes
  scriptNotes?: import('./screenplay').ScriptNote[];

  // Split content
  splitContent?: {
    audio: { id: string; text: string }[];
    video: { id: string; text: string }[];
    isIndependent: boolean;
    swapped: boolean;
  };

  // Production data
  breakdown?: import('./screenplay').Breakdown;
  artCart?: import('./screenplay').ArtCart;
  viewFinder?: import('./screenplay').ViewFinder;
  schedule?: import('./screenplay').Schedule;
  onSet?: import('./screenplay').OnSet;
  superVisor?: import('./screenplay').SuperVisor;

  // Settings
  showSceneNumbers?: boolean;
  sceneNumberStyle?: 'numeric' | 'alphanumeric';
  pageLocks?: import('./screenplay').PageLock[];
  watermarkSettings?: import('./screenplay').WatermarkSettings;

  // Metadata
  version: number;  // Data format version for migrations
  savedAt: Date;
}

// Current data format version
export const PROJECT_DATA_VERSION = 1;
