// Sun panel selection, outside React (BaseCamp's inner views remount)
import { create } from 'zustand';

/** Which location's sun panel is open (outside React: BaseCamp views remount) */
export const useSunPanel = create<{ locationId: string | null; date: string; set: (p: Partial<{ locationId: string | null; date: string }>) => void }>((set) => ({
  locationId: null,
  date: new Date().toISOString().slice(0, 10),
  set: (p) => set(p),
}));
