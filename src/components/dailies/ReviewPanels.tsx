// Dailies review side panel: comments (Frame.io-style threads) and clip info
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import { useAuthStore } from '../../services/projectService';
import type { DailiesClip, DrawingStroke } from '../../types/dailies';
import type { Thread } from '../../engine/dailies/review';
import { fpsLabel } from '../../engine/dailies/review';
import { shortTime, timecodeToFrames } from '../../engine/dailies/timecode';
import { generateBreakdownScenes } from '../../utils/breakdown';
import { DRAW_COLORS } from './drawing';

export interface DrawState {
  on: boolean;
  tool: DrawingStroke['tool'];
  color: string;
  strokes: DrawingStroke[];
}

const TOOLS: { id: DrawingStroke['tool']; label: string; icon: string }[] = [
  { id: 'pen', label: 'Pen', icon: '✎' },
  { id: 'arrow', label: 'Arrow', icon: '↗' },
  { id: 'rect', label: 'Box', icon: '▭' },
  { id: 'ellipse', label: 'Circle', icon: '◯' },
];

const ago = (d: Date) => {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString();
};

function useMe() {
  const user = useAuthStore((s) => s.user);
  return { author: user?.name || 'Guest', authorEmail: user?.email };
}

interface CommentsProps {
  clip: DailiesClip;
  threads: Thread[];
  time: number;
  range: { in?: number; out?: number };
  tcLabel: (t: number) => string;
  activeId: string | null;
  onSelect: (id: string | null) => void;
  draw: DrawState;
  setDraw: (fn: (d: DrawState) => DrawState) => void;
  onComposeFocus: () => void;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  onPosted: () => void;
}

export function CommentsPanel({ clip, threads, time, range, tcLabel, activeId, onSelect, draw, setDraw, onComposeFocus, composerRef, onPosted }: CommentsProps) {
  const { addComment, updateComment, deleteComment } = useScreenplayStore(
    useShallow((s) => ({ addComment: s.addDailiesComment, updateComment: s.updateDailiesComment, deleteComment: s.deleteDailiesComment }))
  );
  const me = useMe();
  const [text, setText] = useState('');
  const [timed, setTimed] = useState(clip.kind !== 'image');
  const [hideDone, setHideDone] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const start = range.in ?? (range.out !== undefined ? 0 : time);
  const end = range.out;

  const post = () => {
    const body = text.trim();
    if (!body && !draw.strokes.length) return;
    addComment({
      clipId: clip.id,
      text: body,
      ...(timed && clip.kind !== 'image' ? { time: start, ...(end !== undefined && end > start ? { endTime: end } : {}) } : {}),
      ...(draw.strokes.length ? { drawing: draw.strokes } : {}),
      ...me,
    });
    setText('');
    setDraw((d) => ({ ...d, on: false, strokes: [] }));
    onPosted();
  };

  const postReply = (parentId: string) => {
    const body = replyText.trim();
    if (!body) return;
    addComment({ clipId: clip.id, parentId, text: body, ...me });
    setReplyText('');
    setReplyTo(null);
  };

  const mine = (author: string, email?: string) => (email ? email === me.authorEmail : author === me.author);
  const shown = threads.filter((t) => !hideDone || !t.comment.completed);
  const open = threads.filter((t) => !t.comment.completed).length;

  return (
    <div className="dl-comments">
      <div className="dl-comments-head">
        <span>{open} open · {threads.length} total</span>
        <label className="dl-check"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide done</label>
      </div>

      <ul className="dl-thread-list">
        {shown.map(({ comment, replies }) => (
          <li key={comment.id} className={`dl-thread ${comment.id === activeId ? 'active' : ''} ${comment.completed ? 'done' : ''}`}
            onClick={() => onSelect(comment.id === activeId ? null : comment.id)}>
            <div className="dl-comment-head">
              <span className="dl-avatar">{comment.author.charAt(0).toUpperCase()}</span>
              <strong>{comment.author}</strong>
              {comment.time !== undefined && (
                <span className="dl-time-chip">{tcLabel(comment.time)}{comment.endTime !== undefined ? ` – ${tcLabel(comment.endTime)}` : ''}</span>
              )}
              <span className="dl-muted dl-ago">{ago(comment.createdAt)}</span>
            </div>
            {comment.text && <p className="dl-comment-text">{comment.text}</p>}
            {comment.drawing?.length ? <span className="dl-muted">✎ Drawing{comment.id === activeId ? '' : ' (select to show)'}</span> : null}
            <div className="dl-comment-actions" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setReplyTo(replyTo === comment.id ? null : comment.id); setReplyText(''); }}>Reply</button>
              <label className="dl-check"><input type="checkbox" checked={!!comment.completed} onChange={(e) => updateComment(comment.id, { completed: e.target.checked })} /> Done</label>
              {mine(comment.author, comment.authorEmail) && <button onClick={() => { if (confirm('Delete this comment and its replies?')) deleteComment(comment.id); }}>Delete</button>}
            </div>
            {replies.length > 0 && (
              <ul className="dl-replies" onClick={(e) => e.stopPropagation()}>
                {replies.map((r) => (
                  <li key={r.id}>
                    <div className="dl-comment-head">
                      <span className="dl-avatar small">{r.author.charAt(0).toUpperCase()}</span>
                      <strong>{r.author}</strong>
                      <span className="dl-muted dl-ago">{ago(r.createdAt)}</span>
                      {mine(r.author, r.authorEmail) && <button className="dl-link" onClick={() => deleteComment(r.id)}>Delete</button>}
                    </div>
                    <p className="dl-comment-text">{r.text}</p>
                  </li>
                ))}
              </ul>
            )}
            {replyTo === comment.id && (
              <div className="dl-reply-box" onClick={(e) => e.stopPropagation()}>
                <textarea autoFocus rows={2} placeholder="Reply…" value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postReply(comment.id); } if (e.key === 'Escape') setReplyTo(null); }} />
                <button className="dl-btn primary small" onClick={() => postReply(comment.id)} disabled={!replyText.trim()}>Reply</button>
              </div>
            )}
          </li>
        ))}
        {threads.length === 0 && <li className="dl-muted dl-none">No comments yet. Pause on a frame and leave the first one.</li>}
      </ul>

      <div className={`dl-composer ${draw.on ? 'drawing' : ''}`}>
        {draw.on && (
          <div className="dl-draw-tools" role="toolbar" aria-label="Drawing tools">
            {TOOLS.map((t) => (
              <button key={t.id} className={draw.tool === t.id ? 'active' : ''} title={t.label} aria-label={t.label} onClick={() => setDraw((d) => ({ ...d, tool: t.id }))}>{t.icon}</button>
            ))}
            <span className="dl-sep" />
            {DRAW_COLORS.map((c) => (
              <button key={c} className={`dl-swatch ${draw.color === c ? 'active' : ''}`} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => setDraw((d) => ({ ...d, color: c }))} />
            ))}
            <span className="dl-sep" />
            <button title="Undo stroke" aria-label="Undo stroke" disabled={!draw.strokes.length} onClick={() => setDraw((d) => ({ ...d, strokes: d.strokes.slice(0, -1) }))}>↶</button>
            <button title="Clear drawing" aria-label="Clear drawing" disabled={!draw.strokes.length} onClick={() => setDraw((d) => ({ ...d, strokes: [] }))}>⌫</button>
          </div>
        )}
        <textarea
          ref={composerRef}
          rows={3}
          placeholder="Leave your comment…"
          value={text}
          onFocus={onComposeFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
        />
        <div className="dl-composer-row">
          {clip.kind !== 'image' && (
            <button className={`dl-chip ${timed ? 'on' : ''}`} onClick={() => setTimed((t) => !t)} title="Attach to this frame (or the In/Out range)" aria-pressed={timed}>
              ⏱ {timed ? `${tcLabel(start)}${end !== undefined && end > start ? ` – ${tcLabel(end)}` : ''}` : 'No time'}
            </button>
          )}
          <button className={`dl-chip ${draw.on ? 'on' : ''}`} onClick={() => { onComposeFocus(); setDraw((d) => ({ ...d, on: !d.on })); }} aria-pressed={draw.on} title="Draw on the frame">
            ✎ {draw.strokes.length ? `${draw.strokes.length} stroke${draw.strokes.length === 1 ? '' : 's'}` : 'Draw'}
          </button>
          <span className="dl-grow" />
          <button className="dl-btn primary" onClick={post} disabled={!text.trim() && !draw.strokes.length}>Send</button>
        </div>
        <p className="dl-hint">Space play · J K L shuttle · ← → frame · I O range · ↑ ↓ comments · C comment</p>
      </div>
    </div>
  );
}

const FPS_CHOICES = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60];

export function InfoPanel({ clip, versions }: { clip: DailiesClip; versions: DailiesClip[] }) {
  const { updateClip, unstack, elements, schedule, superVisor } = useScreenplayStore(
    useShallow((s) => ({ updateClip: s.updateDailiesClip, unstack: s.unstackDailiesClip, elements: s.screenplay.elements, schedule: s.schedule, superVisor: s.superVisor }))
  );
  const scenes = useMemo(() => generateBreakdownScenes(elements), [elements]);
  const takes = useMemo(() => (superVisor?.sessions ?? []).flatMap((session) => session.takes), [superVisor]);
  const [tc, setTc] = useState(clip.startTimecode ?? '');
  const tcValid = !tc || timecodeToFrames(tc, clip.fps) !== null;
  const mb = (clip.media.size / 1024 / 1024).toFixed(1);

  return (
    <div className="dl-info">
      <label>Name<input value={clip.name} onChange={(e) => updateClip(clip.id, { name: e.target.value })} /></label>
      {clip.kind !== 'image' && (
        <div className="dl-info-row">
          <label>Frame rate
            <select value={clip.fps} onChange={(e) => updateClip(clip.id, { fps: Number(e.target.value), fpsSetByUser: true })}>
              {[...new Set([...FPS_CHOICES, clip.fps])].sort((a, b) => a - b).map((f) => <option key={f} value={f}>{fpsLabel(f)} fps</option>)}
            </select>
          </label>
          <label>Start timecode
            <input value={tc} placeholder="00:00:00:00" className={tcValid ? '' : 'invalid'} onChange={(e) => setTc(e.target.value)}
              onBlur={() => { if (tcValid) updateClip(clip.id, { startTimecode: tc || undefined }); }} />
          </label>
        </div>
      )}
      {!clip.fpsSetByUser && clip.kind === 'video' && <p className="dl-muted">Frame rate is detected while the clip plays.</p>}

      <h4>Links</h4>
      <label>Scene
        <select value={clip.sceneId ?? ''} onChange={(e) => updateClip(clip.id, { sceneId: e.target.value || undefined })}>
          <option value="">None</option>
          {scenes.map((s) => <option key={s.id} value={s.id}>{s.sceneNumber}. {s.intExt}. {s.location} - {s.timeOfDay}</option>)}
        </select>
      </label>
      <label>Shoot day
        <select value={clip.shootDayId ?? ''} onChange={(e) => updateClip(clip.id, { shootDayId: e.target.value || undefined })}>
          <option value="">None</option>
          {(schedule?.shootDays ?? []).map((d) => <option key={d.id} value={d.id}>Day {d.dayNumber}{d.date ? ` · ${new Date(d.date).toLocaleDateString()}` : ''}</option>)}
        </select>
      </label>
      <label>Take
        <select value={clip.takeId ?? ''} onChange={(e) => updateClip(clip.id, { takeId: e.target.value || undefined })}>
          <option value="">None</option>
          {takes.map((t) => <option key={t.id} value={t.id}>Sc {t.sceneNumber} · {t.shotNumber} · Tk {t.takeNumber} ({t.camera}){t.circled ? ' ◯' : ''}</option>)}
        </select>
      </label>

      <h4>File</h4>
      <dl className="dl-facts">
        <dt>File</dt><dd title={clip.media.fileName}>{clip.media.fileName}</dd>
        <dt>Size</dt><dd>{mb} MB{clip.width ? ` · ${clip.width}×${clip.height}` : ''}</dd>
        {clip.kind !== 'image' && <><dt>Length</dt><dd>{shortTime(clip.durationS)}</dd></>}
        <dt>Stored</dt><dd>{clip.media.store === 'drive' ? 'Google Drive (shared with the project)' : 'This browser only'}</dd>
        <dt>Version</dt><dd>V{clip.version} of {versions.length}</dd>
        <dt>Added</dt><dd>{clip.uploadedBy ? `${clip.uploadedBy}, ` : ''}{clip.uploadedAt.toLocaleString()}</dd>
      </dl>
      {versions.length > 1 && (
        <button className="dl-btn" onClick={() => unstack(clip.id)} title="Make this version its own clip">Unstack This Version</button>
      )}
    </div>
  );
}
