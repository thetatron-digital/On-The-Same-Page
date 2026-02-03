import jsPDF from 'jspdf';
import type { Screenplay, ElementType } from '../types/screenplay';
import { ELEMENT_FORMATTING } from '../types/screenplay';
import { getPlainText } from './fdx';

// PDF constants (in points, 72 points = 1 inch)
const PAGE_WIDTH = 612; // 8.5 inches
const PAGE_HEIGHT = 792; // 11 inches
const TOP_MARGIN = 72; // 1 inch
const BOTTOM_MARGIN = 72; // 1 inch
const RIGHT_MARGIN = 72; // 1 inch
const LINE_HEIGHT = 12; // 12 points for Courier 12pt
const FONT_SIZE = 12;

// Convert inches to points
const inchesToPoints = (inches: number): number => inches * 72;

// Get x position for element type
const getXPosition = (elementType: ElementType): number => {
  const formatting = ELEMENT_FORMATTING[elementType];
  return inchesToPoints(formatting.leftMargin);
};

// Get max width for element type
const getMaxWidth = (elementType: ElementType): number => {
  const formatting = ELEMENT_FORMATTING[elementType];
  const leftPos = inchesToPoints(formatting.leftMargin);
  const rightPos = PAGE_WIDTH - inchesToPoints(formatting.rightMargin);
  return rightPos - leftPos;
};

// Word wrap text to fit within max width
const wrapText = (doc: jsPDF, text: string, maxWidth: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = doc.getTextWidth(testLine);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
};

export const generatePDF = (screenplay: Screenplay): jsPDF => {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'letter',
  });

  // Set Courier font
  doc.setFont('Courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  let currentY = TOP_MARGIN;
  let pageNumber = 1;

  // Helper function to add a new page
  const addNewPage = () => {
    doc.addPage();
    pageNumber++;
    currentY = TOP_MARGIN;

    // Add page number (except first page)
    doc.setFont('Courier', 'normal');
    doc.text(`${pageNumber}.`, PAGE_WIDTH - RIGHT_MARGIN, 36, { align: 'right' });
  };

  // Helper function to check if we need a new page
  const checkPageBreak = (neededSpace: number) => {
    if (currentY + neededSpace > PAGE_HEIGHT - BOTTOM_MARGIN) {
      addNewPage();
      return true;
    }
    return false;
  };

  // Add title page
  if (screenplay.title) {
    const titleY = PAGE_HEIGHT / 3;
    doc.setFont('Courier', 'bold');
    doc.text(screenplay.title.toUpperCase(), PAGE_WIDTH / 2, titleY, { align: 'center' });

    doc.setFont('Courier', 'normal');
    doc.text('Written by', PAGE_WIDTH / 2, titleY + LINE_HEIGHT * 3, { align: 'center' });

    if (screenplay.author) {
      doc.text(screenplay.author, PAGE_WIDTH / 2, titleY + LINE_HEIGHT * 5, { align: 'center' });
    }

    addNewPage();
  }

  // Process each element
  screenplay.elements.forEach((element) => {
    const formatting = ELEMENT_FORMATTING[element.type];
    const text = getPlainText(element.content);

    if (!text.trim()) return;

    // Add space before (except at top of page)
    if (currentY > TOP_MARGIN) {
      currentY += formatting.spaceBefore * LINE_HEIGHT;
    }

    // Get positioning
    const xPos = getXPosition(element.type);
    const maxWidth = getMaxWidth(element.type);

    // Format text based on element type
    let displayText = formatting.allCaps ? text.toUpperCase() : text;

    // Word wrap the text
    const lines = wrapText(doc, displayText, maxWidth);

    // Check if we need to break to a new page
    checkPageBreak(lines.length * LINE_HEIGHT);

    // Render each line
    lines.forEach((line, lineIndex) => {
      if (formatting.alignment === 'Right') {
        doc.text(line, PAGE_WIDTH - RIGHT_MARGIN, currentY, { align: 'right' });
      } else if (formatting.alignment === 'Center') {
        doc.text(line, PAGE_WIDTH / 2, currentY, { align: 'center' });
      } else {
        doc.text(line, xPos, currentY);
      }
      currentY += LINE_HEIGHT;

      // Check for page break within multi-line text
      if (lineIndex < lines.length - 1) {
        checkPageBreak(LINE_HEIGHT);
      }
    });

    // Add space after
    currentY += (formatting.spaceAfter - 1) * LINE_HEIGHT;
  });

  return doc;
};

export const downloadPDF = (screenplay: Screenplay, filename: string = 'screenplay.pdf'): void => {
  const doc = generatePDF(screenplay);
  doc.save(filename);
};
