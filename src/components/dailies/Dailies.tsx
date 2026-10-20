// Dailies (SuperVisor tab): Frame.io-style review of the day's clips.
// Library grid of assets (newest version of each stack) -> review player.
import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import { REVIEW_STATUS_LABELS, type DailiesClip, type ReviewStatus } from '../../types/dailies';
import { generateBreakdownScenes } from '../../utils/breakdown';
import { commentsToCsv, latestVersions, openCount, stacks } from '../../engine/dailies/review';
import { shortTime } from '../../engine/dailies/timecode';
import { removeClipMedia } from '../../services/mediaStore';
import { addClips, clipsGoToDrive } from './addClips';
import { useDailiesUi } from './dailiesUi';
import { downloadText } from './download';
import './Dailies.css';

const DailiesReview = lazy(() => import('./DailiesReview'));

const ACCEPT = 'video/*,audio/*,image/*';
const STATUSES: ReviewStatus[] = ['needs-review', 'in-progress', 'approved', 'none'];

export function Dailies() {
  const openClipId = useDailiesUi((s) => s.openClipId);
  const clipExists = useScreenplayStore((s) => !!s.dailies?.clips.some((c) => c.id === openClipId));
  return (
    <div className="dailies">
      {openClipId && clipExists ? (
        <Suspense fallback={<div className="dl-empty">Loading the player…</div>}>
          <DailiesReview clipId={openClipId} />
        </Suspense>
      ) : (
        <DailiesLibrary />
      )}
      <UploadTray />
    </div>
  );
}

function StatusPill({ status }: { status: ReviewStatus }) {
  return <span className={`dl-status ${status}`}>{REVIEW_STATUS_LABELS[status]}</span>;
}

function DailiesLibrary() {
  const { dailies, elements, deleteClip } = useScreenplayStore(
    useShallow((s) => ({ dailies: s.dailies, elements: s.screenplay.elements, deleteClip: s.deleteDailiesClip }))
  );
  const ui = useDailiesUi();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState<string | null>(null); // 'library' or a clip id
  const scenes = useMemo(() => generateBreakdownScenes(elements), [elements]);
  const clips = useMemo(() => dailies?.clips ?? [], [dailies]);
  const comments = useMemo(() => dailies?.comments ?? [], [dailies]);
  const stackMap = useMemo(() => stacks(clips), [clips]);

  const shown = useMemo(() => {
    const q = ui.search.trim().toLowerCase();
    const list = latestVersions(clips).filter((c) =>
      (ui.statusFilter === 'all' || c.status === ui.statusFilter) &&
      (!ui.sceneFilter || c.sceneId === ui.sceneFilter) &&
      (!q || c.name.toLowerCase().includes(q)));
    const order = { 'needs-review': 0, 'in-progress': 1, approved: 2, none: 3 };
    return list.sort((a, b) =>
      ui.sort === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true })
        : ui.sort === 'status' ? order[a.status] - order[b.status]
          : b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }, [clips, ui.search, ui.statusFilter, ui.sceneFilter, ui.sort]);

  const drop = (e: React.DragEvent, stackOnto?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const files = [...e.dataTransfer.files];
    if (files.length) void addClips(files, stackOnto);
  };

  const remove = async (clip: DailiesClip) => {
    const versions = stackMap.get(clip.stackId) ?? [clip];
    if (!confirm(`Delete "${clip.name}"${versions.length > 1 ? ` and all ${versions.length} versions` : ''} with its comments?`)) return;
    for (const v of versions) {
      deleteClip(v.id);
      void removeClipMedia(v.media, true);
    }
  };

  const sceneLabel = (id?: string) => {
    const sc = scenes.find((s) => s.id === id);
    return sc ? `Sc ${sc.sceneNumber}` : '';
  };

  return (
    <div
      className={`dl-library ${dragOver === 'library' ? 'drag' : ''}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); if (dragOver !== 'library') setDragOver('library'); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(null); }}
      onDrop={(e) => drop(e)}
    >
      <div className="dl-toolbar">
        <h3>Dailies <span className="dl-count">{shown.length} of {stackMap.size}</span></h3>
        <input className="dl-search" type="search" placeholder="Search" value={ui.search} onChange={(e) => ui.set({ search: e.target.value })} aria-label="Search clips" />
        <select value={ui.statusFilter} onChange={(e) => ui.set({ statusFilter: e.target.value as ReviewStatus | 'all' })} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{REVIEW_STATUS_LABELS[s]}</option>)}
        </select>
        <select value={ui.sceneFilter} onChange={(e) => ui.set({ sceneFilter: e.target.value })} aria-label="Filter by scene">
          <option value="">All scenes</option>
          {scenes.map((s) => <option key={s.id} value={s.id}>Scene {s.sceneNumber}</option>)}
        </select>
        <select value={ui.sort} onChange={(e) => ui.set({ sort: e.target.value as typeof ui.sort })} aria-label="Sort">
          <option value="newest">Newest</option>
          <option value="name">Name</option>
          <option value="status">Status</option>
        </select>
        <div className="dl-toolbar-end">
          <button className="dl-btn" disabled={!clips.length} onClick={() => downloadText(commentsToCsv(latestVersions(clips), comments), 'Dailies comments.csv', 'text/csv')}>Export Comments</button>
          <button className="dl-btn primary" onClick={() => fileRef.current?.click()}>Upload</button>
          <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) void addClips(fs); }} />
        </div>
      </div>

      {clips.length === 0 ? (
        <div className="dl-empty">
          <p><strong>Drop the day's clips here</strong> or use Upload.</p>
          <p className="dl-muted">
            MP4 (H.264) and other browser-playable files.{' '}
            {clipsGoToDrive() ? 'Clips upload to your Google Drive so everyone on the project can review them.' : 'Clips stay in this browser. Open a Google Drive project to share them.'}
          </p>
        </div>
      ) : (
        <div className="dl-grid">
          {shown.map((clip) => {
            const versions = stackMap.get(clip.stackId)!;
            const open = versions.reduce((n, v) => n + openCount(comments, v.id), 0);
            return (
              <div
                key={clip.id}
                className={`dl-card ${dragOver === clip.id ? 'drop-version' : ''}`}
                onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); setDragOver(clip.id); } }}
                onDragLeave={() => setDragOver('library')}
                onDrop={(e) => drop(e, clip.id)}
              >
                <button className="dl-thumb" onClick={() => ui.set({ openClipId: clip.id, compareClipId: null })} aria-label={`Open ${clip.name}`}>
                  {clip.thumbnail ? <img src={clip.thumbnail} alt="" /> : <span className="dl-thumb-blank">{clip.kind === 'audio' ? '♪' : ''}</span>}
                  {clip.kind !== 'image' && <span className="dl-duration">{shortTime(clip.durationS)}</span>}
                  {versions.length > 1 && <span className="dl-version">V{clip.version}</span>}
                  {dragOver === clip.id && <span className="dl-drop-hint">Drop to add V{clip.version + 1}</span>}
                </button>
                <div className="dl-card-info">
                  <span className="dl-name" title={clip.name}>{clip.name}</span>
                  <span className="dl-card-meta">
                    <StatusPill status={clip.status} />
                    {open > 0 && <span className="dl-comments" title={`${open} open comment${open === 1 ? '' : 's'}`}>💬 {open}</span>}
                    {sceneLabel(clip.sceneId) && <span className="dl-muted">{sceneLabel(clip.sceneId)}</span>}
                    <button className="dl-icon" title="Delete" aria-label={`Delete ${clip.name}`} onClick={() => void remove(clip)}>🗑</button>
                  </span>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && <p className="dl-muted">No clips match these filters.</p>}
        </div>
      )}
      {dragOver === 'library' && <div className="dl-drop-overlay">Drop to upload</div>}
    </div>
  );
}

function UploadTray() {
  const { uploads, setUpload } = useDailiesUi(useShallow((s) => ({ uploads: s.uploads, setUpload: s.setUpload })));
  if (!uploads.length) return null;
  return (
    <div className="dl-tray" role="status" aria-live="polite">
      <strong>Uploading {uploads.filter((u) => !u.error).length}</strong>
      {uploads.map((u) => (
        <div key={u.key} className={`dl-tray-item ${u.error ? 'error' : ''}`}>
          <span className="dl-tray-name" title={u.name}>{u.name}</span>
          {u.error ? (
            <>
              <span className="dl-tray-error">{u.error}</span>
              <button className="dl-icon" aria-label="Dismiss" onClick={() => setUpload(u.key, null)}>×</button>
            </>
          ) : (
            <span className="dl-bar"><span style={{ width: `${u.total ? Math.round((u.sent / u.total) * 100) : 0}%` }} /></span>
          )}
        </div>
      ))}
    </div>
  );
}
