/**
 * Breakdown utilities for script analysis
 * Industry standard breakdown calculations
 */

import type {
  ScreenplayElement,
  BreakdownScene,
  BreakdownElement,
  BreakdownCategory,
  ParsedSceneHeading,
} from '../types/screenplay';
import { LINES_PER_PAGE } from '../types/screenplay';
import { getPlainText } from './fdx';

/**
 * Parse a scene heading into its components
 * Examples:
 * - "INT. COFFEE SHOP - DAY" -> { intExt: 'INT', location: 'COFFEE SHOP', timeOfDay: 'DAY' }
 * - "EXT. BEACH - NIGHT" -> { intExt: 'EXT', location: 'BEACH', timeOfDay: 'NIGHT' }
 */
export const parseSceneHeading = (text: string): ParsedSceneHeading => {
  const fullText = text.trim().toUpperCase();

  // Match INT/EXT patterns
  const intExtMatch = fullText.match(/^(INT\.?\/EXT\.?|I\/E|INT\.?|EXT\.?)\s*/i);
  const intExt = intExtMatch ?
    intExtMatch[1].replace(/\./g, '').toUpperCase() as 'INT' | 'EXT' | 'INT/EXT' | 'I/E' : '';

  // Remove INT/EXT prefix
  let remaining = intExtMatch ? fullText.slice(intExtMatch[0].length) : fullText;

  // Split on " - " to separate location and time of day
  const parts = remaining.split(/\s+-\s+/);
  const location = parts[0]?.trim() || '';
  const timeOfDay = parts[1]?.trim() || '';

  return {
    intExt,
    location,
    timeOfDay,
    fullText,
  };
};

/**
 * Calculate page eighths for a scene
 * Industry standard: 1 page = 8 eighths
 * Based on line count, where 55 lines = 1 page
 */
export const calculateEighths = (lineCount: number): number => {
  // Each eighth is roughly 6.875 lines (55/8)
  const linesPerEighth = LINES_PER_PAGE / 8;
  const eighths = Math.ceil(lineCount / linesPerEighth);
  // Minimum 1/8, maximum 8/8 per scene for display
  return Math.max(1, Math.min(8, eighths));
};

/**
 * Estimate line count for an element
 * Based on character count, assuming ~60 chars per line for action
 * and narrower widths for dialogue/parenthetical
 */
export const estimateLineCount = (element: ScreenplayElement): number => {
  const text = getPlainText(element.content);
  const charCount = text.length;

  // Different element types have different line widths
  let charsPerLine: number;
  switch (element.type) {
    case 'Dialogue':
      charsPerLine = 35; // Narrower column
      break;
    case 'Parenthetical':
      charsPerLine = 25; // Even narrower
      break;
    case 'Character':
    case 'Transition':
      charsPerLine = 30;
      break;
    default:
      charsPerLine = 60; // Full width (action, scene heading)
  }

  // Each element takes at least 1 line
  return Math.max(1, Math.ceil(charCount / charsPerLine));
};

/**
 * Calculate total line count for a range of elements (scene content)
 */
export const calculateSceneLines = (elements: ScreenplayElement[]): number => {
  return elements.reduce((total, el) => total + estimateLineCount(el), 0);
};

/**
 * Determine if a time of day is Day or Night (for scheduling)
 */
export const getDayNight = (timeOfDay: string): 'Day' | 'Night' => {
  const upper = timeOfDay.toUpperCase();

  // Night variants
  if (upper.includes('NIGHT') || upper.includes('DUSK') || upper === 'EVENING') {
    return 'Night';
  }

  // Default to Day
  return 'Day';
};

/**
 * Format eighths for display (e.g., "1 2/8" or "2 4/8")
 */
export const formatEighths = (eighths: number): string => {
  if (eighths <= 8) {
    return `${eighths}/8`;
  }

  const pages = Math.floor(eighths / 8);
  const remainder = eighths % 8;

  if (remainder === 0) {
    return `${pages}`;
  }

  return `${pages} ${remainder}/8`;
};

/**
 * Extract scenes from screenplay elements
 * Groups elements by scene headings
 */
export const extractScenes = (elements: ScreenplayElement[]): {
  sceneElement: ScreenplayElement;
  contentElements: ScreenplayElement[];
  startIndex: number;
  endIndex: number;
}[] => {
  const scenes: {
    sceneElement: ScreenplayElement;
    contentElements: ScreenplayElement[];
    startIndex: number;
    endIndex: number;
  }[] = [];

  let currentSceneStart = -1;
  let currentSceneElement: ScreenplayElement | null = null;
  let currentContent: ScreenplayElement[] = [];

  elements.forEach((element, index) => {
    if (element.type === 'Scene Heading') {
      // Save previous scene if exists
      if (currentSceneElement) {
        scenes.push({
          sceneElement: currentSceneElement,
          contentElements: currentContent,
          startIndex: currentSceneStart,
          endIndex: index - 1,
        });
      }

      // Start new scene
      currentSceneStart = index;
      currentSceneElement = element;
      currentContent = [];
    } else if (currentSceneElement) {
      currentContent.push(element);
    }
  });

  // Don't forget the last scene
  if (currentSceneElement) {
    scenes.push({
      sceneElement: currentSceneElement,
      contentElements: currentContent,
      startIndex: currentSceneStart,
      endIndex: elements.length - 1,
    });
  }

  return scenes;
};

/**
 * Generate breakdown scenes from screenplay
 */
export const generateBreakdownScenes = (
  elements: ScreenplayElement[]
): BreakdownScene[] => {
  const sceneGroups = extractScenes(elements);
  let pageCounter = 1;
  let lineCounter = 0;

  return sceneGroups.map((group, index) => {
    const parsed = parseSceneHeading(getPlainText(group.sceneElement.content));
    const sceneLines = calculateSceneLines([group.sceneElement, ...group.contentElements]);
    const eighths = calculateEighths(sceneLines);

    // Calculate page positions
    const pageStart = pageCounter;
    lineCounter += sceneLines;
    while (lineCounter > LINES_PER_PAGE) {
      pageCounter++;
      lineCounter -= LINES_PER_PAGE;
    }
    const pageEnd = pageCounter;

    // Generate description from first action element
    const firstAction = group.contentElements.find(el => el.type === 'Action');
    const description = firstAction ?
      getPlainText(firstAction.content).slice(0, 100) + '...' : '';

    return {
      id: group.sceneElement.id,
      sceneNumber: group.sceneElement.sceneNumber || String(index + 1),
      intExt: (parsed.intExt || 'INT') as 'INT' | 'EXT' | 'INT/EXT' | 'I/E',
      location: parsed.location,
      timeOfDay: parsed.timeOfDay,
      dayNight: getDayNight(parsed.timeOfDay),
      eighths,
      pageStart,
      pageEnd,
      description,
      elements: [], // To be populated with breakdown element IDs
      castIds: [],  // To be populated with cast IDs
    };
  });
};

/**
 * Create a breakdown element from selected text
 */
export const createBreakdownElement = (
  text: string,
  category: BreakdownCategory | string,
  sceneId: string,
  sourceElementId: string,
  startOffset: number,
  endOffset: number
): BreakdownElement => {
  return {
    id: `be_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text: text.trim(),
    category,
    sceneId,
    sourceElementId,
    startOffset,
    endOffset,
  };
};

/**
 * Group breakdown elements by category
 */
export const groupElementsByCategory = (
  elements: BreakdownElement[]
): Map<string, BreakdownElement[]> => {
  const groups = new Map<string, BreakdownElement[]>();

  elements.forEach(el => {
    const existing = groups.get(el.category) || [];
    existing.push(el);
    groups.set(el.category, existing);
  });

  return groups;
};

/**
 * Filter breakdown elements by scene
 */
export const getElementsForScene = (
  elements: BreakdownElement[],
  sceneId: string
): BreakdownElement[] => {
  return elements.filter(el => el.sceneId === sceneId);
};

/**
 * Get unique element texts by category (for summary views)
 */
export const getUniqueByCategoryForScene = (
  elements: BreakdownElement[],
  sceneId: string
): Map<string, string[]> => {
  const sceneElements = getElementsForScene(elements, sceneId);
  const result = new Map<string, string[]>();

  sceneElements.forEach(el => {
    const existing = result.get(el.category) || [];
    if (!existing.includes(el.text)) {
      existing.push(el.text);
    }
    result.set(el.category, existing);
  });

  return result;
};
