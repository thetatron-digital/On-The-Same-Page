// Reference library (ShotDeck-style) for the production's own images:
// stills, frame grabs, scout photos. Bytes live outside the project file
// (browser storage or the user's Drive), like dailies.
import type { MediaRef } from './dailies';

export type FacetId =
  | 'mediaType' | 'intExt' | 'timeOfDay' | 'frameSize' | 'shotType' | 'angle' | 'lensSize'
  | 'composition' | 'lighting' | 'lightSource' | 'mood';

export interface ReferenceCredits {
  title?: string;
  year?: string;
  director?: string;
  dp?: string;
  productionDesigner?: string;
  costumeDesigner?: string;
  colorist?: string;
  source?: string; // URL or where it came from
}

/** Measured from the pixels when the image is added */
export interface ImageLook {
  palette: string[]; // dominant colours, hex, most common first
  temperature: 'warm' | 'neutral' | 'cool';
  saturation: 'b&w' | 'muted' | 'natural' | 'vivid';
  contrast: 'low' | 'medium' | 'high';
  key: 'low' | 'medium' | 'high'; // overall brightness
}

export interface ReferenceImage {
  id: string;
  media: MediaRef;
  thumbnail: string; // small JPEG data URL for the grid
  width: number;
  height: number;
  look: ImageLook;
  facets: Partial<Record<FacetId, string[]>>;
  focalLength?: number; // mm, when known
  people?: number;
  credits: ReferenceCredits;
  keywords: string[];
  notes?: string;
  sceneIds: string[];
  shotIds: string[];
  department?: string; // ArtCart department, e.g. Costume
  addedBy?: string;
  addedAt: Date;
}

export interface ReferenceDeck {
  id: string;
  name: string;
  imageIds: string[];
  createdAt: Date;
}

export interface References {
  images: ReferenceImage[];
  decks: ReferenceDeck[];
}
