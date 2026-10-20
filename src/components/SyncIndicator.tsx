// Shared Drive project status, in the toolbar: who else is here, view-only
// access, and the last sync
import { useSyncStatus } from '../services/projectSync';
import './SyncIndicator.css';

const time = (d?: Date) => d?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) ?? '';

const APP_NAMES: Record<string, string> = {
  home: 'Home', blueprint: 'BluePrint', corkboard: 'CorkBoard', rewriter: 'ReWriter', breakdown: 'BreakDown',
  artcart: 'ArtCart', viewfinder: 'ViewFinder', basecamp: 'BaseCamp', onset: 'OnSet', supervisor: 'SuperVisor',
};

// A stable colour per person
const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export function SyncIndicator() {
  const { state, at, by, conflicts, readOnly, others } = useSyncStatus();
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
    <span className={`sync-indicator ${state}`}>
      {others.length > 0 && (
        <span className="sync-people" aria-label={`Also here: ${others.map((o) => o.name).join(', ')}`}>
          {others.slice(0, 4).map((o) => (
            <span key={o.userId} className="sync-person" style={{ background: `hsl(${hue(o.userId)} 55% 45%)` }}
              title={`${o.name} · in ${APP_NAMES[o.app] ?? o.app}`}>
              {o.name.charAt(0).toUpperCase()}
            </span>
          ))}
          {others.length > 4 && <span className="sync-person more" title={others.slice(4).map((o) => o.name).join(', ')}>+{others.length - 4}</span>}
        </span>
      )}
      {readOnly && <span className="sync-readonly" title="Shared with you as Viewer or Commenter: you can look around, but changes aren't saved">View only</span>}
      <span className="sync-status" title={title} role="status" aria-live="polite">
        <span className="sync-dot" aria-hidden />
        <span className="sync-text">{text}</span>
        {conflicts.length > 0 && <span className="sync-conflicts">{conflicts.length} kept as yours</span>}
      </span>
    </span>
  );
}
