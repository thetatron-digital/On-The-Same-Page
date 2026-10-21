// "You're offline" notice: edits keep saving in this browser, and Drive
// projects sync when the connection comes back.
import { useEffect, useState } from 'react';
import { useProjectsStore } from '../services/projectService';
import './OfflineNotice.css';

export function OfflineNotice() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [backOnline, setBackOnline] = useState(false);
  const drive = useProjectsStore((s) => { const p = s.projects.find((x) => x.id === s.currentProjectId); return !!p && !p.isLocal; });

  useEffect(() => {
    let timer = 0;
    const up = () => { setOnline(true); setBackOnline(true); timer = window.setTimeout(() => setBackOnline(false), 4000); };
    const down = () => { setOnline(false); setBackOnline(false); };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); clearTimeout(timer); };
  }, []);

  if (online && !backOnline) return null;
  return (
    <div className={`offline-notice ${online ? 'back' : ''}`} role="status" aria-live="polite">
      {online
        ? drive ? 'Back online · syncing with Google Drive' : 'Back online'
        : drive
          ? "You're offline · edits are kept in this browser and sync with Google Drive when you're back"
          : "You're offline · OTSP keeps working and your edits are saved in this browser"}
    </div>
  );
}
