// Shown when a shared project link can't be opened yet: Drive lets OTSP
// open someone else's file only after you pick it in Google's picker.
import { useState } from 'react';
import { openSharedProject, useSharedAccessPrompt } from '../services/openShared';
import { isPickerConfigured } from '../services/googlePicker';
import { useAuthStore } from '../services/projectService';
import './ShareDialog.css';

export function SharedProjectPrompt() {
  const { projectId, app } = useSharedAccessPrompt();
  const user = useAuthStore((s) => s.user);
  const [error, setError] = useState<string | null>(null);
  if (!projectId) return null;
  const close = () => { setError(null); useSharedAccessPrompt.setState({ projectId: null }); };
  const open = async () => {
    setError(null);
    try {
      if (await openSharedProject(projectId, app)) close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the project');
    }
  };
  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-content share-dialog" role="dialog" aria-label="Open shared project" onClick={(e) => e.stopPropagation()}>
        <h3>Open a shared project</h3>
        {!user ? (
          <p className="share-note">Sign in with the Google account the project was shared with, then follow the link again.</p>
        ) : (
          <p className="share-note">
            If this project was shared with {user.email}, confirm it in Google's file picker to give OTSP access. You only need to do this once per project.
          </p>
        )}
        {!isPickerConfigured() && <p className="share-note">This copy of OTSP doesn't have the Google Picker set up yet (see .env.example).</p>}
        {error && <p className="share-error" role="alert">{error}</p>}
        <div className="modal-buttons">
          <button onClick={close}>Cancel</button>
          {user && <button className="primary" disabled={!isPickerConfigured()} onClick={open}>Choose in Google Drive…</button>}
        </div>
      </div>
    </div>
  );
}
