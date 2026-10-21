// Full project backups: everything in the project (all apps) plus the
// media that lives only in this browser (dailies clips and reference
// images not in Drive), in one .otspbackup file (a ZIP). Restoring makes a
// new project from it.
import JSZip from 'jszip';
import type { ProjectData } from '../types/user';
import type { MediaRef } from '../types/dailies';
import { PROJECT_DATA_VERSION } from '../types/user';
import { parseProjectData } from './projectData';

export const BACKUP_EXTENSION = '.otspbackup';

/** Every media reference the project holds */
export function mediaRefs(data: ProjectData): MediaRef[] {
  return [...(data.dailies?.clips ?? []).map((c) => c.media), ...(data.references?.images ?? []).map((i) => i.media)];
}

const mediaPath = (ref: MediaRef) => `media/${ref.store}-${ref.id.replace(/[^\w.-]/g, '_')}`;

export interface BackupResult { blob: Blob; mediaIncluded: number; mediaMissing: number }

export async function createBackup(
  data: ProjectData,
  name: string,
  getBlob: (ref: MediaRef) => Promise<Blob | undefined>,
  opts: { includeDriveMedia?: boolean } = {}
): Promise<BackupResult> {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({ ...data, version: PROJECT_DATA_VERSION, savedAt: new Date().toISOString() }));
  let mediaIncluded = 0;
  let mediaMissing = 0;
  for (const ref of mediaRefs(data)) {
    if (ref.store === 'drive' && !opts.includeDriveMedia) continue; // safe in Drive already
    const blob = await getBlob(ref);
    if (blob) { zip.file(mediaPath(ref), blob); mediaIncluded++; } else mediaMissing++;
  }
  zip.file('README.txt', `OTSP project backup: ${name}\nMade ${new Date().toLocaleString()}.\nRestore it from OTSP Home > Restore Backup.\n`);
  return { blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), mediaIncluded, mediaMissing };
}

export interface RestoredBackup {
  data: ProjectData;
  media: { ref: MediaRef; blob: Blob }[];
}

export async function readBackup(file: Blob): Promise<RestoredBackup> {
  const zip = await JSZip.loadAsync(file);
  const json = await zip.file('project.json')?.async('string');
  if (!json) throw new Error("This file isn't an OTSP backup (no project.json inside).");
  const data = parseProjectData(json);
  const media: { ref: MediaRef; blob: Blob }[] = [];
  for (const ref of mediaRefs(data)) {
    const entry = zip.file(mediaPath(ref));
    if (entry) media.push({ ref, blob: new Blob([await entry.async('uint8array') as BlobPart], { type: ref.mime }) });
  }
  return { data, media };
}
