// Deck exports: a captioned contact-sheet PDF, or a ZIP of the original
// images with a captions spreadsheet.
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import type { ReferenceImage } from '../../types/references';
import { getClipBlob } from '../../services/mediaStore';

const save = (blob: Blob, name: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'References';

export const caption = (img: ReferenceImage) => {
  const c = img.credits;
  const title = [c.title, c.year && `(${c.year})`].filter(Boolean).join(' ');
  const credits = [c.director && `Dir. ${c.director}`, c.dp && `DP ${c.dp}`].filter(Boolean).join(' · ');
  const tags = [...(img.facets.frameSize ?? []), ...(img.facets.lensSize ?? []), img.focalLength ? `${img.focalLength}mm` : '', ...(img.facets.lighting ?? []), ...(img.facets.timeOfDay ?? [])].filter(Boolean).join(', ');
  return { title, credits, tags };
};

async function fullImage(img: ReferenceImage, maxSide: number): Promise<string> {
  try {
    const blob = await getClipBlob(img.media);
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return img.thumbnail; // not available here: use the grid thumbnail
  }
}

/** Landscape contact sheet, 2 × 3 per page, captioned */
export async function exportDeckPdf(images: ReferenceImage[], name: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 30;
  const cols = 3, rows = 2, gap = 14;
  const cellW = (W - 2 * M - gap * (cols - 1)) / cols;
  const cellH = (H - 2 * M - 26 - gap * (rows - 1)) / rows;
  const capH = 34;
  for (let i = 0; i < images.length; i++) {
    const slot = i % (cols * rows);
    if (i > 0 && slot === 0) doc.addPage();
    if (slot === 0) {
      doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor('#1a1a1a').text(name, M, M + 6);
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor('#888888').text(`${images.length} images`, W - M, M + 6, { align: 'right' });
    }
    const img = images[i];
    const x = M + (slot % cols) * (cellW + gap);
    const y = M + 22 + Math.floor(slot / cols) * (cellH + gap);
    const data = await fullImage(img, 1200);
    const boxH = cellH - capH;
    const scale = Math.min(cellW / img.width, boxH / img.height);
    const w = img.width * scale, h = img.height * scale;
    doc.addImage(data, 'JPEG', x + (cellW - w) / 2, y + (boxH - h) / 2, w, h);
    const c = caption(img);
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor('#1a1a1a').text((doc.splitTextToSize(c.title || ' ', cellW) as string[])[0], x, y + boxH + 10);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor('#555555');
    if (c.credits) doc.text((doc.splitTextToSize(c.credits, cellW) as string[])[0], x, y + boxH + 20);
    if (c.tags) doc.text((doc.splitTextToSize(c.tags, cellW) as string[])[0], x, y + boxH + 29);
  }
  save(doc.output('blob'), `${safe(name)}.pdf`);
}

/** Original files plus captions.csv */
export async function exportDeckZip(images: ReferenceImage[], name: string) {
  const zip = new JSZip();
  const rows = [['File', 'Title', 'Year', 'Director', 'Cinematographer', 'Tags', 'Keywords', 'Palette', 'Source']];
  const used = new Set<string>();
  for (const [i, img] of images.entries()) {
    let file = `${String(i + 1).padStart(3, '0')} ${safe(img.media.fileName)}`;
    while (used.has(file)) file = `_${file}`;
    used.add(file);
    try {
      zip.file(file, await getClipBlob(img.media));
    } catch {
      file = `${file} (not available here)`;
    }
    const c = caption(img);
    rows.push([file, img.credits.title ?? '', img.credits.year ?? '', img.credits.director ?? '', img.credits.dp ?? '', c.tags, img.keywords.join('; '), img.look.palette.join(' '), img.credits.source ?? '']);
  }
  zip.file('captions.csv', rows.map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n') + '\n');
  save(await zip.generateAsync({ type: 'blob' }), `${safe(name)}.zip`);
}
