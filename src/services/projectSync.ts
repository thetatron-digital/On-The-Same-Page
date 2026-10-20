// ============================================
// PROJECT SYNC (shared Google Drive projects)
// ============================================
// Several people can work on one Drive project. Drive stores one JSON
// file; we remember the revision this editor last had (the base). When
// someone else saves in between:
// - on save, their version is merged with ours (merge3) before writing
// - while the project is open, their changes are pulled in every 20 s and
//   when the tab comes back into view
// Free: only the Drive API, no server. There is a small window between
// checking the revision and writing it in which a save can still be
// overwritten; the next sync of the other editor merges it back.

import { create } from 'zustand';
import { googleDrive, type DriveRevision } from './googleDrive';
import { useScreenplayStore } from '../store/screenplayStore';
import { cancelAutoSave } from './projectService';
import { deepEqual, merge3 } from '../utils/merge3';
import { PERSISTED_KEYS } from './autoSave';
import type { ProjectData } from '../types/user';

export const PULL_INTERVAL_MS = 20_000;

interface SyncBase {
  projectId: string;
  data: ProjectData;
  revision: string;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'merged' | 'offline';
  at?: Date;
  /** Who made the changes we last pulled or merged in */
  by?: string;
  /** Values both sides changed; ours were kept */
  conflicts: string[];
}

export const useSyncStatus = create<SyncStatus>(() => ({ state: 'idle', conflicts: [] }));

let base: SyncBase | null = null;
let busy: Promise<unknown> | null = null;

const persisted = (data: ProjectData) => Object.fromEntries(PERSISTED_KEYS.map((k) => [k, data[k] ?? undefined])) as Partial<ProjectData>;

// One sync at a time: a pull waits for a save in flight and vice versa
async function exclusive<T>(work: () => Promise<T>): Promise<T> {
  while (busy) await busy.catch(() => {});
  const run = work();
  busy = run;
  try {
    return await run;
  } finally {
    if (busy === run) busy = null;
  }
}

export function clearSyncBase() {
  base = null;
  useSyncStatus.setState({ state: 'idle', conflicts: [], by: undefined, at: undefined });
}

export const syncBaseFor = (projectId: string) => (base?.projectId === projectId ? base : null);

/** Load a Drive project and remember it as the base for later merges */
export async function loadDriveProject(projectId: string): Promise<ProjectData> {
  // Revision first: if someone saves during the download, the next check
  // sees a newer revision and merges, which is safe either way
  const revision = await googleDrive.getRevision(projectId);
  const data = await googleDrive.loadProject(projectId);
  base = { projectId, data, revision: revision.revision };
  useSyncStatus.setState({ state: 'synced', at: new Date(), conflicts: [], by: undefined });
  return data;
}

// Put merged or pulled data into the editor without treating it as
// opening a new document (selection, view and undo stay)
function applyToEditor(data: ProjectData) {
  useScreenplayStore.getState().applyProjectData(data);
}

const editorData = () => useScreenplayStore.getState().getProjectData();

const unchangedSinceBase = (local: ProjectData, b: SyncBase) =>
  PERSISTED_KEYS.every((k) => local[k] === b.data[k] || deepEqual(local[k] ?? undefined, b.data[k] ?? undefined));

function mergeWithRemote(b: SyncBase, local: ProjectData, remote: ProjectData, rev: DriveRevision) {
  const { value, conflicts } = merge3(persisted(b.data), persisted(local), persisted(remote));
  const merged = { ...local, ...value } as ProjectData;
  applyToEditor(merged);
  useSyncStatus.setState({ state: 'merged', at: new Date(), by: rev.modifiedByMe ? undefined : rev.modifiedBy, conflicts });
  return merged;
}

/**
 * Save to Drive, first merging in anything another editor saved since our
 * base. Returns the data actually written.
 */
export function saveDriveProject(projectId: string, local: ProjectData): Promise<ProjectData> {
  return exclusive(async () => {
    useSyncStatus.setState((s) => ({ ...s, state: 'syncing' }));
    let toSave = local;
    const b = syncBaseFor(projectId);
    try {
      if (b) {
        const current = await googleDrive.getRevision(projectId);
        if (current.revision !== b.revision) {
          const remote = await googleDrive.loadProject(projectId);
          // Merge with what is in the editor now, which may be newer than `local`
          toSave = mergeWithRemote(b, editorData(), remote, current);
        }
      }
      const saved = await googleDrive.saveProject(projectId, toSave);
      base = { projectId, data: toSave, revision: saved.revision };
      if (useSyncStatus.getState().state === 'syncing') useSyncStatus.setState({ state: 'synced', at: new Date() });
      else useSyncStatus.setState({ at: new Date() });
      return toSave;
    } catch (error) {
      useSyncStatus.setState((s) => ({ ...s, state: 'offline' }));
      throw error;
    }
  });
}

/**
 * Bring in changes another editor saved. Returns true when something
 * came in. With no local edits the editor simply takes their version.
 */
export function pullRemoteChanges(projectId: string): Promise<boolean> {
  return exclusive(async () => {
    const b = syncBaseFor(projectId);
    if (!b) return false;
    let current: DriveRevision;
    try {
      current = await googleDrive.getRevision(projectId);
    } catch {
      useSyncStatus.setState((s) => ({ ...s, state: 'offline' }));
      return false;
    }
    if (current.revision === b.revision) {
      if (useSyncStatus.getState().state === 'offline') useSyncStatus.setState({ state: 'synced', at: new Date() });
      return false;
    }
    const remote = await googleDrive.loadProject(projectId);
    const local = editorData();
    if (unchangedSinceBase(local, b)) {
      applyToEditor(remote);
      // Taking their saved version is not an edit of ours
      cancelAutoSave();
      useScreenplayStore.getState().setDirty(false);
      useSyncStatus.setState({ state: 'synced', at: new Date(), by: current.modifiedByMe ? undefined : current.modifiedBy, conflicts: [] });
    } else {
      mergeWithRemote(b, local, remote, current); // auto-save writes the merge
    }
    base = { projectId, data: remote, revision: current.revision };
    return true;
  });
}

/** Pull changes for the open Drive project on an interval and on tab focus */
export function startRemoteSync(getProjectId: () => string | null, interval = PULL_INTERVAL_MS): () => void {
  const pull = () => {
    const id = getProjectId();
    const store = useScreenplayStore.getState();
    if (!id || !syncBaseFor(id) || store.documentOrigin !== 'project' || document.visibilityState !== 'visible') return;
    void pullRemoteChanges(id).catch((error) => console.error('Sync failed:', error));
  };
  const timer = setInterval(pull, interval);
  const onVisible = () => { if (document.visibilityState === 'visible') pull(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
