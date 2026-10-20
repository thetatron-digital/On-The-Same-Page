import jsPDF from 'jspdf';
import type { Screenplay, ElementType, WatermarkSettings } from '../types/screenplay';
import { ELEMENT_FORMATTING } from '../types/screenplay';
import { paginateScript } from '../engine/paginate';

// PDF constants (in points, 72 points = 1 inch)
const PAGE_WIDTH = 612; // 8.5 inches
const PAGE_HEIGHT = 792; // 11 inches
const TOP_MARGIN = 72; // 1 inch
const BOTTOM_MARGIN = 72; // 1 inch
const LINE_HEIGHT = 12; // 12 points for Courier 12pt
const FONT_SIZE = 12;
const HEADER_MARGIN = 36; // 0.5 inch: page number baseline
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
  const { showSceneNumbers = false, watermark = DEFAULT_WATERMARK } = options;
  const { pages } = paginateScript(screenplay.elements);

  const doc = new jsPDF({
    unit: 'pt',
    format: 'letter',
  });

  // Set Courier font
  doc.setFont('Courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  // Add title page
  if (screenplay.title) {
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
  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0 || screenplay.title) {
      doc.addPage();
    }
    addWatermark(doc, watermark);
    doc.setFont('Courier', 'normal');

    // Page number top right (script page 1 is unnumbered)
    if (page.number > 1) {
      doc.text(`${page.number}.`, PAGE_NUMBER_RIGHT, HEADER_MARGIN, { align: 'right' });
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
    });
  });

  return doc;
};

export const downloadPDF = (screenplay: Screenplay, filename: string = 'screenplay.pdf', options: PDFOptions = {}): void => {
  const doc = generatePDF(screenplay, options);
  doc.save(filename);
};
