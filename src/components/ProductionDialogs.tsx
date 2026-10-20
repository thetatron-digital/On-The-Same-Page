// Production menu dialogs for ReWriter: Revisions… and Scene Numbers…
// Fields follow Final Draft's dialogs (findings/ui-parity-spec.md §1.3).
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../store/screenplayStore';
import { getRevisionSettings, type SceneNumberScheme } from '../engine/production';
import './ProductionDialogs.css';

interface DialogProps {
  onClose: () => void;
}

export const RevisionsDialog = ({ onClose }: DialogProps) => {
  const { screenplay, updateRevisionSettings, updateRevisionSet } = useScreenplayStore(
    useShallow((s) => ({
      screenplay: s.screenplay,
      updateRevisionSettings: s.updateRevisionSettings,
      updateRevisionSet: s.updateRevisionSet,
    }))
  );
  const settings = getRevisionSettings(screenplay);
  const index = settings.sets.findIndex((set) => set.id === settings.activeSetId);
  const step = (by: number) => {
    const next = settings.sets[index + by];
    if (next) updateRevisionSettings({ activeSetId: next.id });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog revisions-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Revisions</h3>
        <div className="revisions-table-wrap">
          <table className="revisions-table">
            <thead>
              <tr>
                <th>Active Set</th>
                <th>Revision Set Label</th>
                <th>Mark</th>
                <th>Page Color</th>
              </tr>
            </thead>
            <tbody>
              {settings.sets.map((set) => (
                <tr
                  key={set.id}
                  className={set.id === settings.activeSetId ? 'active' : ''}
                  onDoubleClick={() => updateRevisionSettings({ activeSetId: set.id })}
                >
                  <td>
                    <input
                      type="radio"
                      name="active-revision-set"
                      aria-label={`Make ${set.label} the active set`}
                      checked={set.id === settings.activeSetId}
                      onChange={() => updateRevisionSettings({ activeSetId: set.id })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={set.label}
                      aria-label="Revision set label"
                      onChange={(e) => updateRevisionSet(set.id, { label: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="mark-input"
                      maxLength={2}
                      value={set.mark}
                      aria-label="Revision mark"
                      onChange={(e) => updateRevisionSet(set.id, { mark: e.target.value || '*' })}
                    />
                  </td>
                  <td>
                    <input
                      type="color"
                      value={set.pageColor}
                      aria-label="Page color"
                      onChange={(e) => updateRevisionSet(set.id, { pageColor: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="production-row">
          <button onClick={() => step(-1)} disabled={index <= 0}>Previous Revision Set</button>
          <button onClick={() => step(1)} disabled={index >= settings.sets.length - 1}>Next Revision Set</button>
        </div>

        <label className="production-check">
          <input
            type="checkbox"
            checked={settings.revisionMode}
            onChange={(e) => updateRevisionSettings({ revisionMode: e.target.checked })}
          />
          Revision Mode
        </label>
        <label className="production-check">
          <input
            type="checkbox"
            checked={settings.showPageColors}
            onChange={(e) => updateRevisionSettings({ showPageColors: e.target.checked })}
          />
          Show page colors
        </label>
        <label className="production-field">
          Show text and marks:
          <select
            value={settings.marksShown}
            onChange={(e) => updateRevisionSettings({ marksShown: e.target.value as 'active' | 'all' })}
          >
            <option value="active">Active revision set</option>
            <option value="all">All revision sets</option>
          </select>
        </label>
        <label className="production-field">
          Mark location (inches from left edge):
          <input
            type="number"
            min={7}
            max={8.25}
            step={0.05}
            value={settings.markLocation}
            onChange={(e) => updateRevisionSettings({ markLocation: parseFloat(e.target.value) || 7.75 })}
          />
        </label>

        <div className="modal-buttons">
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export const SceneNumbersDialog = ({ onClose }: DialogProps) => {
  const { selectedElementId, numberScenes, removeSceneNumbers, toggleSceneNumbers } = useScreenplayStore(
    useShallow((s) => ({
      selectedElementId: s.selectedElementId,
      numberScenes: s.numberScenes,
      removeSceneNumbers: s.removeSceneNumbers,
      toggleSceneNumbers: s.toggleSceneNumbers,
    }))
  );
  const [action, setAction] = useState<'number' | 'remove'>('number');
  const [scheme, setScheme] = useState<SceneNumberScheme>('1A');
  const [keepExisting, setKeepExisting] = useState(true);
  const [fromCurrent, setFromCurrent] = useState(false);
  const [startAt, setStartAt] = useState(1);
  const [show, setShow] = useState(true);

  const apply = () => {
    if (action === 'remove') {
      removeSceneNumbers();
    } else {
      numberScenes({
        scheme,
        keepExisting,
        startAt: Math.max(1, startAt),
        fromElementId: fromCurrent ? selectedElementId ?? undefined : undefined,
      });
      // numberScenes turns numbers on; turn them off again if unticked
      if (!show) toggleSceneNumbers();
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Scene Numbers</h3>
        <label className="production-check">
          <input type="radio" name="scene-number-action" checked={action === 'number'} onChange={() => setAction('number')} />
          Number/Renumber
        </label>
        <div className={`production-group ${action === 'number' ? '' : 'disabled'}`}>
          <label className="production-field">
            Numbering Scheme:
            <select value={scheme} onChange={(e) => setScheme(e.target.value as SceneNumberScheme)} disabled={action !== 'number'}>
              <option value="1A">1A: 1, 1A, 2, 3</option>
              <option value="A2">A2: 1, A2, 2, 3</option>
            </select>
          </label>
          <label className="production-check">
            <input type="checkbox" checked={keepExisting} onChange={(e) => setKeepExisting(e.target.checked)} disabled={action !== 'number'} />
            Keep existing numbers
          </label>
          <label className="production-check">
            <input type="checkbox" checked={fromCurrent} onChange={(e) => setFromCurrent(e.target.checked)} disabled={action !== 'number' || keepExisting} />
            Number from current scene
          </label>
          <label className="production-field">
            Starting Number:
            <input type="number" min={1} value={startAt} onChange={(e) => setStartAt(parseInt(e.target.value, 10) || 1)} disabled={action !== 'number'} />
          </label>
          <label className="production-check">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} disabled={action !== 'number'} />
            Show numbers on left and right
          </label>
        </div>
        <label className="production-check">
          <input type="radio" name="scene-number-action" checked={action === 'remove'} onChange={() => setAction('remove')} />
          Remove Numbers
        </label>
        <div className="modal-buttons">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={apply}>OK</button>
        </div>
      </div>
    </div>
  );
};
