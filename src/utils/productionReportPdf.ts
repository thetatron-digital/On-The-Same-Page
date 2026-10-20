// Daily Production Report as a one-to-two page PDF (jsPDF, letter)
import jsPDF from 'jspdf';
import type { ProductionReport, Progress } from '../engine/schedule/productionReport';
import { formatEighths } from './breakdown';

const PW = 612, PH = 792, M = 36, CW = PW - 2 * M;

export function productionReportPdf(r: ProductionReport, title: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = M;

  const ensure = (h: number) => {
    if (y + h > PH - M) { doc.addPage(); y = M; }
  };
  const heading = (text: string) => {
    ensure(28);
    y += 10;
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor('#1a1a1a').text(text.toUpperCase(), M, y);
    doc.setDrawColor('#bbbbbb').setLineWidth(0.5).line(M, y + 4, PW - M, y + 4);
    y += 16;
  };
  const para = (text: string, size = 9) => {
    doc.setFont('helvetica', 'normal').setFontSize(size);
    const lines = doc.splitTextToSize(text, CW) as string[];
    ensure(lines.length * (size + 3));
    doc.text(lines, M, y);
    y += lines.length * (size + 3) + 2;
  };
  const table = (cols: { label: string; w: number; align?: 'left' | 'right' }[], rows: string[][]) => {
    const row = (cells: string[], bold: boolean) => {
      ensure(14);
      doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(8.5);
      let x = M;
      cells.forEach((c, i) => {
        const col = cols[i];
        const text = (doc.splitTextToSize(c, col.w - 4) as string[])[0] ?? '';
        doc.text(text, col.align === 'right' ? x + col.w - 4 : x, y, { align: col.align === 'right' ? 'right' : 'left' });
        x += col.w;
      });
      y += 13;
    };
    row(cols.map((c) => c.label), true);
    rows.forEach((r) => row(r, false));
  };

  // Header
  doc.setFont('helvetica', 'bold').setFontSize(15).text('Daily Production Report', M, y + 6);
  doc.setFont('helvetica', 'normal').setFontSize(10).text(title, PW - M, y + 6, { align: 'right' });
  y += 22;
  doc.setFontSize(10).text(
    `Shoot Day ${r.day.dayNumber} of ${r.dayCount}${r.date ? ` · ${new Date(`${r.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : ''}`,
    M, y
  );
  y += 6;

  heading('Times');
  const t = r.times;
  const timeCells: [string, string | undefined][] = [
    ['Crew Call', t.crewCall], ['First Shot', t.firstShot], ['Lunch', t.lunchStart && `${t.lunchStart}${t.lunchEnd ? ` – ${t.lunchEnd}` : ''}`],
    ['1st Shot After Lunch', t.firstShotAfterLunch], ['Camera Wrap', t.cameraWrap], ['Last Out', t.lastOut],
  ];
  const cw = CW / timeCells.length;
  timeCells.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor('#666666').text(label, M + i * cw, y);
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor('#1a1a1a').text(value || '—', M + i * cw, y + 12);
  });
  y += 24;

  heading('Scenes');
  table(
    [{ label: 'Sc', w: 40 }, { label: 'Set', w: 250 }, { label: 'D/N', w: 70 }, { label: 'Pages', w: 60, align: 'right' }, { label: 'Takes', w: 50, align: 'right' }, { label: 'Status', w: 70 }],
    r.scenes.map((s) => [s.sceneNumber, s.set, s.dayNight, formatEighths(s.eighths), s.takes ? String(s.takes) : '', s.status === 'complete' ? 'Complete' : s.status === 'partial' ? 'Partial' : 'Not shot'])
  );
  if (r.entry.addedScenes) para(`Added scenes: ${r.entry.addedScenes}`);
  para(`Pages scheduled ${formatEighths(r.scheduledEighths)} · shot ${formatEighths(r.shotEighths)} · ${r.aheadBehindEighths >= 0 ? 'ahead' : 'behind'} ${formatEighths(Math.abs(r.aheadBehindEighths))} pages to date`);

  heading('Progress');
  const prog = (label: string, p: Progress, f: (n: number) => string = String) => [label, f(p.previous), f(p.today), f(p.toDate), f(p.remaining), f(p.total)];
  table(
    [{ label: '', w: 90 }, ...['Previous', 'Today', 'To Date', 'Remaining', 'Total'].map((l) => ({ label: l, w: 80, align: 'right' as const }))],
    [prog('Scenes', r.scenesProgress), prog('Pages', r.pagesProgress, formatEighths), ...(r.supervisor ? [prog('Setups', r.setupsProgress)] : [])]
  );
  if (r.supervisor) {
    para(`Takes ${r.supervisor.takes} · Prints ${r.supervisor.prints} · NG ${r.supervisor.ng}${r.supervisor.byCamera.length ? ` · ${r.supervisor.byCamera.map((c) => `${c.camera} camera ${c.takes} takes / ${c.prints} prints`).join(', ')}` : ''}`);
  }

  if (r.delays.length) {
    heading(`Delays (${r.delayMinutes} min)`);
    r.delays.forEach((d) => para(`${d.category}: ${d.reason}${d.duration ? ` · ${d.duration} min` : ''}${d.notes ? ` · ${d.notes}` : ''}`));
  }
  if (r.entry.cameraRolls || r.entry.soundRolls) {
    heading('Media');
    para(`Camera rolls ${r.entry.cameraRolls || '—'} · Sound rolls ${r.entry.soundRolls || '—'}`);
  }
  if (r.entry.notes) { heading('Notes'); para(r.entry.notes); }
  if (r.entry.incidents) { heading('Incidents / Accidents'); para(r.entry.incidents); }
  if (r.entry.preparedBy) { y += 8; para(`Prepared by ${r.entry.preparedBy}`); }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor('#888888')
      .text(`Printed ${new Date().toLocaleString()} · Page ${i} of ${pages}`, PW - M, PH - M / 2, { align: 'right' });
  }
  return doc;
}
