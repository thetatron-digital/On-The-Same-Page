// Dailies review (Frame.io-style): clips, versions, timecoded comments.
// Media bytes live outside the project file (browser storage or the
// user's Google Drive); the project only stores references.

export type ReviewStatus = 'none' | 'needs-review' | 'in-progress' | 'approved';

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  none: 'No Status',
  'needs-review': 'Needs Review',
  'in-progress': 'In Progress',
  approved: 'Approved',
};

/** Where a clip's bytes are */
export interface MediaRef {
  store: 'local' | 'drive';
  id: string;        // IndexedDB key or Drive file id
  mime: string;
  size: number;      // bytes
  fileName: string;
}

export interface DailiesClip {
  id: string;
  name: string;
  media: MediaRef;
  kind: 'video' | 'audio' | 'image';
  durationS: number;
  fps: number;        // for frame stepping and timecode (detected or set)
  fpsSetByUser?: boolean; // don't replace with the detected rate
  width?: number;
  height?: number;
  startTimecode?: string; // source timecode of the first frame, HH:MM:SS:FF
  thumbnail?: string;     // small JPEG data URL
  // Version stack: clips sharing a stackId are versions of one asset
  stackId: string;
  version: number;
  status: ReviewStatus;
  // OTSP links
  sceneId?: string;
  shootDayId?: string;
  takeId?: string;
  uploadedBy?: string;
  uploadedAt: Date;
}

/** A stroke drawn over the frame, in 0-1 coordinates of the picture */
export interface DrawingStroke {
  tool: 'pen' | 'arrow' | 'rect' | 'ellipse';
  color: string;
  size: number;        // relative to picture width
  points: [number, number][];
}

export interface DailiesComment {
  id: string;
  clipId: string;
  parentId?: string;   // replies
  time?: number;       // seconds into the clip; none = general comment
  endTime?: number;    // range comments (In/Out)
  text: string;
  author: string;
  authorEmail?: string;
  createdAt: Date;
  completed?: boolean;
  drawing?: DrawingStroke[];
}

export interface Dailies {
  clips: DailiesClip[];
  comments: DailiesComment[];
}
