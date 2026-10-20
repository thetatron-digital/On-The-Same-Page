import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseProjectData } from '../utils/projectData';
import type { ProjectData } from '../types/user';

// A Drive file in memory: one JSON document with a revision counter
const drive = vi.hoisted(() => ({ json: '', rev: 0, by: 'Me', me: true }));
vi.mock('./googleDrive', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./googleDrive')>()),
  googleDrive: {
    getRevision: vi.fn(async () => ({ revision: String(drive.rev), modifiedTime: '', modifiedBy: drive.by, modifiedByMe: drive.me })),
    loadProject: vi.fn(async () => parseProjectData(drive.json)),
    saveProject: vi.fn(async (_id: string, data: ProjectData) => {
      Object.assign(drive, { json: JSON.stringify(data), rev: drive.rev + 1, by: 'Me', me: true });
      return { revision: String(drive.rev), modifiedTime: '', modifiedBy: 'Me', modifiedByMe: true };
    }),
  },
}));

const { useScreenplayStore } = await import('../store/screenplayStore');
const { loadDriveProject, pullRemoteChanges, saveDriveProject, useSyncStatus } = await import('./projectSync');

const store = () => useScreenplayStore.getState();
const texts = (data: ProjectData = store().getProjectData()) => data.screenplay.elements.map((e) => e.content.map((r) => r.text).join(''));

// Set the text of element i in a project
const withText = (data: ProjectData, i: number, text: string): ProjectData => ({
  ...data,
  screenplay: {
    ...data.screenplay,
    elements: data.screenplay.elements.map((e, k) => (k === i ? { ...e, content: [{ text }] } : e)),
  },
});
const editLocal = (i: number, text: string) => useScreenplayStore.setState({ screenplay: withText(store().getProjectData(), i, text).screenplay });
// Another editor saves a change to element i
const editRemote = (i: number, text: string) => {
  const theirs = withText(parseProjectData(drive.json), i, text);
  Object.assign(drive, { json: JSON.stringify(theirs), rev: drive.rev + 1, by: 'Alex', me: false });
};

beforeEach(async () => {
  store().resetToNew();
  const elements = ['INT. HOUSE - DAY', 'Ada waits.', 'Grace arrives.'].map((text, i) => ({
    id: `e${i}`, type: (i === 0 ? 'Scene Heading' : 'Action') as 'Scene Heading' | 'Action', content: [{ text }],
  }));
  useScreenplayStore.setState({ screenplay: { ...store().screenplay, elements } });
  Object.assign(drive, { json: JSON.stringify(store().getProjectData()), rev: 1, by: 'Me', me: true });
  store().loadFromProjectData(await loadDriveProject('p1'));
});

describe('project sync', () => {
  it('saves straight through when nobody else saved', async () => {
    editLocal(1, 'Ada waits, nervous.');
    await saveDriveProject('p1', store().getProjectData());
    expect(texts(parseProjectData(drive.json))[1]).toBe('Ada waits, nervous.');
    expect(useSyncStatus.getState()).toMatchObject({ state: 'synced', conflicts: [] });
  });

  it('takes a collaborator\'s save when we have no edits', async () => {
    editRemote(2, 'Grace bursts in.');
    expect(await pullRemoteChanges('p1')).toBe(true);
    expect(texts()[2]).toBe('Grace bursts in.');
    expect(store().isDirty).toBe(false);
    expect(useSyncStatus.getState()).toMatchObject({ state: 'synced', by: 'Alex' });
    expect(await pullRemoteChanges('p1')).toBe(false); // nothing new
  });

  it('merges a collaborator\'s save with our edits on pull, then saves the merge', async () => {
    editLocal(1, 'Ada paces.');
    editRemote(2, 'Grace bursts in.');
    await pullRemoteChanges('p1');
    expect(texts()).toEqual(['INT. HOUSE - DAY', 'Ada paces.', 'Grace bursts in.']);
    expect(useSyncStatus.getState()).toMatchObject({ state: 'merged', by: 'Alex', conflicts: [] });
    await saveDriveProject('p1', store().getProjectData());
    expect(texts(parseProjectData(drive.json))).toEqual(['INT. HOUSE - DAY', 'Ada paces.', 'Grace bursts in.']);
  });

  it('merges before saving when someone saved since we loaded', async () => {
    editRemote(2, 'Grace bursts in.');
    editLocal(1, 'Ada paces.');
    await saveDriveProject('p1', store().getProjectData());
    expect(texts(parseProjectData(drive.json))).toEqual(['INT. HOUSE - DAY', 'Ada paces.', 'Grace bursts in.']);
    expect(texts()).toEqual(['INT. HOUSE - DAY', 'Ada paces.', 'Grace bursts in.']);
  });

  it('keeps our text and reports a conflict when both edit the same line', async () => {
    editRemote(1, 'Ada sleeps.');
    editLocal(1, 'Ada paces.');
    await pullRemoteChanges('p1');
    expect(texts()[1]).toBe('Ada paces.');
    expect(useSyncStatus.getState().conflicts.length).toBe(1);
  });
});
