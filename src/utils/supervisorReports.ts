// Script supervisor paperwork for editorial: the Editor's Log (every take,
// scene by scene) and an Avid Log Exchange (ALE) file.
import type { TakeEntry } from '../types/screenplay';

export interface EditorsLogRow {
  scene: string;
  setup: string;
  take: number;
  camera: string;
  tcIn: string;
  tcOut: string;
  duration: string;
  rating: string; // Print / Hold / NG
  notes: string;
}

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const notesOf = (t: TakeEntry) =>
  [t.directorNotes && `Dir: ${t.directorNotes}`, t.editorNotes, t.technicalNotes && `Tech: ${t.technicalNotes}`, t.continuityNotes && `Cont: ${t.continuityNotes}`]
    .filter(Boolean).join(' · ');

const mmss = (seconds?: number) => (seconds ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : '');

/** Takes in editorial order: scene, setup, take, camera */
export function editorsLog(takes: TakeEntry[]): EditorsLogRow[] {
  return [...takes]
    .sort((a, b) => natural(a.sceneNumber, b.sceneNumber) || natural(a.shotNumber, b.shotNumber) || a.takeNumber - b.takeNumber || natural(a.camera, b.camera))
    .map((t) => ({
      scene: t.sceneNumber,
      setup: t.shotNumber,
      take: t.takeNumber,
      camera: t.camera,
      tcIn: t.timecodeIn ?? '',
      tcOut: t.timecodeOut ?? '',
      duration: mmss(t.duration),
      rating: t.circled ? 'Print' : t.rating || '',
      notes: notesOf(t),
    }));
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function editorsLogCsv(rows: EditorsLogRow[]): string {
  const head = ['Scene', 'Setup', 'Take', 'Camera', 'TC In', 'TC Out', 'Duration', 'Rating', 'Notes'];
  return [head, ...rows.map((r) => [r.scene, r.setup, r.take, r.camera, r.tcIn, r.tcOut, r.duration, r.rating, r.notes])]
    .map((r) => r.map(csvCell).join(','))
    .join('\n') + '\n';
}

export interface AleOptions {
  fps?: number;            // 23.976, 24, 25, 29.97...
  videoFormat?: string;    // 1080, 720, NTSC, PAL
  audioFormat?: string;    // 48khz
}

// ALE fields are tab separated, one line per clip: no tabs or line breaks inside
const field = (v: string | number | undefined) => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim();

/**
 * Avid Log Exchange for Media Composer (and Resolve). Avid matches rows to
 * clips by Name, or by Tape + Start when timecodes are filled in.
 */
export function generateALE(takes: TakeEntry[], opts: AleOptions = {}): string {
  const fps = opts.fps ?? 23.976;
  const fpsText = Number.isInteger(fps) ? String(fps) : fps.toFixed(3).replace(/0+$/, '');
  const columns = ['Name', 'Tracks', 'Start', 'End', 'Scene', 'Take', 'Camera', 'Circled', 'Rating', 'Duration', 'Comments'];
  const multiCam = new Set(takes.map((t) => t.camera)).size > 1;
  const rows = editorsLog(takes).map((r) => {
    // Slate as editors read it: scene + setup ("12A"), then take ("12A-3"), camera when several
    const slate = !r.setup ? r.scene : r.setup.startsWith(r.scene) ? r.setup : `${r.scene}${r.setup}`;
    const name = `${slate}-${r.take}${multiCam && r.camera ? `_${r.camera}` : ''}`;
    return [name, 'VA1A2', r.tcIn, r.tcOut, slate, r.take, r.camera, r.rating === 'Print' ? 'Y' : '', r.rating, r.duration, r.notes]
      .map(field).join('\t');
  });
  return [
    'Heading',
    'FIELD_DELIM\tTABS',
    `VIDEO_FORMAT\t${opts.videoFormat ?? '1080'}`,
    `AUDIO_FORMAT\t${opts.audioFormat ?? '48khz'}`,
    `FPS\t${fpsText}`,
    '',
    'Column',
    columns.join('\t'),
    '',
    'Data',
    ...rows,
    '',
  ].join('\n');
}
