// Storyboard PDF: 3 x 2 boards per landscape page with shot, board,
// duration, dialogue, action and notes under each image (jsPDF).
import jsPDF from 'jspdf';
import type { StoryboardFrame } from '../../types/screenplay';
import { formatTime, type BoardPosition } from '../../engine/storyboard/boards';

const PW = 792, PH = 612, M = 30;
const COLS = 3, ROWS = 2;

export function storyboardPdf(frames: StoryboardFrame[], positions: BoardPosition[], info: { title: string; scene: string }): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const cellW = (PW - 2 * M - (COLS - 1) * 14) / COLS;
  const imageH = cellW * (9 / 16);
  const cellH = (PH - 2 * M - 40 - (ROWS - 1) * 10) / ROWS;
  const perPage = COLS * ROWS;
  const pages = Math.max(1, Math.ceil(frames.length / perPage));
  const total = positions.reduce((sum, p) => sum + p.durationMs, 0);

  for (let page = 0; page < pages; page++) {
    if (page > 0) doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(info.title, M, M + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(info.scene, M, M + 18);
    doc.text(`${frames.length} boards · ${formatTime(total)} · Page ${page + 1} of ${pages}`, PW - M, M + 4, { align: 'right' });

    frames.slice(page * perPage, (page + 1) * perPage).forEach((frame, i) => {
      const n = page * perPage + i;
      const x = M + (i % COLS) * (cellW + 14);
      const y = M + 34 + Math.floor(i / COLS) * (cellH + 10);
      doc.setDrawColor('#999999');
      doc.setLineWidth(0.5);
      if (frame.image) doc.addImage(frame.image, 'JPEG', x, y, cellW, imageH);
      doc.rect(x, y, cellW, imageH);
      let ty = y + imageH + 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Shot ${positions[n].shot}`, x, ty);
      doc.setFont('helvetica', 'normal');
      doc.text(`Board ${positions[n].number} · ${formatTime(positions[n].durationMs)}`, x + cellW, ty, { align: 'right' });
      ty += 12;
      doc.setFontSize(8);
      for (const [label, text] of [['', frame.dialogue], ['Action: ', frame.actionNotes], ['Notes: ', frame.notes]] as const) {
        if (!text) continue;
        const lines = doc.splitTextToSize(`${label}${text}`, cellW) as string[];
        const room = Math.floor((y + cellH - ty) / 10);
        lines.slice(0, Math.max(0, room)).forEach((line) => { doc.text(line, x, ty); ty += 10; });
      }
    });
  }
  return doc;
}
