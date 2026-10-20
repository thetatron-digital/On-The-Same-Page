// Which call sheet's Send panel is open (outside React: BaseCamp's inner views remount)
import { create } from 'zustand';

export const useCallSheetSend = create<{ callSheetId: string | null; open: (id: string | null) => void }>((set) => ({
  callSheetId: null,
  open: (callSheetId) => set({ callSheetId }),
}));
