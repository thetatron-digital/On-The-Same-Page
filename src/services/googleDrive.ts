// ============================================
// GOOGLE DRIVE STORAGE SERVICE
// ============================================
// Stores project data in user's own Google Drive
// Completely free - uses user's 15GB quota

import { googleAuth } from './googleAuth';
import {
  GOOGLE_CONFIG,
  STORAGE_KEYS,
  PROJECT_DATA_VERSION,
  type Project,
  type ProjectData
} from '../types/user';
import { migrateProjectData, parseProjectData, reviveDates } from '../utils/projectData';

// Fields requested from the Drive v3 files.list endpoint
interface DrivePermission {
  id?: string;
  type: string;
  role: string;
  emailAddress?: string;
  displayName?: string;
}

/** Someone with access to a project, as the Share dialog lists them */
export interface ProjectMember {
  permissionId: string;
  email?: string;
  name?: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'edit' | 'comment' | 'view';
}

const ROLE_FROM_DRIVE: Record<string, ProjectMember['role']> = {
  owner: 'owner', organizer: 'owner', fileOrganizer: 'edit', writer: 'edit', commenter: 'comment', reader: 'view',
};

/** Thrown when a Drive project exists but this app can't see it yet */
export class ProjectAccessError extends Error {
  projectId: string;
  constructor(projectId: string) {
    super('This project was not shared with this account, or OTSP has not been given access to it yet.');
    this.projectId = projectId;
  }
}

/** OTSP's own link to a project (opens it in the app) */
export const projectLink = (projectId: string, app = 'rewriter') => `${window.location.origin}/projects/${projectId}/${app}`;

interface DriveFile {
  id: string;
  name: string;
  description?: string;
  createdTime: string;
  modifiedTime: string;
  shared?: boolean;
  ownedByMe?: boolean;
  owners?: { displayName?: string; emailAddress?: string; permissionId?: string }[];
  permissions?: DrivePermission[];
}

/** Which saved version of a project file this is, and who saved it */
export interface DriveRevision {
  revision: string;      // headRevisionId (falls back to modifiedTime)
  modifiedTime: string;
  modifiedBy?: string;   // display name of whoever saved it
  modifiedByMe?: boolean;
  canEdit?: boolean;     // false for Viewers and Commenters
  presence?: Record<string, string>; // OTSP presence notes (appProperties)
}

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
// headRevisionId only changes when the content does, so presence notes
// (metadata) never look like a collaborator's save
const REVISION_FIELDS = 'headRevisionId,modifiedTime,lastModifyingUser(displayName,me),capabilities(canEdit),appProperties';

interface RevisionFile {
  headRevisionId?: string;
  modifiedTime: string;
  lastModifyingUser?: { displayName?: string; me?: boolean };
  capabilities?: { canEdit?: boolean };
  appProperties?: Record<string, string>;
}

const toRevision = (file: RevisionFile): DriveRevision => ({
  revision: file.headRevisionId || file.modifiedTime,
  modifiedTime: file.modifiedTime,
  modifiedBy: file.lastModifyingUser?.displayName,
  modifiedByMe: file.lastModifyingUser?.me,
  canEdit: file.capabilities?.canEdit,
  presence: file.appProperties,
});
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

class GoogleDriveService {
  private appFolderId: string | null = null;

  // Get authorization header
  private async getAuthHeader(): Promise<HeadersInit> {
    const token = await googleAuth.getAccessToken();
    if (!token) throw new Error('Not authenticated');
    return { Authorization: `Bearer ${token}` };
  }

  // Find or create the app folder in user's Drive
  async getAppFolder(): Promise<string> {
    if (this.appFolderId) return this.appFolderId;

    const headers = await this.getAuthHeader();

    // Search for existing folder
    const searchResponse = await fetch(
      `${DRIVE_API_BASE}/files?` +
        new URLSearchParams({
          q: `name='${GOOGLE_CONFIG.APP_FOLDER_NAME}' and mimeType='${GOOGLE_CONFIG.MIME_TYPES.FOLDER}' and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive',
        }),
      { headers }
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to search for app folder');
    }

    const searchResult = await searchResponse.json();

    if (searchResult.files && searchResult.files.length > 0) {
      this.appFolderId = searchResult.files[0].id as string;
      return this.appFolderId;
    }

    // Create new folder
    const createResponse = await fetch(`${DRIVE_API_BASE}/files`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: GOOGLE_CONFIG.APP_FOLDER_NAME,
        mimeType: GOOGLE_CONFIG.MIME_TYPES.FOLDER,
      }),
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create app folder');
    }

    const folder = await createResponse.json();
    this.appFolderId = folder.id as string;
    return this.appFolderId;
  }

  // List all projects
  async listProjects(): Promise<Project[]> {
    const headers = await this.getAuthHeader();
    const folderId = await this.getAppFolder();
    const fields = 'files(id, name, description, createdTime, modifiedTime, ownedByMe, owners(displayName, emailAddress), shared, permissions)';
    const list = async (q: string): Promise<DriveFile[]> => {
      const response = await fetch(
        `${DRIVE_API_BASE}/files?` + new URLSearchParams({ q, fields, orderBy: 'modifiedTime desc', spaces: 'drive' }),
        { headers }
      );
      if (!response.ok) throw new Error('Failed to list projects');
      return (await response.json()).files || [];
    };

    // Our projects, plus projects others shared with us that OTSP has been
    // given access to (drive.file scope: opened once through the picker)
    const [own, shared] = await Promise.all([
      list(`'${folderId}' in parents and mimeType='${GOOGLE_CONFIG.MIME_TYPES.JSON}' and trashed=false`),
      list(`sharedWithMe and mimeType='${GOOGLE_CONFIG.MIME_TYPES.JSON}' and trashed=false`).catch(() => [] as DriveFile[]),
    ]);
    const seen = new Set<string>();
    const files = [...own, ...shared].filter((f) => !seen.has(f.id) && seen.add(f.id));
    files.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
    const user = googleAuth.getStoredUser();

    return files.map((file: DriveFile): Project => {
      const owner = file.ownedByMe === false ? file.owners?.[0] : undefined;
      return {
        id: file.id,
        name: file.name.replace(/\.json$/, ''),
        description: file.description || '',
        createdAt: new Date(file.createdTime),
        updatedAt: new Date(file.modifiedTime),
        ownerId: owner ? owner.emailAddress || '' : user?.id || '',
        ownerEmail: owner ? owner.emailAddress || '' : user?.email || '',
        ownerName: owner ? owner.displayName : user?.name,
        isShared: file.shared || false,
        sharedWithMe: !!owner,
        sharedWith: file.permissions
          ?.filter((p: DrivePermission) => p.type === 'user' && p.emailAddress && p.emailAddress !== user?.email)
          .map((p: DrivePermission) => ({
            email: p.emailAddress!,
            name: p.displayName,
            permission: p.role === 'writer' ? 'edit' as const : 'view' as const,
            addedAt: new Date(),
          })),
      };
    });
  }

  async createProject(name: string, data: ProjectData): Promise<Project> {
    const headers = await this.getAuthHeader();
    const folderId = await this.getAppFolder();
    const user = googleAuth.getStoredUser();

    if (!user) throw new Error('Not authenticated');

    // Prepare file metadata
    const metadata = {
      name: `${name}.json`,
      parents: [folderId],
      mimeType: GOOGLE_CONFIG.MIME_TYPES.JSON,
      description: `Re-writer screenplay project: ${name}`,
    };

    // Prepare file content
    const content = JSON.stringify({
      ...data,
      version: PROJECT_DATA_VERSION,
      savedAt: new Date().toISOString(),
    });

    // Use multipart upload
    const boundary = '-------314159265358979323846';
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n');

    const response = await fetch(
      `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,createdTime,modifiedTime`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create project: ${error}`);
    }

    const file = await response.json();

    return {
      id: file.id,
      name: name,
      createdAt: new Date(file.createdTime),
      updatedAt: new Date(file.modifiedTime),
      ownerId: user.id,
      ownerEmail: user.email,
      ownerName: user.name,
      isShared: false,
    };
  }

  // Load a project's data
  async loadProject(projectId: string): Promise<ProjectData> {
    const headers = await this.getAuthHeader();

    const response = await fetch(
      `${DRIVE_API_BASE}/files/${projectId}?alt=media`,
      { headers }
    );

    if (response.status === 404 || response.status === 403) throw new ProjectAccessError(projectId);
    if (!response.ok) {
      throw new Error('Failed to load project');
    }

    return parseProjectData(await response.text());
  }

  // The project file's current revision (cheap: metadata only)
  async getRevision(projectId: string): Promise<DriveRevision> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${DRIVE_API_BASE}/files/${projectId}?fields=${encodeURIComponent(REVISION_FIELDS)}`, { headers });
    if (response.status === 404 || response.status === 403) throw new ProjectAccessError(projectId);
    if (!response.ok) throw new Error('Failed to check the project for changes');
    return toRevision(await response.json());
  }

  // Set or clear (null) presence notes on the project file. Metadata only:
  // no new revision. Needs edit access.
  async setPresence(projectId: string, notes: Record<string, string | null>): Promise<void> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${DRIVE_API_BASE}/files/${projectId}?fields=id`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ appProperties: notes }),
      keepalive: true, // still sent when the tab is closing
    });
    if (!response.ok) throw new Error('Could not update presence');
  }

  // Save/update a project; returns the revision it became
  async saveProject(projectId: string, data: ProjectData): Promise<DriveRevision> {
    const headers = await this.getAuthHeader();

    const content = JSON.stringify({
      ...data,
      version: PROJECT_DATA_VERSION,
      savedAt: new Date().toISOString(),
    });

    const response = await fetch(
      `${UPLOAD_API_BASE}/files/${projectId}?uploadType=media&fields=${encodeURIComponent(REVISION_FIELDS)}`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: content,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save project');
    }

    return toRevision(await response.json());
  }

  // Rename a project
  async renameProject(projectId: string, newName: string): Promise<void> {
    const headers = await this.getAuthHeader();

    const response = await fetch(`${DRIVE_API_BASE}/files/${projectId}`, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${newName}.json`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to rename project');
    }
  }

  // Delete a project (move to trash)
  async deleteProject(projectId: string): Promise<void> {
    const headers = await this.getAuthHeader();

    const response = await fetch(`${DRIVE_API_BASE}/files/${projectId}`, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trashed: true }),
    });

    if (!response.ok) {
      throw new Error('Failed to delete project');
    }
  }

  // Duplicate a project
  async duplicateProject(projectId: string, newName: string): Promise<Project> {
    const headers = await this.getAuthHeader();
    const user = googleAuth.getStoredUser();

    if (!user) throw new Error('Not authenticated');

    const response = await fetch(
      `${DRIVE_API_BASE}/files/${projectId}/copy`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${newName}.json`,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to duplicate project');
    }

    const file = await response.json();

    return {
      id: file.id,
      name: newName,
      createdAt: new Date(file.createdTime),
      updatedAt: new Date(file.modifiedTime),
      ownerId: user.id,
      ownerEmail: user.email,
      ownerName: user.name,
      isShared: false,
    };
  }

  // Share a project with someone
  async shareProject(
    projectId: string,
    email: string,
    permission: 'view' | 'comment' | 'edit',
    message?: string
  ): Promise<void> {
    const headers = await this.getAuthHeader();
    // Google emails the invite; the message carries OTSP's own link
    const emailMessage = [message?.trim(), `Open it in OTSP: ${projectLink(projectId)}`].filter(Boolean).join('\n\n');
    const response = await fetch(
      `${DRIVE_API_BASE}/files/${projectId}/permissions?` + new URLSearchParams({ sendNotificationEmail: 'true', emailMessage }),
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'user',
          role: permission === 'edit' ? 'writer' : permission === 'comment' ? 'commenter' : 'reader',
          emailAddress: email,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(response.status === 400 ? `Could not share with ${email}. Check the address.` : 'Failed to share project');
    }
  }

  // Everyone with access to a project
  async listMembers(projectId: string): Promise<ProjectMember[]> {
    const headers = await this.getAuthHeader();
    const response = await fetch(
      `${DRIVE_API_BASE}/files/${projectId}/permissions?fields=${encodeURIComponent('permissions(id,type,role,emailAddress,displayName)')}`,
      { headers }
    );
    if (!response.ok) throw new Error('Could not load who has access');
    const { permissions = [] } = (await response.json()) as { permissions?: DrivePermission[] };
    return permissions.map((p) => ({
      permissionId: p.id ?? '',
      email: p.emailAddress,
      name: p.displayName,
      type: p.type as ProjectMember['type'],
      role: ROLE_FROM_DRIVE[p.role] ?? 'view',
    }));
  }

  // Change someone's access
  async updateMember(projectId: string, permissionId: string, permission: 'view' | 'comment' | 'edit'): Promise<void> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${DRIVE_API_BASE}/files/${projectId}/permissions/${permissionId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: permission === 'edit' ? 'writer' : permission === 'comment' ? 'commenter' : 'reader' }),
    });
    if (!response.ok) throw new Error('Could not change access');
  }

  // Remove sharing for a user
  async unshareProject(projectId: string, permissionId: string): Promise<void> {
    const headers = await this.getAuthHeader();

    const response = await fetch(
      `${DRIVE_API_BASE}/files/${projectId}/permissions/${permissionId}`,
      {
        method: 'DELETE',
        headers,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to remove sharing');
    }
  }

  // Get a shareable link
  async getShareableLink(projectId: string, canEdit: boolean = false): Promise<string> {
    const headers = await this.getAuthHeader();

    // Create "anyone with link" permission
    const response = await fetch(
      `${DRIVE_API_BASE}/files/${projectId}/permissions`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'anyone',
          role: canEdit ? 'writer' : 'reader',
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create shareable link');
    }

    // Get the web view link
    const fileResponse = await fetch(
      `${DRIVE_API_BASE}/files/${projectId}?fields=webViewLink`,
      { headers }
    );

    if (!fileResponse.ok) {
      throw new Error('Failed to get share link');
    }

    const file = await fileResponse.json();
    return file.webViewLink;
  }

  // Get storage quota info
  async getStorageQuota(): Promise<{
    used: number;
    limit: number;
    usedByApp: number;
  }> {
    const headers = await this.getAuthHeader();

    const response = await fetch(
      `${DRIVE_API_BASE}/about?fields=storageQuota`,
      { headers }
    );

    if (!response.ok) {
      throw new Error('Failed to get storage quota');
    }

    const result = await response.json();

    return {
      used: parseInt(result.storageQuota.usage, 10),
      limit: parseInt(result.storageQuota.limit, 10),
      usedByApp: parseInt(result.storageQuota.usageInDriveTrash || '0', 10),
    };
  }

  // Clear cached folder ID (useful when switching accounts)
  clearCache(): void {
    this.appFolderId = null;
  }
}

// Singleton instance
export const googleDrive = new GoogleDriveService();

// ============================================
// LOCAL STORAGE FALLBACK
// ============================================
// For offline usage or when not signed in

class LocalStorageService {
  // Save project locally
  saveProject(id: string, data: ProjectData): void {
    const projects = this.getLocalProjects();
    projects[id] = {
      data,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.LOCAL_PROJECTS, JSON.stringify(projects));
  }

  // Load project from local storage
  loadProject(id: string): ProjectData | null {
    const projects = this.getLocalProjects();
    const data = projects[id]?.data;
    return data ? migrateProjectData(data) : null;
  }

  // Get all local projects
  getLocalProjects(): Record<string, { data: ProjectData; savedAt: string }> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LOCAL_PROJECTS);
      return stored ? JSON.parse(stored, reviveDates) : {};
    } catch {
      return {};
    }
  }

  // List local projects as Project objects
  listProjects(): Project[] {
    const projects = this.getLocalProjects();
    return Object.entries(projects).map(([id, { data, savedAt }]) => ({
      id,
      name: data.screenplay?.title || 'Untitled',
      createdAt: new Date(savedAt),
      updatedAt: new Date(savedAt),
      ownerId: 'local',
      ownerEmail: 'local',
      isShared: false,
      isLocal: true,
    }));
  }

  // Delete local project
  deleteProject(id: string): void {
    const projects = this.getLocalProjects();
    delete projects[id];
    localStorage.setItem(STORAGE_KEYS.LOCAL_PROJECTS, JSON.stringify(projects));
  }

  // Generate unique ID for local projects
  generateId(): string {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save current project reference
  setCurrentProject(id: string | null): void {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT);
    }
  }

  // Get current project reference
  getCurrentProject(): string | null {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT);
  }
}

export const localStorage_service = new LocalStorageService();
