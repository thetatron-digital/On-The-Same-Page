// Tools > Table Read… bar and Tools > Assign Voices… dialog. Uses only the
// voices the browser already has (no paid speech service).
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../store/screenplayStore';
import type { VoiceSetting } from '../types/screenplay';
import { getTableReadSettings, NARRATOR, defaultVoiceName } from '../engine/tableRead';
import { listCharacters } from '../utils/reports';
import { availableVoices, pause, play, preview, skip, speechAvailable, stop, useTableRead } from '../commands/tableReadPlayer';
import { useDialogs } from '../commands/dialogs';
import './TableRead.css';
import './ProductionDialogs.css';

export const TableReadBar = () => {
  const { open, playing, queue, position, readAlong, hide } = useTableRead();
  const screenplay = useScreenplayStore((s) => s.screenplay);
  const setTableReadSettings = useScreenplayStore((s) => s.setTableReadSettings);
  if (!open) return null;
  const settings = getTableReadSettings(screenplay);
  const current = queue[position];
  return (
    <div className="table-read-bar" role="toolbar" aria-label="Table Read">
      <button onClick={() => skip(-1)} disabled={queue.length === 0} aria-label="Previous paragraph" title="Previous paragraph">⏮</button>
      {playing
        ? <button className="primary" onClick={pause} aria-label="Pause" title="Pause">⏸</button>
        : <button className="primary" onClick={() => play()} aria-label="Play from the cursor" title="Play from the cursor">▶</button>}
      <button onClick={() => skip(1)} disabled={queue.length === 0} aria-label="Next paragraph" title="Next paragraph">⏭</button>
      <button onClick={stop} disabled={queue.length === 0} aria-label="Stop" title="Stop">⏹</button>
      <span className="table-read-now">
        {current ? `${current.speaker === NARRATOR ? 'Narrator' : current.speaker}: ${position + 1} / ${queue.length}` : 'Ready'}
      </span>
      <label><input type="checkbox" checked={readAlong} onChange={(e) => useTableRead.setState({ readAlong: e.target.checked })} /> Read along</label>
      <label><input type="checkbox" checked={settings.readNarration} onChange={(e) => { setTableReadSettings({ ...settings, readNarration: e.target.checked }); stop(); }} /> Action</label>
      <button onClick={() => useDialogs.getState().show('voices')}>Voices…</button>
      <button className="table-read-close" onClick={hide} aria-label="Close Table Read">×</button>
    </div>
  );
};

// Voices load asynchronously in most browsers
const useVoices = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => availableVoices());
  useEffect(() => {
    if (!speechAvailable()) return;
    const update = () => setVoices(availableVoices());
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  return voices;
};

export const AssignVoicesDialog = ({ onClose }: { onClose: () => void }) => {
  const { screenplay, setTableReadSettings } = useScreenplayStore(
    useShallow((s) => ({ screenplay: s.screenplay, setTableReadSettings: s.setTableReadSettings }))
  );
  const settings = getTableReadSettings(screenplay);
  const voices = useVoices();
  const characters = useMemo(() => listCharacters(screenplay), [screenplay]);
  const names = voices.map((v) => v.name);

  const update = (speaker: string, changes: Partial<VoiceSetting>) => {
    if (speaker === NARRATOR) setTableReadSettings({ ...settings, narrator: { ...settings.narrator, ...changes } });
    else setTableReadSettings({ ...settings, characters: { ...settings.characters, [speaker]: { ...(settings.characters[speaker] ?? { pitch: 1, rate: 1 }), ...changes } } });
  };
  const row = (speaker: string, label: string, sample: string) => {
    const voice = speaker === NARRATOR ? settings.narrator : settings.characters[speaker] ?? { pitch: 1, rate: 1 };
    const automatic = defaultVoiceName(speaker === NARRATOR ? '' : speaker, names);
    return (
      <tr key={speaker}>
        <td>{label}</td>
        <td>
          <select value={voice.voiceName ?? ''} onChange={(e) => update(speaker, { voiceName: e.target.value || undefined })} aria-label={`${label} voice`}>
            <option value="">Automatic{automatic ? ` (${automatic})` : ''}</option>
            {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
          </select>
        </td>
        <td><input type="range" min={0} max={2} step={0.1} value={voice.pitch} onChange={(e) => update(speaker, { pitch: +e.target.value })} aria-label={`${label} pitch`} /></td>
        <td><input type="range" min={0.5} max={2} step={0.1} value={voice.rate} onChange={(e) => update(speaker, { rate: +e.target.value })} aria-label={`${label} speed`} /></td>
        <td><button onClick={() => preview(speaker, sample)}>Preview</button></td>
      </tr>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content production-dialog voices-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Assign Voices</h3>
        {!speechAvailable() || voices.length === 0 ? (
          <p className="dialog-hint">This browser has no speech voices installed.</p>
        ) : (
          <div className="revisions-table-wrap">
            <table className="revisions-table">
              <thead><tr><th>Part</th><th>Voice</th><th>Pitch</th><th>Speed</th><th /></tr></thead>
              <tbody>
                {row(NARRATOR, 'Narrator', 'The narrator reads scene headings and action.')}
                {characters.map((c) => row(c, c, `This is ${c.toLowerCase()}.`))}
              </tbody>
            </table>
          </div>
        )}
        <label className="production-check">
          <input type="checkbox" checked={settings.readCharacterNames} onChange={(e) => setTableReadSettings({ ...settings, readCharacterNames: e.target.checked })} />
          Narrator reads character names
        </label>
        <label className="production-check">
          <input type="checkbox" checked={settings.readParentheticals} onChange={(e) => setTableReadSettings({ ...settings, readParentheticals: e.target.checked })} />
          Narrator reads parentheticals
        </label>
        <div className="modal-buttons">
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};
