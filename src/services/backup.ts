// File > Save Backup… and Home > Restore Backup
import { useScreenplayStore } from '../store/screenplayStore';
import { useProjectsStore } from './projectService';
import { openProject } from './openProject';
import { cacheBlob, getCachedBlob } from './mediaStore';
import { BACKUP_EXTENSION, createBackup, readBackup } from '../utils/projectBackup';

export async function saveBackup(): Promise<string> {
  const store = useScreenplayStore.getState();
  const name = store.screenplay.title || 'Untitled';
  const { blob, mediaIncluded, mediaMissing } = await createBackup(store.getProjectData(), name, getCachedBlob);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Project'} ${new Date().toISOString().slice(0, 10)}${BACKUP_EXTENSION}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return [
    `Backup saved${mediaIncluded ? ` with ${mediaIncluded} clip${mediaIncluded === 1 ? '' : 's'} and images kept in this browser` : ''}.`,
    mediaMissing ? ` ${mediaMissing} media file${mediaMissing === 1 ? ' is' : 's are'} not in this browser and could not be included.` : '',
  ].join('');
}

/** Make a new project from a backup and open it */
export async function restoreBackup(file: File): Promise<void> {
  const { data, media } = await readBackup(file);
  for (const m of media) await cacheBlob(m.ref, m.blob).catch(() => {});
  const name = `${data.screenplay.title || file.name.replace(BACKUP_EXTENSION, '')} (restored)`;
  const project = await useProjectsStore.getState().createProject(name, data);
  await openProject(project.id);
}
