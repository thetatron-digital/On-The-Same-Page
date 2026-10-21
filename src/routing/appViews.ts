// Which screen inside an app is showing, kept outside the components so
// Find Anything (and switching apps) can open a place directly, and each
// app comes back where you left it.
import { create } from 'zustand';

export type SuperVisorTab = 'takes' | 'continuity' | 'reports' | 'dailies';
export type ViewFinderView = 'shots' | 'storyboard' | 'references' | 'blocking';
export type BottomLineLevel = { kind: 'topsheet' } | { kind: 'category'; id: string } | { kind: 'account'; id: string };

interface AppViews {
  superVisorTab: SuperVisorTab;
  viewFinderView: ViewFinderView;
  referenceImageId: string | null; // select this image when References opens
  bottomLineLevel: BottomLineLevel;
  set: (patch: Partial<Omit<AppViews, 'set'>>) => void;
}

export const useAppViews = create<AppViews>((set) => ({
  superVisorTab: 'takes',
  viewFinderView: 'shots',
  referenceImageId: null,
  bottomLineLevel: { kind: 'topsheet' },
  set: (patch) => set(patch),
}));
