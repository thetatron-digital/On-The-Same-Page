// Dailies review: Frame.io-style player with frame-accurate stepping,
// timeline with comment markers, In/Out ranges, drawings over the frame,
// version switching and side-by-side compare. Comments and clip info live
// in the side panel (ReviewPanels.tsx).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import { REVIEW_STATUS_LABELS, type DailiesClip, type DrawingStroke, type ReviewStatus } from '../../types/dailies';
import { stacks, threads, commentsToCsv, commentsToEdl } from '../../engine/dailies/review';
import { detectFps, displayTimecode, frameAt, shortTime, timeOfFrame } from '../../engine/dailies/timecode';
import { clipUrl, getClipBlob } from '../../services/mediaStore';
import { MediaAccessError } from '../../services/driveMedia';
import { pickSharedClip, isPickerConfigured } from '../../services/googlePicker';
import { useDailiesUi } from './dailiesUi';
import { drawStrokes } from './drawing';
import { downloadBlob, downloadText } from './download';
import { CommentsPanel, InfoPanel, type DrawState } from './ReviewPanels';
import { reviewPdf } from './reviewPdf';

const SPEEDS = [0.5, 1, 1.5, 2];
const SHUTTLE = [1, 2, 4, 8];

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Load a clip's media into an object URL, with download progress */
function useClipMedia(clip: DailiesClip | undefined) {
  // Keyed by clip (see <Picture key>), so a new clip starts from empty state
  const [state, setState] = useState<{ url?: string; progress?: number; error?: string; needsAccess?: string }>({ progress: 0 });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!clip) return;
    const controller = new AbortController();
    clipUrl(clip.media, (p) => setState({ progress: p.total ? p.sent / p.total : 0 }), controller.signal)
      .then((url) => setState({ url }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof MediaAccessError) setState({ needsAccess: error.fileId, error: error.message });
        else setState({ error: error instanceof Error ? error.message : 'Could not load this clip' });
      });
    return () => controller.abort();
  }, [clip, attempt]);
  return { ...state, retry: () => { setState({ progress: 0 }); setAttempt((n) => n + 1); } };
}

/** Size of the largest box with this aspect ratio that fits the element */
function useFit(ratio: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.min(el.clientWidth, el.clientHeight * ratio);
      setSize({ w, h: w / ratio });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);
  return [ref, size] as const;
}

interface PictureProps {
  clip: DailiesClip;
  videoRef: (el: HTMLVideoElement | null) => void;
  strokes: DrawingStroke[] | null;
  draw?: DrawState;
  onStroke?: (stroke: DrawingStroke) => void;
  label?: string;
}

function Picture({ clip, videoRef, strokes, draw, onStroke, label }: PictureProps) {
  const media = useClipMedia(clip);
  const ratio = clip.width && clip.height ? clip.width / clip.height : 16 / 9;
  const [stageRef, fit] = useFit(ratio);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef<DrawingStroke | null>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(fit.w * dpr);
    canvas.height = Math.round(fit.h * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, fit.w, fit.h);
    drawStrokes(ctx, [...(strokes ?? []), ...(live.current ? [live.current] : [])], fit.w, fit.h);
  }, [strokes, fit.w, fit.h]);
  useEffect(paint, [paint]);

  const point = (e: React.PointerEvent): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  return (
    <div className="dl-stage" ref={stageRef}>
      <div className="dl-picture" style={{ width: fit.w, height: fit.h }}>
        {media.url && clip.kind === 'image' && <img src={media.url} alt={clip.name} />}
        {media.url && clip.kind !== 'image' && (
          <video
            ref={videoRef}
            src={media.url}
            playsInline
            preload="auto"
            poster={clip.kind === 'audio' ? undefined : clip.thumbnail}
            className={clip.kind === 'audio' ? 'audio' : ''}
          />
        )}
        {clip.kind === 'audio' && <div className="dl-audio-card">♪ {clip.name}</div>}
        <canvas
          ref={canvasRef}
          className={`dl-draw ${draw?.on ? 'active' : ''}`}
          style={{ width: fit.w, height: fit.h }}
          onPointerDown={(e) => {
            if (!draw?.on) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            live.current = { tool: draw.tool, color: draw.color, size: 0.004, points: [point(e)] };
            paint();
          }}
          onPointerMove={(e) => {
            if (!live.current) return;
            const p = point(e);
            live.current = live.current.tool === 'pen'
              ? { ...live.current, points: [...live.current.points, p] }
              : { ...live.current, points: [live.current.points[0], p] };
            paint();
          }}
          onPointerUp={() => {
            if (live.current && live.current.points.length > 0) onStroke?.(live.current);
            live.current = null;
            paint();
          }}
        />
        {label && <span className="dl-picture-label">{label}</span>}
        {!media.url && (
          <div className="dl-loading">
            {media.error ? (
              <>
                <p>{media.error}</p>
                {media.needsAccess && isPickerConfigured() && (
                  <button className="dl-btn primary" onClick={async () => { if (await pickSharedClip(media.needsAccess!)) media.retry(); }}>Give OTSP Access…</button>
                )}
                {!media.needsAccess && <button className="dl-btn" onClick={media.retry}>Try Again</button>}
              </>
            ) : (
              <>
                <p>Loading clip…</p>
                <span className="dl-bar"><span style={{ width: `${Math.round((media.progress ?? 0) * 100)}%` }} /></span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DailiesReview({ clipId }: { clipId: string }) {
  const { dailies, updateClip } = useScreenplayStore(useShallow((s) => ({ dailies: s.dailies, updateClip: s.updateDailiesClip })));
  const ui = useDailiesUi();
  const clips = useMemo(() => dailies?.clips ?? [], [dailies]);
  const comments = useMemo(() => dailies?.comments ?? [], [dailies]);
  const clip = clips.find((c) => c.id === clipId)!;
  const versions = stacks(clips).get(clip.stackId) ?? [clip];
  const compare = ui.compareClipId ? clips.find((c) => c.id === ui.compareClipId) : undefined;
  const fps = clip.fps;
  const duration = clip.durationS;

  const video = useRef<HTMLVideoElement | null>(null);
  const compareVideo = useRef<HTMLVideoElement | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [range, setRange] = useState<{ in?: number; out?: number }>({});
  const [tcMode, setTcMode] = useState<'tc' | 'frames' | 'short'>('tc');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'comments' | 'info'>('comments');
  const [draw, setDraw] = useState<DrawState>({ on: false, tool: 'pen', color: '#FF3B30', strokes: [] });
  const reverse = useRef<{ speed: number; timer: number } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const videos = () => [video.current, compareVideo.current].filter(Boolean) as HTMLVideoElement[];

  const stopReverse = () => {
    if (reverse.current) clearInterval(reverse.current.timer);
    reverse.current = null;
  };

  const seek = useCallback((t: number) => {
    const clamped = Math.max(0, Math.min(duration || Infinity, t));
    for (const v of videos()) v.currentTime = clamped;
    setTime(clamped);
  }, [duration]);

  const pause = () => {
    stopReverse();
    for (const v of videos()) v.pause();
  };

  const play = (speed = 1) => {
    stopReverse();
    for (const v of videos()) {
      v.playbackRate = speed * rate;
      void v.play().catch(() => {});
    }
  };

  const togglePlay = () => (playing || reverse.current ? pause() : play());

  const stepFrames = (n: number) => {
    pause();
    seek(timeOfFrame(frameAt(video.current?.currentTime ?? time, fps) + n, fps));
  };

  // J/K/L shuttle: J plays backwards (faster each press), L forwards
  const shuttle = (dir: -1 | 1) => {
    if (dir === 1) {
      const next = reverse.current ? 1 : playing ? SHUTTLE[Math.min(SHUTTLE.length - 1, SHUTTLE.indexOf(video.current?.playbackRate ?? 1) + 1)] : 1;
      play(next);
      return;
    }
    for (const v of videos()) v.pause();
    const speed = reverse.current ? SHUTTLE[Math.min(SHUTTLE.length - 1, SHUTTLE.indexOf(reverse.current.speed) + 1)] : 1;
    stopReverse();
    const step = 1 / fps;
    const timer = window.setInterval(() => {
      const t = (video.current?.currentTime ?? 0) - step * speed;
      if (t <= 0) { seek(0); stopReverse(); setPlaying(false); return; }
      seek(t);
    }, 1000 / fps);
    reverse.current = { speed, timer };
    setPlaying(true);
  };

  // Media element events -> state, and frame-rate detection while playing
  const attach = useCallback((el: HTMLVideoElement | null) => {
    video.current = el;
    if (!el) return;
    el.muted = muted;
    el.onplay = () => setPlaying(true);
    el.onpause = () => { if (!reverse.current) setPlaying(false); };
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && Math.abs(el.duration - clip.durationS) > 0.05) updateClip(clip.id, { durationS: el.duration });
      el.currentTime = time;
    };
    el.onended = () => setPlaying(false);
    if ('requestVideoFrameCallback' in el && !clip.fpsSetByUser) {
      const times: number[] = [];
      const onFrame = (_now: number, meta: { mediaTime: number }) => {
        if (!el.paused) times.push(meta.mediaTime);
        if (times.length >= 40) {
          const detected = detectFps(times);
          if (detected && detected !== useScreenplayStore.getState().dailies?.clips.find((c) => c.id === clip.id)?.fps) updateClip(clip.id, { fps: detected });
          return;
        }
        el.requestVideoFrameCallback(onFrame);
      };
      el.requestVideoFrameCallback(onFrame);
    }
    // only when the element changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);

  // Follow the playhead while playing; loop In/Out
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = video.current;
      if (v) {
        let t = v.currentTime;
        const end = range.out ?? duration;
        if (loop && !reverse.current && t >= end - 0.5 / fps) {
          t = range.in ?? 0;
          seek(t);
        } else if (range.out !== undefined && !loop && !reverse.current && t >= range.out) {
          pause();
          seek(range.out);
        }
        // keep the compare picture in step
        const c = compareVideo.current;
        if (c && Math.abs(c.currentTime - t) > 0.1) c.currentTime = t;
        setTime(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, loop, range.in, range.out, duration, fps]);

  useEffect(() => () => stopReverse(), []);
  useEffect(() => { for (const v of videos()) v.muted = muted; }, [muted]);

  const clipThreads = useMemo(() => threads(comments, clip.id), [comments, clip.id]);
  const timed = clipThreads.filter((t) => t.comment.time !== undefined);
  const active = clipThreads.find((t) => t.comment.id === activeCommentId)?.comment;

  const selectComment = (id: string | null) => {
    setActiveCommentId(id);
    const c = clipThreads.find((t) => t.comment.id === id)?.comment;
    if (c?.time !== undefined) {
      pause();
      seek(timeOfFrame(frameAt(c.time, fps), fps));
      if (c.endTime !== undefined) setRange({ in: c.time, out: c.endTime });
    }
  };

  const jumpComment = (dir: -1 | 1) => {
    const now = frameAt(time, fps);
    const list = dir === 1 ? timed : [...timed].reverse();
    const next = list.find((t) => (dir === 1 ? frameAt(t.comment.time!, fps) > now : frameAt(t.comment.time!, fps) < now));
    if (next) selectComment(next.comment.id);
  };

  // Frame.io-style keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const k = e.key;
      if (k === ' ' || k === 'k' || k === 'K') { e.preventDefault(); if (k === ' ') togglePlay(); else pause(); }
      else if (k === 'l' || k === 'L') shuttle(1);
      else if (k === 'j' || k === 'J') shuttle(-1);
      else if (k === 'ArrowLeft') { e.preventDefault(); if (e.shiftKey) { pause(); seek(time - 1); } else stepFrames(-1); }
      else if (k === 'ArrowRight') { e.preventDefault(); if (e.shiftKey) { pause(); seek(time + 1); } else stepFrames(1); }
      else if (k === 'ArrowUp') { e.preventDefault(); jumpComment(-1); }
      else if (k === 'ArrowDown') { e.preventDefault(); jumpComment(1); }
      else if (k === 'Home') seek(range.in ?? 0);
      else if (k === 'End') seek(range.out ?? duration);
      else if (k === 'i' || k === 'I') setRange((r) => ({ in: time, out: r.out !== undefined && r.out > time ? r.out : undefined }));
      else if (k === 'o' || k === 'O') setRange((r) => ({ in: r.in !== undefined && r.in < time ? r.in : undefined, out: time }));
      else if (k === 'x' || k === 'Escape') { setRange({}); setActiveCommentId(null); setDraw((d) => ({ ...d, on: false })); }
      else if (k === 'm' || k === 'M') setMuted((m) => !m);
      else if (k === 'c' || k === 'C') { e.preventDefault(); pause(); composerRef.current?.focus(); }
      else if (k === 'f' || k === 'F') document.querySelector('.dl-review-main')?.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tcLabel = (t: number) =>
    tcMode === 'frames' ? `${frameAt(t, fps)}` : tcMode === 'short' ? shortTime(t) : displayTimecode(t, fps, clip.startTimecode);

  // What's drawn over the picture: the comment being written, or the selected one (when paused)
  const strokes = draw.on || draw.strokes.length ? draw.strokes : !playing && active?.drawing ? active.drawing : null;

  const scrubRef = useRef<HTMLDivElement>(null);
  const scrubAt = (e: React.PointerEvent) => {
    const r = scrubRef.current!.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * duration);
  };

  const exportReportPdf = async () => {
    setExportOpen(false);
    const blob = await reviewPdf(clip, clipThreads);
    downloadBlob(blob, `${clip.name} V${clip.version} review.pdf`);
  };

  return (
    <div className="dl-review">
      <div className="dl-review-bar">
        <button className="dl-btn" onClick={() => { pause(); ui.set({ openClipId: null, compareClipId: null }); }}>← Dailies</button>
        <strong className="dl-review-name" title={clip.name}>{clip.name}</strong>
        {versions.length > 1 && (
          <select value={clip.id} onChange={(e) => { pause(); ui.set({ openClipId: e.target.value, compareClipId: null }); }} aria-label="Version">
            {versions.map((v) => <option key={v.id} value={v.id}>V{v.version}{v.id === versions[0].id ? ' (latest)' : ''}</option>)}
          </select>
        )}
        <select className={`dl-status-select ${clip.status}`} value={clip.status} onChange={(e) => updateClip(clip.id, { status: e.target.value as ReviewStatus })} aria-label="Status">
          {(['none', 'needs-review', 'in-progress', 'approved'] as ReviewStatus[]).map((s) => <option key={s} value={s}>{REVIEW_STATUS_LABELS[s]}</option>)}
        </select>
        <div className="dl-review-bar-end">
          {versions.length > 1 && (
            <select value={ui.compareClipId ?? ''} onChange={(e) => { pause(); ui.set({ compareClipId: e.target.value || null }); }} aria-label="Compare with">
              <option value="">Compare…</option>
              {versions.filter((v) => v.id !== clip.id).map((v) => <option key={v.id} value={v.id}>Compare with V{v.version}</option>)}
            </select>
          )}
          <div className="dl-menu">
            <button className="dl-btn" onClick={() => setExportOpen((o) => !o)} aria-expanded={exportOpen}>Export ▾</button>
            {exportOpen && (
              <div className="dl-menu-list" onMouseLeave={() => setExportOpen(false)}>
                <button onClick={() => { setExportOpen(false); downloadText(commentsToCsv([clip], comments), `${clip.name} V${clip.version} comments.csv`, 'text/csv'); }}>Comments (CSV)</button>
                <button onClick={() => { setExportOpen(false); downloadText(commentsToEdl(clip, comments), `${clip.name} V${clip.version} markers.edl`); }}>Markers for Resolve (EDL)</button>
                <button onClick={() => void exportReportPdf()} disabled={clip.kind === 'audio'}>Review Report (PDF)</button>
                <button onClick={async () => { setExportOpen(false); downloadBlob(await getClipBlob(clip.media), clip.media.fileName); }}>Original File</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dl-review-body">
        <div className="dl-review-main">
          <div className={`dl-pictures ${compare ? 'compare' : ''}`}>
            <Picture
              key={clip.id}
              clip={clip}
              videoRef={attach}
              strokes={strokes}
              draw={draw}
              onStroke={(s) => setDraw((d) => ({ ...d, strokes: [...d.strokes, s] }))}
              label={compare ? `V${clip.version}` : undefined}
            />
            {compare && (
              <Picture
                key={compare.id}
                clip={compare}
                videoRef={(el) => { compareVideo.current = el; if (el) { el.muted = true; el.currentTime = time; } }}
                strokes={null}
                label={`V${compare.version}`}
              />
            )}
          </div>

          {clip.kind !== 'image' && (
            <>
              <div
                className="dl-timeline"
                ref={scrubRef}
                onPointerDown={(e) => { pause(); e.currentTarget.setPointerCapture(e.pointerId); scrubAt(e); }}
                onPointerMove={(e) => { if (e.buttons === 1) scrubAt(e); }}
                role="slider"
                aria-label="Playhead"
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={time}
              >
                {range.in !== undefined && (
                  <span className="dl-range" style={{ left: `${(range.in / duration) * 100}%`, width: `${(((range.out ?? duration) - range.in) / duration) * 100}%` }} />
                )}
                {range.in === undefined && range.out !== undefined && (
                  <span className="dl-range" style={{ left: 0, width: `${(range.out / duration) * 100}%` }} />
                )}
                <span className="dl-progress" style={{ width: `${(time / Math.max(duration, 0.001)) * 100}%` }} />
                {timed.map(({ comment }) => (
                  <button
                    key={comment.id}
                    className={`dl-marker ${comment.completed ? 'done' : ''} ${comment.id === activeCommentId ? 'active' : ''}`}
                    style={{ left: `${(comment.time! / Math.max(duration, 0.001)) * 100}%` }}
                    title={`${comment.author} · ${tcLabel(comment.time!)}: ${comment.text}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => selectComment(comment.id)}
                  >
                    {comment.author.charAt(0).toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="dl-transport">
                <button className="dl-icon big" onClick={togglePlay} title="Play/Pause (Space, K)" aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
                <button className="dl-icon" onClick={() => stepFrames(-1)} title="Previous frame (←)" aria-label="Previous frame">◀︎|</button>
                <button className="dl-icon" onClick={() => stepFrames(1)} title="Next frame (→)" aria-label="Next frame">|▶︎</button>
                <button className="dl-tc" onClick={() => setTcMode((m) => (m === 'tc' ? 'frames' : m === 'frames' ? 'short' : 'tc'))} title="Timecode / frames / time">
                  {tcLabel(time)} <span className="dl-muted">/ {tcLabel(duration)}</span>
                </button>
                <span className="dl-range-label">
                  {range.in !== undefined || range.out !== undefined
                    ? <>In {range.in !== undefined ? tcLabel(range.in) : '—'} · Out {range.out !== undefined ? tcLabel(range.out) : '—'}</>
                    : <span className="dl-muted">I / O to mark a range</span>}
                </span>
                <div className="dl-transport-end">
                  <button className={`dl-icon ${loop ? 'on' : ''}`} onClick={() => setLoop((l) => !l)} title="Loop (In to Out)" aria-pressed={loop}>⟲</button>
                  <select value={rate} onChange={(e) => { const r = Number(e.target.value); setRate(r); for (const v of videos()) v.playbackRate = r; }} aria-label="Speed">
                    {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
                  </select>
                  <button className="dl-icon" onClick={() => setMuted((m) => !m)} title="Mute (M)" aria-pressed={muted}>{muted ? '🔇' : '🔊'}</button>
                  <button className="dl-icon" onClick={() => document.querySelector('.dl-review-main')?.requestFullscreen?.().catch(() => {})} title="Full screen (F)" aria-label="Full screen">⛶</button>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="dl-panel">
          <div className="dl-panel-tabs" role="tablist">
            <button role="tab" aria-selected={panel === 'comments'} className={panel === 'comments' ? 'active' : ''} onClick={() => setPanel('comments')}>Comments</button>
            <button role="tab" aria-selected={panel === 'info'} className={panel === 'info' ? 'active' : ''} onClick={() => setPanel('info')}>Info</button>
          </div>
          {panel === 'comments' ? (
            <CommentsPanel
              clip={clip}
              threads={clipThreads}
              time={time}
              range={range}
              tcLabel={tcLabel}
              activeId={activeCommentId}
              onSelect={selectComment}
              draw={draw}
              setDraw={setDraw}
              onComposeFocus={pause}
              composerRef={composerRef}
              onPosted={() => setRange({})}
            />
          ) : (
            <InfoPanel clip={clip} versions={versions} />
          )}
        </aside>
      </div>
    </div>
  );
}
