// Opening a project someone shared with you: Google's file picker gives
// OTSP access to it (once), then it opens and syncs like your own.
import { create } from 'zustand';
import { pickSharedProject } from './googlePicker';
import { openProject } from './openProject';
import { useProjectsStore } from './projectService';
import type { AppMode } from '../store/types';

/** A shared project link we couldn't open yet (see SharedProjectPrompt) */
export const useSharedAccessPrompt = create<{ projectId: string | null; app: AppMode }>(() => ({ projectId: null, app: 'rewriter' }));

export async function openSharedProject(fileId?: string, app: AppMode = 'rewriter'): Promise<boolean> {
  const id = await pickSharedProject(fileId);
  if (!id) return false;
  await useProjectsStore.getState().fetchProjects();
  await openProject(id, app);
  return true;
}
