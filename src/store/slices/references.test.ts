import { beforeEach, describe, expect, it } from 'vitest';
import { useScreenplayStore } from '../screenplayStore';
import { parseProjectData } from '../../utils/projectData';
import type { ReferenceImage } from '../../types/references';

const store = () => useScreenplayStore.getState();
const image = (name: string): Omit<ReferenceImage, 'id'> => ({
  media: { store: 'local', id: name, mime: 'image/jpeg', size: 1, fileName: `${name}.jpg` }, thumbnail: '', width: 4, height: 3,
  look: { palette: [], temperature: 'neutral', saturation: 'natural', contrast: 'medium', key: 'medium' },
  facets: { timeOfDay: ['Night'] }, credits: { title: name }, keywords: [], sceneIds: [], shotIds: [], addedAt: new Date('2026-10-20T09:00:00Z'),
});

describe('reference library store', () => {
  beforeEach(() => store().resetToNew());

  it('keeps decks in step when images go, and saves with the project', () => {
    const a = store().addReferenceImage(image('a'));
    const b = store().addReferenceImage(image('b'));
    const deck = store().addReferenceDeck('Night look', [a]);
    store().toggleImageInDeck(deck, b);
    store().toggleImageInDeck(deck, a);
    expect(store().references!.decks[0].imageIds).toEqual([b]);
    store().deleteReferenceImage(b);
    expect(store().references!.decks[0].imageIds).toEqual([]);
    const json = JSON.stringify(store().getProjectData());
    store().resetToNew();
    store().loadFromProjectData(parseProjectData(json));
    expect(store().references!.images[0].addedAt).toBeInstanceOf(Date);
    expect(store().references!.decks[0].name).toBe('Night look');
  });
});
