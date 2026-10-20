// Dailies (Frame.io-style review): clips, version stacks, comments
import type { StateCreator } from 'zustand';
import type { Dailies, DailiesClip, DailiesComment } from '../../types/dailies';
import { generateId } from '../../utils/fdx';
import type { DailiesSlice, ScreenplayState } from '../types';

const EMPTY: Dailies = { clips: [], comments: [] };

export const createDailiesSlice: StateCreator<ScreenplayState, [], [], DailiesSlice> = (set, get) => {
  const write = (dailies: Dailies) => set({ dailies, isDirty: true });
  const current = () => get().dailies ?? EMPTY;

  return {
    dailies: null,

    addDailiesClip: (clip, stackOnto) => {
      const d = current();
      const id = generateId();
      const stack = stackOnto ? d.clips.filter((c) => c.stackId === d.clips.find((x) => x.id === stackOnto)?.stackId) : [];
      const added: DailiesClip = {
        ...clip,
        id,
        stackId: stack[0]?.stackId ?? id,
        version: stack.length ? Math.max(...stack.map((c) => c.version)) + 1 : 1,
        // A new version inherits the stack's links
        sceneId: clip.sceneId ?? stack[0]?.sceneId,
        shootDayId: clip.shootDayId ?? stack[0]?.shootDayId,
        takeId: clip.takeId ?? stack[0]?.takeId,
      };
      write({ ...d, clips: [...d.clips, added] });
      return id;
    },

    updateDailiesClip: (id, updates) => {
      const d = current();
      write({ ...d, clips: d.clips.map((c) => (c.id === id ? { ...c, ...updates } : c)) });
    },

    deleteDailiesClip: (id) => {
      const d = current();
      write({ clips: d.clips.filter((c) => c.id !== id), comments: d.comments.filter((c) => c.clipId !== id) });
    },

    // Take one version out of its stack into its own asset
    unstackDailiesClip: (id) => {
      const d = current();
      write({ ...d, clips: d.clips.map((c) => (c.id === id ? { ...c, stackId: c.id, version: 1 } : c)) });
    },

    addDailiesComment: (comment) => {
      const d = current();
      const id = generateId();
      const added: DailiesComment = { ...comment, id, createdAt: new Date() };
      write({ ...d, comments: [...d.comments, added] });
      return id;
    },

    updateDailiesComment: (id, updates) => {
      const d = current();
      write({ ...d, comments: d.comments.map((c) => (c.id === id ? { ...c, ...updates } : c)) });
    },

    deleteDailiesComment: (id) => {
      const d = current();
      write({ ...d, comments: d.comments.filter((c) => c.id !== id && c.parentId !== id) });
    },
  };
};
