import jsPDF from 'jspdf';
import type { Screenplay, ElementType, WatermarkSettings } from '../types/screenplay';
import { ELEMENT_FORMATTING } from '../types/screenplay';
import { paginateScript } from '../engine/paginate';
import { getRevisionSettings, pageRevision, showsRevisionMark } from '../engine/production';

// PDF constants (in points, 72 points = 1 inch)
const PAGE_WIDTH = 612; // 8.5 inches
const PAGE_HEIGHT = 792; // 11 inches
const TOP_MARGIN = 72; // 1 inch
const BOTTOM_MARGIN = 72; // 1 inch
const LINE_HEIGHT = 12; // 12 points for Courier 12pt
const FONT_SIZE = 12;
const HEADER_MARGIN = 36; // 0.5 inch: page number baseline
const LEFT_TEXT = 108; // 1.5 inches: left text margin
const PAGE_NUMBER_RIGHT = 522; // 7.25 inches: page numbers are right-aligned here
const SCENE_NUMBER_LEFT = 54; // 0.75 inch
const SCENE_NUMBER_RIGHT = 531; // 7.38 inches

// Default watermark settings
const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: false,
  text: 'DRAFT',
  opacity: 0.15,
  fontSize: 72,
  angle: -45,
  position: 'diagonal',
};

// Convert inches to points
const inchesToPoints = (inches: number): number => inches * 72;

// Get x position for element type (from left edge of page)
const getXPosition = (elementType: ElementType): number => {
  const formatting = ELEMENT_FORMATTING[elementType];
  return inchesToPoints(formatting.leftEdge);
};

export interface PDFOptions {
  showSceneNumbers?: boolean;
  watermark?: WatermarkSettings;
  revisedPagesOnly?: boolean; // only pages with revisions shown (Revisions: Revised pages only)
}

// Dual dialogue positioning (column width is DUAL_COLUMN_CHARS in the engine)
const DUAL_LEFT_START = 108; // 1.5 inches
const DUAL_RIGHT_START = 324; // 4.5 inches
const DUAL_CHAR_OFFSET = 54; // Offset for character name

// Add watermark to a page
const addWatermark = (doc: jsPDF, watermark: WatermarkSettings) => {
  if (!watermark.enabled) return;

  doc.saveGraphicsState();

  // Set opacity using GState
  const gState = doc.GState({ opacity: watermark.opacity });
  doc.setGState(gState);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(watermark.fontSize);
  doc.setTextColor(128, 128, 128);

  if (watermark.position === 'diagonal') {
    // Rotate and center the watermark
    const centerX = PAGE_WIDTH / 2;
    const centerY = PAGE_HEIGHT / 2;

    doc.text(watermark.text, centerX, centerY, {
      align: 'center',
      angle: watermark.angle,
    });
  } else if (watermark.position === 'center') {
    doc.text(watermark.text, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center' });
  } else if (watermark.position === 'header') {
    doc.setFontSize(10);
    doc.text(watermark.text, PAGE_WIDTH / 2, 30, { align: 'center' });
  } else if (watermark.position === 'footer') {
    doc.setFontSize(10);
    doc.text(watermark.text, PAGE_WIDTH / 2, PAGE_HEIGHT - 30, { align: 'center' });
  }

  doc.restoreGraphicsState();

  // Reset font for content
  doc.setFont('Courier', 'normal');
  doc.setFontSize(FONT_SIZE);
  doc.setTextColor(0, 0, 0);
};

export const generatePDF = (screenplay: Screenplay, options: PDFOptions = {}): jsPDF => {
  const { showSceneNumbers = false, watermark = DEFAULT_WATERMARK, revisedPagesOnly = false } = options;
  const revisions = getRevisionSettings(screenplay);
  const allPages = paginateScript(screenplay).pages;
  const pages = revisedPagesOnly
    ? allPages.filter((page) => pageRevision(page, screenplay.elements, revisions))
    : allPages;
  const includeTitle = !!screenplay.title && !revisedPagesOnly;

  const doc = new jsPDF({
    unit: 'pt',
    format: 'letter',
  });

  // Set Courier font
  doc.setFont('Courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  // Add title page
  if (includeTitle) {
    const titleY = PAGE_HEIGHT / 3;
    doc.setFont('Courier', 'bold');
    doc.text(screenplay.title.toUpperCase(), PAGE_WIDTH / 2, titleY, { align: 'center' });

    doc.setFont('Courier', 'normal');
    const credit = screenplay.titlePage?.credit || 'Written by';
    doc.text(credit, PAGE_WIDTH / 2, titleY + LINE_HEIGHT * 3, { align: 'center' });

    if (screenplay.author) {
      doc.text(screenplay.author, PAGE_WIDTH / 2, titleY + LINE_HEIGHT * 5, { align: 'center' });
    }

    // Add contact info if available
    if (screenplay.titlePage?.contact) {
      const contactLines = screenplay.titlePage.contact.split('\n');
      let contactY = PAGE_HEIGHT - BOTTOM_MARGIN - (contactLines.length * LINE_HEIGHT);
      contactLines.forEach((line) => {
        doc.text(line, inchesToPoints(1.5), contactY);
        contactY += LINE_HEIGHT;
      });
    }
  }

  // Draws one wrapped line of an element at its margin and alignment
  const drawLine = (type: ElementType, text: string, y: number, isFirstLine: boolean) => {
    const formatting = ELEMENT_FORMATTING[type];
    const hang = isFirstLine ? inchesToPoints(formatting.firstIndent ?? 0) : 0;
    if (formatting.alignment === 'right') {
      doc.text(text, inchesToPoints(formatting.rightEdge), y, { align: 'right' });
    } else if (formatting.alignment === 'center') {
      const centerX = (inchesToPoints(formatting.leftEdge) + inchesToPoints(formatting.rightEdge)) / 2;
      doc.text(text, centerX, y, { align: 'center' });
    } else {
      doc.text(text, getXPosition(type) + hang, y);
    }
  };

  // Lay out every page exactly as the pagination engine placed it
  // Margin mark beside each line of a revised paragraph
  const markX = inchesToPoints(revisions.markLocation);
  const drawMarks = (elementIndex: number, y: number, lineCount: number) => {
    const revisionId = screenplay.elements[elementIndex]?.revisionId;
    if (!showsRevisionMark(revisionId, revisions)) return;
    const mark = revisions.sets.find((set) => set.id === revisionId)?.mark ?? '*';
    for (let li = 0; li < lineCount; li++) doc.text(mark, markX, y + li * LINE_HEIGHT);
  };

  if (pages.length === 0) {
    doc.text('No revised pages.', LEFT_TEXT, TOP_MARGIN);
  }

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0 || includeTitle) {
      doc.addPage();
    }
    addWatermark(doc, watermark);
    doc.setFont('Courier', 'normal');

    // Header (not on script page 1): the page's revision, then the page number
    // (locked scripts print A-page labels such as 12A)
    if (page.number > 1) {
      doc.text(`${page.label}.`, PAGE_NUMBER_RIGHT, HEADER_MARGIN, { align: 'right' });
      const revised = pageRevision(page, screenplay.elements, revisions);
      if (revised) {
        const label = revised.date ? `${revised.label} ${revised.date}` : revised.label;
        doc.text(label, PAGE_WIDTH / 2, HEADER_MARGIN, { align: 'center' });
      }
    }

    page.items.forEach((item) => {
      const y = TOP_MARGIN + item.top * LINE_HEIGHT;

      // (MORE) and the CONT'D speaker line sit at the Character indent
      if (item.kind !== 'element' && item.kind !== 'dual') {
        doc.text(item.text, getXPosition('Character'), y);
        return;
      }

      if (item.kind === 'dual') {
        [...item.left.map((p) => ({ p, start: DUAL_LEFT_START })), ...item.right.map((p) => ({ p, start: DUAL_RIGHT_START }))]
          .forEach(({ p, start }) => {
            const xPos = p.type === 'Character' ? start + DUAL_CHAR_OFFSET :
                         p.type === 'Parenthetical' ? start + 30 : start;
            const hang = inchesToPoints(ELEMENT_FORMATTING[p.type].firstIndent ?? 0);
            p.lines.forEach((line, li) => {
              doc.text(line.text, xPos + (li === 0 ? hang : 0), y + (p.top + li) * LINE_HEIGHT);
            });
            drawMarks(p.elementIndex, y + p.top * LINE_HEIGHT, p.lines.length);
          });
        return;
      }

      // Scene numbers beside the first line of a Scene Heading
      if (item.type === 'Scene Heading' && showSceneNumbers && !item.continued) {
        const sceneNumber = screenplay.elements[item.elementIndex].sceneNumber;
        if (sceneNumber) {
          doc.text(sceneNumber, SCENE_NUMBER_LEFT, y);
          doc.text(sceneNumber, SCENE_NUMBER_RIGHT, y);
        }
      }

      item.lines.forEach((line, li) => drawLine(item.type, line.text, y + li * LINE_HEIGHT, !item.continued && li === 0));
      drawMarks(item.elementIndex, y, item.lines.length);
    });
  });

  return doc;
};

export const downloadPDF = (screenplay: Screenplay, filename: string = 'screenplay.pdf', options: PDFOptions = {}): void => {
  const doc = generatePDF(screenplay, options);
  doc.save(filename);
};
