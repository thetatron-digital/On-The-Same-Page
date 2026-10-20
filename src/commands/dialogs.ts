// Which menu dialog is open. One host renders it (components/DialogHost.tsx),
// so menus, toolbar buttons and shortcuts can all open the same dialogs.
import { create } from 'zustand';
import type { ReportType } from '../components/WritingDialogs';
import type { FindTab } from '../components/FindReplace';

export type DialogId =
  | 'revisions' | 'sceneNumbers' | 'macros' | 'bookmarks' | 'reports'
  | 'sides' | 'pdf' | 'watermark' | 'shortcuts' | 'about' | 'find' | 'autoComplete' | 'voices'
  | 'highlightCharacters' | 'renameCharacter' | 'pageLayout' | 'headerFooter';

interface DialogState {
  open: DialogId | null;
  reportType: ReportType;
  findTab: FindTab;
  show: (id: DialogId, reportType?: ReportType) => void;
  showFind: (tab: FindTab) => void;
  close: () => void;
}

export const useDialogs = create<DialogState>((set) => ({
  open: null,
  reportType: 'scene',
  findTab: 'find',
  show: (id, reportType) => set((s) => ({ open: id, reportType: reportType ?? s.reportType })),
  showFind: (tab) => set({ open: 'find', findTab: tab }),
  close: () => set({ open: null }),
}));
