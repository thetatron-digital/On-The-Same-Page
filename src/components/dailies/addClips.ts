// Adding clips to Dailies: read each file, keep its bytes (browser, and
// Drive for Drive projects), share Drive clips with the project's people,
// then add it to the library (or as the next version of a clip).
import { useScreenplayStore } from '../../store/screenplayStore';
import { useAuthStore, useProjectsStore } from '../../services/projectService';
import { googleDrive } from '../../services/googleDrive';
import { shareMediaWith } from '../../services/driveMedia';
import { storeClipMedia } from '../../services/mediaStore';
import { isReadOnlyProject } from '../../services/projectSync';
import { probeMedia } from './dailiesMedia';
import { useDailiesUi } from './dailiesUi';

/** Clips go to Drive when the open project is a Drive project we can edit */
export function clipsGoToDrive(): boolean {
  const { currentProjectId, projects } = useProjectsStore.getState();
  const project = projects.find((p) => p.id === currentProjectId);
  return !!(useAuthStore.getState().user && project && !project.isLocal && !isReadOnlyProject(currentProjectId));
}

const clipName = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

export async function addClips(files: File[], stackOnto?: string): Promise<string[]> {
  const ui = useDailiesUi.getState();
  const toDrive = clipsGoToDrive();
  const user = useAuthStore.getState().user;
  const projectId = useProjectsStore.getState().currentProjectId;
  const added: string[] = [];
  let members: string[] | null = null;

  for (const file of files) {
    const key = `${file.name}-${file.size}-${Date.now()}`;
    ui.setUpload(key, { name: file.name, sent: 0, total: file.size });
    try {
      const probe = await probeMedia(file);
      const media = await storeClipMedia(file, { toDrive, onProgress: (p) => ui.setUpload(key, { sent: p.sent, total: p.total }) });
      if (media.store === 'drive' && projectId) {
        members ??= await googleDrive.listMembers(projectId)
          .then((list) => list.filter((m) => m.type === 'user' && m.email && m.email !== user?.email).map((m) => m.email!))
          .catch(() => []);
        if (members.length) void shareMediaWith([media.id], members);
      }
      const id = useScreenplayStore.getState().addDailiesClip({
        name: clipName(file.name),
        media,
        kind: probe.kind,
        durationS: probe.durationS,
        fps: 24, // refined when the clip first plays
        width: probe.width,
        height: probe.height,
        thumbnail: probe.thumbnail,
        status: 'needs-review',
        uploadedBy: user?.name,
        uploadedAt: new Date(),
      }, stackOnto);
      // Each further file in a drop onto a clip stacks on top of the last
      if (stackOnto) stackOnto = id;
      added.push(id);
      ui.setUpload(key, null);
    } catch (error) {
      ui.setUpload(key, { error: error instanceof Error ? error.message : 'Could not add this file' });
    }
  }
  return added;
}
