/**
 * Script Parser Utility
 *
 * Parses screenplay elements to extract:
 * - Scene heading components (INT/EXT, location, time of day)
 * - Character names from Character elements
 * - Locations from Scene Headings
 *
 * Used by Smart Type / Auto-Complete feature
 */

import type {
  ScreenplayElement,
  ParsedSceneHeading,
  ScriptLocation,
  ScriptCharacter,
  StoryCharacter,
  AutoCompleteSuggestion,
} from '../types/screenplay';
import { getPlainText } from './fdx';

/**
 * Parse a scene heading into its components
 * Handles formats like:
 * - INT. COFFEE SHOP - DAY
 * - EXT. BEACH - NIGHT
 * - INT/EXT. CAR - CONTINUOUS
 * - I/E HOUSE - MORNING
 */
export function parseSceneHeading(text: string): ParsedSceneHeading {
  const fullText = text.trim().toUpperCase();

  // Match INT/EXT patterns at the start
  const intExtPattern = /^(INT\/EXT|I\/E|INT|EXT)\.?\s*/i;
  const intExtMatch = fullText.match(intExtPattern);

  let intExt: ParsedSceneHeading['intExt'] = '';
  let remainder = fullText;

  if (intExtMatch) {
    const matched = intExtMatch[1].toUpperCase();
    if (matched === 'INT/EXT' || matched === 'I/E') {
      intExt = matched === 'I/E' ? 'I/E' : 'INT/EXT';
    } else if (matched === 'INT') {
      intExt = 'INT';
    } else if (matched === 'EXT') {
      intExt = 'EXT';
    }
    remainder = fullText.slice(intExtMatch[0].length);
  }

  // Split location and time of day by " - " or " -- "
  const parts = remainder.split(/\s+-+\s+/);
  const location = parts[0]?.trim() || '';
  const timeOfDay = parts[1]?.trim() || '';

  return {
    intExt,
    location,
    timeOfDay,
    fullText,
  };
}

/**
 * Extract all unique characters from screenplay Character elements
 * Returns a map of character names to their metadata
 */
export function extractCharactersFromScript(
  elements: ScreenplayElement[]
): Map<string, ScriptCharacter> {
  const characters = new Map<string, ScriptCharacter>();

  // Track current scene for sceneIds
  let currentSceneId: string | null = null;

  elements.forEach((element, index) => {
    // Track current scene
    if (element.type === 'Scene Heading') {
      currentSceneId = element.id;
    }

    // Extract character names from Character elements
    if (element.type === 'Character') {
      const text = getPlainText(element.content).trim().toUpperCase();

      // Remove extensions like (V.O.), (O.S.), (CONT'D), etc.
      const nameOnly = text.replace(/\s*\([^)]*\)\s*/g, '').trim();

      if (nameOnly) {
        const existing = characters.get(nameOnly);

        if (existing) {
          existing.occurrences++;
          existing.dialogueCount++;
          if (currentSceneId && !existing.sceneIds.includes(currentSceneId)) {
            existing.sceneIds.push(currentSceneId);
          }
        } else {
          characters.set(nameOnly, {
            name: nameOnly,
            occurrences: 1,
            dialogueCount: 1,
            firstAppearance: index,
            sceneIds: currentSceneId ? [currentSceneId] : [],
            isFromBlueprint: false,
          });
        }
      }
    }
  });

  return characters;
}

/**
 * Extract all unique locations from screenplay Scene Heading elements
 */
export function extractLocationsFromScript(
  elements: ScreenplayElement[]
): ScriptLocation[] {
  const locationMap = new Map<string, ScriptLocation>();

  elements.forEach((element) => {
    if (element.type === 'Scene Heading') {
      const text = getPlainText(element.content);
      const parsed = parseSceneHeading(text);

      if (parsed.location) {
        const existing = locationMap.get(parsed.location);

        if (existing) {
          existing.occurrences++;
          if (!existing.sceneIds.includes(element.id)) {
            existing.sceneIds.push(element.id);
          }
          // Update intExt if we see both INT and EXT versions
          if (existing.intExt !== 'BOTH') {
            if (
              (existing.intExt === 'INT' && (parsed.intExt === 'EXT' || parsed.intExt === 'INT/EXT')) ||
              (existing.intExt === 'EXT' && (parsed.intExt === 'INT' || parsed.intExt === 'INT/EXT'))
            ) {
              existing.intExt = 'BOTH';
            }
          }
        } else {
          locationMap.set(parsed.location, {
            name: parsed.location,
            intExt: parsed.intExt || 'INT',
            occurrences: 1,
            sceneIds: [element.id],
          });
        }
      }
    }
  });

  return Array.from(locationMap.values());
}

/**
 * Merge BluePrint characters with script-extracted characters
 * BluePrint characters take priority for the isFromBlueprint flag
 */
export function mergeCharacterSources(
  scriptCharacters: Map<string, ScriptCharacter>,
  blueprintCharacters: StoryCharacter[]
): Map<string, ScriptCharacter> {
  const merged = new Map(scriptCharacters);

  blueprintCharacters.forEach((bpChar) => {
    const name = bpChar.name.trim().toUpperCase();
    if (!name) return;

    const existing = merged.get(name);

    if (existing) {
      // Mark as also from blueprint
      existing.isFromBlueprint = true;
    } else {
      // Add as blueprint-only character (not yet in script)
      merged.set(name, {
        name: name,
        occurrences: 0,
        dialogueCount: 0,
        firstAppearance: -1,
        sceneIds: [],
        isFromBlueprint: true,
      });
    }
  });

  return merged;
}

/**
 * Generate auto-complete suggestions for character names
 * Filters by search text and sorts by relevance
 */
export function getCharacterSuggestions(
  characters: Map<string, ScriptCharacter>,
  searchText: string,
  maxResults: number = 10
): AutoCompleteSuggestion[] {
  const search = searchText.trim().toUpperCase();

  if (!search) {
    // Return top characters by occurrence
    return Array.from(characters.values())
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, maxResults)
      .map((char) => ({
        value: char.name,
        type: 'character' as const,
        source: char.isFromBlueprint ? 'blueprint' as const : 'script' as const,
        occurrences: char.occurrences,
      }));
  }

  // Filter by search text (starts with)
  const matches = Array.from(characters.values())
    .filter((char) => char.name.startsWith(search))
    .sort((a, b) => {
      // Sort by: exact match first, then by occurrence count
      if (a.name === search) return -1;
      if (b.name === search) return 1;
      return b.occurrences - a.occurrences;
    })
    .slice(0, maxResults);

  return matches.map((char) => ({
    value: char.name,
    type: 'character' as const,
    source: char.isFromBlueprint ? 'blueprint' as const : 'script' as const,
    occurrences: char.occurrences,
  }));
}

/**
 * Generate auto-complete suggestions for locations
 * Filters by search text and sorts by relevance
 */
export function getLocationSuggestions(
  locations: ScriptLocation[],
  searchText: string,
  maxResults: number = 10
): AutoCompleteSuggestion[] {
  const search = searchText.trim().toUpperCase();

  if (!search) {
    // Return top locations by occurrence
    return locations
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, maxResults)
      .map((loc) => ({
        value: loc.name,
        type: 'location' as const,
        source: 'script' as const,
        occurrences: loc.occurrences,
      }));
  }

  // Filter by search text (contains)
  const matches = locations
    .filter((loc) => loc.name.includes(search))
    .sort((a, b) => {
      // Sort by: starts with first, then by occurrence count
      const aStartsWith = a.name.startsWith(search);
      const bStartsWith = b.name.startsWith(search);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return b.occurrences - a.occurrences;
    })
    .slice(0, maxResults);

  return matches.map((loc) => ({
    value: loc.name,
    type: 'location' as const,
    source: 'script' as const,
    occurrences: loc.occurrences,
  }));
}

/**
 * Detect if the current typing context should trigger auto-complete
 * Returns the trigger type and current search text
 */
export function detectAutoCompleteTrigger(
  currentElement: ScreenplayElement | null,
  cursorPosition: number,
  text: string
): { triggerType: 'character' | 'location' | 'extension' | 'timeofday' | null; searchText: string } {
  if (!currentElement) {
    return { triggerType: null, searchText: '' };
  }

  const elementText = text.substring(0, cursorPosition).toUpperCase();

  // Character element
  if (currentElement.type === 'Character') {
    // Check if user is typing an extension (opened parenthesis)
    const extensionMatch = elementText.match(/^([A-Z\s]+)\s*\(([A-Z.']*)$/);
    if (extensionMatch) {
      // User has opened parenthesis - show extension suggestions
      return { triggerType: 'extension', searchText: extensionMatch[2] || '' };
    }

    // Check if there's already a complete extension - don't trigger
    if (/\([^)]+\)\s*$/.test(elementText)) {
      return { triggerType: null, searchText: '' };
    }

    // Remove any partial extension for character name search
    const nameOnly = elementText.replace(/\s*\([^)]*\)?\s*$/, '').trim();
    return { triggerType: 'character', searchText: nameOnly };
  }

  // Scene Heading element
  if (currentElement.type === 'Scene Heading') {
    const parsed = parseSceneHeading(elementText);

    // Only trigger if we have INT/EXT
    if (parsed.intExt) {
      // Check if user has typed " - " and is now typing time of day
      if (elementText.includes(' - ')) {
        // Extract what's after the dash
        const afterDash = elementText.split(' - ').slice(1).join(' - ').trim();
        return { triggerType: 'timeofday', searchText: afterDash };
      }

      // Otherwise suggest locations
      return { triggerType: 'location', searchText: parsed.location };
    }
  }

  return { triggerType: null, searchText: '' };
}

/**
 * Generate auto-complete suggestions for character extensions
 * (V.O.), (O.S.), (CONT'D), etc.
 */
export function getExtensionSuggestions(
  searchText: string,
  maxResults: number = 10
): AutoCompleteSuggestion[] {
  const extensions = [
    '(V.O.)',      // Voice Over
    '(O.S.)',      // Off Screen
    '(O.C.)',      // Off Camera
    "(CONT'D)",    // Continued
    '(PRE-LAP)',   // Pre-lap
    '(FILTERED)', // Phone, radio
  ];

  const search = searchText.trim().toUpperCase();

  // Filter extensions that match the search
  const matches = extensions
    .filter(ext => {
      // Match against inner content (without parens)
      const inner = ext.replace(/[()]/g, '');
      return inner.startsWith(search) || ext.includes(search);
    })
    .slice(0, maxResults);

  return matches.map(ext => ({
    value: ext,
    type: 'extension' as const,
    source: 'script' as const,
  }));
}

/**
 * Generate auto-complete suggestions for time of day
 * DAY, NIGHT, MORNING, etc.
 */
export function getTimeOfDaySuggestions(
  searchText: string,
  maxResults: number = 10
): AutoCompleteSuggestion[] {
  const timeOptions = [
    'DAY',
    'NIGHT',
    'MORNING',
    'AFTERNOON',
    'EVENING',
    'DUSK',
    'DAWN',
    'LATER',
    'CONTINUOUS',
    'SAME',
    'MOMENTS LATER',
  ];

  const search = searchText.trim().toUpperCase();

  if (!search) {
    // Return all options when nothing typed
    return timeOptions.slice(0, maxResults).map(time => ({
      value: time,
      type: 'extension' as const, // reuse extension type for display
      source: 'script' as const,
    }));
  }

  // Filter time options that start with search text
  const matches = timeOptions
    .filter(time => time.startsWith(search))
    .slice(0, maxResults);

  return matches.map(time => ({
    value: time,
    type: 'extension' as const,
    source: 'script' as const,
  }));
}

/**
 * Calculate eighths for a scene (page length measurement)
 * Industry standard: 1 page = 8 eighths
 */
export function calculateEighths(lineCount: number, linesPerPage: number = 55): number {
  const pageLength = lineCount / linesPerPage;
  const eighths = Math.ceil(pageLength * 8);
  return Math.max(1, Math.min(eighths, 64)); // Cap at 8 pages (64 eighths)
}

/**
 * Determine Day/Night from time of day string
 */
export function getDayNight(timeOfDay: string): 'Day' | 'Night' {
  const upper = timeOfDay.toUpperCase();
  const nightIndicators = ['NIGHT', 'EVENING', 'DUSK', 'MIDNIGHT', 'LATE NIGHT'];

  for (const indicator of nightIndicators) {
    if (upper.includes(indicator)) {
      return 'Night';
    }
  }

  return 'Day';
}
