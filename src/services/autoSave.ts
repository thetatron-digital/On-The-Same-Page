// ============================================
// AUTO-SAVE
// ============================================
// Watches the fields that make up a saved project and, 30 s after the
// last change, saves to the open project (Google Drive or local).
// Many store actions don't set isDirty, so changes are detected by
// comparing the persisted fields themselves.

import { useScreenplayStore, type ScreenplayState } from '../store/screenplayStore';
import { cancelAutoSave, scheduleAutoSave, useProjectsStore } from './projectService';
import { isReadOnlyProject } from './projectSync';
import type { ProjectData } from '../types/user';

// Keep in sync with getProjectData() in screenplayStore.ts
export const PERSISTED_KEYS = [
  'screenplay', 'storyOutline', 'beatBoards', 'versions', 'scriptNotes',
  'splitContent', 'breakdown', 'artCart', 'viewFinder', 'schedule', 'onSet',
  'superVisor', 'productionData', 'showSceneNumbers', 'sceneNumberStyle',
  'pageLocks', 'watermarkSettings',
] as const satisfies readonly (keyof ScreenplayState & keyof ProjectData)[];

export const AUTO_SAVE_DELAY_MS = 30_000;

const persistedChanged = (a: ScreenplayState, b: ScreenplayState) =>
  PERSISTED_KEYS.some((key) => a[key] !== b[key]);

// True when nothing persisted has changed since `data` was captured
const unchangedSince = (data: ProjectData) => {
  const state = useScreenplayStore.getState();
  return PERSISTED_KEYS.every((key) => (state[key] ?? undefined) === (data[key] ?? undefined));
};

export function startAutoSave(delay: number = AUTO_SAVE_DELAY_MS): () => void {
  const unsubscribe = useScreenplayStore.subscribe((state, prev) => {
    // Opening, creating or importing a document is not an edit
    if (state.documentGeneration !== prev.documentGeneration) {
      cancelAutoSave();
      return;
    }
    if (!persistedChanged(state, prev)) return;

    if (!state.isDirty) state.setDirty(true);

    // File > New / opened .fdx: wait for an explicit save before
    // writing into whatever project happens to be open
    if (state.documentOrigin !== 'project') return;

    const projectId = useProjectsStore.getState().currentProjectId;
    if (!projectId) return;
    // Shared with us as Viewer/Commenter: edits stay local
    if (isReadOnlyProject(projectId)) return;

    scheduleAutoSave(
      projectId,
      () => useScreenplayStore.getState().getProjectData(),
      delay,
      (saved) => {
        if (unchangedSince(saved)) useScreenplayStore.getState().setDirty(false);
      }
    );
  });

  return () => {
    unsubscribe();
    cancelAutoSave();
  };
}
