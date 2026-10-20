// Which menu dialog is open. One host renders it (components/DialogHost.tsx),
// so menus, toolbar buttons and shortcuts can all open the same dialogs.
import { create } from 'zustand';
import type { ReportType } from '../components/WritingDialogs';

export type DialogId =
  | 'revisions' | 'sceneNumbers' | 'macros' | 'bookmarks' | 'reports'
  | 'sides' | 'pdf' | 'watermark' | 'shortcuts' | 'about';

interface DialogState {
  open: DialogId | null;
  reportType: ReportType;
  show: (id: DialogId, reportType?: ReportType) => void;
  close: () => void;
}

export const useDialogs = create<DialogState>((set) => ({
  open: null,
  reportType: 'scene',
  show: (id, reportType) => set((s) => ({ open: id, reportType: reportType ?? s.reportType })),
  close: () => set({ open: null }),
}));
