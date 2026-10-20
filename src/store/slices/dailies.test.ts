import { beforeEach, describe, expect, it } from 'vitest';
import { useScreenplayStore } from '../screenplayStore';
import { parseProjectData } from '../../utils/projectData';
import type { DailiesClip } from '../../types/dailies';

const store = () => useScreenplayStore.getState();
const clip = (name: string): Omit<DailiesClip, 'id' | 'stackId' | 'version'> => ({
  name, kind: 'video', durationS: 10, fps: 24, status: 'none', uploadedAt: new Date('2026-10-20T10:00:00Z'),
  media: { store: 'local', id: `m-${name}`, mime: 'video/mp4', size: 1000, fileName: `${name}.mp4` },
});

describe('dailies store', () => {
  beforeEach(() => store().resetToNew());

  it('stacks new versions and carries the stack links', () => {
    const v1 = store().addDailiesClip({ ...clip('1A-T1'), sceneId: 's1' });
    const v2 = store().addDailiesClip(clip('1A-T1 v2'), v1);
    const other = store().addDailiesClip(clip('2B-T3'));
    const clips = store().dailies!.clips;
    expect(clips.find((c) => c.id === v2)).toMatchObject({ stackId: v1, version: 2, sceneId: 's1' });
    expect(clips.find((c) => c.id === other)).toMatchObject({ stackId: other, version: 1 });
    store().unstackDailiesClip(v2);
    expect(store().dailies!.clips.find((c) => c.id === v2)).toMatchObject({ stackId: v2, version: 1 });
  });

  it('deletes a clip with its comments, and a comment with its replies', () => {
    const a = store().addDailiesClip(clip('A'));
    const b = store().addDailiesClip(clip('B'));
    const c1 = store().addDailiesComment({ clipId: a, text: 'Soft focus', time: 2.5, author: 'Me' });
    store().addDailiesComment({ clipId: a, parentId: c1, text: 'Agreed', author: 'Alex' });
    store().addDailiesComment({ clipId: b, text: 'Great', author: 'Me' });
    store().deleteDailiesComment(c1);
    expect(store().dailies!.comments.map((c) => c.text)).toEqual(['Great']);
    store().deleteDailiesClip(b);
    expect(store().dailies!.comments).toEqual([]);
  });

  it('saves and reopens with the project, dates intact', () => {
    const a = store().addDailiesClip(clip('A'));
    store().addDailiesComment({ clipId: a, text: 'Note', time: 1, author: 'Me' });
    const json = JSON.stringify(store().getProjectData());
    store().resetToNew();
    store().loadFromProjectData(parseProjectData(json));
    expect(store().dailies!.clips[0].uploadedAt).toBeInstanceOf(Date);
    expect(store().dailies!.comments[0].createdAt).toBeInstanceOf(Date);
  });
});
