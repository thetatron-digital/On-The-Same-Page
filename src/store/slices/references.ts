// Reference library: images with facets, and decks of them
import type { StateCreator } from 'zustand';
import type { ReferenceImage, References } from '../../types/references';
import { generateId } from '../../utils/fdx';
import type { ReferencesSlice, ScreenplayState } from '../types';

const EMPTY: References = { images: [], decks: [] };

export const createReferencesSlice: StateCreator<ScreenplayState, [], [], ReferencesSlice> = (set, get) => {
  const write = (references: References) => set({ references, isDirty: true });
  const current = () => get().references ?? EMPTY;

  return {
    references: null,

    addReferenceImage: (image) => {
      const id = generateId();
      const r = current();
      write({ ...r, images: [...r.images, { ...image, id } as ReferenceImage] });
      return id;
    },

    updateReferenceImage: (id, updates) => {
      const r = current();
      write({ ...r, images: r.images.map((i) => (i.id === id ? { ...i, ...updates } : i)) });
    },

    deleteReferenceImage: (id) => {
      const r = current();
      write({
        images: r.images.filter((i) => i.id !== id),
        decks: r.decks.map((d) => (d.imageIds.includes(id) ? { ...d, imageIds: d.imageIds.filter((x) => x !== id) } : d)),
      });
    },

    addReferenceDeck: (name, imageIds = []) => {
      const id = generateId();
      const r = current();
      write({ ...r, decks: [...r.decks, { id, name, imageIds, createdAt: new Date() }] });
      return id;
    },

    updateReferenceDeck: (id, updates) => {
      const r = current();
      write({ ...r, decks: r.decks.map((d) => (d.id === id ? { ...d, ...updates } : d)) });
    },

    deleteReferenceDeck: (id) => {
      const r = current();
      write({ ...r, decks: r.decks.filter((d) => d.id !== id) });
    },

    toggleImageInDeck: (deckId, imageId) => {
      const r = current();
      write({
        ...r,
        decks: r.decks.map((d) => (d.id !== deckId ? d : {
          ...d,
          imageIds: d.imageIds.includes(imageId) ? d.imageIds.filter((x) => x !== imageId) : [...d.imageIds, imageId],
        })),
      });
    },
  };
};
