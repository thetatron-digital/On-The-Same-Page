// Review report PDF: one frame grab per timecoded comment (with its
// drawing), the comment and its replies; general comments at the end.
import { jsPDF } from 'jspdf';
import type { DailiesClip } from '../../types/dailies';
import { REVIEW_STATUS_LABELS } from '../../types/dailies';
import type { Thread } from '../../engine/dailies/review';
import { displayTimecode, frameAt, timeOfFrame } from '../../engine/dailies/timecode';
import { clipUrl } from '../../services/mediaStore';
import { drawStrokes } from './drawing';

const GRAB_W = 960;

async function grabFrames(clip: DailiesClip, times: number[]): Promise<string[]> {
  if (clip.kind === 'image') {
    const img = new Image();
    img.src = await clipUrl(clip.media);
    await img.decode();
    return times.map(() => {
      const c = document.createElement('canvas');
      c.width = GRAB_W;
      c.height = Math.round((GRAB_W * img.naturalHeight) / img.naturalWidth);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.85);
    });
  }
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = await clipUrl(clip.media);
  await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error('Could not read the clip')); });
  const out: string[] = [];
  for (const t of times) {
    video.currentTime = timeOfFrame(frameAt(t, clip.fps), clip.fps);
    await new Promise<void>((resolve) => { video.onseeked = () => resolve(); setTimeout(resolve, 4000); });
    const c = document.createElement('canvas');
    c.width = GRAB_W;
    c.height = Math.round((GRAB_W * (video.videoHeight || 9)) / (video.videoWidth || 16));
    c.getContext('2d')!.drawImage(video, 0, 0, c.width, c.height);
    out.push(c.toDataURL('image/jpeg', 0.85));
  }
  return out;
}

export async function reviewPdf(clip: DailiesClip, threads: Thread[]): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  const timed = threads.filter((t) => t.comment.time !== undefined || clip.kind === 'image');
  const general = threads.filter((t) => t.comment.time === undefined && clip.kind !== 'image');
  const grabs = await grabFrames(clip, timed.map((t) => t.comment.time ?? 0));

  const header = (sub: string) => {
    doc.setFont('helvetica', 'bold').setFontSize(14).text(`${clip.name}  V${clip.version}`, M, M);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110)
      .text(`${REVIEW_STATUS_LABELS[clip.status]} · ${sub} · Exported ${new Date().toLocaleString()}`, M, M + 14);
    doc.setTextColor(0);
  };

  const imgW = (W - M * 3) * 0.6;
  for (const [i, { comment, replies }] of timed.entries()) {
    if (i > 0) doc.addPage();
    header(`Comment ${i + 1} of ${threads.length}`);
    const top = M + 30;
    const props = doc.getImageProperties(grabs[i]);
    const imgH = Math.min(H - top - M, (imgW * props.height) / props.width);
    // Frame with the comment's drawing on top
    let image = grabs[i];
    if (comment.drawing?.length) {
      const c = document.createElement('canvas');
      c.width = props.width;
      c.height = props.height;
      const ctx = c.getContext('2d')!;
      const img = new Image();
      img.src = grabs[i];
      await img.decode();
      ctx.drawImage(img, 0, 0);
      drawStrokes(ctx, comment.drawing, c.width, c.height);
      image = c.toDataURL('image/jpeg', 0.85);
    }
    doc.addImage(image, 'JPEG', M, top, imgW, imgH);
    const x = M * 2 + imgW;
    const w = W - x - M;
    let y = top + 4;
    if (comment.time !== undefined) {
      const tc = displayTimecode(comment.time, clip.fps, clip.startTimecode);
      const end = comment.endTime !== undefined ? ` – ${displayTimecode(comment.endTime, clip.fps, clip.startTimecode)}` : '';
      doc.setFont('courier', 'bold').setFontSize(11).text(tc + end, x, y);
      y += 18;
    }
    const block = (author: string, text: string, indent = 0, done = false) => {
      doc.setFont('helvetica', 'bold').setFontSize(10).text(`${author}${done ? '  (Done)' : ''}`, x + indent, y);
      y += 13;
      doc.setFont('helvetica', 'normal').setFontSize(10);
      const lines = doc.splitTextToSize(text || '(drawing)', w - indent) as string[];
      doc.text(lines, x + indent, y);
      y += lines.length * 12 + 8;
    };
    block(comment.author, comment.text, 0, comment.completed);
    replies.forEach((r) => block(r.author, r.text, 12));
  }

  if (general.length) {
    if (timed.length) doc.addPage();
    header('General comments');
    let y = M + 40;
    for (const { comment, replies } of general) {
      for (const [c, indent] of [[comment, 0], ...replies.map((r) => [r, 14] as const)] as const) {
        if (y > H - M - 30) { doc.addPage(); header('General comments (cont.)'); y = M + 40; }
        doc.setFont('helvetica', 'bold').setFontSize(10).text(c.author, M + indent, y);
        y += 13;
        const lines = doc.splitTextToSize(c.text, W - M * 2 - indent) as string[];
        doc.setFont('helvetica', 'normal').text(lines, M + indent, y);
        y += lines.length * 12 + 10;
      }
    }
  }
  if (!threads.length) {
    header('No comments');
    doc.setFontSize(11).text('This clip has no comments yet.', M, M + 50);
  }
  return doc.output('blob');
}
