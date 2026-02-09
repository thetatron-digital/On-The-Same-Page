import jsPDF from 'jspdf';
import type { Screenplay, ElementType, WatermarkSettings } from '../types/screenplay';
import { ELEMENT_FORMATTING } from '../types/screenplay';
import { getPlainText } from './fdx';

// PDF constants (in points, 72 points = 1 inch)
const PAGE_WIDTH = 612; // 8.5 inches
const PAGE_HEIGHT = 792; // 11 inches
const TOP_MARGIN = 72; // 1 inch
const BOTTOM_MARGIN = 72; // 1 inch
const LEFT_MARGIN = 108; // 1.5 inches
const RIGHT_MARGIN = 72; // 1 inch
const LINE_HEIGHT = 12; // 12 points for Courier 12pt
const FONT_SIZE = 12;
const SCENE_NUMBER_OFFSET = 36; // Distance from margin for scene numbers

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

// Get max width for element type
const getMaxWidth = (elementType: ElementType): number => {
  const formatting = ELEMENT_FORMATTING[elementType];
  const leftPos = inchesToPoints(formatting.leftEdge);
  const rightPos = inchesToPoints(formatting.rightEdge);
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

export interface PDFOptions {
  showSceneNumbers?: boolean;
  watermark?: WatermarkSettings;
}

// Dual dialogue positioning
const DUAL_LEFT_START = 108; // 1.5 inches
const DUAL_RIGHT_START = 324; // 4.5 inches
const DUAL_CHAR_OFFSET = 54; // Offset for character name
const DUAL_WIDTH = 180; // Width for each column

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

    // Add watermark to new page
    addWatermark(doc, watermark);
  };

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

    addNewPage();
  }

  // Add watermark to first content page
  addWatermark(doc, watermark);

  // Track current character for MORE/CONT'D handling
  let currentCharacter = '';
  let inDialogueBlock = false;

  // Helper to add MORE marker
  const addMoreMarker = () => {
    const moreFormatting = ELEMENT_FORMATTING['Dialogue'];
    const moreX = (inchesToPoints(moreFormatting.leftEdge) + inchesToPoints(moreFormatting.rightEdge)) / 2;
    doc.text('(MORE)', moreX, currentY, { align: 'center' });
    currentY += LINE_HEIGHT;
  };

  // Helper to add CONT'D character name
  const addContdMarker = (characterName: string) => {
    const charX = getXPosition('Character');
    doc.text(`${characterName} (CONT'D)`, charX, currentY);
    currentY += LINE_HEIGHT;
  };

  // Helper for page break with dialogue handling
  const checkPageBreakWithDialogue = (neededSpace: number, isDialogue: boolean): boolean => {
    if (currentY + neededSpace > PAGE_HEIGHT - BOTTOM_MARGIN) {
      // Add MORE if breaking during dialogue
      if (isDialogue && inDialogueBlock && currentCharacter) {
        addMoreMarker();
      }

      addNewPage();

      // Add CONT'D if continuing dialogue after page break
      if (isDialogue && inDialogueBlock && currentCharacter) {
        addContdMarker(currentCharacter);
      }

      return true;
    }
    return false;
  };

  // Helper to render dual dialogue side by side
  const renderDualDialogue = (leftElements: typeof screenplay.elements, rightElements: typeof screenplay.elements) => {
    if (currentY > TOP_MARGIN) {
      currentY += LINE_HEIGHT; // Space before dual dialogue block
    }

    const startY = currentY;
    let leftY = startY;
    let rightY = startY;

    // Render left column
    leftElements.forEach((el) => {
      const text = getPlainText(el.content);
      if (!text.trim()) return;

      const displayText = ELEMENT_FORMATTING[el.type].allCaps ? text.toUpperCase() : text;
      const lines = wrapText(doc, displayText, DUAL_WIDTH);

      const xPos = el.type === 'Character' ? DUAL_LEFT_START + DUAL_CHAR_OFFSET :
                   el.type === 'Parenthetical' ? DUAL_LEFT_START + 30 : DUAL_LEFT_START;

      lines.forEach((line) => {
        doc.text(line, xPos, leftY);
        leftY += LINE_HEIGHT;
      });
    });

    // Render right column
    rightElements.forEach((el) => {
      const text = getPlainText(el.content);
      if (!text.trim()) return;

      const displayText = ELEMENT_FORMATTING[el.type].allCaps ? text.toUpperCase() : text;
      const lines = wrapText(doc, displayText, DUAL_WIDTH);

      const xPos = el.type === 'Character' ? DUAL_RIGHT_START + DUAL_CHAR_OFFSET :
                   el.type === 'Parenthetical' ? DUAL_RIGHT_START + 30 : DUAL_RIGHT_START;

      lines.forEach((line) => {
        doc.text(line, xPos, rightY);
        rightY += LINE_HEIGHT;
      });
    });

    // Move Y to after both columns
    currentY = Math.max(leftY, rightY) + LINE_HEIGHT;
  };

  // Process each element
  let i = 0;
  while (i < screenplay.elements.length) {
    const element = screenplay.elements[i];
    const formatting = ELEMENT_FORMATTING[element.type];
    const text = getPlainText(element.content);

    // Check for dual dialogue block
    if (element.isDualDialogue && element.dualDialoguePosition === 'left') {
      // Collect left block
      const leftBlock: typeof screenplay.elements = [];
      let j = i;
      while (j < screenplay.elements.length &&
             screenplay.elements[j].isDualDialogue &&
             screenplay.elements[j].dualDialoguePosition === 'left') {
        leftBlock.push(screenplay.elements[j]);
        j++;
      }

      // Collect right block
      const rightBlock: typeof screenplay.elements = [];
      while (j < screenplay.elements.length &&
             screenplay.elements[j].isDualDialogue &&
             screenplay.elements[j].dualDialoguePosition === 'right') {
        rightBlock.push(screenplay.elements[j]);
        j++;
      }

      // Render dual dialogue
      if (leftBlock.length > 0 && rightBlock.length > 0) {
        renderDualDialogue(leftBlock, rightBlock);
        i = j;
        continue;
      }
    }

    if (!text.trim()) {
      i++;
      continue;
    }

    // Track character for dialogue blocks
    if (element.type === 'Character') {
      // Extract character name without extensions
      currentCharacter = text.replace(/\s*\([^)]*\)\s*$/, '').trim().toUpperCase();
      inDialogueBlock = true;
    } else if (element.type !== 'Dialogue' && element.type !== 'Parenthetical') {
      // Reset when we leave dialogue block
      inDialogueBlock = false;
      currentCharacter = '';
    }

    // Add space before (except at top of page)
    if (currentY > TOP_MARGIN) {
      currentY += formatting.spaceBeforeLines * LINE_HEIGHT;
    }

    // Get positioning
    const xPos = getXPosition(element.type);
    const maxWidth = getMaxWidth(element.type);

    // Format text based on element type
    const displayText = formatting.allCaps ? text.toUpperCase() : text;

    // Word wrap the text
    const lines = wrapText(doc, displayText, maxWidth);

    // Check if we need to break to a new page
    const isDialogueElement = element.type === 'Dialogue' || element.type === 'Parenthetical';
    checkPageBreakWithDialogue(lines.length * LINE_HEIGHT, isDialogueElement);

    // Add scene numbers for Scene Heading elements
    if (element.type === 'Scene Heading' && showSceneNumbers && element.sceneNumber) {
      // Left scene number
      doc.text(element.sceneNumber, LEFT_MARGIN - SCENE_NUMBER_OFFSET, currentY);
      // Right scene number
      doc.text(element.sceneNumber, PAGE_WIDTH - RIGHT_MARGIN + SCENE_NUMBER_OFFSET, currentY, { align: 'right' });
    }

    // Render each line
    lines.forEach((line, lineIndex) => {
      if (formatting.alignment === 'right') {
        doc.text(line, inchesToPoints(formatting.rightEdge), currentY, { align: 'right' });
      } else if (formatting.alignment === 'center') {
        const centerX = (inchesToPoints(formatting.leftEdge) + inchesToPoints(formatting.rightEdge)) / 2;
        doc.text(line, centerX, currentY, { align: 'center' });
      } else {
        doc.text(line, xPos, currentY);
      }
      currentY += LINE_HEIGHT;

      // Check for page break within multi-line text
      if (lineIndex < lines.length - 1) {
        checkPageBreakWithDialogue(LINE_HEIGHT, isDialogueElement);
      }
    });

    // Add space after
    if (formatting.spaceAfterLines > 0) {
      currentY += formatting.spaceAfterLines * LINE_HEIGHT;
    }

    i++;
  }

  return doc;
};

export const downloadPDF = (screenplay: Screenplay, filename: string = 'screenplay.pdf', options: PDFOptions = {}): void => {
  const doc = generatePDF(screenplay, options);
  doc.save(filename);
};
