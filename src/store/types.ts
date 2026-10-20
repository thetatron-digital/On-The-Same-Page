// Types for the OTSP store. Each app owns one slice; ScreenplayState is their union.
import type { ProductionCalendar } from '../engine/schedule/calendar';
import type { DOODSettings } from '../engine/schedule/dood';
import type { AutoDayBreakOptions, SortDirection } from '../engine/schedule/stripboard';
import type { SceneNumberOptions } from '../engine/production';
import type {
  Screenplay,
  ElementType,
  TextRun,
  TitlePageInfo,
  Beat,
  BeatBoard,
  ScriptVersion,
  ScriptNote,
  StoryOutline,
  PlotOverview,
  StoryCharacter,
  ActsOverview,
  StoryBeat,
  AutoCompleteState,
  ScriptCharacter,
  ScriptLocation,
  AutoCompleteSuggestion,
  PageLock,
  RevisionSettings,
  RevisionSet,
  WatermarkSettings,
  Breakdown,
  BreakdownElement,
  ElementRecord,
  BreakdownSheetFields,
  BreakdownScene,
  BreakdownCategory,
  CustomCategory,
  ArtCart,
  ArtCartItem,
  Vendor,
  ShoppingList,
  SourcingStatus,
  ItemPriority,
  ItemOption,
  ApprovalStatus,
  BudgetStatus,
  ViewFinder,
  Shot,
  ShotStatus,
  StoryboardFrame,
  CameraPackage,
  SceneCoverage,
  Schedule,
  SceneStrip,
  ShotPackage,
  ShootDay,
  DOODStatus,
  ProductionPerson,
  ProductionLocation,
  ProductionScene,
  Department,
  CallSheet,
  ProductionData,
  ProductionSettings,
  OnSet,
  OnSetViewMode,
  OnSetDisplaySettings,
  DelayEntry,
  SuperVisor,
  TakeEntry,
  ContinuityLog,
  SlateInfo,
  ThemeId,
} from '../types/screenplay';

// Panel visibility options
export interface PanelState {
  navigator: boolean;
  elements: boolean;
  writingStats: boolean;
  titlePage: boolean;
  beatBoard: boolean;
}

// Visibility toggles for Show/Hide menu
export interface VisibilityState {
  ruler: boolean;
  sceneNavigator: boolean;
  scriptNotes: boolean;
}

// View modes (within Re-writer app)
export type ViewMode = 'script' | 'split';

// App modes (top-level application switching)
export type AppMode = 'home' | 'blueprint' | 'corkboard' | 'rewriter' | 'breakdown' | 'artcart' | 'viewfinder' | 'basecamp' | 'onset' | 'supervisor';

// Split View content (independent from main script)
export interface SplitEntry {
  id: string;
  text: string;
}

export interface SplitContent {
  audio: SplitEntry[];
  video: SplitEntry[];
  isIndependent: boolean; // true = edit independently, false = sync from main script
  swapped: boolean; // true = video on left, audio on right
}

// Writing statistics
export interface WritingStats {
  pageCount: number;
  wordCount: number;
  characterCount: number;
  sceneCount: number;
  dialogueCount: number;
  estimatedRuntime: string; // e.g., "1h 32m"
}

// History entry for undo/redo
export interface HistoryEntry {
  screenplay: Screenplay;
  selectedElementId: string | null;
}

// ReWriter document: elements, undo/redo, file I/O, SmartType, scene numbers, page locks, watermark
export interface ScriptSlice {
  screenplay: Screenplay;
  selectedElementId: string | null;
  currentElementType: ElementType;
  isDirty: boolean;
  // Bumped whenever the whole document is replaced (open, new, import).
  // Auto-save uses it to tell a document swap apart from an edit.
  documentGeneration: number;
  // 'project': opened/created as a saved project, safe to auto-save.
  // 'file': File > New or an opened .fdx; auto-save waits for a manual save.
  documentOrigin: 'project' | 'file';
  fileName: string;
  // Undo/Redo
  history: HistoryEntry[];
  future: HistoryEntry[];
  historyIndex: number;
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
  saveToHistory: () => void;
  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  // Actions
  setScreenplay: (screenplay: Screenplay) => void;
  newScreenplay: () => void;
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
  setDocumentOrigin: (origin: 'project' | 'file') => void;
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
  // Production menu: revisions
  updateRevisionSettings: (changes: Partial<RevisionSettings>) => void;
  updateRevisionSet: (id: number, changes: Partial<RevisionSet>) => void;
  toggleRevisionMode: () => void;
  markRevised: (elementIds: string[]) => void;
  clearRevised: (elementIds: string[]) => void;
  // Production menu: locked pages
  lockPages: () => void;
  unlockAPages: () => void;
  unlockAllPages: () => void;
  // Production menu: scene numbers and omitted scenes
  numberScenes: (options: SceneNumberOptions) => void;
  removeSceneNumbers: () => void;
  editSceneNumber: (elementId: string, sceneNumber: string) => void;
  toggleOmitScene: (elementId: string) => void;
}

// App shell: active app, zoom, panels, theme, writing stats
export interface UiSlice {
  darkMode: boolean;
  activeTheme: ThemeId;
  // UI State
  zoom: number;
  activeApp: AppMode;
  viewMode: ViewMode;
  panels: PanelState;
  visibility: VisibilityState;
  stats: WritingStats;
  currentPage: number;
  cursorLine: number;
  // UI actions
  setZoom: (zoom: number) => void;
  setActiveApp: (app: AppMode) => void;
  setViewMode: (mode: ViewMode) => void;
  togglePanel: (panel: keyof PanelState) => void;
  toggleVisibility: (item: keyof VisibilityState) => void;
  setCurrentPage: (page: number) => void;
  setCursorLine: (line: number) => void;
  calculateStats: () => void;
  // Theme
  toggleDarkMode: () => void;
  setTheme: (themeId: ThemeId) => void;
}

// BluePrint/CorkBoard and script extras: beat boards, versions, notes, split view, story outline
export interface StorySlice {
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
}

// BreakDown: tagging and breakdown scenes
export interface BreakdownSlice {
  // Breakdown State
  breakdown: Breakdown | null;
  breakdownScenes: BreakdownScene[];
  selectedBreakdownCategory: BreakdownCategory | null;
  selectedBreakdownSceneId: string | null;
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

  // Breakdown sheet fields (Set, Synopsis, Script Day...)
  updateBreakdownSheet: (sceneId: string, updates: Partial<BreakdownSheetFields>) => void;

  // Element Manager (master element list)
  syncElements: () => void;
  updateElementRecord: (id: string, updates: Partial<Omit<ElementRecord, 'id'>>) => void;
  mergeElementRecords: (targetId: string, sourceIds: string[]) => void;
  renumberElementBoardIds: (category: string) => void;
  deleteElementRecord: (id: string) => void;
}

// ArtCart: items, options/approvals, vendors, shopping lists, budget
export interface ArtCartSlice {
  // ArtCart State
  artCart: ArtCart | null;
  selectedArtCartCategory: string | null;
  selectedArtCartItemId: string | null;
  artCartFilterStatus: SourcingStatus | 'All';
  // ArtCart actions
  initializeArtCart: () => void;
  importFromBreakdown: () => void;
  checkScriptVersionSync: () => void;
  addArtCartItem: (item: Omit<ArtCartItem, 'id' | 'createdAt' | 'updatedAt' | 'options'>) => string;
  updateArtCartItem: (itemId: string, updates: Partial<ArtCartItem>) => void;
  deleteArtCartItem: (itemId: string) => void;
  setArtCartItemStatus: (itemId: string, status: SourcingStatus) => void;
  setArtCartItemPriority: (itemId: string, priority: ItemPriority) => void;
  // Vendor actions
  addVendor: (vendor: Omit<Vendor, 'id'>) => string;
  updateVendor: (vendorId: string, updates: Partial<Vendor>) => void;
  deleteVendor: (vendorId: string) => void;
  // Shopping list actions
  createShoppingList: (name: string, itemIds: string[]) => string;
  updateShoppingList: (listId: string, updates: Partial<ShoppingList>) => void;
  deleteShoppingList: (listId: string) => void;
  // Filter actions
  selectArtCartCategory: (category: string | null) => void;
  selectArtCartItem: (itemId: string | null) => void;
  setArtCartFilterStatus: (status: SourcingStatus | 'All') => void;
  getArtCartItemsByCategory: (category: string) => ArtCartItem[];
  getArtCartItemsByStatus: (status: SourcingStatus) => ArtCartItem[];
  // Item Options actions
  addItemOption: (itemId: string, option: Omit<ItemOption, 'id' | 'createdAt' | 'approvalStatus'>) => string;
  updateItemOption: (itemId: string, optionId: string, updates: Partial<ItemOption>) => void;
  deleteItemOption: (itemId: string, optionId: string) => void;
  approveItemOption: (itemId: string, optionId: string, approvedBy: string, status: ApprovalStatus, notes?: string) => void;
  selectItemOption: (itemId: string, optionId: string) => void;
  setRecommendedOption: (itemId: string, optionId: string) => void;
  // Budget actions
  setCategoryBudget: (category: string, allocated: number, status: BudgetStatus) => void;
  updateBudgetSpent: (category: string, spent: number) => void;
  setTotalBudget: (amount: number, status: BudgetStatus) => void;
  calculateBudgetTotals: () => void;
}

// ViewFinder: shots, storyboards, camera packages, coverage
export interface ViewFinderSlice {
  // ViewFinder State
  viewFinder: ViewFinder | null;
  selectedViewFinderSceneId: string | null;
  selectedShotId: string | null;
  viewFinderFilterStatus: ShotStatus | 'All';
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
}

// BaseCamp scheduling: strips, shoot days, shot packages, DOOD
export interface ScheduleSlice {
  // BaseCamp State (Scheduling)
  schedule: Schedule | null;
  selectedShootDayId: string | null;
  selectedStripId: string | null;
  // BaseCamp actions
  initializeSchedule: () => void;
  importStripsFromBreakdown: () => void;
  importProductionScenesAsStrips: () => void;
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

  // Movie Magic-style board tools. Each returns an error message, or null.
  setScheduleCalendar: (calendar: ProductionCalendar | null) => void;
  autoAssignDayBreaks: (options: AutoDayBreakOptions) => string | null;
  sortScheduledStrips: (levels: StripSortLevel[]) => string | null;
  updateDOODSettings: (updates: Partial<DOODSettings>) => void;
  // Schedule settings
  updateScheduleSettings: (settings: Partial<Pick<Schedule, 'defaultCallTime' | 'defaultLunchDuration' | 'showLunchOnBoard'>>) => void;
  // Selection
  selectShootDay: (dayId: string | null) => void;
  selectStrip: (stripId: string | null) => void;
}

// BaseCamp production management: people, locations, scenes, departments, call sheets
export interface ProductionSlice {
  // Production Management State (shared)
  productionData: ProductionData;
  basecampView: 'dashboard' | 'callsheets' | 'people' | 'scenes' | 'locations' | 'settings' | 'stripboard' | 'calendar' | 'dood';
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
}

// OnSet: live production board
export interface OnSetSlice {
  // OnSet State (Live Production)
  onSet: OnSet | null;
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
}

// SuperVisor: takes, continuity, daily reports
export interface SuperVisorSlice {
  // SuperVisor State (Script Supervisor)
  superVisor: SuperVisor | null;
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
}

// Whole-project load/reset/serialize (cloud + local storage)
export interface ProjectSlice {
  // Project Data actions (for cloud storage)
  loadFromProjectData: (data: import('../types/user').ProjectData) => void;
  resetToNew: () => void;
  getProjectData: () => import('../types/user').ProjectData;
}

export type ScreenplayState =
  ScriptSlice &
  UiSlice &
  StorySlice &
  BreakdownSlice &
  ArtCartSlice &
  ViewFinderSlice &
  ScheduleSlice &
  ProductionSlice &
  OnSetSlice &
  SuperVisorSlice &
  ProjectSlice;

// Fields a Strip Board sort level can use (Movie Magic's Sort window)
export type StripSortField = 'sceneNumber' | 'intExt' | 'location' | 'timeOfDay' | 'pageCount' | 'color' | 'castCount' | 'firstCast';

export interface StripSortLevel {
  field: StripSortField;
  direction: SortDirection;
}
