import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScreenplayStore } from '../store/screenplayStore';
import { useProjectsStore } from './projectService';
import { AUTO_SAVE_DELAY_MS, startAutoSave } from './autoSave';

const store = () => useScreenplayStore.getState();
const saveProject = vi.fn(async () => {});
let stop: () => void;

const typeInFirstElement = (text: string) =>
  store().updateElement(store().screenplay.elements[0].id, [{ text }]);

beforeEach(() => {
  vi.useFakeTimers();
  saveProject.mockClear();
  store().resetToNew();
  useProjectsStore.setState({ currentProjectId: 'project-1', saveProject });
  stop = startAutoSave();
});

afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe('auto-save', () => {
  it('saves the open project 30 s after the last edit', async () => {
    typeInFirstElement('INT. HOUSE');
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS - 1);
    expect(saveProject).not.toHaveBeenCalled();

    typeInFirstElement('INT. HOUSE - DAY'); // restarts the timer
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);

    expect(saveProject).toHaveBeenCalledTimes(1);
    const [projectId, data] = saveProject.mock.calls[0] as unknown as [string, { screenplay: { elements: { content: { text: string }[] }[] } }];
    expect(projectId).toBe('project-1');
    expect(data.screenplay.elements[0].content[0].text).toBe('INT. HOUSE - DAY');
    expect(store().isDirty).toBe(false);
  });

  it('marks the project dirty for changes whose actions never set isDirty', async () => {
    store().toggleSceneNumbers();
    expect(store().isDirty).toBe(true);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
    expect(saveProject).toHaveBeenCalledTimes(1);
  });

  it('does not save when a project is merely opened', async () => {
    const data = store().getProjectData();
    store().loadFromProjectData(data);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
    expect(saveProject).not.toHaveBeenCalled();
  });

  it('cancels a pending save when another document is opened', async () => {
    typeInFirstElement('INT. HOUSE');
    store().loadFromProjectData(store().getProjectData());
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
    expect(saveProject).not.toHaveBeenCalled();
  });

  it('never writes a File > New document into the open project until saved manually', async () => {
    store().newScreenplay();
    typeInFirstElement('A different script');
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
    expect(saveProject).not.toHaveBeenCalled();
    expect(store().isDirty).toBe(true);

    store().setDocumentOrigin('project'); // what a manual Save does
    typeInFirstElement('A different script, revised');
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
    expect(saveProject).toHaveBeenCalledTimes(1);
  });

  it('never auto-saves the blank startup document into the last session\'s project', async () => {
    useScreenplayStore.setState(useScreenplayStore.getInitialState(), true);
    expect(store().documentOrigin).toBe('file');
    typeInFirstElement('INT. HOUSE');
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
    expect(saveProject).not.toHaveBeenCalled();
  });

  it('does nothing without an open project', async () => {
    useProjectsStore.setState({ currentProjectId: null });
    typeInFirstElement('INT. HOUSE');
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
    expect(saveProject).not.toHaveBeenCalled();
    expect(store().isDirty).toBe(true);
  });

  it('stays dirty if more edits land while a save is in flight', async () => {
    let finishSave!: () => void;
    saveProject.mockImplementationOnce(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    typeInFirstElement('INT. HOUSE');
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
    typeInFirstElement('INT. HOUSE - NIGHT');
    finishSave();
    await vi.advanceTimersByTimeAsync(0);
    expect(store().isDirty).toBe(true);
  });
});
