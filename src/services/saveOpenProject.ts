// File > Save (Mod+S): save to the open project (Google Drive or local).
// With no project open, go Home to create or pick one.
import { useScreenplayStore } from '../store/screenplayStore';
import { cancelAutoSave, useProjectsStore } from './projectService';

export async function saveOpenProject(): Promise<void> {
  const { currentProjectId, saveProject } = useProjectsStore.getState();
  const store = useScreenplayStore.getState();
  if (!currentProjectId) {
    store.setActiveApp('home');
    return;
  }
  cancelAutoSave();
  await saveProject(currentProjectId, store.getProjectData());
  store.setDirty(false);
  // An explicitly saved document belongs to this project from now on
  store.setDocumentOrigin('project');
}
