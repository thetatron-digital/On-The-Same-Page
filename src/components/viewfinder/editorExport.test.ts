import { describe, expect, it } from 'vitest';
import { buildTimeline, toFcpxml, toOtio, toXmeml } from './editorExport';
import { boardPositions } from '../../engine/storyboard/boards';
import type { StoryboardFrame } from '../../types/screenplay';

const frames: StoryboardFrame[] = [
  { id: 'a', order: 1, description: '', newShot: true, durationMs: 1500, actionNotes: 'Wide on the diner & lot' },
  { id: 'b', order: 2, description: '', dialogue: 'MAYA: Keep it.', audio: { dataUrl: 'data:audio/wav;base64,AAAA', name: 'l', durationMs: 1000 } },
  { id: 'c', order: 3, description: '', newShot: true, durationMs: 1250 },
];
const positions = boardPositions(frames, 2000);
const t = buildTimeline(frames, positions, { name: 'Scene 1', fps: 24, width: 1280, height: 720 });

describe('editor exports', () => {
  it('lays boards on a frame grid without gaps', () => {
    expect(t.clips.map((c) => [c.startFrame, c.frames, c.imageFile])).toEqual([
      [0, 36, 'media/board-001-1A.png'],
      [36, 48, 'media/board-002-1B.png'],
      [84, 30, 'media/board-003-2A.png'],
    ]);
    expect(t.clips[1]).toMatchObject({ audioFile: 'media/board-002-1B.wav', audioFrames: 24 });
  });

  it('writes FCP7 XML with escaped names and an audio track', () => {
    const xml = toXmeml(t);
    expect(xml).toContain('<xmeml version="4">');
    expect(xml).toContain('<name>1A Wide on the diner &amp; lot</name>');
    expect(xml).toContain('<start>84</start>');
    expect(xml).toContain('<pathurl>media/board-002-1B.wav</pathurl>');
    expect(new DOMParser().parseFromString(xml, 'text/xml').querySelector('parsererror')).toBeNull();
  });

  it('writes FCPXML 1.9 with rational times', () => {
    const xml = toFcpxml(t);
    expect(xml).toContain('frameDuration="1/24s"');
    expect(xml).toContain('offset="36/24s"');
    expect(xml).toContain('audioRole="dialogue"');
    expect(new DOMParser().parseFromString(xml, 'text/xml').querySelector('parsererror')).toBeNull();
  });

  it('writes OpenTimelineIO with a gap before late audio', () => {
    const otio = JSON.parse(toOtio(t));
    const [video, audio] = otio.tracks.children;
    expect(video.children).toHaveLength(3);
    expect(video.children[2].source_range.duration.value).toBe(30);
    expect(audio.children.map((c: { OTIO_SCHEMA: string }) => c.OTIO_SCHEMA)).toEqual(['Gap.1', 'Clip.2']);
    expect(audio.children[0].source_range.duration.value).toBe(36);
  });
});
