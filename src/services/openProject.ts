// Open a saved project (Drive or local) into the editor
import { useScreenplayStore } from '../store/screenplayStore';
import { useProjectsStore } from './projectService';
import type { AppMode } from '../store/types';

export async function openProject(projectId: string, app: AppMode = 'rewriter'): Promise<void> {
  const projects = useProjectsStore.getState();
  // loadProject needs the list to know whether the id is a local project
  if (!projects.projects.some((p) => p.id === projectId)) {
    await projects.fetchProjects();
  }
  const data = await useProjectsStore.getState().loadProject(projectId);
  const screenplay = useScreenplayStore.getState();
  screenplay.loadFromProjectData(data);
  screenplay.setActiveApp(app);
}
