// Screenplay element types following Final Draft conventions
export type ElementType =
  | 'Scene Heading'
  | 'Action'
  | 'Character'
  | 'Dialogue'
  | 'Parenthetical'
  | 'Transition'
  | 'Shot'
  | 'General';

export interface TextRun {
  text: string;
  style?: 'Bold' | 'Italic' | 'Underline' | 'Bold+Italic' | 'Bold+Underline' | 'Italic+Underline' | 'Bold+Italic+Underline';
}

export interface ScreenplayElement {
  id: string;
  type: ElementType;
  content: TextRun[];
  sceneNumber?: string;
}

export interface TitlePageInfo {
  title: string;
  credit: string; // "Written by", "Screenplay by", etc.
  author: string;
  source?: string; // "Based on..."
  draftDate?: string;
  contact?: string;
  copyright?: string;
  image?: string; // Base64 encoded image for title page
}

// Beat Board types
export interface Beat {
  id: string;
  title: string;
  description: string;
  color: string;
  position: { x: number; y: number };
  linkedSceneId?: string; // Links to a scene heading element
  imageUrl?: string;
}

export interface BeatBoard {
  id: string;
  name: string;
  beats: Beat[];
}

// Script Version for version management
export interface ScriptVersion {
  id: string;
  name: string;
  timestamp: Date;
  screenplay: Screenplay;
  isActive: boolean;
}

// Script Note for collaborators
export interface ScriptNote {
  id: string;
  elementId: string; // Which element the note is attached to
  author: string;
  content: string;
  timestamp: Date;
  resolved: boolean;
}

// ============================================
// OUTLINE MODE TYPES (Story Development)
// ============================================

// Plot Overview - General story information
export interface PlotOverview {
  title: string;
  logline: string;
  themes: string;        // Free text for themes
  storyTypes: string[];  // Story type patterns
  genres: string[];      // Drama, Comedy, Thriller, etc.
  tones: string[];       // Multiple tones
  audience: string;      // Target audience
  setting: string;       // Time period and location
  bStory: string;        // Subplot/thematic mirror
  otherDetails: string;  // Additional notes
}

// Character development
export type CharacterRole = 'Protagonist' | 'Antagonist' | 'Love Interest' | 'Mentor' | 'Sidekick' | 'Ally' | 'Guardian' | 'Other';
export type CharacterArc = 'Positive Arc' | 'Flat Arc' | 'Spiral Arc' | 'Corruption Arc';
export type CharacterArchetype = 'Lover' | 'Magician' | 'Explorer' | 'Sage' | 'Innocent' | 'Creator' | 'Ruler' | 'Caregiver' | 'Orphan' | 'Jester' | 'Classic Villain' | 'Anti-Villain' | 'Beast' | 'Authority Figure' | 'Bully' | 'Fanatic' | 'Machine' | 'Evil Personified' | 'Mastermind' | 'Henchman' | 'Shadow' | 'Corrupted';

export interface StoryCharacter {
  id: string;
  name: string;
  role: CharacterRole;
  characterArc: CharacterArc;
  archetypes: CharacterArchetype[];
  physicalDescription: string;
  personality: string;
  want: string;          // External goal
  need: string;          // Internal goal (thematic truth)
  lie: string;           // False belief they hold
  ghost: string;         // Past wound/trauma
  notes: string;
}

// Acts Overview - High-level act summaries
export interface ActsOverview {
  act1: string;    // Setup (0-25%)
  act2a: string;   // Rising Action (25-50%)
  act2b: string;   // Midpoint to Low Point (50-75%)
  act3: string;    // Resolution (75-100%)
}

// Structured Beat Sheet
// Based on common story structure (Blake Snyder, Save the Cat, etc.)
export interface StoryBeat {
  id: string;
  name: string;      // Beat name (e.g., "Inciting Incident")
  act: 'act1' | 'act2a' | 'act2b' | 'act3';
  description: string;  // User's content for this beat
  pageTarget?: number;  // Suggested page number
  linkedSceneId?: string; // Link to actual scene in script
}

// Full Outline structure
export interface StoryOutline {
  plot: PlotOverview;
  characters: StoryCharacter[];
  acts: ActsOverview;
  beats: StoryBeat[];
}

// Predefined beat template (for generating default beats)
export const DEFAULT_BEAT_STRUCTURE: Array<{ name: string; act: 'act1' | 'act2a' | 'act2b' | 'act3'; hint: string }> = [
  // Act 1 - Setup (0-25%)
  { name: 'Prologue', act: 'act1', hint: 'Optional opening that sets mood or stakes' },
  { name: 'Protagonist Introduction', act: 'act1', hint: 'Show protagonist in their ordinary world' },
  { name: 'Want & Need Established', act: 'act1', hint: 'What protagonist wants vs what they truly need' },
  { name: 'Inciting Incident', act: 'act1', hint: 'The event that disrupts the ordinary world' },
  { name: 'Hesitation', act: 'act1', hint: 'Protagonist resists the call to adventure' },
  { name: 'Preparation', act: 'act1', hint: 'Protagonist prepares to pursue the goal' },
  { name: 'Plot Point 1', act: 'act1', hint: 'Protagonist commits to the journey (no turning back)' },

  // Act 2A - Rising Action (25-50%)
  { name: 'Enter New World', act: 'act2a', hint: 'Protagonist enters unfamiliar territory' },
  { name: 'B-Story Begins', act: 'act2a', hint: 'Subplot and/or love interest introduced' },
  { name: 'Fun & Games', act: 'act2a', hint: 'The "promise of the premise" - genre-specific fun' },
  { name: 'First Trials', act: 'act2a', hint: 'Early obstacles and small victories' },
  { name: 'Gain Allies/Skills', act: 'act2a', hint: 'Protagonist builds support system' },
  { name: 'Pinch Point 1', act: 'act2a', hint: 'Antagonist shows true power/threat' },
  { name: 'Midpoint', act: 'act2a', hint: 'Major shift - false victory or false defeat' },

  // Act 2B - Complications (50-75%)
  { name: 'Rising Stakes', act: 'act2b', hint: 'Tension increases, obstacles get harder' },
  { name: 'Internal Conflict', act: 'act2b', hint: 'Protagonist battles inner demons' },
  { name: 'Pinch Point 2', act: 'act2b', hint: 'Antagonist applies more pressure' },
  { name: 'Major Setback', act: 'act2b', hint: 'Things fall apart for the protagonist' },
  { name: 'All Is Lost', act: 'act2b', hint: 'The lowest point - seems impossible to win' },
  { name: 'Dark Night of the Soul', act: 'act2b', hint: 'Protagonist confronts their deepest fears' },
  { name: 'Moment of Clarity', act: 'act2b', hint: 'Protagonist realizes what they truly need' },
  { name: 'Plot Point 2', act: 'act2b', hint: 'Protagonist finds new resolve' },

  // Act 3 - Resolution (75-100%)
  { name: 'Rally the Team', act: 'act3', hint: 'Protagonist gathers allies for final push' },
  { name: 'Create the Plan', act: 'act3', hint: 'Strategy for the final confrontation' },
  { name: 'Execute the Plan', act: 'act3', hint: 'Putting the plan into action' },
  { name: 'Climax', act: 'act3', hint: 'The final battle - protagonist faces antagonist' },
  { name: 'Proof of Growth', act: 'act3', hint: 'Protagonist demonstrates change' },
  { name: 'Resolution', act: 'act3', hint: 'Conflict is resolved' },
  { name: 'New Normal', act: 'act3', hint: 'Show the transformed world/protagonist' },
  { name: 'Epilogue', act: 'act3', hint: 'Optional closing that ties up loose ends' },
];

export interface Screenplay {
  title: string;
  author: string;
  titlePage: TitlePageInfo;
  contact?: string;
  draftDate?: string;
  copyright?: string;
  elements: ScreenplayElement[];
}

export interface DocumentMetadata {
  fileName: string;
  lastModified: Date;
  isDirty: boolean;
}

// ============================================
// INDUSTRY STANDARD FORMATTING SPECIFICATIONS
// ============================================
// Based on Final Draft and industry standards
// Sources:
// - https://www.finaldraft.com/learn/how-to-format-a-screenplay/
// - https://www.studiobinder.com/blog/screenplay-margins/
// - https://screenwriting.io/what-is-standard-screenplay-format/
//
// Page: 8.5" x 11" (US Letter)
// Font: Courier 12pt (fixed-width)
// 1 page ≈ 1 minute of screen time
// 55 lines per page (for 1/8th page calculations in scheduling)

// Page dimensions in inches
export const PAGE_WIDTH_INCHES = 8.5;
export const PAGE_HEIGHT_INCHES = 11;

// Margins in inches (industry standard)
export const MARGIN_LEFT = 1.5;    // Extra for 3-hole punch binding
export const MARGIN_RIGHT = 1.0;
export const MARGIN_TOP = 1.0;
export const MARGIN_BOTTOM = 1.0;

// Printable area
export const PRINTABLE_WIDTH = PAGE_WIDTH_INCHES - MARGIN_LEFT - MARGIN_RIGHT; // 6 inches
export const PRINTABLE_HEIGHT = PAGE_HEIGHT_INCHES - MARGIN_TOP - MARGIN_BOTTOM; // 9 inches

// Font specifications
export const FONT_FAMILY = 'Courier New, Courier, monospace';
export const FONT_SIZE_PT = 12;
export const LINE_HEIGHT_PT = 12; // Single-spaced Courier 12pt = 12 points

// Lines per page (industry standard for 1/8th page calculations)
export const LINES_PER_PAGE = 55;

// Screen display settings
export const DEFAULT_PPI = 96; // Standard screen resolution
export const DEFAULT_ZOOM = 100;

// Element formatting specifications
// All measurements from LEFT EDGE of page (not from margin)
export interface ElementFormatting {
  leftEdge: number;      // inches from left edge of page
  rightEdge: number;     // inches from left edge for right boundary
  alignment: 'left' | 'center' | 'right';
  allCaps: boolean;
  spaceBeforeLines: number;  // blank lines before element
  spaceAfterLines: number;   // blank lines after element
}

// Industry standard element positioning
// Character names: 3.7" from left edge (appears centered)
// Dialogue: 2.5" from left edge, ~3.5" wide
// Parenthetical: 3.1" from left edge
// Transitions: 6" from left edge (right-aligned)
export const ELEMENT_FORMATTING: Record<ElementType, ElementFormatting> = {
  'Scene Heading': {
    leftEdge: 1.5,        // At left margin
    rightEdge: 7.5,       // To right margin
    alignment: 'left',
    allCaps: true,
    spaceBeforeLines: 2,  // Double space before new scene
    spaceAfterLines: 1,
  },
  'Action': {
    leftEdge: 1.5,        // At left margin
    rightEdge: 7.5,       // Full width to right margin
    alignment: 'left',
    allCaps: false,
    spaceBeforeLines: 1,
    spaceAfterLines: 1,
  },
  'Character': {
    leftEdge: 3.7,        // 3.7" from left edge (industry standard)
    rightEdge: 7.5,
    alignment: 'left',    // Left-aligned at its indented position
    allCaps: true,
    spaceBeforeLines: 1,
    spaceAfterLines: 0,   // No space before dialogue
  },
  'Dialogue': {
    leftEdge: 2.5,        // 2.5" from left edge
    rightEdge: 6.0,       // Creates ~3.5" wide dialogue block
    alignment: 'left',
    allCaps: false,
    spaceBeforeLines: 0,
    spaceAfterLines: 1,
  },
  'Parenthetical': {
    leftEdge: 3.1,        // 3.1" from left edge
    rightEdge: 5.5,       // Narrower than dialogue
    alignment: 'left',
    allCaps: false,
    spaceBeforeLines: 0,
    spaceAfterLines: 0,
  },
  'Transition': {
    leftEdge: 6.0,        // 6" from left edge
    rightEdge: 7.5,       // To right margin
    alignment: 'right',
    allCaps: true,
    spaceBeforeLines: 1,
    spaceAfterLines: 1,
  },
  'Shot': {
    leftEdge: 1.5,
    rightEdge: 7.5,
    alignment: 'left',
    allCaps: true,
    spaceBeforeLines: 1,
    spaceAfterLines: 1,
  },
  'General': {
    leftEdge: 1.5,
    rightEdge: 7.5,
    alignment: 'left',
    allCaps: false,
    spaceBeforeLines: 1,
    spaceAfterLines: 1,
  },
};

// Calculate pixel values for screen display at a given zoom level
export const inchesToPixels = (inches: number, ppi: number = DEFAULT_PPI): number => {
  return inches * ppi;
};

// Get page dimensions in pixels
export const getPageDimensionsPixels = (ppi: number = DEFAULT_PPI, zoom: number = 100) => {
  const scale = zoom / 100;
  return {
    width: PAGE_WIDTH_INCHES * ppi * scale,
    height: PAGE_HEIGHT_INCHES * ppi * scale,
    marginLeft: MARGIN_LEFT * ppi * scale,
    marginRight: MARGIN_RIGHT * ppi * scale,
    marginTop: MARGIN_TOP * ppi * scale,
    marginBottom: MARGIN_BOTTOM * ppi * scale,
    printableWidth: PRINTABLE_WIDTH * ppi * scale,
    printableHeight: PRINTABLE_HEIGHT * ppi * scale,
  };
};

// Keyboard shortcuts for element switching
export const ELEMENT_SHORTCUTS: Record<string, ElementType> = {
  '1': 'Scene Heading',
  '2': 'Action',
  '3': 'Character',
  '4': 'Dialogue',
  '5': 'Parenthetical',
  '6': 'Transition',
};

// Smart element progression (what comes next after Enter)
export const ELEMENT_PROGRESSION: Record<ElementType, ElementType> = {
  'Scene Heading': 'Action',
  'Action': 'Action',
  'Character': 'Dialogue',
  'Dialogue': 'Character',
  'Parenthetical': 'Dialogue',
  'Transition': 'Scene Heading',
  'Shot': 'Action',
  'General': 'Action',
};

// Element display names and shortcuts
export const ELEMENT_INFO: Record<ElementType, { name: string; shortcut: string; description: string }> = {
  'Scene Heading': { name: 'Scene Heading', shortcut: 'Ctrl+1', description: 'INT./EXT. LOCATION - TIME' },
  'Action': { name: 'Action', shortcut: 'Ctrl+2', description: 'Describe what happens' },
  'Character': { name: 'Character', shortcut: 'Ctrl+3', description: 'CHARACTER NAME' },
  'Dialogue': { name: 'Dialogue', shortcut: 'Ctrl+4', description: 'What the character says' },
  'Parenthetical': { name: 'Parenthetical', shortcut: 'Ctrl+5', description: '(how they say it)' },
  'Transition': { name: 'Transition', shortcut: 'Ctrl+6', description: 'CUT TO:' },
  'Shot': { name: 'Shot', shortcut: '', description: 'Camera direction' },
  'General': { name: 'General', shortcut: '', description: 'General text' },
};
