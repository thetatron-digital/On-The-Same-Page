// Editor's Log as a landscape PDF (jsPDF, letter)
import jsPDF from 'jspdf';
import type { EditorsLogRow } from './supervisorReports';

const PW = 792, PH = 612, M = 32;
const COLS: { key: keyof EditorsLogRow; label: string; w: number }[] = [
  { key: 'scene', label: 'Scene', w: 44 }, { key: 'setup', label: 'Setup', w: 50 }, { key: 'take', label: 'Take', w: 34 },
  { key: 'camera', label: 'Cam', w: 32 }, { key: 'tcIn', label: 'TC In', w: 78 }, { key: 'tcOut', label: 'TC Out', w: 78 },
  { key: 'duration', label: 'Dur', w: 40 }, { key: 'rating', label: 'Rating', w: 46 }, { key: 'notes', label: 'Notes', w: PW - 2 * M - 402 },
];

export function editorsLogPdf(rows: EditorsLogRow[], title: string, subtitle: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  let y = 0;
  const header = () => {
    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor('#1a1a1a').text("Editor's Log", M, M + 4);
    doc.setFont('helvetica', 'normal').setFontSize(10).text(`${title} · ${subtitle}`, PW - M, M + 4, { align: 'right' });
    y = M + 26;
    doc.setFont('helvetica', 'bold').setFontSize(8.5);
    let x = M;
    for (const c of COLS) { doc.text(c.label, x, y); x += c.w; }
    doc.setDrawColor('#999999').setLineWidth(0.5).line(M, y + 4, PW - M, y + 4);
    y += 16;
  };
  header();
  let lastScene = '';
  for (const r of rows) {
    const notes = doc.splitTextToSize(r.notes, COLS[COLS.length - 1].w - 4) as string[];
    const h = Math.max(1, notes.length) * 11 + 3;
    if (y + h > PH - M) { doc.addPage(); header(); lastScene = ''; }
    if (r.scene !== lastScene && lastScene) { doc.setDrawColor('#dddddd').line(M, y - 9, PW - M, y - 9); }
    lastScene = r.scene;
    doc.setFont('helvetica', r.rating === 'Print' ? 'bold' : 'normal').setFontSize(8.5).setTextColor(r.rating === 'NG' ? '#999999' : '#1a1a1a');
    let x = M;
    for (const c of COLS) {
      if (c.key === 'notes') doc.text(notes, x, y);
      else doc.text(String(r[c.key] ?? ''), x, y);
      x += c.w;
    }
    y += h;
  }
  if (!rows.length) doc.setFont('helvetica', 'normal').setFontSize(10).text('No takes logged.', M, y);
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor('#888888').text(`Page ${i} of ${pages}`, PW - M, PH - M / 2, { align: 'right' });
  }
  return doc;
}
