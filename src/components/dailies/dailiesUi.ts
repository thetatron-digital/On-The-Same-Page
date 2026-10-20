// Dailies screen state outside React, so it survives remounts
import { create } from 'zustand';
import type { ReviewStatus } from '../../types/dailies';

export interface UploadItem {
  key: string;
  name: string;
  sent: number;
  total: number;
  error?: string;
}

interface DailiesUi {
  openClipId: string | null;
  compareClipId: string | null;
  statusFilter: ReviewStatus | 'all';
  sceneFilter: string; // '' = all
  search: string;
  sort: 'newest' | 'name' | 'status';
  uploads: UploadItem[];
  set: (patch: Partial<Omit<DailiesUi, 'set' | 'setUpload'>>) => void;
  setUpload: (key: string, patch: Partial<UploadItem> | null) => void;
}

export const useDailiesUi = create<DailiesUi>((set) => ({
  openClipId: null,
  compareClipId: null,
  statusFilter: 'all',
  sceneFilter: '',
  search: '',
  sort: 'newest',
  uploads: [],
  set: (patch) => set(patch),
  setUpload: (key, patch) =>
    set((s) => ({
      uploads: patch === null
        ? s.uploads.filter((u) => u.key !== key)
        : s.uploads.some((u) => u.key === key)
          ? s.uploads.map((u) => (u.key === key ? { ...u, ...patch } : u))
          : [...s.uploads, { key, name: '', sent: 0, total: 0, ...patch }],
    })),
}));
