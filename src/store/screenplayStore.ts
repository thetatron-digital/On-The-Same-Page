import { create } from 'zustand';
import type {
  Screenplay, ScreenplayElement, ElementType, TextRun, TitlePageInfo,
  Beat, BeatBoard, ScriptVersion, ScriptNote,
  StoryOutline, PlotOverview, StoryCharacter, ActsOverview, StoryBeat,
  AutoCompleteState, ScriptCharacter, ScriptLocation, AutoCompleteSuggestion,
  PageLock, WatermarkSettings,
  Breakdown, BreakdownElement, BreakdownScene, BreakdownCategory,
  CustomCategory,
  ArtCart, ArtCartItem, Vendor, ShoppingList, SourcingStatus, ItemPriority,
  ItemOption, ApprovalStatus, ArtCartBudget, BudgetStatus,
  ViewFinder, Shot, ShotStatus,
  Storyboard, StoryboardFrame, CameraPackage, SceneCoverage,
  Schedule, SceneStrip, ShotPackage, ShootDay, StripColor,
  DOODEntry, DOODStatus,
  ProductionPerson, ProductionLocation, ProductionScene, Department, CallSheet,
  ProductionData, ProductionSettings,
  OnSet, OnSetViewMode, OnSetDisplaySettings, ProductionStatus, LunchStatus, DelayEntry,
  SuperVisor, SupervisorSession, TakeEntry, ContinuityLog, DailyReport, SlateInfo,
  ThemeId
} from '../types/screenplay';
import { STRIP_COLOR_MAP, DEFAULT_DEPARTMENTS, AVATAR_COLORS } from '../types/screenplay';
import { LINES_PER_PAGE, DEFAULT_BEAT_STRUCTURE } from '../types/screenplay';
import { createNewScreenplay, generateId, parseFDX, generateFDX, getPlainText } from '../utils/fdx';
import {
  extractCharactersFromScript,
  extractLocationsFromScript,
  mergeCharacterSources,
  getCharacterSuggestions,
  getLocationSuggestions,
  getExtensionSuggestions,
  getTimeOfDaySuggestions
} from '../utils/scriptParser';
import {
  generateBreakdownScenes,
  getElementsForScene,
} from '../utils/breakdown';

// Panel visibility options
interface PanelState {
  navigator: boolean;
  elements: boolean;
  writingStats: boolean;
  titlePage: boolean;
  beatBoard: boolean;
}

// Visibility toggles for Show/Hide menu
interface VisibilityState {
  ruler: boolean;
  sceneNavigator: boolean;
  scriptNotes: boolean;
}

// View modes (within Re-writer app)
type ViewMode = 'script' | 'split';

// App modes (top-level application switching)
type AppMode = 'home' | 'blueprint' | 'corkboard' | 'rewriter' | 'breakdown' | 'artcart' | 'viewfinder' | 'basecamp' | 'onset' | 'supervisor';

// Split View content (independent from main script)
interface SplitEntry {
  id: string;
  text: string;
}

interface SplitContent {
  audio: SplitEntry[];
  video: SplitEntry[];
  isIndependent: boolean; // true = edit independently, false = sync from main script
  swapped: boolean; // true = video on left, audio on right
}

// Writing statistics
interface WritingStats {
  pageCount: number;
  wordCount: number;
  characterCount: number;
  sceneCount: number;
  dialogueCount: number;
  estimatedRuntime: string; // e.g., "1h 32m"
}

// History entry for undo/redo
interface HistoryEntry {
  screenplay: Screenplay;
  selectedElementId: string | null;
}

interface ScreenplayState {
  screenplay: Screenplay;
  selectedElementId: string | null;
  currentElementType: ElementType;
  isDirty: boolean;
  fileName: string;
  darkMode: boolean;
  activeTheme: ThemeId;

  // Undo/Redo
  history: HistoryEntry[];
  future: HistoryEntry[];
  historyIndex: number;

  // UI State
  zoom: number;
  activeApp: AppMode;
  viewMode: ViewMode;
  panels: PanelState;
  visibility: VisibilityState;
  stats: WritingStats;
  currentPage: number;
  cursorLine: number;

  // Beat Board
  beatBoards: BeatBoard[];
  activeBeatBoardId: string | null;

  // Version Management
  versions: ScriptVersion[];
  activeVersionId: string | null;

  // Script Notes
  scriptNotes: ScriptNote[];

  // Split View
  splitContent: SplitContent;

  // Story Outline
  storyOutline: StoryOutline;

  // Auto-Complete / Smart Type
  autoComplete: AutoCompleteState;
  scriptCharacters: Map<string, ScriptCharacter>;
  scriptLocations: ScriptLocation[];

  // Scene Numbers
  showSceneNumbers: boolean;
  sceneNumberStyle: 'numeric' | 'alphanumeric'; // 1, 2, 3 or 1, 1A, 2, etc.

  // Page Locking
  pageLocks: PageLock[];

  // Watermark Settings
  watermarkSettings: WatermarkSettings;

  // Breakdown State
  breakdown: Breakdown | null;
  breakdownScenes: BreakdownScene[];
  selectedBreakdownCategory: BreakdownCategory | null;
  selectedBreakdownSceneId: string | null;

  // ArtCart State
  artCart: ArtCart | null;
  selectedArtCartCategory: string | null;
  selectedArtCartItemId: string | null;
  artCartFilterStatus: SourcingStatus | 'All';

  // ViewFinder State
  viewFinder: ViewFinder | null;
  selectedViewFinderSceneId: string | null;
  selectedShotId: string | null;
  viewFinderFilterStatus: ShotStatus | 'All';

  // BaseCamp State (Scheduling)
  schedule: Schedule | null;
  selectedShootDayId: string | null;
  selectedStripId: string | null;

  // Production Management State (shared)
  productionData: ProductionData;
  basecampView: 'dashboard' | 'callsheets' | 'people' | 'scenes' | 'locations' | 'departments' | 'settings' | 'stripboard';

  // OnSet State (Live Production)
  onSet: OnSet | null;

  // SuperVisor State (Script Supervisor)
  superVisor: SuperVisor | null;

  // Actions
  setScreenplay: (screenplay: Screenplay) => void;
  newScreenplay: () => void;

  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveToHistory: () => void;
  setTitle: (title: string) => void;
  setAuthor: (author: string) => void;
  updateTitlePage: (titlePage: Partial<TitlePageInfo>) => void;

  // Element actions
  addElement: (afterId?: string, type?: ElementType) => string;
  updateElement: (id: string, content: TextRun[]) => void;
  updateElementType: (id: string, type: ElementType) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  setCurrentElementType: (type: ElementType) => void;
  mergeWithPrevious: (id: string) => string | null;

  // File actions
  loadFromFDX: (content: string) => void;
  exportToFDX: () => string;
  setFileName: (name: string) => void;
  setDirty: (dirty: boolean) => void;

  // UI actions
  setZoom: (zoom: number) => void;
  setActiveApp: (app: AppMode) => void;
  setViewMode: (mode: ViewMode) => void;
  togglePanel: (panel: keyof PanelState) => void;
  toggleVisibility: (item: keyof VisibilityState) => void;
  setCurrentPage: (page: number) => void;
  setCursorLine: (line: number) => void;
  calculateStats: () => void;

  // Beat Board actions
  createBeatBoard: (name: string) => string;
  deleteBeatBoard: (id: string) => void;
  setActiveBeatBoard: (id: string | null) => void;
  addBeat: (boardId: string, beat: Omit<Beat, 'id'>) => string;
  updateBeat: (boardId: string, beatId: string, updates: Partial<Beat>) => void;
  deleteBeat: (boardId: string, beatId: string) => void;
  sendBeatToScript: (boardId: string, beatId: string) => string | undefined;

  // Version Management actions
  createVersion: (name: string) => string;
  switchVersion: (versionId: string) => void;
  deleteVersion: (versionId: string) => void;
  renameVersion: (versionId: string, name: string) => void;

  // Script Notes actions
  addNote: (elementId: string, content: string, author?: string) => string;
  updateNote: (noteId: string, content: string) => void;
  deleteNote: (noteId: string) => void;
  resolveNote: (noteId: string) => void;

  // Split View actions
  toggleSplitIndependent: () => void;
  toggleSplitSwapped: () => void;
  updateSplitAudio: (entries: SplitEntry[]) => void;
  updateSplitVideo: (entries: SplitEntry[]) => void;
  addSplitEntry: (column: 'audio' | 'video', text?: string) => string;
  updateSplitEntry: (column: 'audio' | 'video', id: string, text: string) => void;
  deleteSplitEntry: (column: 'audio' | 'video', id: string) => void;

  // Story Outline actions
  updatePlotOverview: (updates: Partial<PlotOverview>) => void;
  addCharacter: () => string;
  updateCharacter: (id: string, updates: Partial<StoryCharacter>) => void;
  deleteCharacter: (id: string) => void;
  updateActs: (updates: Partial<ActsOverview>) => void;
  updateBeatContent: (beatId: string, description: string) => void;
  linkBeatToScene: (beatId: string, sceneId: string | undefined) => void;
  initializeBeats: () => void;
  addStoryBeat: (beat: StoryBeat) => void;

  // Auto-Complete / Smart Type actions
  refreshScriptData: () => void;
  openAutoComplete: (triggerType: 'character' | 'location' | 'extension' | 'timeofday', searchText: string, position: { x: number; y: number }) => void;
  closeAutoComplete: () => void;
  updateAutoCompleteSearch: (searchText: string) => void;
  selectAutoCompleteSuggestion: (index: number) => void;
  moveAutoCompleteSelection: (direction: 'up' | 'down') => void;
  getAutoCompleteSuggestions: () => AutoCompleteSuggestion[];

  // Scene Numbers actions
  toggleSceneNumbers: () => void;
  setSceneNumberStyle: (style: 'numeric' | 'alphanumeric') => void;
  generateSceneNumbers: () => void;
  clearSceneNumbers: () => void;

  // Page Locking actions
  lockPage: (pageNumber: number, color?: string) => void;
  unlockPage: (pageNumber: number) => void;
  isPageLocked: (pageNumber: number) => boolean;
  getPageLock: (pageNumber: number) => PageLock | undefined;

  // Watermark actions
  setWatermarkSettings: (settings: Partial<WatermarkSettings>) => void;
  toggleWatermark: () => void;

  // Dual Dialogue actions
  toggleDualDialogue: (characterElementId: string) => void;

  // Breakdown actions
  initializeBreakdown: () => void;
  refreshBreakdownScenes: () => void;
  selectBreakdownCategory: (category: BreakdownCategory | null) => void;
  selectBreakdownScene: (sceneId: string | null) => void;
  addBreakdownElement: (element: BreakdownElement) => void;
  updateBreakdownElement: (elementId: string, updates: Partial<BreakdownElement>) => void;
  deleteBreakdownElement: (elementId: string) => void;
  addCustomCategory: (category: CustomCategory) => void;
  getBreakdownElementsForScene: (sceneId: string) => BreakdownElement[];

  // ArtCart actions
  initializeArtCart: () => void;
  importFromBreakdown: () => void;
  checkScriptVersionSync: () => void;
  addArtCartItem: (item: Omit<ArtCartItem, 'id' | 'createdAt' | 'updatedAt' | 'options'>) => string;
  updateArtCartItem: (itemId: string, updates: Partial<ArtCartItem>) => void;
  deleteArtCartItem: (itemId: string) => void;
  setArtCartItemStatus: (itemId: string, status: SourcingStatus) => void;
  setArtCartItemPriority: (itemId: string, priority: ItemPriority) => void;

  // Item Options actions
  addItemOption: (itemId: string, option: Omit<ItemOption, 'id' | 'createdAt' | 'approvalStatus'>) => string;
  updateItemOption: (itemId: string, optionId: string, updates: Partial<ItemOption>) => void;
  deleteItemOption: (itemId: string, optionId: string) => void;
  approveItemOption: (itemId: string, optionId: string, approvedBy: string, status: ApprovalStatus, notes?: string) => void;
  selectItemOption: (itemId: string, optionId: string) => void;
  setRecommendedOption: (itemId: string, optionId: string) => void;

  // Vendor actions
  addVendor: (vendor: Omit<Vendor, 'id'>) => string;
  updateVendor: (vendorId: string, updates: Partial<Vendor>) => void;
  deleteVendor: (vendorId: string) => void;

  // Shopping list actions
  createShoppingList: (name: string, itemIds: string[]) => string;
  updateShoppingList: (listId: string, updates: Partial<ShoppingList>) => void;
  deleteShoppingList: (listId: string) => void;

  // Budget actions
  setCategoryBudget: (category: string, allocated: number, status: BudgetStatus) => void;
  updateBudgetSpent: (category: string, spent: number) => void;
  setTotalBudget: (amount: number, status: BudgetStatus) => void;
  calculateBudgetTotals: () => void;

  // Filter actions
  selectArtCartCategory: (category: string | null) => void;
  selectArtCartItem: (itemId: string | null) => void;
  setArtCartFilterStatus: (status: SourcingStatus | 'All') => void;
  getArtCartItemsByCategory: (category: string) => ArtCartItem[];
  getArtCartItemsByStatus: (status: SourcingStatus) => ArtCartItem[];

  // ViewFinder actions
  initializeViewFinder: () => void;
  importScenesForViewFinder: () => void;
  checkViewFinderScriptSync: () => void;

  // Shot actions
  addShot: (shot: Omit<Shot, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateShot: (shotId: string, updates: Partial<Shot>) => void;
  deleteShot: (shotId: string) => void;
  setShotStatus: (shotId: string, status: ShotStatus) => void;
  reorderShots: (sceneId: string, shotIds: string[]) => void;
  duplicateShot: (shotId: string) => string;

  // Storyboard actions
  createStoryboard: (sceneId: string, sceneNumber: string) => string;
  addStoryboardFrame: (storyboardId: string, frame: Omit<StoryboardFrame, 'id'>) => string;
  updateStoryboardFrame: (storyboardId: string, frameId: string, updates: Partial<StoryboardFrame>) => void;
  deleteStoryboardFrame: (storyboardId: string, frameId: string) => void;
  reorderStoryboardFrames: (storyboardId: string, frameIds: string[]) => void;
  linkFrameToShot: (storyboardId: string, frameId: string, shotId: string | undefined) => void;

  // Camera package actions
  addCameraPackage: (pkg: Omit<CameraPackage, 'id'>) => string;
  updateCameraPackage: (packageId: string, updates: Partial<CameraPackage>) => void;
  deleteCameraPackage: (packageId: string) => void;

  // Scene coverage actions
  updateSceneCoverage: (sceneId: string, updates: Partial<SceneCoverage>) => void;
  markSceneCoverageComplete: (sceneId: string, complete: boolean) => void;
  calculateSceneCoverage: () => void;

  // ViewFinder filter actions
  selectViewFinderScene: (sceneId: string | null) => void;
  selectShot: (shotId: string | null) => void;
  setViewFinderFilterStatus: (status: ShotStatus | 'All') => void;
  getShotsByScene: (sceneId: string) => Shot[];
  getShotsByStatus: (status: ShotStatus) => Shot[];

  // BaseCamp actions
  initializeSchedule: () => void;
  importStripsFromBreakdown: () => void;
  createShotPackagesFromViewFinder: () => void;

  // Shoot day actions
  addShootDay: () => string;
  updateShootDay: (dayId: string, updates: Partial<ShootDay>) => void;
  deleteShootDay: (dayId: string) => void;
  reorderShootDays: (dayIds: string[]) => void;

  // Strip actions
  updateStrip: (stripId: string, updates: Partial<SceneStrip>) => void;
  assignStripToDay: (stripId: string, dayId: string, position?: number) => void;
  unassignStrip: (stripId: string) => void;
  reorderStripsInDay: (dayId: string, stripIds: string[]) => void;
  lockStrip: (stripId: string, locked: boolean) => void;

  // Shot package actions
  createShotPackage: (sceneId: string, name: string, shotIds: string[]) => string;
  updateShotPackage: (packageId: string, updates: Partial<ShotPackage>) => void;
  deleteShotPackage: (packageId: string) => void;
  assignPackageToDay: (packageId: string, dayId: string, position?: number) => void;
  unassignPackage: (packageId: string) => void;
  splitPackage: (packageId: string, shotIds: string[], newName: string) => string;

  // DOOD actions
  updateDOOD: (castId: string, dayId: string, status: DOODStatus) => void;
  recalculateDOOD: () => void;

  // Schedule settings
  updateScheduleSettings: (settings: Partial<Pick<Schedule, 'defaultCallTime' | 'defaultLunchDuration' | 'showLunchOnBoard'>>) => void;

  // Selection
  selectShootDay: (dayId: string | null) => void;
  selectStrip: (stripId: string | null) => void;

  // Production Management actions
  setBasecampView: (view: ScreenplayState['basecampView']) => void;
  initializeProductionData: () => void;

  // People CRUD
  addPerson: (person: Omit<ProductionPerson, 'id' | 'avatarColor'>) => string;
  updatePerson: (id: string, updates: Partial<ProductionPerson>) => void;
  deletePerson: (id: string) => void;

  // Location CRUD
  addLocation: (location: Omit<ProductionLocation, 'id'>) => string;
  updateLocation: (id: string, updates: Partial<ProductionLocation>) => void;
  deleteLocation: (id: string) => void;

  // Production Scene CRUD
  addProductionScene: (scene: Omit<ProductionScene, 'id'>) => string;
  updateProductionScene: (id: string, updates: Partial<ProductionScene>) => void;
  deleteProductionScene: (id: string) => void;

  // Department CRUD
  addDepartment: (name: string) => string;
  updateDepartment: (id: string, updates: Partial<Department>) => void;
  deleteDepartment: (id: string) => void;
  addPosition: (departmentId: string, position: string) => void;
  removePosition: (departmentId: string, position: string) => void;

  // Call Sheet CRUD
  addCallSheet: (callSheet: Omit<CallSheet, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateCallSheet: (id: string, updates: Partial<CallSheet>) => void;
  deleteCallSheet: (id: string) => void;

  // Production Settings
  updateProductionSettings: (settings: Partial<ProductionSettings>) => void;

  // OnSet actions (Live Production)
  initializeOnSet: () => void;
  setOnSetViewMode: (mode: OnSetViewMode) => void;
  updateOnSetDisplaySettings: (settings: Partial<OnSetDisplaySettings>) => void;
  startProductionDay: (dayId: string) => void;
  markStripComplete: (stripId: string) => void;
  markStripInProgress: (stripId: string) => void;
  startLunch: () => void;
  endLunch: () => void;
  addDelay: (reason: string, category: DelayEntry['category'], notes?: string) => string;
  endDelay: (delayId: string) => void;
  updateAheadBehind: () => void;
  goLive: () => void;
  goOffline: () => void;
  getQuickStatus: () => { currentScene: string; currentSetup: string; estimatedWrap: string; aheadBehind: string; nextUp: string; isOnLunch: boolean; lunchCountdown?: string } | null;

  // SuperVisor actions
  initializeSuperVisor: () => void;
  startSupervisorSession: (shootDayId: string) => string;
  endSupervisorSession: () => void;

  // Take logging
  setCurrentSlate: (slate: Partial<SlateInfo>) => void;
  logTake: (take: Omit<TakeEntry, 'id' | 'createdAt'>) => string;
  updateTake: (takeId: string, updates: Partial<TakeEntry>) => void;
  deleteTake: (takeId: string) => void;
  circleTake: (takeId: string, circled: boolean) => void;

  // Continuity
  addContinuityLog: (sceneId: string) => string;
  updateContinuityLog: (logId: string, updates: Partial<ContinuityLog>) => void;

  // Reports
  generateDailyReport: (shootDayId: string) => string;
  approveDailyReport: (reportId: string, approvedBy: string) => void;

  // Selection
  selectSuperVisorScene: (sceneId: string | null) => void;
  selectSuperVisorShot: (shotId: string | null) => void;
  setSuperVisorCameraFilter: (camera: string | 'All') => void;

  // Getters
  getTakesForScene: (sceneNumber: string) => TakeEntry[];
  getTakesForShot: (shotId: string) => TakeEntry[];
  getCircledTakes: () => TakeEntry[];

  // Theme
  toggleDarkMode: () => void;
  setTheme: (themeId: ThemeId) => void;

  // Project Data actions (for cloud storage)
  loadFromProjectData: (data: import('../types/user').ProjectData) => void;
  resetToNew: () => void;
  getProjectData: () => import('../types/user').ProjectData;
}

// Calculate writing statistics from screenplay
const calculateWritingStats = (screenplay: Screenplay): WritingStats => {
  let wordCount = 0;
  let characterCount = 0;
  let sceneCount = 0;
  let dialogueCount = 0;
  let totalLines = 0;

  screenplay.elements.forEach((element) => {
    const text = getPlainText(element.content);
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    wordCount += words.length;
    characterCount += text.length;

    if (element.type === 'Scene Heading') {
      sceneCount++;
    }
    if (element.type === 'Dialogue') {
      dialogueCount++;
    }

    // Estimate lines (rough calculation based on 60 chars per line)
    const lineCount = Math.max(1, Math.ceil(text.length / 60));
    totalLines += lineCount;
  });

  const pageCount = Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE));

  // 1 page ≈ 1 minute of screen time
  const totalMinutes = pageCount;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const estimatedRuntime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return {
    pageCount,
    wordCount,
    characterCount,
    sceneCount,
    dialogueCount,
    estimatedRuntime,
  };
};

// Max history entries to prevent memory issues
const MAX_HISTORY = 100;

export const useScreenplayStore = create<ScreenplayState>((set, get) => ({
  screenplay: createNewScreenplay(),
  selectedElementId: null,
  currentElementType: 'Scene Heading',
  isDirty: false,
  fileName: 'Untitled.fdx',
  darkMode: true,
  activeTheme: 'default',

  // Undo/Redo state
  history: [],
  future: [],
  historyIndex: -1,

  // UI State defaults
  zoom: 100,
  activeApp: 'rewriter',
  viewMode: 'script',
  panels: {
    navigator: false,
    elements: false,
    writingStats: false,
    titlePage: false,
    beatBoard: false,
  },
  visibility: {
    ruler: true,
    sceneNavigator: true,
    scriptNotes: true,
  },
  stats: {
    pageCount: 1,
    wordCount: 0,
    characterCount: 0,
    sceneCount: 0,
    dialogueCount: 0,
    estimatedRuntime: '0m',
  },
  currentPage: 1,
  cursorLine: 1,

  // Beat Board state
  beatBoards: [],
  activeBeatBoardId: null,

  // Version Management state
  versions: [],
  activeVersionId: null,

  // Script Notes state
  scriptNotes: [],

  // Split View state
  splitContent: {
    audio: [{ id: generateId(), text: '' }],
    video: [{ id: generateId(), text: '' }],
    isIndependent: false,
    swapped: false,
  },

  // Story Outline state
  storyOutline: {
    plot: {
      title: '',
      logline: '',
      themes: '',
      storyTypes: [],
      genres: [],
      tones: [],
      audience: '',
      setting: '',
      bStory: '',
      otherDetails: '',
    },
    characters: [],
    acts: {
      act1: '',
      act2a: '',
      act2b: '',
      act3: '',
    },
    beats: [],
  },

  // Auto-Complete / Smart Type state
  autoComplete: {
    isOpen: false,
    suggestions: [],
    selectedIndex: 0,
    triggerType: null,
    searchText: '',
    position: { x: 0, y: 0 },
  },
  scriptCharacters: new Map(),
  scriptLocations: [],

  // Scene Numbers state
  showSceneNumbers: false,
  sceneNumberStyle: 'numeric',

  // Page Locking state
  pageLocks: [],

  // Watermark Settings state
  watermarkSettings: {
    enabled: false,
    text: 'DRAFT',
    opacity: 0.15,
    fontSize: 72,
    angle: -45,
    position: 'diagonal',
  },

  // Breakdown state
  breakdown: null,
  breakdownScenes: [],
  selectedBreakdownCategory: null,
  selectedBreakdownSceneId: null,

  // ArtCart state
  artCart: null,
  selectedArtCartCategory: null,
  selectedArtCartItemId: null,
  artCartFilterStatus: 'All',

  // ViewFinder state
  viewFinder: null,
  selectedViewFinderSceneId: null,
  selectedShotId: null,
  viewFinderFilterStatus: 'All',

  // BaseCamp state
  schedule: null,
  selectedShootDayId: null,
  selectedStripId: null,

  // Production Management state
  productionData: {
    people: [],
    locations: [],
    scenes: [],
    departments: DEFAULT_DEPARTMENTS.map((d, i) => ({ ...d, id: `dept-default-${i}` })),
    callSheets: [],
    settings: {
      projectName: '',
      producer: '',
      director: '',
      defaultCallTime: '7:00 AM',
      defaultLunchDuration: 30,
    },
  },
  basecampView: 'dashboard' as const,

  // OnSet state
  onSet: null,

  // SuperVisor state
  superVisor: null,

  // Save current state to history (call before making changes)
  saveToHistory: () => {
    const state = get();
    const entry: HistoryEntry = {
      screenplay: JSON.parse(JSON.stringify(state.screenplay)),
      selectedElementId: state.selectedElementId,
    };

    // Trim history if too long
    let newHistory = [...state.history, entry];
    if (newHistory.length > MAX_HISTORY) {
      newHistory = newHistory.slice(-MAX_HISTORY);
    }

    set({
      history: newHistory,
      future: [], // Clear redo stack on new action
    });
  },

  undo: () => {
    const state = get();
    if (state.history.length === 0) return;

    // Save current state to future (for redo)
    const currentEntry: HistoryEntry = {
      screenplay: JSON.parse(JSON.stringify(state.screenplay)),
      selectedElementId: state.selectedElementId,
    };

    // Pop last history entry
    const newHistory = [...state.history];
    const previousEntry = newHistory.pop();

    if (previousEntry) {
      const stats = calculateWritingStats(previousEntry.screenplay);
      set({
        screenplay: previousEntry.screenplay,
        selectedElementId: previousEntry.selectedElementId,
        history: newHistory,
        future: [currentEntry, ...state.future],
        stats,
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;

    // Save current state to history
    const currentEntry: HistoryEntry = {
      screenplay: JSON.parse(JSON.stringify(state.screenplay)),
      selectedElementId: state.selectedElementId,
    };

    // Pop first future entry
    const [nextEntry, ...newFuture] = state.future;

    if (nextEntry) {
      const stats = calculateWritingStats(nextEntry.screenplay);
      set({
        screenplay: nextEntry.screenplay,
        selectedElementId: nextEntry.selectedElementId,
        history: [...state.history, currentEntry],
        future: newFuture,
        stats,
      });
    }
  },

  canUndo: () => get().history.length > 0,
  canRedo: () => get().future.length > 0,

  setScreenplay: (screenplay) => {
    get().saveToHistory();
    const stats = calculateWritingStats(screenplay);
    set({ screenplay, isDirty: true, stats });
  },

  newScreenplay: () => {
    const newScript = createNewScreenplay();
    const stats = calculateWritingStats(newScript);
    set({
      screenplay: newScript,
      selectedElementId: newScript.elements[0]?.id || null,
      isDirty: false,
      fileName: 'Untitled.fdx',
      stats,
      currentPage: 1,
    });
  },

  setTitle: (title) =>
    set((state) => ({
      screenplay: {
        ...state.screenplay,
        title,
        titlePage: { ...state.screenplay.titlePage, title }
      },
      isDirty: true,
    })),

  setAuthor: (author) =>
    set((state) => ({
      screenplay: {
        ...state.screenplay,
        author,
        titlePage: { ...state.screenplay.titlePage, author }
      },
      isDirty: true,
    })),

  updateTitlePage: (titlePageUpdate) =>
    set((state) => {
      const newTitlePage = { ...state.screenplay.titlePage, ...titlePageUpdate };

      // If title is updated, sync to Blueprint plot title
      const outlineUpdates: Partial<{ storyOutline: typeof state.storyOutline }> = {};
      if (titlePageUpdate.title !== undefined) {
        outlineUpdates.storyOutline = {
          ...state.storyOutline,
          plot: { ...state.storyOutline.plot, title: titlePageUpdate.title },
        };
      }

      return {
        screenplay: {
          ...state.screenplay,
          titlePage: newTitlePage,
        },
        ...outlineUpdates,
        isDirty: true,
      };
    }),

  addElement: (afterId, type) => {
    const state = get();
    state.saveToHistory(); // Save before change

    const elementType = type || state.currentElementType;
    const newElement: ScreenplayElement = {
      id: generateId(),
      type: elementType,
      content: [{ text: '' }],
    };

    const elements = [...state.screenplay.elements];

    if (afterId) {
      const index = elements.findIndex((el) => el.id === afterId);
      if (index !== -1) {
        elements.splice(index + 1, 0, newElement);
      } else {
        elements.push(newElement);
      }
    } else {
      elements.push(newElement);
    }

    const newScreenplay = { ...state.screenplay, elements };
    const stats = calculateWritingStats(newScreenplay);

    set({
      screenplay: newScreenplay,
      selectedElementId: newElement.id,
      isDirty: true,
      stats,
    });

    return newElement.id;
  },

  updateElement: (id, content) =>
    set((state) => {
      const elements = state.screenplay.elements.map((el) =>
        el.id === id ? { ...el, content } : el
      );
      const newScreenplay = { ...state.screenplay, elements };
      const stats = calculateWritingStats(newScreenplay);
      return {
        screenplay: newScreenplay,
        isDirty: true,
        stats,
      };
    }),

  updateElementType: (id, type) =>
    set((state) => {
      const elements = state.screenplay.elements.map((el) =>
        el.id === id ? { ...el, type } : el
      );
      const newScreenplay = { ...state.screenplay, elements };
      const stats = calculateWritingStats(newScreenplay);
      return {
        screenplay: newScreenplay,
        currentElementType: type,
        isDirty: true,
        stats,
      };
    }),

  deleteElement: (id) => {
    get().saveToHistory(); // Save before change
    set((state) => {
      const elements = state.screenplay.elements.filter((el) => el.id !== id);

      if (elements.length === 0) {
        elements.push({
          id: generateId(),
          type: 'Scene Heading',
          content: [{ text: '' }],
        });
      }

      let newSelectedId = state.selectedElementId;
      if (state.selectedElementId === id) {
        const deletedIndex = state.screenplay.elements.findIndex((el) => el.id === id);
        if (deletedIndex > 0) {
          newSelectedId = elements[deletedIndex - 1]?.id || elements[0]?.id;
        } else {
          newSelectedId = elements[0]?.id;
        }
      }

      const newScreenplay = { ...state.screenplay, elements };
      const stats = calculateWritingStats(newScreenplay);

      return {
        screenplay: newScreenplay,
        selectedElementId: newSelectedId,
        isDirty: true,
        stats,
      };
    });
  },

  selectElement: (id) => set({ selectedElementId: id }),

  setCurrentElementType: (type) => set({ currentElementType: type }),

  mergeWithPrevious: (id) => {
    const state = get();
    const elements = [...state.screenplay.elements];
    const index = elements.findIndex((el) => el.id === id);

    if (index <= 0) return null;

    state.saveToHistory(); // Save before change

    const currentElement = elements[index];
    const previousElement = elements[index - 1];

    const mergedContent = [
      ...previousElement.content,
      ...currentElement.content,
    ];

    elements[index - 1] = {
      ...previousElement,
      content: mergedContent,
    };

    elements.splice(index, 1);

    const newScreenplay = { ...state.screenplay, elements };
    const stats = calculateWritingStats(newScreenplay);

    set({
      screenplay: newScreenplay,
      selectedElementId: previousElement.id,
      isDirty: true,
      stats,
    });

    return previousElement.id;
  },

  loadFromFDX: (content) => {
    try {
      const screenplay = parseFDX(content);
      const stats = calculateWritingStats(screenplay);
      set({
        screenplay,
        selectedElementId: screenplay.elements[0]?.id || null,
        isDirty: false,
        stats,
        currentPage: 1,
      });
    } catch (error) {
      console.error('Failed to parse FDX file:', error);
      throw error;
    }
  },

  exportToFDX: () => {
    const state = get();
    return generateFDX(state.screenplay);
  },

  setFileName: (name) => set({ fileName: name }),

  setDirty: (dirty) => set({ isDirty: dirty }),

  // UI actions
  setZoom: (zoom) => set({ zoom: Math.max(50, Math.min(200, zoom)) }),

  setActiveApp: (app) => set({ activeApp: app }),

  setViewMode: (mode) => set({ viewMode: mode }),

  togglePanel: (panel) =>
    set((state) => ({
      panels: {
        ...state.panels,
        [panel]: !state.panels[panel],
      },
    })),

  toggleVisibility: (item) =>
    set((state) => ({
      visibility: {
        ...state.visibility,
        [item]: !state.visibility[item],
      },
    })),

  setCurrentPage: (page) => set({ currentPage: page }),

  setCursorLine: (line) => set({ cursorLine: line }),

  calculateStats: () =>
    set((state) => ({
      stats: calculateWritingStats(state.screenplay),
    })),

  // Beat Board actions
  createBeatBoard: (name) => {
    const id = generateId();
    set((state) => ({
      beatBoards: [...state.beatBoards, { id, name, beats: [] }],
      activeBeatBoardId: id,
    }));
    return id;
  },

  deleteBeatBoard: (id) =>
    set((state) => ({
      beatBoards: state.beatBoards.filter((b) => b.id !== id),
      activeBeatBoardId: state.activeBeatBoardId === id ? null : state.activeBeatBoardId,
    })),

  setActiveBeatBoard: (id) => set({ activeBeatBoardId: id }),

  addBeat: (boardId, beat) => {
    const id = generateId();
    set((state) => ({
      beatBoards: state.beatBoards.map((board) =>
        board.id === boardId
          ? { ...board, beats: [...board.beats, { ...beat, id }] }
          : board
      ),
      isDirty: true,
    }));
    return id;
  },

  updateBeat: (boardId, beatId, updates) =>
    set((state) => ({
      beatBoards: state.beatBoards.map((board) =>
        board.id === boardId
          ? {
              ...board,
              beats: board.beats.map((beat) =>
                beat.id === beatId ? { ...beat, ...updates } : beat
              ),
            }
          : board
      ),
      isDirty: true,
    })),

  deleteBeat: (boardId, beatId) =>
    set((state) => ({
      beatBoards: state.beatBoards.map((board) =>
        board.id === boardId
          ? { ...board, beats: board.beats.filter((b) => b.id !== beatId) }
          : board
      ),
      isDirty: true,
    })),

  sendBeatToScript: (boardId, beatId) => {
    const state = get();
    const board = state.beatBoards.find((b) => b.id === boardId);
    const beat = board?.beats.find((b) => b.id === beatId);
    if (!beat) return undefined;

    // Create a scene heading from the beat
    const sceneId = state.addElement(undefined, 'Scene Heading');
    state.updateElement(sceneId, [{ text: beat.title }]);

    // If there's a description, add it as action
    if (beat.description) {
      const actionId = state.addElement(sceneId, 'Action');
      state.updateElement(actionId, [{ text: beat.description }]);
    }

    // Link the beat to the scene
    state.updateBeat(boardId, beatId, { linkedSceneId: sceneId });

    return sceneId;
  },

  // Version Management actions
  createVersion: (name) => {
    const state = get();
    const id = generateId();
    const version: ScriptVersion = {
      id,
      name,
      timestamp: new Date(),
      screenplay: JSON.parse(JSON.stringify(state.screenplay)),
      isActive: false,
    };
    set((state) => ({
      versions: [...state.versions, version],
    }));
    return id;
  },

  switchVersion: (versionId) => {
    const state = get();
    const version = state.versions.find((v) => v.id === versionId);
    if (!version) return;

    // Save current to active version before switching
    const updatedVersions = state.versions.map((v) =>
      v.id === state.activeVersionId
        ? { ...v, screenplay: JSON.parse(JSON.stringify(state.screenplay)), isActive: false }
        : v.id === versionId
        ? { ...v, isActive: true }
        : v
    );

    const stats = calculateWritingStats(version.screenplay);
    set({
      screenplay: JSON.parse(JSON.stringify(version.screenplay)),
      versions: updatedVersions,
      activeVersionId: versionId,
      stats,
      isDirty: false,
    });
  },

  deleteVersion: (versionId) =>
    set((state) => ({
      versions: state.versions.filter((v) => v.id !== versionId),
      activeVersionId: state.activeVersionId === versionId ? null : state.activeVersionId,
    })),

  renameVersion: (versionId, name) =>
    set((state) => ({
      versions: state.versions.map((v) =>
        v.id === versionId ? { ...v, name } : v
      ),
    })),

  // Script Notes actions
  addNote: (elementId, content, author = 'You') => {
    const id = generateId();
    const note: ScriptNote = {
      id,
      elementId,
      author,
      content,
      timestamp: new Date(),
      resolved: false,
    };
    set((state) => ({
      scriptNotes: [...state.scriptNotes, note],
    }));
    return id;
  },

  updateNote: (noteId, content) =>
    set((state) => ({
      scriptNotes: state.scriptNotes.map((n) =>
        n.id === noteId ? { ...n, content } : n
      ),
    })),

  deleteNote: (noteId) =>
    set((state) => ({
      scriptNotes: state.scriptNotes.filter((n) => n.id !== noteId),
    })),

  resolveNote: (noteId) =>
    set((state) => ({
      scriptNotes: state.scriptNotes.map((n) =>
        n.id === noteId ? { ...n, resolved: true } : n
      ),
    })),

  // Split View actions
  toggleSplitIndependent: () =>
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        isIndependent: !state.splitContent.isIndependent,
      },
    })),

  toggleSplitSwapped: () =>
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        swapped: !state.splitContent.swapped,
      },
    })),

  updateSplitAudio: (entries) =>
    set((state) => ({
      splitContent: { ...state.splitContent, audio: entries },
    })),

  updateSplitVideo: (entries) =>
    set((state) => ({
      splitContent: { ...state.splitContent, video: entries },
    })),

  addSplitEntry: (column, text = '') => {
    const id = generateId();
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        [column]: [...state.splitContent[column], { id, text }],
      },
    }));
    return id;
  },

  updateSplitEntry: (column, id, text) =>
    set((state) => ({
      splitContent: {
        ...state.splitContent,
        [column]: state.splitContent[column].map((entry) =>
          entry.id === id ? { ...entry, text } : entry
        ),
      },
    })),

  deleteSplitEntry: (column, id) =>
    set((state) => {
      const filtered = state.splitContent[column].filter((e) => e.id !== id);
      // Keep at least one empty entry
      const entries = filtered.length > 0 ? filtered : [{ id: generateId(), text: '' }];
      return {
        splitContent: {
          ...state.splitContent,
          [column]: entries,
        },
      };
    }),

  // Story Outline actions
  updatePlotOverview: (updates) =>
    set((state) => {
      const newPlot = { ...state.storyOutline.plot, ...updates };

      // If title is updated, sync to screenplay title page
      const screenplayUpdates: Partial<{ screenplay: typeof state.screenplay }> = {};
      if (updates.title !== undefined) {
        screenplayUpdates.screenplay = {
          ...state.screenplay,
          title: updates.title,
          titlePage: { ...state.screenplay.titlePage, title: updates.title },
        };
      }

      return {
        storyOutline: {
          ...state.storyOutline,
          plot: newPlot,
        },
        ...screenplayUpdates,
        isDirty: true,
      };
    }),

  addCharacter: () => {
    const id = generateId();
    const newCharacter: StoryCharacter = {
      id,
      name: '',
      role: 'Other',
      characterArc: 'Positive Arc',
      archetypes: [],
      physicalDescription: '',
      personality: '',
      want: '',
      need: '',
      lie: '',
      ghost: '',
      notes: '',
    };
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        characters: [...state.storyOutline.characters, newCharacter],
      },
      isDirty: true,
    }));
    return id;
  },

  updateCharacter: (id, updates) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        characters: state.storyOutline.characters.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      },
      isDirty: true,
    })),

  deleteCharacter: (id) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        characters: state.storyOutline.characters.filter((c) => c.id !== id),
      },
      isDirty: true,
    })),

  updateActs: (updates) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        acts: { ...state.storyOutline.acts, ...updates },
      },
      isDirty: true,
    })),

  updateBeatContent: (beatId, description) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        beats: state.storyOutline.beats.map((b) =>
          b.id === beatId ? { ...b, description } : b
        ),
      },
      isDirty: true,
    })),

  linkBeatToScene: (beatId, sceneId) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        beats: state.storyOutline.beats.map((b) =>
          b.id === beatId ? { ...b, linkedSceneId: sceneId } : b
        ),
      },
    })),

  initializeBeats: () =>
    set((state) => {
      // Only initialize if beats are empty
      if (state.storyOutline.beats.length > 0) return state;

      const beats: StoryBeat[] = DEFAULT_BEAT_STRUCTURE.map((template) => ({
        id: generateId(),
        name: template.name,
        act: template.act,
        description: '',
      }));

      return {
        storyOutline: {
          ...state.storyOutline,
          beats,
        },
      };
    }),

  addStoryBeat: (beat) =>
    set((state) => ({
      storyOutline: {
        ...state.storyOutline,
        beats: [...state.storyOutline.beats, beat],
      },
      isDirty: true,
    })),

  // Auto-Complete / Smart Type actions
  refreshScriptData: () => {
    const state = get();
    // Extract characters and locations from script
    const scriptChars = extractCharactersFromScript(state.screenplay.elements);
    // Merge with BluePrint characters
    const mergedChars = mergeCharacterSources(scriptChars, state.storyOutline.characters);
    const locations = extractLocationsFromScript(state.screenplay.elements);

    set({
      scriptCharacters: mergedChars,
      scriptLocations: locations,
    });
  },

  openAutoComplete: (triggerType, searchText, position) => {
    const state = get();
    // Generate suggestions based on trigger type
    let suggestions: AutoCompleteSuggestion[] = [];

    if (triggerType === 'character') {
      suggestions = getCharacterSuggestions(state.scriptCharacters, searchText);
    } else if (triggerType === 'location') {
      suggestions = getLocationSuggestions(state.scriptLocations, searchText);
    } else if (triggerType === 'extension') {
      suggestions = getExtensionSuggestions(searchText);
    } else if (triggerType === 'timeofday') {
      suggestions = getTimeOfDaySuggestions(searchText);
    }

    set({
      autoComplete: {
        isOpen: suggestions.length > 0,
        suggestions,
        selectedIndex: 0,
        triggerType,
        searchText,
        position,
      },
    });
  },

  closeAutoComplete: () =>
    set({
      autoComplete: {
        isOpen: false,
        suggestions: [],
        selectedIndex: 0,
        triggerType: null,
        searchText: '',
        position: { x: 0, y: 0 },
      },
    }),

  updateAutoCompleteSearch: (searchText) => {
    const state = get();
    const { triggerType } = state.autoComplete;

    if (!triggerType) return;

    let suggestions: AutoCompleteSuggestion[] = [];

    if (triggerType === 'character') {
      suggestions = getCharacterSuggestions(state.scriptCharacters, searchText);
    } else if (triggerType === 'location') {
      suggestions = getLocationSuggestions(state.scriptLocations, searchText);
    } else if (triggerType === 'extension') {
      suggestions = getExtensionSuggestions(searchText);
    } else if (triggerType === 'timeofday') {
      suggestions = getTimeOfDaySuggestions(searchText);
    }

    set({
      autoComplete: {
        ...state.autoComplete,
        suggestions,
        selectedIndex: 0,
        searchText,
        isOpen: suggestions.length > 0,
      },
    });
  },

  selectAutoCompleteSuggestion: (index) =>
    set((state) => ({
      autoComplete: {
        ...state.autoComplete,
        selectedIndex: Math.max(0, Math.min(index, state.autoComplete.suggestions.length - 1)),
      },
    })),

  moveAutoCompleteSelection: (direction) =>
    set((state) => {
      const { suggestions, selectedIndex } = state.autoComplete;
      if (suggestions.length === 0) return state;

      let newIndex = selectedIndex;
      if (direction === 'up') {
        newIndex = selectedIndex > 0 ? selectedIndex - 1 : suggestions.length - 1;
      } else {
        newIndex = selectedIndex < suggestions.length - 1 ? selectedIndex + 1 : 0;
      }

      return {
        autoComplete: {
          ...state.autoComplete,
          selectedIndex: newIndex,
        },
      };
    }),

  getAutoCompleteSuggestions: () => get().autoComplete.suggestions,

  // Scene Numbers actions
  toggleSceneNumbers: () => set((state) => ({ showSceneNumbers: !state.showSceneNumbers })),

  setSceneNumberStyle: (style) => set({ sceneNumberStyle: style }),

  generateSceneNumbers: () => {
    const state = get();
    let sceneCount = 0;

    const elements = state.screenplay.elements.map((el) => {
      if (el.type === 'Scene Heading') {
        sceneCount++;
        return { ...el, sceneNumber: String(sceneCount) };
      }
      return el;
    });

    set({
      screenplay: { ...state.screenplay, elements },
      showSceneNumbers: true,
      isDirty: true,
    });
  },

  clearSceneNumbers: () => {
    const state = get();
    const elements = state.screenplay.elements.map((el) => {
      if (el.type === 'Scene Heading') {
        const { sceneNumber, ...rest } = el;
        return rest as typeof el;
      }
      return el;
    });

    set({
      screenplay: { ...state.screenplay, elements },
      showSceneNumbers: false,
      isDirty: true,
    });
  },

  // Page Locking actions
  lockPage: (pageNumber, color = 'white') => {
    const state = get();
    const existingLock = state.pageLocks.find((l) => l.pageNumber === pageNumber);
    if (existingLock) return;

    const newLock: PageLock = {
      pageNumber,
      lockedAt: new Date(),
      color,
    };

    set({
      pageLocks: [...state.pageLocks, newLock],
      isDirty: true,
    });
  },

  unlockPage: (pageNumber) =>
    set((state) => ({
      pageLocks: state.pageLocks.filter((l) => l.pageNumber !== pageNumber),
      isDirty: true,
    })),

  isPageLocked: (pageNumber) => {
    const state = get();
    return state.pageLocks.some((l) => l.pageNumber === pageNumber);
  },

  getPageLock: (pageNumber) => {
    const state = get();
    return state.pageLocks.find((l) => l.pageNumber === pageNumber);
  },

  // Watermark actions
  setWatermarkSettings: (settings) =>
    set((state) => ({
      watermarkSettings: { ...state.watermarkSettings, ...settings },
    })),

  toggleWatermark: () =>
    set((state) => ({
      watermarkSettings: {
        ...state.watermarkSettings,
        enabled: !state.watermarkSettings.enabled,
      },
    })),

  // Dual Dialogue actions
  toggleDualDialogue: (characterElementId) => {
    const state = get();
    const elements = [...state.screenplay.elements];
    const charIndex = elements.findIndex((el) => el.id === characterElementId);

    if (charIndex === -1 || elements[charIndex].type !== 'Character') return;

    const charElement = elements[charIndex];
    const isCurrentlyDual = charElement.isDualDialogue;

    if (isCurrentlyDual) {
      // Turn off dual dialogue for this character and following dialogue
      let i = charIndex;
      while (i < elements.length) {
        const el = elements[i];
        if (el.type === 'Character' || el.type === 'Dialogue' || el.type === 'Parenthetical') {
          elements[i] = { ...el, isDualDialogue: false, dualDialoguePosition: undefined };
          // Stop if we hit the next character after processing current block
          if (el.type === 'Character' && i > charIndex) break;
        } else {
          break;
        }
        i++;
      }
    } else {
      // Turn on dual dialogue - mark this character block as 'right' (appears alongside previous)
      // The previous character block is implicitly 'left'
      let i = charIndex;
      while (i < elements.length) {
        const el = elements[i];
        if (el.type === 'Character' || el.type === 'Dialogue' || el.type === 'Parenthetical') {
          elements[i] = { ...el, isDualDialogue: true, dualDialoguePosition: 'right' };
          if (el.type === 'Character' && i > charIndex) break;
        } else {
          break;
        }
        i++;
      }

      // Mark previous character block as 'left'
      let j = charIndex - 1;
      while (j >= 0) {
        const el = elements[j];
        if (el.type === 'Character') {
          // Found the previous character, mark their block
          let k = j;
          while (k < charIndex) {
            const kEl = elements[k];
            if (kEl.type === 'Character' || kEl.type === 'Dialogue' || kEl.type === 'Parenthetical') {
              elements[k] = { ...kEl, isDualDialogue: true, dualDialoguePosition: 'left' };
            }
            k++;
          }
          break;
        }
        j--;
      }
    }

    state.saveToHistory();
    set({
      screenplay: { ...state.screenplay, elements },
      isDirty: true,
    });
  },

  // Breakdown actions
  initializeBreakdown: () => {
    const state = get();
    const scenes = generateBreakdownScenes(state.screenplay.elements);

    const breakdown: Breakdown = {
      id: generateId(),
      name: `Breakdown - ${state.screenplay.title || 'Untitled'}`,
      scriptVersionId: state.activeVersionId || 'main',
      versionInfo: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        createdAt: new Date(),
        lastSyncedAt: new Date(),
        missingElements: [],
        newScenes: [],
        syncStatus: 'current',
      },
      elements: [],
      scenes,
      customCategories: [],
      castList: [],
      locationsList: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({
      breakdown,
      breakdownScenes: scenes,
      selectedBreakdownSceneId: scenes[0]?.id || null,
    });
  },

  refreshBreakdownScenes: () => {
    const state = get();
    const scenes = generateBreakdownScenes(state.screenplay.elements);

    // Preserve existing element assignments
    const existingElements = state.breakdown?.elements || [];
    const updatedScenes = scenes.map(scene => ({
      ...scene,
      elements: existingElements
        .filter(el => el.sceneId === scene.id)
        .map(el => el.id),
    }));

    set({
      breakdownScenes: updatedScenes,
      breakdown: state.breakdown ? {
        ...state.breakdown,
        scenes: updatedScenes,
        versionInfo: {
          ...state.breakdown.versionInfo,
          lastSyncedAt: new Date(),
          syncStatus: 'current',
        },
        updatedAt: new Date(),
      } : null,
    });
  },

  selectBreakdownCategory: (category) => set({ selectedBreakdownCategory: category }),

  selectBreakdownScene: (sceneId) => set({ selectedBreakdownSceneId: sceneId }),

  addBreakdownElement: (element) => {
    const state = get();
    if (!state.breakdown) return;

    const newElements = [...state.breakdown.elements, element];

    // Update scene's element list
    const updatedScenes = state.breakdown.scenes.map(scene =>
      scene.id === element.sceneId
        ? { ...scene, elements: [...scene.elements, element.id] }
        : scene
    );

    set({
      breakdown: {
        ...state.breakdown,
        elements: newElements,
        scenes: updatedScenes,
        updatedAt: new Date(),
      },
      breakdownScenes: updatedScenes,
      isDirty: true,
    });
  },

  updateBreakdownElement: (elementId, updates) => {
    const state = get();
    if (!state.breakdown) return;

    const newElements = state.breakdown.elements.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    );

    set({
      breakdown: {
        ...state.breakdown,
        elements: newElements,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteBreakdownElement: (elementId) => {
    const state = get();
    if (!state.breakdown) return;

    const elementToDelete = state.breakdown.elements.find(el => el.id === elementId);
    const newElements = state.breakdown.elements.filter(el => el.id !== elementId);

    // Update scene's element list
    const updatedScenes = state.breakdown.scenes.map(scene =>
      scene.id === elementToDelete?.sceneId
        ? { ...scene, elements: scene.elements.filter(id => id !== elementId) }
        : scene
    );

    set({
      breakdown: {
        ...state.breakdown,
        elements: newElements,
        scenes: updatedScenes,
        updatedAt: new Date(),
      },
      breakdownScenes: updatedScenes,
      isDirty: true,
    });
  },

  addCustomCategory: (category) => {
    const state = get();
    if (!state.breakdown) return;

    set({
      breakdown: {
        ...state.breakdown,
        customCategories: [...state.breakdown.customCategories, category],
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  getBreakdownElementsForScene: (sceneId) => {
    const state = get();
    if (!state.breakdown) return [];
    return getElementsForScene(state.breakdown.elements, sceneId);
  },

  // ArtCart actions
  initializeArtCart: () => {
    const state = get();
    const artCart: ArtCart = {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [],
      vendors: [],
      shoppingLists: [],
      budgets: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      importedFromBreakdownId: state.breakdown?.id,
      totalBudgetStatus: 'Pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set({ artCart });
  },

  importFromBreakdown: () => {
    const state = get();
    if (!state.breakdown) return;

    // Art-related categories to import
    const artCategories = ['Props', 'Set Dressing', 'Greenery', 'Vehicles', 'Wardrobe', 'Makeup', 'Special Equipment'];

    // Filter breakdown elements to art categories
    const artElements = state.breakdown.elements.filter(el =>
      artCategories.includes(el.category)
    );

    // Create ArtCartItems from breakdown elements
    const newItems: ArtCartItem[] = artElements.map(el => ({
      id: generateId(),
      name: el.text,
      category: el.category,
      status: 'To Find' as SourcingStatus,
      priority: 'Medium' as ItemPriority,
      quantity: 1,
      options: [],
      needsApproval: false,
      sceneIds: [el.sceneId],
      breakdownElementId: el.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Merge with existing items (avoid duplicates by breakdownElementId)
    const existingIds = new Set(state.artCart?.items.map(i => i.breakdownElementId) || []);
    const uniqueNewItems = newItems.filter(item =>
      item.breakdownElementId && !existingIds.has(item.breakdownElementId)
    );

    const updatedArtCart: ArtCart = state.artCart ? {
      ...state.artCart,
      items: [...state.artCart.items, ...uniqueNewItems],
      scriptSync: {
        ...state.artCart.scriptSync,
        syncedAt: new Date(),
        isOutdated: false,
      },
      importedFromBreakdownId: state.breakdown.id,
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: uniqueNewItems,
      vendors: [],
      shoppingLists: [],
      budgets: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      importedFromBreakdownId: state.breakdown.id,
      totalBudgetStatus: 'Pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
  },

  checkScriptVersionSync: () => {
    const state = get();
    if (!state.artCart) return;

    // Check if script has changed since last sync
    const currentVersionId = state.activeVersionId || 'main';
    const isOutdated = state.artCart.scriptSync.scriptVersionId !== currentVersionId;

    if (isOutdated) {
      set({
        artCart: {
          ...state.artCart,
          scriptSync: {
            ...state.artCart.scriptSync,
            isOutdated: true,
            latestVersionId: currentVersionId,
            latestVersionName: state.versions.find(v => v.id === currentVersionId)?.name || 'Current',
          },
          updatedAt: new Date(),
        },
      });
    }
  },

  addArtCartItem: (itemData) => {
    const state = get();
    const id = generateId();
    const newItem: ArtCartItem = {
      ...itemData,
      id,
      options: [],
      needsApproval: itemData.needsApproval ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedArtCart = state.artCart ? {
      ...state.artCart,
      items: [...state.artCart.items, newItem],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [newItem],
      vendors: [],
      shoppingLists: [],
      budgets: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      totalBudgetStatus: 'Pending' as BudgetStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
    return id;
  },

  updateArtCartItem: (itemId, updates) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId ? { ...item, ...updates, updatedAt: new Date() } : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteArtCartItem: (itemId) => {
    const state = get();
    if (!state.artCart) return;

    set({
      artCart: {
        ...state.artCart,
        items: state.artCart.items.filter(item => item.id !== itemId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  setArtCartItemStatus: (itemId, status) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId ? { ...item, status, updatedAt: new Date() } : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  setArtCartItemPriority: (itemId, priority) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId ? { ...item, priority, updatedAt: new Date() } : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  addVendor: (vendorData) => {
    const state = get();
    const id = generateId();
    const newVendor: Vendor = { ...vendorData, id };

    const updatedArtCart = state.artCart ? {
      ...state.artCart,
      vendors: [...state.artCart.vendors, newVendor],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [],
      vendors: [newVendor],
      shoppingLists: [],
      budgets: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      totalBudgetStatus: 'Pending' as BudgetStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
    return id;
  },

  updateVendor: (vendorId, updates) => {
    const state = get();
    if (!state.artCart) return;

    const updatedVendors = state.artCart.vendors.map(vendor =>
      vendor.id === vendorId ? { ...vendor, ...updates } : vendor
    );

    set({
      artCart: {
        ...state.artCart,
        vendors: updatedVendors,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteVendor: (vendorId) => {
    const state = get();
    if (!state.artCart) return;

    set({
      artCart: {
        ...state.artCart,
        vendors: state.artCart.vendors.filter(v => v.id !== vendorId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  createShoppingList: (name, itemIds) => {
    const state = get();
    const id = generateId();
    const newList: ShoppingList = {
      id,
      name,
      itemIds,
      status: 'Draft',
      createdAt: new Date(),
    };

    const updatedArtCart = state.artCart ? {
      ...state.artCart,
      shoppingLists: [...state.artCart.shoppingLists, newList],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [],
      vendors: [],
      shoppingLists: [newList],
      budgets: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      totalBudgetStatus: 'Pending' as BudgetStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
    return id;
  },

  updateShoppingList: (listId, updates) => {
    const state = get();
    if (!state.artCart) return;

    const updatedLists = state.artCart.shoppingLists.map(list =>
      list.id === listId ? { ...list, ...updates } : list
    );

    set({
      artCart: {
        ...state.artCart,
        shoppingLists: updatedLists,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteShoppingList: (listId) => {
    const state = get();
    if (!state.artCart) return;

    set({
      artCart: {
        ...state.artCart,
        shoppingLists: state.artCart.shoppingLists.filter(l => l.id !== listId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  selectArtCartCategory: (category) => set({ selectedArtCartCategory: category }),

  selectArtCartItem: (itemId) => set({ selectedArtCartItemId: itemId }),

  setArtCartFilterStatus: (status) => set({ artCartFilterStatus: status }),

  getArtCartItemsByCategory: (category) => {
    const state = get();
    if (!state.artCart) return [];
    return state.artCart.items.filter(item => item.category === category);
  },

  getArtCartItemsByStatus: (status) => {
    const state = get();
    if (!state.artCart) return [];
    return state.artCart.items.filter(item => item.status === status);
  },

  // Item Options actions
  addItemOption: (itemId, optionData) => {
    const state = get();
    if (!state.artCart) return '';

    const optionId = generateId();
    const newOption: ItemOption = {
      ...optionData,
      id: optionId,
      approvalStatus: 'Pending',
      createdAt: new Date(),
    };

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId
        ? { ...item, options: [...item.options, newOption], updatedAt: new Date() }
        : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    return optionId;
  },

  updateItemOption: (itemId, optionId, updates) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId
        ? {
            ...item,
            options: item.options.map(opt =>
              opt.id === optionId ? { ...opt, ...updates } : opt
            ),
            updatedAt: new Date(),
          }
        : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteItemOption: (itemId, optionId) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId
        ? {
            ...item,
            options: item.options.filter(opt => opt.id !== optionId),
            selectedOptionId: item.selectedOptionId === optionId ? undefined : item.selectedOptionId,
            updatedAt: new Date(),
          }
        : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  approveItemOption: (itemId, optionId, approvedBy, status, notes) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item => {
      if (item.id !== itemId) return item;

      const updatedOptions = item.options.map(opt =>
        opt.id === optionId
          ? {
              ...opt,
              approvalStatus: status,
              approvedBy,
              approvalDate: new Date(),
              approvalNotes: notes,
            }
          : opt
      );

      // If approved, auto-select this option
      const selectedOptionId = status === 'Approved' ? optionId : item.selectedOptionId;

      // Update item approval status based on option approval
      const approvalStatus = status === 'Approved' || status === 'Indifferent'
        ? status
        : item.approvalStatus;

      return {
        ...item,
        options: updatedOptions,
        selectedOptionId,
        approvalStatus,
        approvedBy: status === 'Approved' ? approvedBy : item.approvedBy,
        approvalDate: status === 'Approved' ? new Date() : item.approvalDate,
        updatedAt: new Date(),
      };
    });

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  selectItemOption: (itemId, optionId) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item => {
      if (item.id !== itemId) return item;

      const selectedOption = item.options.find(opt => opt.id === optionId);
      if (!selectedOption) return item;

      return {
        ...item,
        selectedOptionId: optionId,
        estimatedCost: selectedOption.price,
        vendorId: selectedOption.vendorId,
        updatedAt: new Date(),
      };
    });

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  setRecommendedOption: (itemId, optionId) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item => {
      if (item.id !== itemId) return item;

      return {
        ...item,
        options: item.options.map(opt => ({
          ...opt,
          isRecommended: opt.id === optionId,
        })),
        updatedAt: new Date(),
      };
    });

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  // Budget actions
  setCategoryBudget: (category, allocated, status) => {
    const state = get();
    if (!state.artCart) return;

    const existingBudget = state.artCart.budgets.find(b => b.category === category);
    const spent = existingBudget?.spent || 0;
    const committed = existingBudget?.committed || 0;

    const newBudget: ArtCartBudget = {
      category,
      status,
      allocated,
      spent,
      committed,
      remaining: allocated - spent - committed,
    };

    const updatedBudgets = existingBudget
      ? state.artCart.budgets.map(b => b.category === category ? newBudget : b)
      : [...state.artCart.budgets, newBudget];

    set({
      artCart: {
        ...state.artCart,
        budgets: updatedBudgets,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  updateBudgetSpent: (category, spent) => {
    const state = get();
    if (!state.artCart) return;

    const updatedBudgets = state.artCart.budgets.map(b => {
      if (b.category !== category) return b;
      return {
        ...b,
        spent,
        remaining: b.allocated - spent - b.committed,
      };
    });

    set({
      artCart: {
        ...state.artCart,
        budgets: updatedBudgets,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  setTotalBudget: (amount, status) => {
    const state = get();
    if (!state.artCart) return;

    set({
      artCart: {
        ...state.artCart,
        totalBudgetAllocated: amount,
        totalBudgetStatus: status,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  calculateBudgetTotals: () => {
    const state = get();
    if (!state.artCart) return;

    // Calculate spent/committed from items
    const categoryTotals: Record<string, { spent: number; committed: number }> = {};

    state.artCart.items.forEach(item => {
      const category = item.category;
      if (!categoryTotals[category]) {
        categoryTotals[category] = { spent: 0, committed: 0 };
      }

      if (item.actualCost) {
        categoryTotals[category].spent += item.actualCost * item.quantity;
      } else if (item.estimatedCost && (item.status === 'Found' || item.status === 'Researching')) {
        categoryTotals[category].committed += item.estimatedCost * item.quantity;
      }
    });

    const updatedBudgets = state.artCart.budgets.map(b => {
      const totals = categoryTotals[b.category] || { spent: 0, committed: 0 };
      return {
        ...b,
        spent: totals.spent,
        committed: totals.committed,
        remaining: b.allocated - totals.spent - totals.committed,
      };
    });

    set({
      artCart: {
        ...state.artCart,
        budgets: updatedBudgets,
        updatedAt: new Date(),
      },
    });
  },

  // ============================================
  // VIEWFINDER ACTIONS
  // ============================================

  initializeViewFinder: () => {
    const state = get();
    if (state.viewFinder) return;

    const viewFinder: ViewFinder = {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      shots: [],
      storyboards: [],
      cameraPackages: [],
      sceneCoverage: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ viewFinder, isDirty: true });
  },

  importScenesForViewFinder: () => {
    const state = get();
    if (!state.viewFinder) {
      get().initializeViewFinder();
    }

    // Get scenes from breakdown or directly from screenplay
    const scenes = state.breakdownScenes.length > 0
      ? state.breakdownScenes
      : [];

    // Create scene coverage entries for each scene
    const sceneCoverage: SceneCoverage[] = scenes.map(scene => ({
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      shotCount: 0,
      completedShots: 0,
      estimatedDuration: 0,
      coverageComplete: false,
    }));

    set({
      viewFinder: {
        ...state.viewFinder!,
        sceneCoverage,
        importedFromBreakdownId: state.breakdown?.id,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  checkViewFinderScriptSync: () => {
    const state = get();
    if (!state.viewFinder) return;

    const latestVersionId = state.activeVersionId || 'main';
    const isOutdated = state.viewFinder.scriptSync.scriptVersionId !== latestVersionId;

    set({
      viewFinder: {
        ...state.viewFinder,
        scriptSync: {
          ...state.viewFinder.scriptSync,
          isOutdated,
          latestVersionId: isOutdated ? latestVersionId : undefined,
          latestVersionName: isOutdated ? 'Latest' : undefined,
        },
      },
    });
  },

  addShot: (shot) => {
    const state = get();
    const id = generateId();

    const newShot: Shot = {
      ...shot,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedViewFinder = state.viewFinder ? {
      ...state.viewFinder,
      shots: [...state.viewFinder.shots, newShot],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      shots: [newShot],
      storyboards: [],
      cameraPackages: [],
      sceneCoverage: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ viewFinder: updatedViewFinder, isDirty: true });
    get().calculateSceneCoverage();
    return id;
  },

  updateShot: (shotId, updates) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedShots = state.viewFinder.shots.map(shot =>
      shot.id === shotId ? { ...shot, ...updates, updatedAt: new Date() } : shot
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        shots: updatedShots,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    get().calculateSceneCoverage();
  },

  deleteShot: (shotId) => {
    const state = get();
    if (!state.viewFinder) return;

    set({
      viewFinder: {
        ...state.viewFinder,
        shots: state.viewFinder.shots.filter(shot => shot.id !== shotId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    get().calculateSceneCoverage();
  },

  setShotStatus: (shotId, status) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedShots = state.viewFinder.shots.map(shot =>
      shot.id === shotId ? { ...shot, status, updatedAt: new Date() } : shot
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        shots: updatedShots,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    get().calculateSceneCoverage();
  },

  reorderShots: (sceneId, shotIds) => {
    const state = get();
    if (!state.viewFinder) return;

    const sceneShots = state.viewFinder.shots.filter(s => s.sceneId === sceneId);
    const otherShots = state.viewFinder.shots.filter(s => s.sceneId !== sceneId);

    // Reorder scene shots based on shotIds array
    const reorderedSceneShots = shotIds
      .map((id, index) => {
        const shot = sceneShots.find(s => s.id === id);
        return shot ? { ...shot, priority: index + 1 } : null;
      })
      .filter((s): s is Shot => s !== null);

    set({
      viewFinder: {
        ...state.viewFinder,
        shots: [...otherShots, ...reorderedSceneShots],
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  duplicateShot: (shotId) => {
    const state = get();
    if (!state.viewFinder) return '';

    const sourceShot = state.viewFinder.shots.find(s => s.id === shotId);
    if (!sourceShot) return '';

    const id = generateId();
    const newShot: Shot = {
      ...sourceShot,
      id,
      shotNumber: sourceShot.shotNumber + '-copy',
      status: 'Planned',
      takes: undefined,
      selectedTake: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({
      viewFinder: {
        ...state.viewFinder,
        shots: [...state.viewFinder.shots, newShot],
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    get().calculateSceneCoverage();
    return id;
  },

  createStoryboard: (sceneId, sceneNumber) => {
    const state = get();
    const id = generateId();

    const newStoryboard: Storyboard = {
      id,
      sceneId,
      sceneNumber,
      frames: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedViewFinder = state.viewFinder ? {
      ...state.viewFinder,
      storyboards: [...state.viewFinder.storyboards, newStoryboard],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      shots: [],
      storyboards: [newStoryboard],
      cameraPackages: [],
      sceneCoverage: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ viewFinder: updatedViewFinder, isDirty: true });
    return id;
  },

  addStoryboardFrame: (storyboardId, frame) => {
    const state = get();
    if (!state.viewFinder) return '';

    const id = generateId();
    const newFrame: StoryboardFrame = {
      ...frame,
      id,
    };

    const updatedStoryboards = state.viewFinder.storyboards.map(sb =>
      sb.id === storyboardId
        ? { ...sb, frames: [...sb.frames, newFrame], updatedAt: new Date() }
        : sb
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        storyboards: updatedStoryboards,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    return id;
  },

  updateStoryboardFrame: (storyboardId, frameId, updates) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedStoryboards = state.viewFinder.storyboards.map(sb => {
      if (sb.id !== storyboardId) return sb;

      return {
        ...sb,
        frames: sb.frames.map(f =>
          f.id === frameId ? { ...f, ...updates } : f
        ),
        updatedAt: new Date(),
      };
    });

    set({
      viewFinder: {
        ...state.viewFinder,
        storyboards: updatedStoryboards,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteStoryboardFrame: (storyboardId, frameId) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedStoryboards = state.viewFinder.storyboards.map(sb => {
      if (sb.id !== storyboardId) return sb;

      return {
        ...sb,
        frames: sb.frames.filter(f => f.id !== frameId),
        updatedAt: new Date(),
      };
    });

    set({
      viewFinder: {
        ...state.viewFinder,
        storyboards: updatedStoryboards,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  reorderStoryboardFrames: (storyboardId, frameIds) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedStoryboards = state.viewFinder.storyboards.map(sb => {
      if (sb.id !== storyboardId) return sb;

      const reorderedFrames = frameIds
        .map((id, index) => {
          const frame = sb.frames.find(f => f.id === id);
          return frame ? { ...frame, order: index + 1 } : null;
        })
        .filter((f): f is StoryboardFrame => f !== null);

      return {
        ...sb,
        frames: reorderedFrames,
        updatedAt: new Date(),
      };
    });

    set({
      viewFinder: {
        ...state.viewFinder,
        storyboards: updatedStoryboards,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  linkFrameToShot: (storyboardId, frameId, shotId) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedStoryboards = state.viewFinder.storyboards.map(sb => {
      if (sb.id !== storyboardId) return sb;

      return {
        ...sb,
        frames: sb.frames.map(f =>
          f.id === frameId ? { ...f, shotId } : f
        ),
        updatedAt: new Date(),
      };
    });

    set({
      viewFinder: {
        ...state.viewFinder,
        storyboards: updatedStoryboards,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  addCameraPackage: (pkg) => {
    const state = get();
    const id = generateId();

    const newPackage: CameraPackage = {
      ...pkg,
      id,
    };

    const updatedViewFinder = state.viewFinder ? {
      ...state.viewFinder,
      cameraPackages: [...state.viewFinder.cameraPackages, newPackage],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      shots: [],
      storyboards: [],
      cameraPackages: [newPackage],
      sceneCoverage: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ viewFinder: updatedViewFinder, isDirty: true });
    return id;
  },

  updateCameraPackage: (packageId, updates) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedPackages = state.viewFinder.cameraPackages.map(pkg =>
      pkg.id === packageId ? { ...pkg, ...updates } : pkg
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        cameraPackages: updatedPackages,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteCameraPackage: (packageId) => {
    const state = get();
    if (!state.viewFinder) return;

    set({
      viewFinder: {
        ...state.viewFinder,
        cameraPackages: state.viewFinder.cameraPackages.filter(pkg => pkg.id !== packageId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  updateSceneCoverage: (sceneId, updates) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedCoverage = state.viewFinder.sceneCoverage.map(sc =>
      sc.sceneId === sceneId ? { ...sc, ...updates } : sc
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        sceneCoverage: updatedCoverage,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  markSceneCoverageComplete: (sceneId, complete) => {
    const state = get();
    if (!state.viewFinder) return;

    const updatedCoverage = state.viewFinder.sceneCoverage.map(sc =>
      sc.sceneId === sceneId ? { ...sc, coverageComplete: complete } : sc
    );

    set({
      viewFinder: {
        ...state.viewFinder,
        sceneCoverage: updatedCoverage,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  calculateSceneCoverage: () => {
    const state = get();
    if (!state.viewFinder) return;

    // Group shots by scene
    const shotsByScene = new Map<string, Shot[]>();
    state.viewFinder.shots.forEach(shot => {
      const existing = shotsByScene.get(shot.sceneId) || [];
      shotsByScene.set(shot.sceneId, [...existing, shot]);
    });

    // Update coverage for each scene
    const updatedCoverage = state.viewFinder.sceneCoverage.map(sc => {
      const sceneShots = shotsByScene.get(sc.sceneId) || [];
      const completedShots = sceneShots.filter(s => s.status === 'Completed').length;
      const estimatedDuration = sceneShots.reduce((sum, s) => sum + (s.duration || 0), 0);

      return {
        ...sc,
        shotCount: sceneShots.length,
        completedShots,
        estimatedDuration,
      };
    });

    set({
      viewFinder: {
        ...state.viewFinder,
        sceneCoverage: updatedCoverage,
      },
    });
  },

  selectViewFinderScene: (sceneId) => set({ selectedViewFinderSceneId: sceneId }),
  selectShot: (shotId) => set({ selectedShotId: shotId }),
  setViewFinderFilterStatus: (status) => set({ viewFinderFilterStatus: status }),

  getShotsByScene: (sceneId) => {
    const state = get();
    if (!state.viewFinder) return [];
    return state.viewFinder.shots
      .filter(s => s.sceneId === sceneId)
      .sort((a, b) => a.priority - b.priority);
  },

  getShotsByStatus: (status) => {
    const state = get();
    if (!state.viewFinder) return [];
    return state.viewFinder.shots.filter(s => s.status === status);
  },

  // ============================================
  // BASECAMP ACTIONS (Scheduling)
  // ============================================

  initializeSchedule: () => {
    const state = get();
    if (state.schedule) return;

    const schedule: Schedule = {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      strips: [],
      unscheduledStrips: [],
      shotPackages: [],
      unscheduledPackages: [],
      shootDays: [],
      dayBreaks: [],
      companyMoves: [],
      dood: [],
      totalShootDays: 0,
      defaultCallTime: '7:00 AM',
      defaultLunchDuration: 30,
      showLunchOnBoard: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ schedule, isDirty: true });
  },

  importStripsFromBreakdown: () => {
    const state = get();
    if (!state.schedule) {
      get().initializeSchedule();
    }

    // Convert breakdown scenes to strips
    const strips: SceneStrip[] = state.breakdownScenes.map(scene => {
      const colorKey = `${scene.intExt}-${scene.dayNight}`;
      const color = STRIP_COLOR_MAP[colorKey] || 'White';

      return {
        id: generateId(),
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        intExt: scene.intExt,
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        description: scene.description.substring(0, 50),
        pageCount: scene.eighths / 8,
        color: color as StripColor,
        castIds: scene.castIds,
        castNumbers: [],
        isLocked: false,
        hasStunts: false,
        hasVFX: false,
        hasSpecialEquipment: false,
      };
    });

    const stripIds = strips.map(s => s.id);

    set({
      schedule: {
        ...state.schedule!,
        strips,
        unscheduledStrips: stripIds,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  createShotPackagesFromViewFinder: () => {
    const state = get();
    if (!state.schedule || !state.viewFinder) return;

    // Group shots by scene
    const shotsByScene = new Map<string, typeof state.viewFinder.shots>();
    state.viewFinder.shots.forEach(shot => {
      const existing = shotsByScene.get(shot.sceneId) || [];
      shotsByScene.set(shot.sceneId, [...existing, shot]);
    });

    // Create one package per scene
    const packages: ShotPackage[] = [];
    shotsByScene.forEach((shots, sceneId) => {
      const scene = state.breakdownScenes.find(s => s.id === sceneId);
      if (!scene) return;

      packages.push({
        id: generateId(),
        name: `Scene ${scene.sceneNumber} Coverage`,
        sceneId,
        sceneNumber: scene.sceneNumber,
        shotIds: shots.map(s => s.id),
        estimatedDuration: shots.reduce((sum, s) => sum + (s.duration || 0), 0) / 60, // Convert to minutes
        equipment: [],
        castIds: scene.castIds,
      });
    });

    const packageIds = packages.map(p => p.id);

    set({
      schedule: {
        ...state.schedule,
        shotPackages: packages,
        unscheduledPackages: packageIds,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  addShootDay: () => {
    const state = get();
    if (!state.schedule) {
      get().initializeSchedule();
    }

    const id = generateId();
    const dayNumber = (state.schedule?.shootDays.length || 0) + 1;

    const newDay: ShootDay = {
      id,
      dayNumber,
      strips: [],
      shotPackages: [],
      callTime: state.schedule?.defaultCallTime || '7:00 AM',
      estimatedWrap: '7:00 PM',
      lunchDuration: state.schedule?.defaultLunchDuration || 30,
      isLocked: false,
      hasNightWork: false,
    };

    set({
      schedule: {
        ...state.schedule!,
        shootDays: [...state.schedule!.shootDays, newDay],
        totalShootDays: dayNumber,
        updatedAt: new Date(),
      },
      isDirty: true,
    });

    return id;
  },

  updateShootDay: (dayId, updates) => {
    const state = get();
    if (!state.schedule) return;

    const updatedDays = state.schedule.shootDays.map(day =>
      day.id === dayId ? { ...day, ...updates } : day
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteShootDay: (dayId) => {
    const state = get();
    if (!state.schedule) return;

    const day = state.schedule.shootDays.find(d => d.id === dayId);
    if (!day) return;

    // Move strips back to unscheduled
    const unassignedStrips = [...state.schedule.unscheduledStrips, ...day.strips];
    const unassignedPackages = [...state.schedule.unscheduledPackages, ...day.shotPackages];

    // Remove day and renumber
    const remainingDays = state.schedule.shootDays
      .filter(d => d.id !== dayId)
      .map((d, index) => ({ ...d, dayNumber: index + 1 }));

    set({
      schedule: {
        ...state.schedule,
        shootDays: remainingDays,
        unscheduledStrips: unassignedStrips,
        unscheduledPackages: unassignedPackages,
        totalShootDays: remainingDays.length,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  reorderShootDays: (dayIds) => {
    const state = get();
    if (!state.schedule) return;

    const reorderedDays = dayIds
      .map((id, index) => {
        const day = state.schedule!.shootDays.find(d => d.id === id);
        return day ? { ...day, dayNumber: index + 1 } : null;
      })
      .filter((d): d is ShootDay => d !== null);

    set({
      schedule: {
        ...state.schedule,
        shootDays: reorderedDays,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  updateStrip: (stripId, updates) => {
    const state = get();
    if (!state.schedule) return;

    const updatedStrips = state.schedule.strips.map(strip =>
      strip.id === stripId ? { ...strip, ...updates } : strip
    );

    set({
      schedule: {
        ...state.schedule,
        strips: updatedStrips,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  assignStripToDay: (stripId, dayId, position) => {
    const state = get();
    if (!state.schedule) return;

    const strip = state.schedule.strips.find(s => s.id === stripId);
    if (!strip || strip.isLocked) return;

    // Remove from current location
    const updatedDays = state.schedule.shootDays.map(day => ({
      ...day,
      strips: day.strips.filter(id => id !== stripId),
    }));

    // Add to target day
    const targetDay = updatedDays.find(d => d.id === dayId);
    if (targetDay) {
      if (position !== undefined) {
        targetDay.strips.splice(position, 0, stripId);
      } else {
        targetDay.strips.push(stripId);
      }
    }

    // Remove from unscheduled
    const unscheduledStrips = state.schedule.unscheduledStrips.filter(id => id !== stripId);

    // Update strip's scheduled day
    const updatedStrips = state.schedule.strips.map(s =>
      s.id === stripId ? { ...s, scheduledDayId: dayId } : s
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        strips: updatedStrips,
        unscheduledStrips,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  unassignStrip: (stripId) => {
    const state = get();
    if (!state.schedule) return;

    const strip = state.schedule.strips.find(s => s.id === stripId);
    if (!strip || strip.isLocked) return;

    // Remove from all days
    const updatedDays = state.schedule.shootDays.map(day => ({
      ...day,
      strips: day.strips.filter(id => id !== stripId),
    }));

    // Add to unscheduled
    const unscheduledStrips = [...state.schedule.unscheduledStrips, stripId];

    // Update strip
    const updatedStrips = state.schedule.strips.map(s =>
      s.id === stripId ? { ...s, scheduledDayId: undefined } : s
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        strips: updatedStrips,
        unscheduledStrips,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  reorderStripsInDay: (dayId, stripIds) => {
    const state = get();
    if (!state.schedule) return;

    const updatedDays = state.schedule.shootDays.map(day =>
      day.id === dayId ? { ...day, strips: stripIds } : day
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  lockStrip: (stripId, locked) => {
    const state = get();
    if (!state.schedule) return;

    const updatedStrips = state.schedule.strips.map(strip =>
      strip.id === stripId ? { ...strip, isLocked: locked } : strip
    );

    set({
      schedule: {
        ...state.schedule,
        strips: updatedStrips,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  createShotPackage: (sceneId, name, shotIds) => {
    const state = get();
    if (!state.schedule) {
      get().initializeSchedule();
    }

    const id = generateId();
    const scene = state.breakdownScenes.find(s => s.id === sceneId);

    const newPackage: ShotPackage = {
      id,
      name,
      sceneId,
      sceneNumber: scene?.sceneNumber || '',
      shotIds,
      estimatedDuration: 0,
      equipment: [],
      castIds: scene?.castIds || [],
    };

    set({
      schedule: {
        ...state.schedule!,
        shotPackages: [...state.schedule!.shotPackages, newPackage],
        unscheduledPackages: [...state.schedule!.unscheduledPackages, id],
        updatedAt: new Date(),
      },
      isDirty: true,
    });

    return id;
  },

  updateShotPackage: (packageId, updates) => {
    const state = get();
    if (!state.schedule) return;

    const updatedPackages = state.schedule.shotPackages.map(pkg =>
      pkg.id === packageId ? { ...pkg, ...updates } : pkg
    );

    set({
      schedule: {
        ...state.schedule,
        shotPackages: updatedPackages,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteShotPackage: (packageId) => {
    const state = get();
    if (!state.schedule) return;

    // Remove from days
    const updatedDays = state.schedule.shootDays.map(day => ({
      ...day,
      shotPackages: day.shotPackages.filter(id => id !== packageId),
    }));

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        shotPackages: state.schedule.shotPackages.filter(p => p.id !== packageId),
        unscheduledPackages: state.schedule.unscheduledPackages.filter(id => id !== packageId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  assignPackageToDay: (packageId, dayId, position) => {
    const state = get();
    if (!state.schedule) return;

    // Remove from current location
    const updatedDays = state.schedule.shootDays.map(day => ({
      ...day,
      shotPackages: day.shotPackages.filter(id => id !== packageId),
    }));

    // Add to target day
    const targetDay = updatedDays.find(d => d.id === dayId);
    if (targetDay) {
      if (position !== undefined) {
        targetDay.shotPackages.splice(position, 0, packageId);
      } else {
        targetDay.shotPackages.push(packageId);
      }
    }

    // Remove from unscheduled
    const unscheduledPackages = state.schedule.unscheduledPackages.filter(id => id !== packageId);

    // Update package
    const updatedPackages = state.schedule.shotPackages.map(p =>
      p.id === packageId ? { ...p, scheduledDayId: dayId } : p
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        shotPackages: updatedPackages,
        unscheduledPackages,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  unassignPackage: (packageId) => {
    const state = get();
    if (!state.schedule) return;

    // Remove from all days
    const updatedDays = state.schedule.shootDays.map(day => ({
      ...day,
      shotPackages: day.shotPackages.filter(id => id !== packageId),
    }));

    // Add to unscheduled
    const unscheduledPackages = [...state.schedule.unscheduledPackages, packageId];

    // Update package
    const updatedPackages = state.schedule.shotPackages.map(p =>
      p.id === packageId ? { ...p, scheduledDayId: undefined } : p
    );

    set({
      schedule: {
        ...state.schedule,
        shootDays: updatedDays,
        shotPackages: updatedPackages,
        unscheduledPackages,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  splitPackage: (packageId, shotIds, newName) => {
    const state = get();
    if (!state.schedule) return '';

    const originalPackage = state.schedule.shotPackages.find(p => p.id === packageId);
    if (!originalPackage) return '';

    const newId = generateId();

    // Create new package with selected shots
    const newPackage: ShotPackage = {
      id: newId,
      name: newName,
      sceneId: originalPackage.sceneId,
      sceneNumber: originalPackage.sceneNumber,
      shotIds,
      estimatedDuration: 0,
      equipment: originalPackage.equipment,
      castIds: originalPackage.castIds,
      splitFromPackageId: packageId,
    };

    // Remove shots from original package
    const updatedOriginal = {
      ...originalPackage,
      shotIds: originalPackage.shotIds.filter(id => !shotIds.includes(id)),
    };

    const updatedPackages = state.schedule.shotPackages.map(p =>
      p.id === packageId ? updatedOriginal : p
    );

    set({
      schedule: {
        ...state.schedule,
        shotPackages: [...updatedPackages, newPackage],
        unscheduledPackages: [...state.schedule.unscheduledPackages, newId],
        updatedAt: new Date(),
      },
      isDirty: true,
    });

    return newId;
  },

  updateDOOD: (castId, dayId, status) => {
    const state = get();
    if (!state.schedule) return;

    const day = state.schedule.shootDays.find(d => d.id === dayId);
    if (!day) return;

    const updatedDOOD = state.schedule.dood.map(entry => {
      if (entry.castId !== castId) return entry;

      const updatedStatuses = entry.dayStatuses.map(ds =>
        ds.dayId === dayId ? { ...ds, status } : ds
      );

      // Add if not exists
      if (!updatedStatuses.find(ds => ds.dayId === dayId)) {
        updatedStatuses.push({ dayId, dayNumber: day.dayNumber, status });
      }

      return { ...entry, dayStatuses: updatedStatuses };
    });

    set({
      schedule: {
        ...state.schedule,
        dood: updatedDOOD,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  recalculateDOOD: () => {
    const state = get();
    if (!state.schedule || !state.breakdown) return;

    // Get all cast from breakdown
    const allCast = state.breakdown.castList || [];

    // Build DOOD entries
    const dood: DOODEntry[] = allCast.map(cast => {
      const dayStatuses: DOODEntry['dayStatuses'] = state.schedule!.shootDays.map(day => {
        // Check if cast is needed in any strips scheduled for this day
        const isWorking = day.strips.some(stripId => {
          const strip = state.schedule!.strips.find(s => s.id === stripId);
          return strip?.castIds.includes(cast.id);
        });

        return {
          dayId: day.id,
          dayNumber: day.dayNumber,
          status: isWorking ? 'W' : '' as DOODStatus,
        };
      });

      return {
        castId: cast.id,
        castName: cast.actorName || cast.characterName,
        characterName: cast.characterName,
        dayStatuses,
      };
    });

    set({
      schedule: {
        ...state.schedule,
        dood,
        updatedAt: new Date(),
      },
    });
  },

  updateScheduleSettings: (settings) => {
    const state = get();
    if (!state.schedule) return;

    set({
      schedule: {
        ...state.schedule,
        ...settings,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  selectShootDay: (dayId) => set({ selectedShootDayId: dayId }),
  selectStrip: (stripId) => set({ selectedStripId: stripId }),

  // PRODUCTION MANAGEMENT ACTIONS
  setBasecampView: (view) => set({ basecampView: view }),

  initializeProductionData: () => {
    const state = get();
    if (state.productionData.departments.length > 0) return;
    set({
      productionData: {
        ...state.productionData,
        departments: DEFAULT_DEPARTMENTS.map((d, i) => ({ ...d, id: `dept-default-${i}` })),
      },
    });
  },

  addPerson: (person) => {
    const state = get();
    const id = generateId();
    const colorIndex = state.productionData.people.length % AVATAR_COLORS.length;
    const newPerson: ProductionPerson = { ...person, id, avatarColor: AVATAR_COLORS[colorIndex] };
    set({
      productionData: {
        ...state.productionData,
        people: [...state.productionData.people, newPerson],
      },
      isDirty: true,
    });
    return id;
  },

  updatePerson: (id, updates) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        people: state.productionData.people.map(p => p.id === id ? { ...p, ...updates } : p),
      },
      isDirty: true,
    });
  },

  deletePerson: (id) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        people: state.productionData.people.filter(p => p.id !== id),
      },
      isDirty: true,
    });
  },

  addLocation: (location) => {
    const state = get();
    const id = generateId();
    const newLocation: ProductionLocation = { ...location, id };
    set({
      productionData: {
        ...state.productionData,
        locations: [...state.productionData.locations, newLocation],
      },
      isDirty: true,
    });
    return id;
  },

  updateLocation: (id, updates) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        locations: state.productionData.locations.map(l => l.id === id ? { ...l, ...updates } : l),
      },
      isDirty: true,
    });
  },

  deleteLocation: (id) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        locations: state.productionData.locations.filter(l => l.id !== id),
      },
      isDirty: true,
    });
  },

  addProductionScene: (scene) => {
    const state = get();
    const id = generateId();
    const newScene: ProductionScene = { ...scene, id };
    set({
      productionData: {
        ...state.productionData,
        scenes: [...state.productionData.scenes, newScene],
      },
      isDirty: true,
    });
    return id;
  },

  updateProductionScene: (id, updates) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        scenes: state.productionData.scenes.map(s => s.id === id ? { ...s, ...updates } : s),
      },
      isDirty: true,
    });
  },

  deleteProductionScene: (id) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        scenes: state.productionData.scenes.filter(s => s.id !== id),
      },
      isDirty: true,
    });
  },

  addDepartment: (name) => {
    const state = get();
    const id = generateId();
    const newDept: Department = { id, name, positions: [] };
    set({
      productionData: {
        ...state.productionData,
        departments: [...state.productionData.departments, newDept],
      },
      isDirty: true,
    });
    return id;
  },

  updateDepartment: (id, updates) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        departments: state.productionData.departments.map(d => d.id === id ? { ...d, ...updates } : d),
      },
      isDirty: true,
    });
  },

  deleteDepartment: (id) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        departments: state.productionData.departments.filter(d => d.id !== id),
      },
      isDirty: true,
    });
  },

  addPosition: (departmentId, position) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        departments: state.productionData.departments.map(d =>
          d.id === departmentId
            ? { ...d, positions: [...d.positions, position] }
            : d
        ),
      },
      isDirty: true,
    });
  },

  removePosition: (departmentId, position) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        departments: state.productionData.departments.map(d =>
          d.id === departmentId
            ? { ...d, positions: d.positions.filter(p => p !== position) }
            : d
        ),
      },
      isDirty: true,
    });
  },

  addCallSheet: (callSheet) => {
    const state = get();
    const id = generateId();
    const newCS: CallSheet = { ...callSheet, id, createdAt: new Date(), updatedAt: new Date() };
    set({
      productionData: {
        ...state.productionData,
        callSheets: [...state.productionData.callSheets, newCS],
      },
      isDirty: true,
    });
    return id;
  },

  updateCallSheet: (id, updates) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        callSheets: state.productionData.callSheets.map(cs =>
          cs.id === id ? { ...cs, ...updates, updatedAt: new Date() } : cs
        ),
      },
      isDirty: true,
    });
  },

  deleteCallSheet: (id) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        callSheets: state.productionData.callSheets.filter(cs => cs.id !== id),
      },
      isDirty: true,
    });
  },

  updateProductionSettings: (settings) => {
    const state = get();
    set({
      productionData: {
        ...state.productionData,
        settings: { ...state.productionData.settings, ...settings },
      },
      isDirty: true,
    });
  },

  // ONSET ACTIONS
  initializeOnSet: () => {
    const state = get();
    if (state.onSet) return;

    const onSet: OnSet = {
      productionStatus: null,
      displaySettings: {
        showLunchCountdown: state.schedule?.showLunchOnBoard ?? true,
        showProgressBar: true,
        showNextShot: true,
        showStoryboard: false,
        autoAdvance: true,
        fontSize: 'large',
      },
      viewMode: 'control',
      lunchStatus: null,
      delays: [],
      isLive: false,
    };

    set({ onSet, isDirty: true });
  },

  setOnSetViewMode: (mode) => {
    const state = get();
    if (!state.onSet) {
      get().initializeOnSet();
    }

    set({
      onSet: {
        ...state.onSet!,
        viewMode: mode,
      },
    });
  },

  updateOnSetDisplaySettings: (settings) => {
    const state = get();
    if (!state.onSet) return;

    set({
      onSet: {
        ...state.onSet,
        displaySettings: {
          ...state.onSet.displaySettings,
          ...settings,
        },
      },
      isDirty: true,
    });
  },

  startProductionDay: (dayId) => {
    const state = get();
    if (!state.onSet) {
      get().initializeOnSet();
    }

    const productionStatus: ProductionStatus = {
      currentDayId: dayId,
      currentStripIndex: 0,
      currentShotPackageIndex: 0,
      dayStartedAt: new Date(),
      completedStrips: [],
      completedPackages: [],
      actualTimes: [],
      aheadBehind: 0,
      lastUpdated: new Date(),
    };

    set({
      onSet: {
        ...state.onSet!,
        productionStatus,
        isLive: true,
      },
      isDirty: true,
    });
  },

  markStripComplete: (stripId) => {
    const state = get();
    const onSetState = state.onSet;
    const prodStatus = onSetState?.productionStatus;
    if (!onSetState || !prodStatus) return;

    const completedStrips = [...prodStatus.completedStrips, stripId];
    const currentDay = state.schedule?.shootDays.find(d => d.id === prodStatus.currentDayId);
    const nextIndex = currentDay ? currentDay.strips.indexOf(stripId) + 1 : prodStatus.currentStripIndex + 1;

    set({
      onSet: {
        ...onSetState,
        productionStatus: {
          ...prodStatus,
          completedStrips,
          currentStripIndex: nextIndex,
          lastUpdated: new Date(),
        },
      },
      isDirty: true,
    });
  },

  markStripInProgress: (stripId) => {
    const state = get();
    const onSetState = state.onSet;
    const prodStatus = onSetState?.productionStatus;
    if (!onSetState || !prodStatus) return;

    const currentDay = state.schedule?.shootDays.find(d => d.id === prodStatus.currentDayId);
    const stripIndex = currentDay ? currentDay.strips.indexOf(stripId) : 0;

    set({
      onSet: {
        ...onSetState,
        productionStatus: {
          ...prodStatus,
          currentStripIndex: stripIndex,
          currentSetupStartedAt: new Date(),
          lastUpdated: new Date(),
        },
      },
      isDirty: true,
    });
  },

  startLunch: () => {
    const state = get();
    if (!state.onSet) return;

    const lunchStatus: LunchStatus = {
      isOnLunch: true,
      lunchStartedAt: new Date(),
      scheduledDuration: state.schedule?.defaultLunchDuration || 30,
    };

    set({
      onSet: {
        ...state.onSet,
        lunchStatus,
      },
      isDirty: true,
    });
  },

  endLunch: () => {
    const state = get();
    if (!state.onSet?.lunchStatus) return;

    const startedAt = state.onSet.lunchStatus.lunchStartedAt;
    const actualDuration = startedAt
      ? Math.round((new Date().getTime() - new Date(startedAt).getTime()) / 60000)
      : 0;

    set({
      onSet: {
        ...state.onSet,
        lunchStatus: {
          ...state.onSet.lunchStatus,
          isOnLunch: false,
          actualDuration,
        },
      },
      isDirty: true,
    });
  },

  addDelay: (reason, category, notes) => {
    const state = get();
    if (!state.onSet) {
      get().initializeOnSet();
    }

    const id = generateId();
    const delay: DelayEntry = {
      id,
      reason,
      category,
      notes,
      startedAt: new Date(),
    };

    set({
      onSet: {
        ...state.onSet!,
        delays: [...state.onSet!.delays, delay],
      },
      isDirty: true,
    });

    return id;
  },

  endDelay: (delayId) => {
    const state = get();
    if (!state.onSet) return;

    const delays = state.onSet.delays.map(d => {
      if (d.id === delayId && !d.endedAt) {
        const duration = Math.round((new Date().getTime() - new Date(d.startedAt).getTime()) / 60000);
        return { ...d, endedAt: new Date(), duration };
      }
      return d;
    });

    set({
      onSet: {
        ...state.onSet,
        delays,
      },
      isDirty: true,
    });
  },

  updateAheadBehind: () => {
    const state = get();
    const onSetState = state.onSet;
    const prodStatus = onSetState?.productionStatus;
    if (!onSetState || !prodStatus || !state.schedule) return;

    // Simple calculation: compare completed strips to expected progress
    const currentDay = state.schedule.shootDays.find(d => d.id === prodStatus.currentDayId);
    if (!currentDay) return;

    const completedCount = prodStatus.completedStrips.length;

    // If day started, calculate expected progress based on elapsed time
    const dayStarted = prodStatus.dayStartedAt;
    if (!dayStarted) return;

    const elapsedMinutes = (new Date().getTime() - new Date(dayStarted).getTime()) / 60000;
    const expectedPerStrip = 60; // Assume 1 hour per strip as baseline (would be calculated from estimates)
    const expectedProgress = elapsedMinutes / expectedPerStrip;
    const aheadBehind = Math.round((completedCount - expectedProgress) * expectedPerStrip);

    set({
      onSet: {
        ...onSetState,
        productionStatus: {
          ...prodStatus,
          aheadBehind,
          lastUpdated: new Date(),
        },
      },
    });
  },

  goLive: () => {
    const state = get();
    if (!state.onSet) {
      get().initializeOnSet();
    }

    set({
      onSet: {
        ...state.onSet!,
        isLive: true,
      },
    });
  },

  goOffline: () => {
    const state = get();
    if (!state.onSet) return;

    set({
      onSet: {
        ...state.onSet,
        isLive: false,
      },
    });
  },

  getQuickStatus: () => {
    const state = get();
    const onSetState = state.onSet;
    const prodStatus = onSetState?.productionStatus;
    if (!onSetState || !prodStatus || !state.schedule) return null;

    const currentDay = state.schedule.shootDays.find(d => d.id === prodStatus.currentDayId);
    if (!currentDay) return null;

    const currentStripId = currentDay.strips[prodStatus.currentStripIndex];
    const currentStrip = state.schedule.strips.find(s => s.id === currentStripId);
    const nextStripId = currentDay.strips[prodStatus.currentStripIndex + 1];
    const nextStrip = nextStripId ? state.schedule.strips.find(s => s.id === nextStripId) : null;

    const aheadBehindNum = prodStatus.aheadBehind;
    const aheadBehind = aheadBehindNum >= 0 ? `+${aheadBehindNum} min` : `${aheadBehindNum} min`;

    // Calculate lunch countdown if on lunch
    let lunchCountdown: string | undefined;
    if (onSetState.lunchStatus?.isOnLunch && onSetState.lunchStatus.lunchStartedAt) {
      const elapsed = (new Date().getTime() - new Date(onSetState.lunchStatus.lunchStartedAt).getTime()) / 60000;
      const remaining = onSetState.lunchStatus.scheduledDuration - elapsed;
      if (remaining > 0) {
        const mins = Math.floor(remaining);
        const secs = Math.floor((remaining - mins) * 60);
        lunchCountdown = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    }

    return {
      currentScene: currentStrip ? `Scene ${currentStrip.sceneNumber}` : 'N/A',
      currentSetup: currentStrip ? `${currentStrip.intExt}. ${currentStrip.location}` : '',
      estimatedWrap: currentDay.estimatedWrap,
      aheadBehind,
      nextUp: nextStrip ? `Scene ${nextStrip.sceneNumber}` : 'Wrap',
      isOnLunch: onSetState.lunchStatus?.isOnLunch || false,
      lunchCountdown,
    };
  },

  // SUPERVISOR ACTIONS
  initializeSuperVisor: () => {
    const state = get();
    if (state.superVisor) return;

    const superVisor: SuperVisor = {
      currentSession: null,
      sessions: [],
      continuityLogs: [],
      dailyReports: [],
      currentSlate: null,
      selectedSceneId: null,
      selectedShotId: null,
      filterCamera: 'All',
    };

    set({ superVisor, isDirty: true });
  },

  startSupervisorSession: (shootDayId) => {
    const state = get();
    if (!state.superVisor) {
      get().initializeSuperVisor();
    }

    const id = generateId();
    const session: SupervisorSession = {
      id,
      shootDayId,
      date: new Date(),
      takes: [],
      coverage: [],
      totalSetups: 0,
      totalTakes: 0,
      totalPrints: 0,
      exportedToEditor: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({
      superVisor: {
        ...state.superVisor!,
        currentSession: session,
        sessions: [...state.superVisor!.sessions, session],
      },
      isDirty: true,
    });

    return id;
  },

  endSupervisorSession: () => {
    const state = get();
    if (!state.superVisor?.currentSession) return;

    set({
      superVisor: {
        ...state.superVisor,
        currentSession: null,
      },
      isDirty: true,
    });
  },

  setCurrentSlate: (slate) => {
    const state = get();
    if (!state.superVisor) {
      get().initializeSuperVisor();
    }

    set({
      superVisor: {
        ...state.superVisor!,
        currentSlate: state.superVisor!.currentSlate
          ? { ...state.superVisor!.currentSlate, ...slate }
          : {
              scene: slate.scene || '',
              shot: slate.shot || '',
              take: slate.take || 1,
              camera: slate.camera || 'A',
              roll: slate.roll || '',
              date: slate.date || new Date(),
            },
      },
    });
  },

  logTake: (take) => {
    const state = get();
    const superVisorState = state.superVisor;
    const session = superVisorState?.currentSession;
    if (!superVisorState || !session) return '';

    const id = generateId();
    const newTake: TakeEntry = {
      ...take,
      id,
      createdAt: new Date(),
    };

    const updatedSession = {
      ...session,
      takes: [...session.takes, newTake],
      totalTakes: session.totalTakes + 1,
      totalPrints: take.circled ? session.totalPrints + 1 : session.totalPrints,
      updatedAt: new Date(),
    };

    // Update sessions array too
    const updatedSessions = superVisorState.sessions.map(s =>
      s.id === session.id ? updatedSession : s
    );

    set({
      superVisor: {
        ...superVisorState,
        currentSession: updatedSession,
        sessions: updatedSessions,
        currentSlate: superVisorState.currentSlate
          ? { ...superVisorState.currentSlate, take: superVisorState.currentSlate.take + 1 }
          : null,
      },
      isDirty: true,
    });

    return id;
  },

  updateTake: (takeId, updates) => {
    const state = get();
    const superVisorState = state.superVisor;
    const session = superVisorState?.currentSession;
    if (!superVisorState || !session) return;

    const updatedTakes = session.takes.map(t =>
      t.id === takeId ? { ...t, ...updates } : t
    );

    const updatedSession = {
      ...session,
      takes: updatedTakes,
      updatedAt: new Date(),
    };

    const updatedSessions = superVisorState.sessions.map(s =>
      s.id === session.id ? updatedSession : s
    );

    set({
      superVisor: {
        ...superVisorState,
        currentSession: updatedSession,
        sessions: updatedSessions,
      },
      isDirty: true,
    });
  },

  deleteTake: (takeId) => {
    const state = get();
    const superVisorState = state.superVisor;
    const session = superVisorState?.currentSession;
    if (!superVisorState || !session) return;

    const takeToDelete = session.takes.find(t => t.id === takeId);
    const updatedTakes = session.takes.filter(t => t.id !== takeId);

    const updatedSession = {
      ...session,
      takes: updatedTakes,
      totalTakes: session.totalTakes - 1,
      totalPrints: takeToDelete?.circled ? session.totalPrints - 1 : session.totalPrints,
      updatedAt: new Date(),
    };

    const updatedSessions = superVisorState.sessions.map(s =>
      s.id === session.id ? updatedSession : s
    );

    set({
      superVisor: {
        ...superVisorState,
        currentSession: updatedSession,
        sessions: updatedSessions,
      },
      isDirty: true,
    });
  },

  circleTake: (takeId, circled) => {
    const state = get();
    const superVisorState = state.superVisor;
    const session = superVisorState?.currentSession;
    if (!superVisorState || !session) return;

    const take = session.takes.find(t => t.id === takeId);
    if (!take || take.circled === circled) return;

    const updatedTakes = session.takes.map(t =>
      t.id === takeId ? { ...t, circled, rating: circled ? 'Print' as const : '' as const } : t
    );

    const updatedSession = {
      ...session,
      takes: updatedTakes,
      totalPrints: circled ? session.totalPrints + 1 : session.totalPrints - 1,
      updatedAt: new Date(),
    };

    const updatedSessions = superVisorState.sessions.map(s =>
      s.id === session.id ? updatedSession : s
    );

    set({
      superVisor: {
        ...superVisorState,
        currentSession: updatedSession,
        sessions: updatedSessions,
      },
      isDirty: true,
    });
  },

  addContinuityLog: (sceneId) => {
    const state = get();
    if (!state.superVisor) {
      get().initializeSuperVisor();
    }

    const scene = state.breakdownScenes.find(s => s.id === sceneId);
    const id = generateId();
    const log: ContinuityLog = {
      id,
      sceneId,
      sceneNumber: scene?.sceneNumber || '',
      wardrobeNotes: '',
      propsNotes: '',
      hairMakeupNotes: '',
      actionNotes: '',
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({
      superVisor: {
        ...state.superVisor!,
        continuityLogs: [...state.superVisor!.continuityLogs, log],
      },
      isDirty: true,
    });

    return id;
  },

  updateContinuityLog: (logId, updates) => {
    const state = get();
    if (!state.superVisor) return;

    const updatedLogs = state.superVisor.continuityLogs.map(log =>
      log.id === logId ? { ...log, ...updates, updatedAt: new Date() } : log
    );

    set({
      superVisor: {
        ...state.superVisor,
        continuityLogs: updatedLogs,
      },
      isDirty: true,
    });
  },

  generateDailyReport: (shootDayId) => {
    const state = get();
    if (!state.superVisor) {
      get().initializeSuperVisor();
    }

    const session = state.superVisor!.sessions.find(s => s.shootDayId === shootDayId);
    if (!session) return '';

    // Gather takes by camera
    const cameraMap = new Map<string, { takes: number; prints: number }>();
    session.takes.forEach(take => {
      const existing = cameraMap.get(take.camera) || { takes: 0, prints: 0 };
      cameraMap.set(take.camera, {
        takes: existing.takes + 1,
        prints: take.circled ? existing.prints + 1 : existing.prints,
      });
    });

    const cameraInventory = Array.from(cameraMap.entries()).map(([camera, stats]) => ({
      camera,
      takes: stats.takes,
      prints: stats.prints,
    }));

    // Get unique scenes
    const scenesSet = new Set(session.takes.map(t => t.sceneNumber));

    const id = generateId();
    const report: DailyReport = {
      id,
      shootDayId,
      date: session.date,
      scenesCompleted: Array.from(scenesSet),
      scenesPartial: [],
      pagesShot: 0, // Would calculate from schedule
      minutesShot: 0,
      setupsTotal: session.totalSetups,
      takesTotal: session.totalTakes,
      printsTotal: session.totalPrints,
      ngTotal: session.takes.filter(t => t.rating === 'NG').length,
      cameraInventory,
      productionNotes: session.notes || '',
      editorNotes: '',
      approved: false,
    };

    set({
      superVisor: {
        ...state.superVisor!,
        dailyReports: [...state.superVisor!.dailyReports, report],
      },
      isDirty: true,
    });

    return id;
  },

  approveDailyReport: (reportId, approvedBy) => {
    const state = get();
    if (!state.superVisor) return;

    const updatedReports = state.superVisor.dailyReports.map(report =>
      report.id === reportId
        ? { ...report, approved: true, approvedBy, approvedAt: new Date() }
        : report
    );

    set({
      superVisor: {
        ...state.superVisor,
        dailyReports: updatedReports,
      },
      isDirty: true,
    });
  },

  selectSuperVisorScene: (sceneId) => {
    const state = get();
    if (!state.superVisor) return;

    set({
      superVisor: {
        ...state.superVisor,
        selectedSceneId: sceneId,
      },
    });
  },

  selectSuperVisorShot: (shotId) => {
    const state = get();
    if (!state.superVisor) return;

    set({
      superVisor: {
        ...state.superVisor,
        selectedShotId: shotId,
      },
    });
  },

  setSuperVisorCameraFilter: (camera) => {
    const state = get();
    if (!state.superVisor) return;

    set({
      superVisor: {
        ...state.superVisor,
        filterCamera: camera,
      },
    });
  },

  getTakesForScene: (sceneNumber) => {
    const state = get();
    if (!state.superVisor?.currentSession) return [];
    return state.superVisor.currentSession.takes.filter(t => t.sceneNumber === sceneNumber);
  },

  getTakesForShot: (shotId) => {
    const state = get();
    if (!state.superVisor?.currentSession) return [];
    return state.superVisor.currentSession.takes.filter(t => t.shotId === shotId);
  },

  getCircledTakes: () => {
    const state = get();
    if (!state.superVisor?.currentSession) return [];
    return state.superVisor.currentSession.takes.filter(t => t.circled);
  },

  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

  setTheme: (themeId: ThemeId) => set(() => ({ activeTheme: themeId })),

  // Project Data actions (for cloud storage)
  loadFromProjectData: (data) => {
    const stats = calculateWritingStats(data.screenplay);
    set({
      screenplay: data.screenplay,
      storyOutline: data.storyOutline || get().storyOutline,
      beatBoards: data.beatBoards || [],
      versions: data.versions || [],
      scriptNotes: data.scriptNotes || [],
      splitContent: data.splitContent || get().splitContent,
      breakdown: data.breakdown || null,
      artCart: data.artCart || null,
      viewFinder: data.viewFinder || null,
      schedule: data.schedule || null,
      onSet: data.onSet || null,
      superVisor: data.superVisor || null,
      showSceneNumbers: data.showSceneNumbers ?? false,
      sceneNumberStyle: data.sceneNumberStyle || 'numeric',
      pageLocks: data.pageLocks || [],
      watermarkSettings: data.watermarkSettings || get().watermarkSettings,
      selectedElementId: data.screenplay.elements[0]?.id || null,
      isDirty: false,
      fileName: `${data.screenplay.title || 'Untitled'}.fdx`,
      stats,
      history: [],
      future: [],
    });
  },

  resetToNew: () => {
    const newScript = createNewScreenplay();
    const stats = calculateWritingStats(newScript);
    set({
      screenplay: newScript,
      selectedElementId: newScript.elements[0]?.id || null,
      isDirty: false,
      fileName: 'Untitled.fdx',
      stats,
      currentPage: 1,
      history: [],
      future: [],
      storyOutline: {
        plot: {
          title: '',
          logline: '',
          themes: '',
          storyTypes: [],
          genres: [],
          tones: [],
          audience: '',
          setting: '',
          bStory: '',
          otherDetails: '',
        },
        characters: [],
        acts: {
          act1: '',
          act2a: '',
          act2b: '',
          act3: '',
        },
        beats: DEFAULT_BEAT_STRUCTURE.map((beat, index) => ({
          id: `beat-${index}`,
          name: beat.name,
          act: beat.act,
          description: '',
          linkedSceneId: undefined,
        })),
      },
      beatBoards: [],
      activeBeatBoardId: null,
      versions: [],
      activeVersionId: null,
      scriptNotes: [],
      splitContent: {
        audio: [],
        video: [],
        isIndependent: false,
        swapped: false,
      },
      breakdown: null,
      breakdownScenes: [],
      selectedBreakdownCategory: null,
      selectedBreakdownSceneId: null,
      artCart: null,
      selectedArtCartCategory: null,
      selectedArtCartItemId: null,
      artCartFilterStatus: 'All',
      viewFinder: null,
      selectedViewFinderSceneId: null,
      selectedShotId: null,
      viewFinderFilterStatus: 'All',
      schedule: null,
      selectedShootDayId: null,
      selectedStripId: null,
      onSet: null,
      superVisor: null,
      showSceneNumbers: false,
      pageLocks: [],
    });
  },

  getProjectData: () => {
    const state = get();
    return {
      screenplay: state.screenplay,
      storyOutline: state.storyOutline,
      beatBoards: state.beatBoards,
      versions: state.versions,
      scriptNotes: state.scriptNotes,
      splitContent: state.splitContent,
      breakdown: state.breakdown || undefined,
      artCart: state.artCart || undefined,
      viewFinder: state.viewFinder || undefined,
      schedule: state.schedule || undefined,
      onSet: state.onSet || undefined,
      superVisor: state.superVisor || undefined,
      showSceneNumbers: state.showSceneNumbers,
      sceneNumberStyle: state.sceneNumberStyle,
      pageLocks: state.pageLocks,
      watermarkSettings: state.watermarkSettings,
      version: 1,
      savedAt: new Date(),
    };
  },
}));
