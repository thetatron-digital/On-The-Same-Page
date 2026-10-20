// Renders whichever menu dialog is open (see commands/dialogs.ts), plus the
// small dialogs that only the menus use: Save As PDF, Watermark, Keyboard
// Shortcuts and About.
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../store/screenplayStore';
import { useDialogs } from '../commands/dialogs';
import { COMMANDS, MENUS, labelOf, type MenuEntry } from '../commands/registry';
import { formatBinding } from '../commands/keys';
import { downloadPDF } from '../utils/pdf';
import { RevisionsDialog, SceneNumbersDialog } from './ProductionDialogs';
import { BookmarksDialog, MacrosDialog, ReportsDialog, SidesDialog } from './WritingDialogs';
import './ProductionDialogs.css';

interface DialogProps {
  onClose: () => void;
}

const PdfDialog = ({ onClose }: DialogProps) => {
  const { screenplay, fileName, showSceneNumbers, watermarkSettings } = useScreenplayStore(
    useShallow((s) => ({ screenplay: s.screenplay, fileName: s.fileName, showSceneNumbers: s.showSceneNumbers, watermarkSettings: s.watermarkSettings }))
  );
  const [revisedPagesOnly, setRevisedPagesOnly] = useState(false);
  const [includeTitle, setIncludeTitle] = useState(true);
  const save = () => {
    const script = includeTitle ? screenplay : { ...screenplay, title: '' };
    downloadPDF(script, `${fileName.replace(/\.(fdx|fountain)$/i, '') || 'Untitled'}.pdf`, {
      showSceneNumbers, watermark: watermarkSettings, revisedPagesOnly,
    });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Save As PDF</h3>
        <label className="production-check">
          <input type="checkbox" checked={includeTitle} onChange={(e) => setIncludeTitle(e.target.checked)} />
          Include Title Page
        </label>
        <label className="production-check">
          <input type="checkbox" checked={revisedPagesOnly} onChange={(e) => setRevisedPagesOnly(e.target.checked)} />
          Revised pages only
        </label>
        <div className="modal-buttons">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save PDF</button>
        </div>
      </div>
    </div>
  );
};

const WatermarkDialog = ({ onClose }: DialogProps) => {
  const { watermark, setWatermarkSettings } = useScreenplayStore(
    useShallow((s) => ({ watermark: s.watermarkSettings, setWatermarkSettings: s.setWatermarkSettings }))
  );
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Watermark</h3>
        <label className="production-check">
          <input type="checkbox" checked={watermark.enabled} onChange={(e) => setWatermarkSettings({ enabled: e.target.checked })} />
          Print a watermark
        </label>
        <label className="production-field">
          Text:
          <input type="text" value={watermark.text} onChange={(e) => setWatermarkSettings({ text: e.target.value })} />
        </label>
        <label className="production-field">
          Position:
          <select value={watermark.position} onChange={(e) => setWatermarkSettings({ position: e.target.value as typeof watermark.position })}>
            <option value="diagonal">Diagonal</option>
            <option value="center">Center</option>
            <option value="header">Header</option>
            <option value="footer">Footer</option>
          </select>
        </label>
        <div className="modal-buttons">
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

// Every command with a shortcut, grouped by menu
const ShortcutsDialog = ({ onClose }: DialogProps) => {
  const ids = (items: MenuEntry[]): string[] =>
    items.flatMap((e) => (e === '---' ? [] : typeof e === 'object' ? ids(e.items) : [e]));
  const byId = new Map(COMMANDS.map((c) => [c.id, c]));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard Shortcuts</h3>
        <div className="revisions-table-wrap">
          <table className="revisions-table">
            <tbody>
              {MENUS.map((menu) => {
                const rows = ids(menu.items).map((id) => byId.get(id)!).filter((c) => c?.keys?.length);
                if (rows.length === 0) return null;
                return [
                  <tr key={menu.title}><th colSpan={2}>{menu.title}</th></tr>,
                  ...rows.map((c) => (
                    <tr key={c.id}>
                      <td>{labelOf(c)}</td>
                      <td className="shortcut-cell">{c.keys!.map((b) => formatBinding(b)).join('  or  ')}</td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
        <p className="dialog-hint">Browsers keep some shortcuts for themselves (such as new window), so those use an extra Alt/Option key here.</p>
        <div className="modal-buttons">
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

const AboutDialog = ({ onClose }: DialogProps) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content production-dialog" onClick={(e) => e.stopPropagation()}>
      <h3>OTSP (On The Same Page)</h3>
      <p>A film production workspace from development to wrap. ReWriter is its screenwriting app.</p>
      <div className="modal-buttons">
        <button className="primary" onClick={onClose}>Done</button>
      </div>
    </div>
  </div>
);

export const DialogHost = () => {
  const { open, reportType, close } = useDialogs();
  switch (open) {
    case 'revisions': return <RevisionsDialog onClose={close} />;
    case 'sceneNumbers': return <SceneNumbersDialog onClose={close} />;
    case 'macros': return <MacrosDialog onClose={close} />;
    case 'bookmarks': return <BookmarksDialog onClose={close} />;
    case 'reports': return <ReportsDialog initial={reportType} onClose={close} />;
    case 'sides': return <SidesDialog onClose={close} />;
    case 'pdf': return <PdfDialog onClose={close} />;
    case 'watermark': return <WatermarkDialog onClose={close} />;
    case 'shortcuts': return <ShortcutsDialog onClose={close} />;
    case 'about': return <AboutDialog onClose={close} />;
    default: return null;
  }
};
