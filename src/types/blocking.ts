// Top-down blocking diagrams (set plan, actors and their moves, cameras
// with lens-accurate field of view, lights), one or more per scene.
// Units are metres; x to the right, y down the page; angles in degrees,
// 0 = facing up the page, clockwise.

export type BlockingKind = 'actor' | 'camera' | 'light' | 'wall' | 'prop' | 'door' | 'window';

export interface BlockingItem {
  id: string;
  kind: BlockingKind;
  label: string;
  x: number;
  y: number;
  rotation: number;
  // walls/doors/windows run from (x, y) to (x2, y2); props are w × h
  x2?: number;
  y2?: number;
  w?: number;
  h?: number;
  color?: string;
  // cameras
  focalLength?: number;   // mm
  sensor?: string;        // key of SENSORS
  shotId?: string;        // the shot this setup films
  // actors: marks they move through, in order (mark 1 is x, y)
  path?: { x: number; y: number }[];
}

export interface BlockingDiagram {
  id: string;
  sceneId: string;
  name: string;           // e.g. "Diner – coverage"
  items: BlockingItem[];
  updatedAt: Date;
}
