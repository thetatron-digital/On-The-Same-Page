// BluePrint/CorkBoard and script extras: beat boards, versions, notes, split view, story outline
import type { StateCreator } from 'zustand';
import type { ScriptVersion, ScriptNote, StoryCharacter, StoryBeat } from '../../types/screenplay';
import { DEFAULT_BEAT_STRUCTURE } from '../../types/screenplay';
import { generateId } from '../../utils/fdx';
import { calculateWritingStats } from '../helpers';
import type { ScreenplayState, StorySlice } from '../types';

export const createStorySlice: StateCreator<ScreenplayState, [], [], StorySlice> = (set, get) => ({
  // Beat Board state
  beatBoards: [],
  activeBeatBoardId: null,

  // Version Management state
  versions: [],
  activeVersionId: null,

  // Script Notes state
  scriptNotes: [],
  activeNoteId: null,

  // Split View state
  splitContent: {
    audio: [{ id: generateId(), text: '' }],
    video: [{ id: generateId(), text: '' }],
    isIndependent: false,
    swapped: false,
  },

  // Story Outline state
  storyOutline: {
    plot: {
      title: '',
      logline: '',
      themes: '',
      storyTypes: [],
      genres: [],
      tones: [],
      audience: '',
      setting: '',
      bStory: '',
      otherDetails: '',
    },
    characters: [],
    acts: {
      act1: '',
      act2a: '',
      act2b: '',
      act3: '',
    },
    beats: [],
  },

  // Beat Board actions
  createBeatBoard: (name) => {
    const id = generateId();
    set((state) => ({
      beatBoards: [...state.beatBoards, { id, name, beats: [] }],
      activeBeatBoardId: id,
    }));
    return id;
  },

  deleteBeatBoard: (id) =>
    set((state) => ({
      beatBoards: state.beatBoards.filter((b) => b.id !== id),
      activeBeatBoardId: state.activeBeatBoardId === id ? null : state.activeBeatBoardId,
    })),

  setActiveBeatBoard: (id) => set({ activeBeatBoardId: id }),

  addBeat: (boardId, beat) => {
    const id = generateId();
    set((state) => ({
      beatBoards: state.beatBoards.map((board) =>
        board.id === boardId
          ? { ...board, beats: [...board.beats, { ...beat, id }] }
          : board
      ),
      isDirty: true,
    }));
    return id;
  },

  updateBeat: (boardId, beatId, updates) =>
    set((state) => ({
      beatBoards: state.beatBoards.map((board) =>
        board.id === boardId
          ? {
              ...board,
              beats: board.beats.map((beat) =>
                beat.id === beatId ? { ...beat, ...updates } : beat
              ),
            }
          : board
      ),
      isDirty: true,
    })),

  deleteBeat: (boardId, beatId) =>
    set((state) => ({
      beatBoards: state.beatBoards.map((board) =>
        board.id === boardId
          ? { ...board, beats: board.beats.filter((b) => b.id !== beatId) }
          : board
      ),
      isDirty: true,
    })),

  sendBeatToScript: (boardId, beatId) => {
    const state = get();
    const board = state.beatBoards.find((b) => b.id === boardId);
    const beat = board?.beats.find((b) => b.id === beatId);
    if (!beat) return undefined;

    // Create a scene heading from the beat
    const sceneId = state.addElement(undefined, 'Scene Heading');
    state.updateElement(sceneId, [{ text: beat.title }]);

    // If there's a description, add it as action
    if (beat.description) {
      const actionId = state.addElement(sceneId, 'Action');
      state.updateElement(actionId, [{ text: beat.description }]);
    }

    // Link the beat to the scene
    state.updateBeat(boardId, beatId, { linkedSceneId: sceneId });

    return sceneId;
  },

  // Version Management actions
  createVersion: (name) => {
    const state = get();
    const id = generateId();
    const version: ScriptVersion = {
      id,
      name,
      timestamp: new Date(),
      screenplay: JSON.parse(JSON.stringify(state.screenplay)),
      isActive: false,
    };
    set((state) => ({
      versions: [...state.versions, version],
    }));
    return id;
  },

  switchVersion: (versionId) => {
    const state = get();
    const version = state.versions.find((v) => v.id === versionId);
    if (!version) return;

    // Save current to active version before switching
    const updatedVersions = state.versions.map((v) =>
      v.id === state.activeVersionId
        ? { ...v, screenplay: JSON.parse(JSON.stringify(state.screenplay)), isActive: false }
        : v.id === versionId
        ? { ...v, isActive: true }
        : v
    );

    const stats = calculateWritingStats(version.screenplay);
    set({
      screenplay: JSON.parse(JSON.stringify(version.screenplay)),
      versions: updatedVersions,
      activeVersionId: versionId,
      stats,
      isDirty: false,
    });
  },

  deleteVersion: (versionId) =>
    set((state) => ({
      versions: state.versions.filter((v) => v.id !== versionId),
      activeVersionId: state.activeVersionId === versionId ? null : state.activeVersionId,
    })),

  renameVersion: (versionId, name) =>
    set((state) => ({
      versions: state.versions.map((v) =>
        v.id === versionId ? { ...v, name } : v
      ),
    })),

  // Script Notes actions
  addNote: (elementId, content, author = 'You', fields = {}) => {
    const id = generateId();
    const note: ScriptNote = {
      kind: 'script',
      ...fields,
      id,
      elementId,
      author,
      content,
      timestamp: new Date(),
      resolved: false,
    };
    set((state) => ({
      scriptNotes: [...state.scriptNotes, note],
    }));
    return id;
  },

  updateNote: (noteId, content) =>
    set((state) => ({
      scriptNotes: state.scriptNotes.map((n) =>
        n.id === noteId ? { ...n, content } : n
      ),
    })),

  updateNoteFields: (noteId, changes) =>
    set((state) => ({
      scriptNotes: state.scriptNotes.map((n) =>
        n.id === noteId ? { ...n, ...changes, id: n.id, modifiedAt: new Date() } : n
      ),
    })),

  deleteNote: (noteId) =>
    set((state) => ({
      scriptNotes: state.scriptNotes.filter((n) => n.id !== noteId),
      activeNoteId: state.activeNoteId === noteId ? null : state.activeNoteId,
    })),

  setActiveNote: (noteId) => set({ activeNoteId: noteId }),

  resolveNote: (noteId) =>
    set((state) => ({
      scriptNotes: state.scriptNotes.map((n) =>
        n.id === noteId ? { ...n, resolved: true } : n
      ),
    })),

  // Split View actions
  toggleSplitIndependent: () =>
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        isIndependent: !state.splitContent.isIndependent,
      },
    })),

  toggleSplitSwapped: () =>
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        swapped: !state.splitContent.swapped,
      },
    })),

  updateSplitAudio: (entries) =>
    set((state) => ({
      splitContent: { ...state.splitContent, audio: entries },
    })),

  updateSplitVideo: (entries) =>
    set((state) => ({
      splitContent: { ...state.splitContent, video: entries },
    })),

  addSplitEntry: (column, text = '') => {
    const id = generateId();
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        [column]: [...state.splitContent[column], { id, text }],
      },
    }));
    return id;
  },

  updateSplitEntry: (column, id, text) =>
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        [column]: state.splitContent[column].map((entry) =>
          entry.id === id ? { ...entry, text } : entry
        ),
      },
    })),

  deleteSplitEntry: (column, id) =>
    set((state) => {
      const filtered = state.splitContent[column].filter((e) => e.id !== id);
      // Keep at least one empty entry
      const entries = filtered.length > 0 ? filtered : [{ id: generateId(), text: '' }];
      return {
        splitContent: {
          ...state.splitContent,
          [column]: entries,
        },
      };
    }),

  // Story Outline actions
  updatePlotOverview: (updates) =>
    set((state) => {
      const newPlot = { ...state.storyOutline.plot, ...updates };

      // If title is updated, sync to screenplay title page
      const screenplayUpdates: Partial<{ screenplay: typeof state.screenplay }> = {};
      if (updates.title !== undefined) {
        screenplayUpdates.screenplay = {
          ...state.screenplay,
          title: updates.title,
          titlePage: { ...state.screenplay.titlePage, title: updates.title },
        };
      }

      return {
        storyOutline: {
          ...state.storyOutline,
          plot: newPlot,
        },
        ...screenplayUpdates,
        isDirty: true,
      };
    }),

  addCharacter: () => {
    const id = generateId();
    const newCharacter: StoryCharacter = {
      id,
      name: '',
      role: 'Other',
      characterArc: 'Positive Arc',
      archetypes: [],
      physicalDescription: '',
      personality: '',
      want: '',
      need: '',
      lie: '',
      ghost: '',
      notes: '',
    };
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        characters: [...state.storyOutline.characters, newCharacter],
      },
      isDirty: true,
    }));
    return id;
  },

  updateCharacter: (id, updates) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        characters: state.storyOutline.characters.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      },
      isDirty: true,
    })),

  deleteCharacter: (id) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        characters: state.storyOutline.characters.filter((c) => c.id !== id),
      },
      isDirty: true,
    })),

  updateActs: (updates) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        acts: { ...state.storyOutline.acts, ...updates },
      },
      isDirty: true,
    })),

  updateBeatContent: (beatId, description) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        beats: state.storyOutline.beats.map((b) =>
          b.id === beatId ? { ...b, description } : b
        ),
      },
      isDirty: true,
    })),

  linkBeatToScene: (beatId, sceneId) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        beats: state.storyOutline.beats.map((b) =>
          b.id === beatId ? { ...b, linkedSceneId: sceneId } : b
        ),
      },
    })),

  initializeBeats: () =>
    set((state) => {
      // Only initialize if beats are empty
      if (state.storyOutline.beats.length > 0) return state;

      const beats: StoryBeat[] = DEFAULT_BEAT_STRUCTURE.map((template) => ({
        id: generateId(),
        name: template.name,
        act: template.act,
        description: '',
      }));

      return {
        storyOutline: {
          ...state.storyOutline,
          beats,
        },
      };
    }),

  addStoryBeat: (beat) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        beats: [...state.storyOutline.beats, beat],
      },
      isDirty: true,
    })),
});
