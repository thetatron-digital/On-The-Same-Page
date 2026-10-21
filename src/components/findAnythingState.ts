// Whether Find Anything is open (Cmd/Ctrl+K, or the toolbar)
import { create } from 'zustand';

export const useFindAnything = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({ open: false, set: (open) => set({ open }) }));
