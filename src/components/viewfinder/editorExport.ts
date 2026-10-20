// ============================================
// STORYBOARD -> EDITING APPS
// ============================================
// A ZIP with the board images and audio plus a timeline file, like
// Storyboarder's "Export for Final Cut Pro X and Premiere"
// (findings/storyboarder.md). Open formats only:
//   - FCP7 XML (xmeml v4): Premiere Pro, DaVinci Resolve, older FCP
//   - FCPXML 1.9: Final Cut Pro
//   - OpenTimelineIO JSON (.otio): DaVinci Resolve and other OTIO tools
// Media paths are relative to the timeline file, so unzip and import.

import JSZip from 'jszip';
import type { StoryboardFrame } from '../../types/screenplay';
import type { BoardPosition } from '../../engine/storyboard/boards';

export interface TimelineClip {
  name: string; // shot label + text
  imageFile: string; // e.g. media/board-001-1A.png
  audioFile?: string;
  startFrame: number;
  frames: number; // board length in frames
  audioFrames?: number;
}

export interface TimelineSpec {
  name: string;
  fps: number;
  width: number;
  height: number;
  clips: TimelineClip[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const audioExt = (dataUrl: string) => {
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
  return mime.includes('wav') ? 'wav' : mime.includes('mpeg') ? 'mp3' : mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
};

/** Lay the boards out on a frame grid (no gaps, no drift from rounding) */
export function buildTimeline(frames: StoryboardFrame[], positions: BoardPosition[], opts: { name: string; fps: number; width: number; height: number }): TimelineSpec {
  const toFrames = (ms: number) => Math.round((ms / 1000) * opts.fps);
  const clips = frames.map((frame, i) => {
    const p = positions[i];
    const start = toFrames(p.startMs);
    const end = toFrames(p.startMs + p.durationMs);
    const pad = String(i + 1).padStart(3, '0');
    const text = (frame.dialogue || frame.actionNotes || '').replace(/\s+/g, ' ').slice(0, 60);
    return {
      name: text ? `${p.shot} ${text}` : `Shot ${p.shot}`,
      imageFile: `media/board-${pad}-${p.shot}.png`,
      audioFile: frame.audio ? `media/board-${pad}-${p.shot}.${audioExt(frame.audio.dataUrl)}` : undefined,
      startFrame: start,
      frames: Math.max(1, end - start),
      audioFrames: frame.audio ? Math.max(1, Math.min(end - start, toFrames(frame.audio.durationMs))) : undefined,
    };
  });
  return { ...opts, clips };
}

const totalFrames = (t: TimelineSpec) => t.clips.reduce((max, c) => Math.max(max, c.startFrame + c.frames), 0);

/** Final Cut Pro 7 XML (xmeml v4), which Premiere Pro and Resolve import */
export function toXmeml(t: TimelineSpec): string {
  const rate = `<rate><timebase>${t.fps}</timebase><ntsc>FALSE</ntsc></rate>`;
  const fileEl = (id: string, path: string, frames: number, kind: 'video' | 'audio') => `
            <file id="${id}">
              <name>${esc(path.split('/').pop()!)}</name>
              <pathurl>${esc(path)}</pathurl>
              ${rate}
              <duration>${frames}</duration>
              <media>${kind === 'video'
                ? `<video><samplecharacteristics><width>${t.width}</width><height>${t.height}</height></samplecharacteristics></video>`
                : '<audio><channelcount>1</channelcount></audio>'}</media>
            </file>`;
  const video = t.clips.map((c, i) => `
          <clipitem id="clipitem-v${i + 1}">
            <name>${esc(c.name)}</name>
            <duration>${c.frames}</duration>
            ${rate}
            <start>${c.startFrame}</start>
            <end>${c.startFrame + c.frames}</end>
            <in>0</in>
            <out>${c.frames}</out>${fileEl(`file-v${i + 1}`, c.imageFile, c.frames, 'video')}
          </clipitem>`).join('');
  const audio = t.clips.filter((c) => c.audioFile).map((c, i) => `
          <clipitem id="clipitem-a${i + 1}">
            <name>${esc(c.name)}</name>
            <duration>${c.audioFrames}</duration>
            ${rate}
            <start>${c.startFrame}</start>
            <end>${c.startFrame + c.audioFrames!}</end>
            <in>0</in>
            <out>${c.audioFrames}</out>${fileEl(`file-a${i + 1}`, c.audioFile!, c.audioFrames!, 'audio')}
            <sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>
          </clipitem>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${esc(t.name)}</name>
    <duration>${totalFrames(t)}</duration>
    ${rate}
    <media>
      <video>
        <format><samplecharacteristics>${rate}<width>${t.width}</width><height>${t.height}</height></samplecharacteristics></format>
        <track>${video}
        </track>
      </video>
      <audio>
        <track>${audio}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>
`;
}

/** FCPXML 1.9 for Final Cut Pro (stills as assets, audio connected below) */
export function toFcpxml(t: TimelineSpec): string {
  const fd = `1/${t.fps}s`;
  const time = (frames: number) => (frames === 0 ? '0s' : `${frames}/${t.fps}s`);
  const assets = t.clips.flatMap((c, i) => [
    `    <asset id="v${i + 1}" name="${esc(c.imageFile.split('/').pop()!)}" src="${esc(c.imageFile)}" start="0s" duration="0s" hasVideo="1" format="r1"/>`,
    ...(c.audioFile ? [`    <asset id="a${i + 1}" name="${esc(c.audioFile.split('/').pop()!)}" src="${esc(c.audioFile)}" start="0s" duration="${time(c.audioFrames!)}" hasAudio="1" audioSources="1" audioChannels="1"/>`] : []),
  ]);
  const spine = t.clips.map((c, i) => `          <video ref="v${i + 1}" name="${esc(c.name)}" offset="${time(c.startFrame)}" start="0s" duration="${time(c.frames)}">${c.audioFile
    ? `\n            <asset-clip ref="a${i + 1}" lane="-1" offset="0s" name="${esc(c.name)}" duration="${time(c.audioFrames!)}" audioRole="dialogue"/>\n          `
    : ''}</video>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat${t.height}p${t.fps}" frameDuration="${fd}" width="${t.width}" height="${t.height}"/>
${assets.join('\n')}
  </resources>
  <library>
    <event name="${esc(t.name)}">
      <project name="${esc(t.name)}">
        <sequence format="r1" duration="${time(totalFrames(t))}" tcStart="0s" tcFormat="NDF">
          <spine>
${spine}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}

/** OpenTimelineIO JSON (OTIO_SCHEMA Timeline.1) */
export function toOtio(t: TimelineSpec): string {
  const range = (start: number, duration: number) => ({
    OTIO_SCHEMA: 'TimeRange.1',
    start_time: { OTIO_SCHEMA: 'RationalTime.1', rate: t.fps, value: start },
    duration: { OTIO_SCHEMA: 'RationalTime.1', rate: t.fps, value: duration },
  });
  const clip = (name: string, file: string, frames: number) => ({
    OTIO_SCHEMA: 'Clip.2',
    name,
    source_range: range(0, frames),
    media_references: {
      DEFAULT_MEDIA: { OTIO_SCHEMA: 'ExternalReference.1', target_url: file, available_range: range(0, frames) },
    },
    active_media_reference_key: 'DEFAULT_MEDIA',
    metadata: {},
  });
  const gap = (frames: number) => ({ OTIO_SCHEMA: 'Gap.1', source_range: range(0, frames) });
  const audioChildren: object[] = [];
  let cursor = 0;
  for (const c of t.clips) {
    if (!c.audioFile) continue;
    if (c.startFrame > cursor) audioChildren.push(gap(c.startFrame - cursor));
    audioChildren.push(clip(c.name, c.audioFile, c.audioFrames!));
    cursor = c.startFrame + c.audioFrames!;
  }
  const timeline = {
    OTIO_SCHEMA: 'Timeline.1',
    name: t.name,
    global_start_time: { OTIO_SCHEMA: 'RationalTime.1', rate: t.fps, value: 0 },
    tracks: {
      OTIO_SCHEMA: 'Stack.1',
      name: 'tracks',
      children: [
        { OTIO_SCHEMA: 'Track.1', name: 'Boards', kind: 'Video', children: t.clips.map((c) => clip(c.name, c.imageFile, c.frames)) },
        ...(audioChildren.length ? [{ OTIO_SCHEMA: 'Track.1', name: 'Board Audio', kind: 'Audio', children: audioChildren }] : []),
      ],
    },
    metadata: { created_by: 'OTSP ViewFinder' },
  };
  return JSON.stringify(timeline, null, 2);
}

const dataUrlBytes = (dataUrl: string) => {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** ZIP: timeline files for all three apps + media/ with images and audio */
export async function editorPackage(
  frames: StoryboardFrame[],
  timeline: TimelineSpec,
  renderBoard: (frame: StoryboardFrame) => Promise<string>
): Promise<Blob> {
  const zip = new JSZip();
  const safe = timeline.name.replace(/[^\w\- ]+/g, '').trim() || 'Storyboard';
  zip.file(`${safe} (Premiere, Resolve).xml`, toXmeml(timeline));
  zip.file(`${safe} (Final Cut Pro).fcpxml`, toFcpxml(timeline));
  zip.file(`${safe}.otio`, toOtio(timeline));
  zip.file('README.txt',
    'Unzip, then import the timeline into your editor:\n' +
    '- Premiere Pro / DaVinci Resolve: the .xml file (File > Import)\n' +
    '- Final Cut Pro: the .fcpxml file (File > Import > XML)\n' +
    '- DaVinci Resolve / OTIO tools: the .otio file\n' +
    'Board images and audio are in media/. Made with OTSP.\n');
  for (let i = 0; i < frames.length; i++) {
    const clip = timeline.clips[i];
    zip.file(clip.imageFile, dataUrlBytes(await renderBoard(frames[i])));
    if (clip.audioFile && frames[i].audio) zip.file(clip.audioFile, dataUrlBytes(frames[i].audio!.dataUrl));
  }
  return zip.generateAsync({ type: 'blob' });
}
