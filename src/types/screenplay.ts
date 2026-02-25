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
  isDualDialogue?: boolean; // For dual dialogue (side-by-side)
  dualDialoguePosition?: 'left' | 'right'; // Position in dual dialogue
}

// Page lock for production readiness
export interface PageLock {
  pageNumber: number;
  lockedAt: Date;
  lockedBy?: string;
  color?: string; // Revision color (white, blue, pink, yellow, green, goldenrod, buff, salmon, cherry)
}

// Watermark settings for PDF export
export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  opacity: number; // 0-1
  fontSize: number;
  angle: number; // degrees
  position: 'center' | 'diagonal' | 'header' | 'footer';
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
  // Act 1 - Setup (0-25%) - 10 beats
  { name: 'Prologue', act: 'act1', hint: 'A beat that sets up Tone, Setting, Scope; and contrasts the Epilogue to illustrate Protagonist growth.' },
  { name: 'Protagonist Want', act: 'act1', hint: 'A beat that clearly defines a Goal the Protagonist wants to achieve during the story.' },
  { name: 'Protagonist Need', act: 'act1', hint: 'A beat that defines a Moral Lesson essential to the Protagonist\'s growth, that also conflicts with their Goal.' },
  { name: 'Protagonist Life', act: 'act1', hint: 'A beat illustrating the Protagonist\'s daily routines at Home, Work, and Play; and problems they create by violating the Moral Lesson.' },
  { name: 'Protagonist Plight', act: 'act1', hint: 'A beat that describes how the Protagonist\'s Lie is holding them back from achieving their "Want."' },
  { name: 'Inciting Incident', act: 'act1', hint: 'An unexpected event that upsets the Protagonist\'s Status Quo, and propels the story forward.' },
  { name: 'Hesitation', act: 'act1', hint: 'A beat where the Protagonist reacts to the Inciting Incident, either positively or negatively.' },
  { name: 'Prepare for Goal', act: 'act1', hint: 'A beat where the Protagonist plans to restore the Status Quo, in order to achieve their Goal.' },
  { name: 'Attempt at Goal', act: 'act1', hint: 'A beat where the Protagonist attempts to restore the Status Quo, in order to achieve their Goal.' },
  { name: 'Plot Point 1', act: 'act1', hint: 'A significant event that affects the Protagonist, either internally or externally, and forces them to make a decision.' },

  // Act 2A - Rising Action (25-50%) - 11 beats
  { name: 'Cross to Unknown', act: 'act2a', hint: 'A beat that illustrates the Protagonist\'s decision to abandon their Status Quo, and embark on a journey to achieve their Goal.' },
  { name: 'B-Story', act: 'act2a', hint: 'A beat that illustrates the Theme through the Protagonist\'s relationship with a Mentor or Love Interest.' },
  { name: 'Trials of Initiation', act: 'act2a', hint: 'A beat where the Protagonist struggles to achieve their Goal, while meeting new Allies and Antagonists.' },
  { name: 'Gain Skills', act: 'act2a', hint: 'A beat where the Protagonist learns skills and/or behaviors associated with the Moral Lesson, from various Allies and/or Antagonists.' },
  { name: 'Pinch Point 1', act: 'act2a', hint: 'An event, less dramatic than a Plot Point, that psychologically affects the Protagonist.' },
  { name: 'Trials', act: 'act2a', hint: 'A beat where the Protagonist struggles to achieve their Goal, while meeting new Allies and Antagonists.' },
  { name: 'Gain Skills (2)', act: 'act2a', hint: 'A beat where the Protagonist learns skills and/or behaviors associated with the Moral Lesson, from various Allies and/or Antagonists.' },
  { name: 'Trials (2)', act: 'act2a', hint: 'A beat where the Protagonist struggles to achieve their Goal, while meeting new Allies and Antagonists.' },
  { name: 'Gain Skills (3)', act: 'act2a', hint: 'A beat where the Protagonist learns skills and/or behaviors associated with the Moral Lesson, from various Allies and/or Antagonists.' },
  { name: 'Reach Inner Sanctum', act: 'act2a', hint: 'A beat that shows the Protagonist and Allies, now experienced and familiar with the Unknown, make new plans to achieve their Goal.' },
  { name: 'Midpoint', act: 'act2a', hint: 'A dramatic Wish Fulfillment for the Protagonist, who has not yet learned the Moral Lesson. Stakes are raised, and a deadline for the Goal is introduced. NOTE: This beat can alternatively be a Comeuppance, but either situation should contrast the drama of Pinch Point 2.' },

  // Act 2B - Complications (50-75%) - 9 beats
  { name: 'Internal Tension', act: 'act2b', hint: 'A beat illustrating how dissent, doubt, and jealousy create conflict between the Protagonist and their Allies.' },
  { name: 'External Tension', act: 'act2b', hint: 'A beat where the Antagonist regroups, and doubles their effort to obstruct the Protagonist\'s Goal.' },
  { name: 'Sacrifice Need for Want', act: 'act2b', hint: 'A beat illustrating the Protagonist\'s awareness of the Moral Lesson, but committing to their Goal in spite of it.' },
  { name: 'Increasing Tension', act: 'act2b', hint: 'A beat where the Antagonist obstructs the Protagonist, and/or conflict rises between the Protagonist and their Allies.' },
  { name: 'Twist', act: 'act2b', hint: 'An unexpected event that changes the perception of preceding events, or places the main conflict in a different context.' },
  { name: 'Complete Failure', act: 'act2b', hint: 'A moment of absolute and seemingly permanent defeat for the Protagonist, in their pursuit of the Goal.' },
  { name: 'Admit Defeat', act: 'act2b', hint: 'A beat where the Protagonist admits defeat and exhibits humility.' },
  { name: 'Moment of Clarity', act: 'act2b', hint: 'A beat where the Protagonist realizes the importance of the Moral Lesson, and how it relates to their plight.' },
  { name: 'Plot Point 3', act: 'act2b', hint: 'A beat where the Protagonist makes the decision to confront the Antagonist.' },

  // Act 3 - Resolution (75-100%) - 10 beats
  { name: 'Make Amends', act: 'act3', hint: 'A beat where the Protagonist pays the price for their mistakes and/or achievements.' },
  { name: 'Atone with Allies', act: 'act3', hint: 'A beat where the Protagonist makes amends with their Allies.' },
  { name: 'Create Final Plan', act: 'act3', hint: 'A beat where the Protagonist and Allies make a Final Plan to achieve their Goal.' },
  { name: 'Attempt Final Plan', act: 'act3', hint: 'A beat where the Protagonist and Allies attempt to execute their Final Plan.' },
  { name: 'Proof of Growth', act: 'act3', hint: 'A beat illustrating how the Protagonist and Allies use the Moral Lesson to fix problems from the daily routines.' },
  { name: 'Defeat Lieutenants', act: 'act3', hint: 'A beat illustrating growth for Allies, as they defeat the secondary Antagonists, or sacrifice themselves for the cause.' },
  { name: 'Unexpected Turn', act: 'act3', hint: 'An unexpected beat in which the Protagonist is led into a trap by the main Antagonist, and forced into confrontation.' },
  { name: 'Choose Need or Want', act: 'act3', hint: 'A beat where the Protagonist reacts to the Unexpected Turn, and must finally accept or refuse the Moral Lesson.' },
  { name: 'Execute Final Plan', act: 'act3', hint: 'A beat illustrating the Protagonist using the Moral Lesson to defeat the Antagonist; OR, a beat illustrating the Protagonist refusing the Moral Lesson and being defeated by the Antagonist.' },
  { name: 'Epilogue', act: 'act3', hint: 'A beat that contrasts the Prologue to illustrate the growth, or corruption/fall of the Protagonist.' },
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

// ============================================
// SMART TYPE / AUTO-COMPLETE TYPES
// ============================================

// Parsed scene heading components
export interface ParsedSceneHeading {
  intExt: 'INT' | 'EXT' | 'INT/EXT' | 'I/E' | '';
  location: string;
  timeOfDay: string;
  fullText: string;
}

// Script location extracted from scene headings
export interface ScriptLocation {
  name: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT' | 'I/E' | 'BOTH';
  occurrences: number;
  sceneIds: string[];
}

// Script character extracted from Character elements
export interface ScriptCharacter {
  name: string;
  occurrences: number;
  dialogueCount: number;
  firstAppearance: number; // element index
  sceneIds: string[];
  isFromBlueprint: boolean; // true if also in BluePrint characters
}

// Auto-complete suggestion
export interface AutoCompleteSuggestion {
  value: string;
  type: 'character' | 'location' | 'extension' | 'timeofday';
  source: 'blueprint' | 'script';
  occurrences?: number;
}

// Auto-complete state
export interface AutoCompleteState {
  isOpen: boolean;
  suggestions: AutoCompleteSuggestion[];
  selectedIndex: number;
  triggerType: 'character' | 'location' | 'extension' | 'timeofday' | null;
  searchText: string;
  position: { x: number; y: number };
}

// Common character name extensions (V.O., O.S., etc.)
export const CHARACTER_EXTENSIONS = [
  '(V.O.)',    // Voice Over
  '(O.S.)',    // Off Screen
  '(O.C.)',    // Off Camera
  '(CONT\'D)', // Continued
  '(PRE-LAP)', // Pre-lap (audio before cut)
  '(FILTERED)', // Phone, radio, etc.
];

// Common time of day values for scene headings
export const TIME_OF_DAY_OPTIONS = [
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

// ============================================
// BREAKDOWN APP TYPES
// ============================================

// Industry-standard breakdown categories (14 core)
export type BreakdownCategory =
  | 'Cast'
  | 'Extras'
  | 'Stunts'
  | 'SFX'
  | 'Props'
  | 'Vehicles'
  | 'Animals'
  | 'Wardrobe'
  | 'Makeup'
  | 'Sound'
  | 'Set Dressing'
  | 'Greenery'
  | 'Special Equipment'
  | 'VFX';

// Category metadata with colors (industry standard colors)
export const BREAKDOWN_CATEGORY_INFO: Record<BreakdownCategory, { color: string; description: string }> = {
  'Cast': { color: '#EF4444', description: 'Speaking roles / principal actors' },
  'Extras': { color: '#22C55E', description: 'Background / atmosphere' },
  'Stunts': { color: '#F97316', description: 'Stunt work and coordination' },
  'SFX': { color: '#3B82F6', description: 'On-set special effects (practical)' },
  'Props': { color: '#8B5CF6', description: 'Hand props for actors' },
  'Vehicles': { color: '#EC4899', description: 'Picture vehicles' },
  'Animals': { color: '#EAB308', description: 'Animals with handler' },
  'Wardrobe': { color: '#92400E', description: 'Costume pieces' },
  'Makeup': { color: '#D97706', description: 'Makeup, hair, prosthetics' },
  'Sound': { color: '#78350F', description: 'Sound effects, playback music' },
  'Set Dressing': { color: '#7C3AED', description: 'Set decoration' },
  'Greenery': { color: '#15803D', description: 'Plants, landscaping' },
  'Special Equipment': { color: '#64748B', description: 'Non-standard gear (cranes, etc.)' },
  'VFX': { color: '#06B6D4', description: 'Post-production visual effects' },
};

// Custom category created by user
export interface CustomCategory {
  id: string;
  name: string;
  color: string;
  description?: string;
}

// A tagged element in the breakdown
export interface BreakdownElement {
  id: string;
  text: string;
  category: BreakdownCategory | string; // string for custom categories
  sceneId: string;
  sourceElementId: string;
  startOffset: number;
  endOffset: number;
  notes?: string;
}

// Scene breakdown with eighths calculation
export interface BreakdownScene {
  id: string;
  sceneNumber: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT' | 'I/E';
  location: string;
  timeOfDay: string;
  dayNight: 'Day' | 'Night';
  eighths: number; // Page length in eighths (1-8)
  pageStart: number;
  pageEnd: number;
  description: string;
  elements: string[]; // Element IDs in this scene
  castIds: string[]; // Cast member IDs in this scene
  notes?: string;
}

// Cast member in breakdown
export interface BreakdownCastMember {
  id: string;
  characterName: string;
  actorName?: string;
  role: 'Principal' | 'Supporting' | 'Day Player' | 'Stunt' | 'Voice';
  sceneIds: string[];
  workDays?: number; // Calculated from schedule
}

// Location in breakdown
export interface BreakdownLocation {
  id: string;
  name: string;
  address?: string;
  intExt: 'INT' | 'EXT' | 'BOTH';
  sceneIds: string[];
  notes?: string;
}

// Version tracking for breakdown (key for script changes)
export interface BreakdownVersionInfo {
  scriptVersionId: string;
  scriptVersionName: string;
  createdAt: Date;
  lastSyncedAt: Date;
  missingElements: BreakdownElement[]; // Tags that no longer match script
  newScenes: string[]; // Scene IDs not yet reviewed
  syncStatus: 'current' | 'outdated' | 'needs-review';
}

// Full breakdown structure
export interface Breakdown {
  id: string;
  name: string;
  scriptVersionId: string;
  versionInfo: BreakdownVersionInfo;
  elements: BreakdownElement[];
  scenes: BreakdownScene[];
  customCategories: CustomCategory[];
  castList: BreakdownCastMember[];
  locationsList: BreakdownLocation[];
  createdAt: Date;
  updatedAt: Date;
}


// ============================================
// ARTCART APP TYPES (Art Department Sourcing)
// ============================================

// Categories that ArtCart handles (subset of breakdown categories)
export type ArtCartCategory =
  | 'Props'
  | 'Set Dressing'
  | 'Greenery'
  | 'Vehicles'
  | 'Wardrobe'
  | 'Makeup'
  | 'Special Equipment';

// Sourcing status for items
export type SourcingStatus =
  | 'To Find'      // Not yet sourced
  | 'Researching'  // Looking for options
  | 'Found'        // Located, not yet acquired
  | 'Rented'       // Rented from vendor
  | 'Purchased'    // Bought outright
  | 'Built'        // Will be built/made
  | 'Borrowed'     // Borrowed, no cost
  | 'On Hand';     // Already in inventory

// Priority levels
export type ItemPriority = 'Critical' | 'High' | 'Medium' | 'Low';

// Approval status for options
export type ApprovalStatus =
  | 'Pending'        // Waiting for review
  | 'Approved'       // Director/Producer approved
  | 'Rejected'       // Not approved
  | 'Indifferent';   // Approver is fine with any option

// An option/variant for an item (multiple purchasing choices)
export interface ItemOption {
  id: string;
  name: string;
  description?: string;
  vendorId?: string;
  vendorName?: string;
  price: number;
  rentalPrice?: number;  // If rental option
  rentalPeriod?: string;
  sourceUrl?: string;    // Link to product page
  referenceImages?: string[];
  pros?: string;
  cons?: string;

  // Approval workflow
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvalDate?: Date;
  approvalNotes?: string;

  // Recommended by art director
  isRecommended?: boolean;

  createdAt: Date;
}

// Vendor information
export interface Vendor {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
}

// An item in ArtCart (sourced from BreakDown or manually added)
export interface ArtCartItem {
  id: string;
  name: string;
  category: ArtCartCategory | string;
  description?: string;

  // Sourcing info
  status: SourcingStatus;
  priority: ItemPriority;
  quantity: number;

  // Options - multiple purchasing choices for approval
  options: ItemOption[];
  selectedOptionId?: string;  // Which option was approved/selected

  // Financial (from selected option or manual entry)
  estimatedCost?: number;
  actualCost?: number;
  rentalPeriod?: string; // "2 weeks", "3 days"

  // Vendor (from selected option or manual entry)
  vendorId?: string;
  vendorNotes?: string;

  // Scenes where needed
  sceneIds: string[];

  // Link to breakdown element (if imported)
  breakdownElementId?: string;

  // Tracking
  assignedTo?: string;
  dueDate?: Date;
  acquiredDate?: Date;
  returnDate?: Date;

  // Media
  referenceImages?: string[];
  notes?: string;

  // Approval workflow
  needsApproval: boolean;  // Does this item need director/producer sign-off?
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvalDate?: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Shopping list (grouped items for a department run)
export interface ShoppingList {
  id: string;
  name: string;
  itemIds: string[];
  vendorId?: string;
  assignedTo?: string;
  dueDate?: Date;
  notes?: string;
  status: 'Draft' | 'Active' | 'Completed';
  createdAt: Date;
}

// Budget status
export type BudgetStatus =
  | 'Pending'      // Producer hasn't allocated yet
  | 'Allocated'    // Budget is set
  | 'Locked';      // Budget is final, no changes

// Department budget tracking
export interface ArtCartBudget {
  category: ArtCartCategory | string;
  status: BudgetStatus;
  allocated: number;
  spent: number;
  committed: number; // Pending purchases/rentals
  remaining: number; // calculated: allocated - spent - committed
}

// Script version info for ArtCart sync
export interface ArtCartScriptSync {
  scriptVersionId: string;
  scriptVersionName: string;
  syncedAt: Date;
  isOutdated: boolean;  // True if newer script version exists
  latestVersionId?: string;
  latestVersionName?: string;
  changesDetected?: number;  // Number of breakdown changes since sync
}

// Full ArtCart state
export interface ArtCart {
  id: string;
  projectName: string;
  items: ArtCartItem[];
  vendors: Vendor[];
  shoppingLists: ShoppingList[];
  budgets: ArtCartBudget[];

  // Script version tracking
  scriptSync: ArtCartScriptSync;
  importedFromBreakdownId?: string;

  // Total budget (from BaseCamp/LineItem)
  totalBudgetAllocated?: number;
  totalBudgetStatus: BudgetStatus;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// VIEWFINDER APP TYPES (Cinematography)
// ============================================

// Standard shot sizes
export type ShotSize =
  | 'EWS'   // Extreme Wide Shot
  | 'WS'    // Wide Shot
  | 'FS'    // Full Shot
  | 'MWS'   // Medium Wide Shot
  | 'MS'    // Medium Shot
  | 'MCU'   // Medium Close-Up
  | 'CU'    // Close-Up
  | 'BCU'   // Big Close-Up
  | 'ECU'   // Extreme Close-Up
  | 'Insert'
  | 'Cutaway'
  | 'POV'   // Point of View
  | 'OTS'   // Over the Shoulder
  | '2-Shot'
  | 'Group';

export const SHOT_SIZE_INFO: Record<ShotSize, { name: string; description: string }> = {
  'EWS': { name: 'Extreme Wide Shot', description: 'Establishes massive environment, subject very small' },
  'WS': { name: 'Wide Shot', description: 'Subject visible head to toe with environment' },
  'FS': { name: 'Full Shot', description: 'Subject fills frame head to toe' },
  'MWS': { name: 'Medium Wide Shot', description: 'Subject from knees up (Cowboy Shot)' },
  'MS': { name: 'Medium Shot', description: 'Subject from waist up' },
  'MCU': { name: 'Medium Close-Up', description: 'Subject from chest up' },
  'CU': { name: 'Close-Up', description: 'Subject\'s face or key detail' },
  'BCU': { name: 'Big Close-Up', description: 'Portion of face or tight detail' },
  'ECU': { name: 'Extreme Close-Up', description: 'Very tight on specific detail (eyes, hands)' },
  'Insert': { name: 'Insert Shot', description: 'Close shot of object or detail' },
  'Cutaway': { name: 'Cutaway', description: 'Shot away from main action' },
  'POV': { name: 'Point of View', description: 'From character\'s perspective' },
  'OTS': { name: 'Over the Shoulder', description: 'Looking over subject\'s shoulder at another' },
  '2-Shot': { name: 'Two Shot', description: 'Two subjects in frame' },
  'Group': { name: 'Group Shot', description: 'Multiple subjects in frame' },
};

// Camera angles
export type CameraAngle =
  | 'Eye Level'
  | 'Low Angle'
  | 'High Angle'
  | 'Bird\'s Eye'
  | 'Worm\'s Eye'
  | 'Dutch Angle'
  | 'Overhead';

// Camera movements
export type CameraMovement =
  | 'Static'
  | 'Pan'
  | 'Tilt'
  | 'Dolly In'
  | 'Dolly Out'
  | 'Dolly'
  | 'Truck'
  | 'Crane Up'
  | 'Crane Down'
  | 'Handheld'
  | 'Steadicam'
  | 'Gimbal'
  | 'Zoom In'
  | 'Zoom Out'
  | 'Push In'
  | 'Pull Out'
  | 'Arc'
  | 'Tracking'
  | 'Whip Pan'
  | 'Roll'
  | 'Vertigo';

// Lens/focal length info
export interface LensInfo {
  focalLength: string;   // e.g., "50mm", "24-70mm"
  aperture?: string;     // e.g., "f/1.4", "f/2.8"
  notes?: string;        // Special lens notes (anamorphic, vintage, etc.)
}

// Equipment needed for shot
export interface ShotEquipment {
  camera?: string;       // Camera body
  lens?: LensInfo;
  support?: string;      // Tripod, dolly, crane, etc.
  grip?: string[];       // Flags, nets, diffusion, etc.
  lighting?: string[];   // Light notes
  special?: string[];    // Special equipment (drone, underwater, etc.)
}

// Shot status
export type ShotStatus =
  | 'Planned'
  | 'Storyboarded'
  | 'Approved'
  | 'Setup'
  | 'Filming'
  | 'Completed'
  | 'Cut';

// Individual shot entry
export interface Shot {
  id: string;
  sceneId: string;           // Links to breakdown scene
  sceneNumber: string;       // Scene number for display
  shotNumber: string;        // e.g., "1A", "2", "3B"

  // Shot composition
  size: ShotSize;
  angle: CameraAngle;
  movement: CameraMovement;
  subject: string;           // What/who is being shot
  description: string;       // Shot description

  // Technical details
  equipment: ShotEquipment;
  duration?: number;         // Estimated duration in seconds

  // Coverage and action
  actionDescription?: string; // What happens in this shot
  dialogueReference?: string; // Which dialogue lines covered
  coverage?: string[];        // Which characters/action this covers

  // Storyboard
  storyboardFrame?: string;  // Base64 encoded image or URL
  storyboardNotes?: string;

  // Reference
  referenceImages?: string[]; // Inspiration/reference images
  referenceNotes?: string;

  // Status and workflow
  status: ShotStatus;
  priority: number;          // Shooting order within scene
  takes?: number;            // Number of takes (during production)
  selectedTake?: string;     // Selected take reference

  // Notes
  directorNotes?: string;
  dpNotes?: string;

  createdAt: Date;
  updatedAt: Date;
}

// Scene coverage summary
export interface SceneCoverage {
  sceneId: string;
  sceneNumber: string;
  shotCount: number;
  completedShots: number;
  estimatedDuration: number;   // Total estimated duration
  coverageComplete: boolean;   // Director marked as covered
  notes?: string;
}

// Storyboard for a scene
export interface Storyboard {
  id: string;
  sceneId: string;
  sceneNumber: string;
  frames: StoryboardFrame[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryboardFrame {
  id: string;
  shotId?: string;           // Link to shot if applicable
  order: number;             // Frame sequence
  image?: string;            // Base64 or URL
  description: string;
  actionNotes?: string;
  audioNotes?: string;       // Dialogue, sound effects, music
  duration?: number;         // Estimated seconds
}

// Shot list for a scene (printable format)
export interface ShotList {
  id: string;
  sceneId: string;
  sceneNumber: string;
  sceneName: string;
  shots: Shot[];
  totalDuration: number;
  notes?: string;
  createdAt: Date;
}

// Camera/lens package (what's available for production)
export interface CameraPackage {
  id: string;
  name: string;
  cameras: string[];
  lenses: string[];
  support: string[];
  notes?: string;
}

// ViewFinder script sync (similar to ArtCart)
export interface ViewFinderScriptSync {
  scriptVersionId: string;
  scriptVersionName: string;
  syncedAt: Date;
  isOutdated: boolean;
  latestVersionId?: string;
  latestVersionName?: string;
}

// Full ViewFinder state
export interface ViewFinder {
  id: string;
  projectName: string;

  // All shots organized by scene
  shots: Shot[];

  // Storyboards
  storyboards: Storyboard[];

  // Camera packages available
  cameraPackages: CameraPackage[];

  // Scene coverage tracking
  sceneCoverage: SceneCoverage[];

  // Script sync
  scriptSync: ViewFinderScriptSync;
  importedFromBreakdownId?: string;

  // Settings
  defaultCamera?: string;
  defaultLens?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// BASECAMP APP TYPES (Scheduling & Production)
// ============================================

// Strip colors (industry standard)
export type StripColor =
  | 'White'      // Day exterior
  | 'Yellow'     // Day interior
  | 'Green'      // Day ext/int
  | 'Blue'       // Night exterior
  | 'Black'      // Night interior (often shown as dark blue)
  | 'Purple'     // Night ext/int
  | 'Orange'     // Dawn/Dusk
  | 'Pink';      // Special (VFX, stunts, etc.)

export const STRIP_COLOR_MAP: Record<string, StripColor> = {
  'EXT-DAY': 'White',
  'INT-DAY': 'Yellow',
  'INT/EXT-DAY': 'Green',
  'EXT-NIGHT': 'Blue',
  'INT-NIGHT': 'Black',
  'INT/EXT-NIGHT': 'Purple',
  'EXT-DAWN': 'Orange',
  'EXT-DUSK': 'Orange',
  'INT-DAWN': 'Orange',
  'INT-DUSK': 'Orange',
};

export const STRIP_COLOR_HEX: Record<StripColor, string> = {
  'White': '#FFFFFF',
  'Yellow': '#FEF08A',
  'Green': '#86EFAC',
  'Blue': '#93C5FD',
  'Black': '#1E3A5F',
  'Purple': '#C4B5FD',
  'Orange': '#FED7AA',
  'Pink': '#FBCFE8',
};

// Scene strip for strip board
export interface SceneStrip {
  id: string;
  sceneId: string;           // Links to BreakdownScene
  sceneNumber: string;
  intExt: string;
  location: string;
  timeOfDay: string;
  description: string;       // Brief description
  pageCount: number;         // In eighths (e.g., 2.5 = 2 4/8)
  color: StripColor;

  // Cast requirements
  castIds: string[];         // From breakdown
  castNumbers: number[];     // Day player numbers

  // Scheduling
  scheduledDayId?: string;   // Which shoot day
  orderInDay?: number;       // Position in day

  // Flags
  isLocked: boolean;         // Can't be moved
  hasStunts: boolean;
  hasVFX: boolean;
  hasSpecialEquipment: boolean;

  notes?: string;
}

// Shot package - groups shots for scheduling
export interface ShotPackage {
  id: string;
  name: string;              // e.g., "Scene 12 - Wide Coverage"
  sceneId: string;
  sceneNumber: string;
  shotIds: string[];         // From ViewFinder
  estimatedDuration: number; // In minutes

  // Requirements (pulled from shots)
  equipment: string[];
  castIds: string[];

  // Scheduling
  scheduledDayId?: string;
  orderInDay?: number;
  splitFromPackageId?: string;  // If this was split from another package

  notes?: string;
}

// Shoot day
export interface ShootDay {
  id: string;
  dayNumber: number;         // Shoot day 1, 2, 3...
  date?: Date;               // Actual date if scheduled

  // Scheduling
  strips: string[];          // SceneStrip IDs in order
  shotPackages: string[];    // ShotPackage IDs in order

  // Times
  callTime: string;          // e.g., "6:00 AM"
  estimatedWrap: string;     // e.g., "7:00 PM"
  lunchTime?: string;        // e.g., "12:30 PM"
  lunchDuration?: number;    // Minutes (typically 30 or 60)

  // Location
  location?: string;         // Main location for the day
  locationAddress?: string;

  // Weather/conditions
  weatherBackup?: string;    // Cover set if weather fails

  // Flags
  isLocked: boolean;
  hasNightWork: boolean;

  notes?: string;
}

// Day break marker (for strip board)
export interface DayBreak {
  id: string;
  afterStripId: string;      // Goes after this strip
  dayId: string;             // Links to ShootDay
  label: string;             // "END OF DAY 1"
}

// Company move marker
export interface CompanyMove {
  id: string;
  afterStripId: string;
  fromLocation: string;
  toLocation: string;
  estimatedTime: number;     // Minutes
}

// Cast member for DOOD (Day Out of Days)
export interface DOODEntry {
  castId: string;
  castName: string;
  characterName: string;
  dayStatuses: DOODDayStatus[];  // One per shoot day
}

export type DOODStatus =
  | 'W'    // Work
  | 'SW'   // Start/Work
  | 'WF'   // Work/Finish
  | 'SWF'  // Start/Work/Finish (one day player)
  | 'H'    // Hold (on call but not working)
  | 'T'    // Travel
  | 'R'    // Rehearsal
  | 'F'    // Fitting
  | ''     // Off/Not scheduled
  ;

export interface DOODDayStatus {
  dayId: string;
  dayNumber: number;
  status: DOODStatus;
}

// Schedule overview
export interface Schedule {
  id: string;
  projectName: string;

  // All strips
  strips: SceneStrip[];
  unscheduledStrips: string[];  // Strip IDs not assigned to a day

  // All shot packages
  shotPackages: ShotPackage[];
  unscheduledPackages: string[];

  // Shoot days
  shootDays: ShootDay[];

  // Markers
  dayBreaks: DayBreak[];
  companyMoves: CompanyMove[];

  // DOOD
  dood: DOODEntry[];

  // Production info
  startDate?: Date;
  estimatedEndDate?: Date;
  totalShootDays: number;

  // Settings
  defaultCallTime: string;
  defaultLunchDuration: number;
  showLunchOnBoard: boolean;     // Toggle for OnSet display

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// PRODUCTION MANAGEMENT TYPES (Shared across apps)
// ============================================

// Person role assignment
export interface PersonRole {
  group: 'Crew' | 'Talent' | 'Client';
  department: string;    // e.g., "Camera", "Wardrobe" (Crew only)
  position: string;      // e.g., "Director of Photography" (Crew) or character name (Talent)
  characterName?: string; // For Talent: the character they play
}

// Person in the production
export interface ProductionPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  group: 'Crew' | 'Talent' | 'Client';
  roles: PersonRole[];
  location?: string;
  payRate?: { amount: number; currency: string; period: 'Per Day' | 'Per Hour' | 'Per Week' | 'Flat' };
  tags: string[];
  notes: string;
  avatarColor: string;
  // Availability for scheduling
  availability?: {
    startDate?: string;      // Available from (ISO date)
    endDate?: string;        // Available until (ISO date)
    blockedDates: string[];  // Specific dates not available (ISO dates)
    notes?: string;          // Availability notes
  };
}

// Production location
export interface ProductionLocation {
  id: string;
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  mapLink?: string;
}

// Production scene (standalone, not from script)
export interface ProductionScene {
  id: string;
  sceneNumber: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT';
  dayNight: 'Day' | 'Night' | 'Dawn' | 'Dusk';
  set: string;
  description: string;
  castIds: string[];
  locationId?: string;
  pageCount: number;
  storyDay: string;
  extrasCount: number;
  notes: string;
}

// Department with positions
export interface Department {
  id: string;
  name: string;
  positions: string[];
  isDefault?: boolean;
}

// Default departments for film production
export const DEFAULT_DEPARTMENTS: Omit<Department, 'id'>[] = [
  { name: 'Production', positions: ['Producer', 'Executive Producer', 'Line Producer', 'Associate Producer', 'Production Manager', 'Production Coordinator', 'Production Assistant'], isDefault: true },
  { name: 'Direction', positions: ['Director', '1st Assistant Director', '2nd Assistant Director', '2nd 2nd Assistant Director', 'Set PA'], isDefault: true },
  { name: 'Camera', positions: ['Director of Photography', 'Camera Operator', 'B Camera Operator', '1st AC', '2nd AC', 'Digital Imaging Technician', 'Steadicam Operator', 'Camera PA'], isDefault: true },
  { name: 'Sound', positions: ['Sound Mixer', 'Boom Operator', 'Sound Utility'], isDefault: true },
  { name: 'Art', positions: ['Production Designer', 'Art Director', 'Set Decorator', 'Props Master', 'Set Dresser', 'Art PA'], isDefault: true },
  { name: 'Wardrobe', positions: ['Costume Designer', 'Wardrobe Supervisor', 'Set Costumer', 'Wardrobe PA'], isDefault: true },
  { name: 'Hair & Makeup', positions: ['Hair Department Head', 'Makeup Department Head', 'Hair Stylist', 'Makeup Artist', 'SFX Makeup'], isDefault: true },
  { name: 'Grip', positions: ['Key Grip', 'Best Boy Grip', 'Dolly Grip', 'Grip'], isDefault: true },
  { name: 'Electric', positions: ['Gaffer', 'Best Boy Electric', 'Electrician', 'Board Operator'], isDefault: true },
  { name: 'Locations', positions: ['Location Manager', 'Location Scout', 'Location PA'], isDefault: true },
  { name: 'Post-Production', positions: ['Editor', 'Assistant Editor', 'Colorist', 'VFX Supervisor', 'Sound Designer'], isDefault: true },
  { name: 'Catering & Craft Services', positions: ['Caterer', 'Craft Services'], isDefault: true },
  { name: 'Transportation', positions: ['Transportation Captain', 'Driver'], isDefault: true },
  { name: 'Aerial', positions: ['Drone Pilot', 'Drone Operator'], isDefault: true },
  { name: 'Additional Crew', positions: ['Intern', 'Volunteer', 'Day Player'], isDefault: true },
];

// Call sheet scene entry
export interface CallSheetScene {
  sceneId: string;
  sceneNumber: string;
  setDescription: string;
  cast: string;
  locationId?: string;
  notes: string;
}

// Talent call entry
export interface TalentCallEntry {
  personId: string;
  callTime: string;
}

// Crew call entry
export interface CrewCallEntry {
  personId: string;
  department: string;
  position: string;
  callTime: string;
}

// Full call sheet
export interface CallSheet {
  id: string;
  shootDayId?: string;
  title: string;
  date: string;
  dayNumber: number;
  totalDays: number;

  // Header
  crewCall: string;
  shootingCall: string;
  firstMeal: string;
  estimatedWrap: string;
  producer: string;
  director: string;

  // Locations
  locationIds: string[];

  // Schedule
  scenes: CallSheetScene[];

  // Talent
  talentCalls: TalentCallEntry[];

  // Crew
  crewCalls: CrewCallEntry[];

  // Info
  notes: string;
  nearestHospital: string;
  disclaimer: string;

  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

// Production data (shared across apps)
export interface ProductionData {
  people: ProductionPerson[];
  locations: ProductionLocation[];
  scenes: ProductionScene[];
  departments: Department[];
  callSheets: CallSheet[];
  settings: ProductionSettings;
}

// Production settings
export interface ProductionSettings {
  projectName: string;
  producer: string;
  director: string;
  defaultCallTime: string;
  defaultLunchDuration: number;
  defaultDisclaimer: string;
}

export const DEFAULT_DISCLAIMER = 'NO VISITORS WITHOUT PRIOR APPROVAL OF PRODUCTION | NO PHOTOS ON SET | PUT CELLPHONES ON SILENT WHEN ON SET';

// Avatar color generator
export const AVATAR_COLORS = [
  '#3498DB', '#2ECC71', '#E74C3C', '#9B59B6', '#F39C12',
  '#1ABC9C', '#E67E22', '#2C3E50', '#16A085', '#C0392B',
  '#8E44AD', '#27AE60', '#D35400', '#2980B9', '#7F8C8D',
];

// ============================================
// ONSET APP TYPES (Live Production Board)
// ============================================

// Current production status
export interface ProductionStatus {
  currentDayId: string;
  currentStripIndex: number;
  currentShotPackageIndex: number;

  // Timing
  dayStartedAt?: Date;
  currentSetupStartedAt?: Date;

  // Progress
  completedStrips: string[];
  completedPackages: string[];

  // Actual times log
  actualTimes: ActualTimeEntry[];

  // Status
  aheadBehind: number;          // Minutes (+ahead, -behind)
  lastUpdated: Date;
}

export interface ActualTimeEntry {
  id: string;
  type: 'strip' | 'package' | 'break' | 'delay';
  referenceId: string;          // Strip or package ID
  startedAt: Date;
  completedAt?: Date;
  estimatedMinutes: number;
  actualMinutes?: number;
  delayReason?: string;
}

// Display settings for OnSet
export interface OnSetDisplaySettings {
  showLunchCountdown: boolean;
  showProgressBar: boolean;
  showNextShot: boolean;
  showStoryboard: boolean;
  autoAdvance: boolean;          // Auto-move to next when marked complete
  fontSize: 'normal' | 'large' | 'xlarge';
}

// View mode for dual-screen operation
export type OnSetViewMode =
  | 'control'      // Full AD control panel
  | 'display'      // TV/monitor display (scoreboard view)
  | 'crew';        // Crew read-only mobile view

// Lunch status
export interface LunchStatus {
  isOnLunch: boolean;
  lunchStartedAt?: Date;
  scheduledDuration: number;      // Minutes
  actualDuration?: number;
}

// Delay entry for tracking issues
export interface DelayEntry {
  id: string;
  reason: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;              // Minutes
  category: 'Weather' | 'Technical' | 'Talent' | 'Medical' | 'Other';
  notes?: string;
}

// Quick status for crew display
export interface QuickStatus {
  currentScene: string;
  currentSetup: string;
  estimatedWrap: string;
  aheadBehind: string;            // "+15 min" or "-10 min"
  nextUp: string;
  isOnLunch: boolean;
  lunchCountdown?: string;        // "12:34" remaining
}

// Full OnSet state
export interface OnSet {
  productionStatus: ProductionStatus | null;
  displaySettings: OnSetDisplaySettings;
  viewMode: OnSetViewMode;
  lunchStatus: LunchStatus | null;
  delays: DelayEntry[];
  isLive: boolean;                // Is the board actively tracking?
}

// ============================================
// SUPERVISOR APP TYPES (Script Supervisor)
// ============================================

// Take log entry
export interface TakeEntry {
  id: string;

  // What was shot
  sceneNumber: string;
  shotId: string;               // From ViewFinder
  shotNumber: string;

  // Take info
  takeNumber: number;
  camera: string;               // 'A', 'B', 'C', etc.

  // Timecode
  timecodeIn?: string;
  timecodeOut?: string;
  duration?: number;            // Seconds

  // Rating
  circled: boolean;             // "Print this"
  rating: 'Print' | 'Hold' | 'NG' | '';

  // Notes for editor
  directorNotes?: string;       // "Use first half"
  editorNotes?: string;         // "Best performance"
  technicalNotes?: string;      // "Boom in shot at 0:23"

  // Continuity
  continuityNotes?: string;
  screenDirection?: 'L-R' | 'R-L';

  // Reference
  frameGrab?: string;           // Screenshot/photo

  createdAt: Date;
}

// Lined script coverage
export interface ScriptCoverage {
  id: string;
  shotId: string;
  shotNumber: string;
  color: string;                // Line color

  // Script range covered
  startElementId: string;
  startOffset: number;
  endElementId: string;
  endOffset: number;

  // Coverage type
  coverageType: 'on-screen' | 'off-screen' | 'partial';
  lineStyle: 'solid' | 'wavy' | 'dashed';
  side: 'left' | 'right';       // Which margin
}

// Full supervisor session
export interface SupervisorSession {
  id: string;
  shootDayId: string;
  date: Date;

  // Take logs
  takes: TakeEntry[];

  // Lined script
  coverage: ScriptCoverage[];

  // Daily totals
  totalSetups: number;
  totalTakes: number;
  totalPrints: number;          // Circled takes

  // Export tracking
  exportedToEditor: boolean;
  exportedAt?: Date;

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Camera slate information
export interface SlateInfo {
  scene: string;
  shot: string;
  take: number;
  camera: string;
  roll: string;              // Camera roll / card number
  soundRoll?: string;        // Sound roll
  date: Date;
}

// Continuity log for a scene
export interface ContinuityLog {
  id: string;
  sceneId: string;
  sceneNumber: string;

  // Wardrobe
  wardrobeNotes: string;

  // Props
  propsNotes: string;

  // Hair/Makeup
  hairMakeupNotes: string;

  // Action/Blocking
  actionNotes: string;

  // Reference photos
  photos: string[];          // Base64 or URLs

  createdAt: Date;
  updatedAt: Date;
}

// Script supervisor report (daily)
export interface DailyReport {
  id: string;
  shootDayId: string;
  date: Date;

  // Summary
  scenesCompleted: string[];
  scenesPartial: string[];
  pagesShot: number;
  minutesShot: number;       // Screen time shot

  // Inventory
  setupsTotal: number;
  takesTotal: number;
  printsTotal: number;
  ngTotal: number;

  // By camera
  cameraInventory: {
    camera: string;
    takes: number;
    prints: number;
  }[];

  // Notes
  productionNotes: string;
  editorNotes: string;

  // Approval
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

// Full SuperVisor state
export interface SuperVisor {
  currentSession: SupervisorSession | null;
  sessions: SupervisorSession[];
  continuityLogs: ContinuityLog[];
  dailyReports: DailyReport[];

  // Current take entry (being created)
  currentSlate: SlateInfo | null;

  // View state
  selectedSceneId: string | null;
  selectedShotId: string | null;
  filterCamera: string | 'All';
}

// ============================================
// THEME/SKIN TYPES
// ============================================

// Available themes
export type ThemeId = 'default';

// Theme configuration
export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  isDark: boolean;
  preview: {
    primary: string;
    secondary: string;
    background: string;
  };
}

// Theme registry
export const THEMES: Theme[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Clean professional look',
    isDark: false,
    preview: { primary: '#2563eb', secondary: '#f5f5f5', background: '#ffffff' }
  },
];
