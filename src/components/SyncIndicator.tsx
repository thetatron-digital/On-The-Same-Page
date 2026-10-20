// Shared Drive project sync status, in the toolbar
import { useSyncStatus } from '../services/projectSync';
import './SyncIndicator.css';

const time = (d?: Date) => d?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) ?? '';

export function SyncIndicator() {
  const { state, at, by, conflicts } = useSyncStatus();
  if (state === 'idle') return null;
  const text =
    state === 'syncing' ? 'Syncing…'
      : state === 'offline' ? 'Offline · will retry'
        : state === 'merged' ? `Merged changes from ${by ?? 'a collaborator'}`
          : by ? `Updated from ${by} · ${time(at)}` : `Synced · ${time(at)}`;
  const title = conflicts.length
    ? `${text}. You and ${by ?? 'a collaborator'} both changed ${conflicts.length} value${conflicts.length === 1 ? '' : 's'}; your version was kept:\n${conflicts.slice(0, 12).join('\n')}${conflicts.length > 12 ? '\n…' : ''}`
    : `${text}. Shared projects sync through Google Drive every 20 seconds and on save.`;
  return (
    <span className={`sync-indicator ${state}`} title={title} role="status" aria-live="polite">
      <span className="sync-dot" aria-hidden />
      <span className="sync-text">{text}</span>
      {conflicts.length > 0 && <span className="sync-conflicts">{conflicts.length} kept as yours</span>}
    </span>
  );
}
