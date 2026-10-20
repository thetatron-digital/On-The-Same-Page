// PDF output for the One-Line and Shooting Schedule reports (jsPDF, letter)
import jsPDF from 'jspdf';
import { STRIP_COLOR_HEX, stripColorFor } from '../types/screenplay';
import { dayBreakLine, formatReportDate, type ReportStrip, type ScheduleReport, type TableReport } from './scheduleReports';

export type ReportKind = 'oneLine' | 'shooting';

export const REPORT_TITLES: Record<ReportKind, string> = {
  oneLine: 'One Line Schedule',
  shooting: 'Shooting Schedule',
};

const PW = 612, PH = 792, M = 36, CW = PW - 2 * M;
const FOOT = PH - M + 12;

export function scheduleReportPdf(report: ScheduleReport, kind: ReportKind): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const printed = new Date();
  let y = 0;
  let page = 1;

  const header = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor('#1a1a1a');
    doc.text(REPORT_TITLES[kind], M, M + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(report.title, PW - M, M + 6, { align: 'right' });
    doc.setDrawColor('#999999');
    doc.setLineWidth(0.75);
    doc.line(M, M + 14, PW - M, M + 14);
    y = M + 30;
    if (report.credits) {
      doc.setFontSize(8);
      doc.setTextColor('#555555');
      doc.text(doc.splitTextToSize(report.credits, CW)[0] ?? '', M, M + 25);
      doc.setTextColor('#1a1a1a');
      y = M + 40;
    }
  };
  const footer = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#666666');
    doc.text(`Printed on ${printed.toLocaleDateString('en-US')} at ${printed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`, M, FOOT);
    doc.text(`Page ${page}`, PW - M, FOOT, { align: 'right' });
  };
  const ensure = (height: number) => {
    if (y + height <= PH - M - 12) return;
    footer();
    doc.addPage();
    page++;
    header();
  };

  const swatch = (s: ReportStrip, x: number, top: number, h: number) => {
    const color = STRIP_COLOR_HEX[stripColorFor(s.intExt, s.dayNight)];
    doc.setFillColor(color);
    doc.setDrawColor('#bbbbbb');
    doc.setLineWidth(0.5);
    doc.rect(x, top, 8, h, 'FD');
  };

  header();
  doc.setTextColor('#1a1a1a');

  if (kind === 'oneLine') {
    const cols = { scene: M + 14, ie: M + 70, set: M + 104, dn: M + 330, pages: M + 400, cast: M + 450 };
    for (const day of report.days) {
      for (const item of day.items) {
        ensure(16);
        doc.setFontSize(9);
        if (item.kind === 'banner') {
          doc.setFont('helvetica', 'bold');
          doc.setFillColor('#F5D76E');
          doc.rect(M, y - 10, CW, 14, 'F');
          doc.text(item.text, M + 14, y);
        } else {
          swatch(item, M, y - 10, 14);
          doc.setFont('helvetica', 'bold');
          doc.text(`Scn ${item.sceneNumber}`, cols.scene, y);
          doc.setFont('helvetica', 'normal');
          doc.text(item.intExt, cols.ie, y);
          doc.text(doc.splitTextToSize(item.set, cols.dn - cols.set - 8)[0] ?? '', cols.set, y);
          doc.text(item.dayNight, cols.dn, y);
          doc.text(`${item.pages} pgs`, cols.pages, y);
          if (item.castIds) doc.text(`Cast: ${item.castIds}`, cols.cast, y);
        }
        y += 16;
      }
      ensure(20);
      doc.setFillColor('#e8e8e8');
      doc.rect(M, y - 11, CW, 16, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(dayBreakLine(day), M + 6, y);
      y += 22;
    }
  } else {
    for (const day of report.days) {
      ensure(30);
      doc.setFillColor('#2C3E50');
      doc.rect(M, y - 12, CW, 18, 'F');
      doc.setTextColor('#ffffff');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(['Shoot Day # ' + day.dayNumber, formatReportDate(day.date)].filter(Boolean).join(' -- '), M + 6, y);
      doc.setTextColor('#1a1a1a');
      y += 20;

      for (const item of day.items) {
        if (item.kind === 'banner') {
          ensure(18);
          doc.setFillColor('#F5D76E');
          doc.rect(M, y - 10, CW, 14, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text(item.text, M + 6, y);
          y += 18;
          continue;
        }
        const lists: [string, string[]][] = [];
        if (item.cast.length) lists.push(['Cast Members', item.cast]);
        item.elements.forEach((e) => lists.push([e.category, e.names]));
        const synopsis = item.synopsis ? doc.splitTextToSize(item.synopsis, CW - 20) as string[] : [];
        const listHeight = Math.ceil(lists.length / 3) * 12 + lists.reduce((max, [, names]) => Math.max(max, names.length), 0) * 10;
        ensure(18 + synopsis.length * 11 + listHeight + 12);

        const top = y - 11;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`Scene #${item.sceneNumber}`, M + 14, y);
        doc.text(`${item.intExt} ${item.set}`, M + 90, y);
        doc.setFont('helvetica', 'normal');
        doc.text(item.dayNight, M + 380, y);
        doc.text(`${item.pages} pgs`, M + 450, y);
        y += 13;
        doc.setFontSize(9);
        doc.setTextColor('#444444');
        synopsis.forEach((line) => { doc.text(line, M + 14, y); y += 11; });
        doc.setTextColor('#1a1a1a');

        // Element lists in three columns, like the MMS category blocks
        const colW = (CW - 14) / 3;
        for (let row = 0; row < lists.length; row += 3) {
          const chunk = lists.slice(row, row + 3);
          const rowHeight = 12 + Math.max(...chunk.map(([, n]) => n.length)) * 10;
          chunk.forEach(([category, names], i) => {
            const x = M + 14 + i * colW;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text(category, x, y + 2);
            doc.setFont('helvetica', 'normal');
            names.forEach((n, j) => doc.text(doc.splitTextToSize(n, colW - 6)[0] ?? '', x, y + 12 + j * 10));
          });
          y += rowHeight;
        }
        swatch(item, M, top, y - top - 4);
        doc.setDrawColor('#cccccc');
        doc.line(M, y, PW - M, y);
        y += 14;
      }
      ensure(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(dayBreakLine(day), M + 6, y);
      y += 24;
    }
  }

  ensure(16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total: ${report.days.length} shoot days -- ${report.totalPages} pages`, M, y);
  footer();
  return doc;
}

/** Simple table PDF for the list reports (Cast List, Location List, ...) */
export function tableReportPdf(report: TableReport, projectTitle: string, credits?: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const printed = new Date();
  let page = 1;
  let y = 0;
  // Column widths: short ID / count columns narrow, text columns share the rest
  const narrow = (c: string) => /^(ID|I\/E|Scenes|Pages)$/.test(c);
  const narrowW = 46;
  const wideCount = report.columns.filter((c) => !narrow(c)).length || 1;
  const wideW = (CW - narrowW * (report.columns.length - wideCount)) / wideCount;
  const xs: number[] = [];
  report.columns.reduce((x, c) => { xs.push(x); return x + (narrow(c) ? narrowW : wideW); }, M);
  const widthOf = (i: number) => (narrow(report.columns[i]) ? narrowW : wideW) - 6;

  const header = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor('#1a1a1a');
    doc.text(report.title, M, M + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(projectTitle, PW - M, M + 6, { align: 'right' });
    doc.setDrawColor('#999999'); doc.setLineWidth(0.75); doc.line(M, M + 14, PW - M, M + 14);
    y = M + 28;
    if (credits) {
      doc.setFontSize(8); doc.setTextColor('#555555');
      doc.text(doc.splitTextToSize(credits, CW)[0] ?? '', M, M + 25);
      doc.setTextColor('#1a1a1a'); y = M + 38;
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    report.columns.forEach((c, i) => doc.text(c.toUpperCase(), xs[i], y));
    doc.setDrawColor('#cccccc'); doc.line(M, y + 4, PW - M, y + 4);
    y += 16;
  };
  const footer = () => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#666666');
    doc.text(`Printed on ${printed.toLocaleDateString('en-US')} at ${printed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`, M, FOOT);
    doc.text(`Page ${page}`, PW - M, FOOT, { align: 'right' });
    doc.setTextColor('#1a1a1a');
  };
  const ensure = (h: number) => {
    if (y + h <= PH - M - 12) return;
    footer(); doc.addPage(); page++; header();
  };

  header();
  for (const section of report.sections) {
    if (section.heading) {
      ensure(30);
      doc.setFillColor('#e8e8e8'); doc.rect(M, y - 11, CW, 16, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(section.heading, M + 6, y); y += 18;
    }
    if (section.rows.length === 0 && section.heading) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor('#777777');
      doc.text('None', M + 6, y); doc.setTextColor('#1a1a1a'); y += 14;
    }
    for (const row of section.rows) {
      const cells = row.map((cell, i) => doc.splitTextToSize(cell, widthOf(i)) as string[]);
      const h = Math.max(...cells.map((c) => c.length)) * 11 + 3;
      ensure(h);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      cells.forEach((lines, i) => lines.forEach((line, j) => doc.text(line, xs[i], y + j * 11)));
      y += h;
    }
    y += 6;
  }
  footer();
  return doc;
}
