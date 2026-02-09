import type {
  Screenplay,
  Breakdown,
  BreakdownScene,
  BreakdownElement,
  BreakdownCastMember,
  BreakdownLocation,
  CustomCategory,
  ArtCartItem,
  ViewFinder,
  Shot,
  CameraPackage,
  SceneCoverage,
  Schedule,
  SceneStrip,
  ShootDay,
  DOODEntry,
  TakeEntry,
  ShotSize,
  CameraAngle,
  CameraMovement,
  ShotStatus,
  StripColor,
  SourcingStatus,
  ItemPriority,
} from '../types/screenplay';
import { parseFDX } from './fdx';

// ============================================
// IMPORT FORMAT DETECTION
// ============================================

export type ImportFileType =
  | 'fdx'        // Final Draft screenplay
  | 'xml'        // Generic XML (breakdown, schedule, etc.)
  | 'mms'        // Movie Magic Scheduling
  | 'csv'        // CSV (artcart, generic)
  | 'ale'        // Avid Log Exchange
  | 'otsp'       // Our project archive
  | 'json'       // JSON (beat boards, etc.)
  | 'unknown';

export interface ImportResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

// Detect file type from extension and content
export const detectFileType = (fileName: string, content: string): ImportFileType => {
  const ext = fileName.toLowerCase().split('.').pop() || '';

  switch (ext) {
    case 'fdx':
      return 'fdx';
    case 'mms':
    case 'sex': // Schedule Exchange format
      return 'mms';
    case 'csv':
      return 'csv';
    case 'ale':
      return 'ale';
    case 'otsp':
    case 'zip':
      return 'otsp';
    case 'json':
      return 'json';
    case 'xml':
      // Check XML content to determine specific type
      if (content.includes('<FinalDraft') || content.includes('<Paragraph Type=')) {
        return 'fdx';
      }
      return 'xml';
    default:
      // Try to detect from content
      if (content.startsWith('<?xml')) {
        if (content.includes('<FinalDraft')) return 'fdx';
        return 'xml';
      }
      if (content.startsWith('Heading\n') && content.includes('FIELD_DELIM')) {
        return 'ale';
      }
      if (content.startsWith('{') || content.startsWith('[')) {
        return 'json';
      }
      return 'unknown';
  }
};

// ============================================
// XML PARSING UTILITIES
// ============================================

const getTextContent = (element: Element | null | undefined): string => {
  return element?.textContent?.trim() || '';
};

const getAttribute = (element: Element | null | undefined, attr: string): string => {
  return element?.getAttribute(attr) || '';
};

const getChildren = (parent: Element | null | undefined, tagName: string): Element[] => {
  if (!parent) return [];
  return Array.from(parent.querySelectorAll(`:scope > ${tagName}`));
};

// ============================================
// FDX IMPORT (WRAPPER)
// ============================================

export const importFDX = (content: string): ImportResult<Screenplay> => {
  try {
    const screenplay = parseFDX(content);
    return { success: true, data: screenplay };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse FDX file',
    };
  }
};

// ============================================
// BREAKDOWN XML IMPORT
// ============================================

export const importBreakdownXML = (content: string): ImportResult<Breakdown> => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { success: false, error: 'Invalid XML format' };
    }

    const root = doc.querySelector('Breakdown');
    if (!root) {
      return { success: false, error: 'Not a valid breakdown file' };
    }

    const meta = root.querySelector('Meta');
    const name = getTextContent(meta?.querySelector('Name')) || 'Imported Breakdown';
    const scriptVersionId = getTextContent(meta?.querySelector('ScriptVersion')) || '';

    // Parse scenes
    const scenes: BreakdownScene[] = [];
    const sceneElements = getChildren(root.querySelector('Scenes'), 'Scene');
    for (const sceneEl of sceneElements) {
      scenes.push({
        id: getAttribute(sceneEl, 'id') || `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sceneNumber: getTextContent(sceneEl.querySelector('SceneNumber')),
        intExt: getTextContent(sceneEl.querySelector('IntExt')) as 'INT' | 'EXT' | 'INT/EXT' | 'I/E',
        location: getTextContent(sceneEl.querySelector('Location')),
        timeOfDay: getTextContent(sceneEl.querySelector('TimeOfDay')),
        dayNight: getTextContent(sceneEl.querySelector('DayNight')) as 'Day' | 'Night',
        eighths: parseInt(getTextContent(sceneEl.querySelector('Eighths'))) || 1,
        pageStart: parseFloat(getTextContent(sceneEl.querySelector('PageStart'))) || 0,
        pageEnd: parseFloat(getTextContent(sceneEl.querySelector('PageEnd'))) || 0,
        description: getTextContent(sceneEl.querySelector('Description')),
        elements: [],
        castIds: [],
        notes: getTextContent(sceneEl.querySelector('Notes')),
      });
    }

    // Parse elements
    const elements: BreakdownElement[] = [];
    const elementEls = getChildren(root.querySelector('Elements'), 'Element');
    for (const el of elementEls) {
      elements.push({
        id: getAttribute(el, 'id') || `elem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: getTextContent(el.querySelector('Text')),
        category: getTextContent(el.querySelector('Category')),
        sceneId: getAttribute(el, 'sceneId'),
        sourceElementId: getTextContent(el.querySelector('SourceElementId')),
        startOffset: parseInt(getTextContent(el.querySelector('StartOffset'))) || 0,
        endOffset: parseInt(getTextContent(el.querySelector('EndOffset'))) || 0,
        notes: getTextContent(el.querySelector('Notes')),
      });
    }

    // Parse cast
    const castList: BreakdownCastMember[] = [];
    const castEls = getChildren(root.querySelector('Cast'), 'CastMember');
    for (const el of castEls) {
      castList.push({
        id: getAttribute(el, 'id') || `cast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        characterName: getTextContent(el.querySelector('CharacterName')),
        actorName: getTextContent(el.querySelector('ActorName')) || undefined,
        role: getTextContent(el.querySelector('Role')) as 'Principal' | 'Supporting' | 'Day Player' | 'Stunt' | 'Voice',
        sceneIds: getTextContent(el.querySelector('Scenes')).split(',').filter(Boolean),
        workDays: parseInt(getTextContent(el.querySelector('WorkDays'))) || undefined,
      });
    }

    // Parse locations
    const locationsList: BreakdownLocation[] = [];
    const locEls = getChildren(root.querySelector('Locations'), 'Location');
    for (const el of locEls) {
      locationsList.push({
        id: getAttribute(el, 'id') || `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: getTextContent(el.querySelector('Name')),
        address: getTextContent(el.querySelector('Address')) || undefined,
        intExt: getTextContent(el.querySelector('IntExt')) as 'INT' | 'EXT' | 'BOTH',
        sceneIds: getTextContent(el.querySelector('Scenes')).split(',').filter(Boolean),
        notes: getTextContent(el.querySelector('Notes')) || undefined,
      });
    }

    // Parse custom categories
    const customCategories: CustomCategory[] = [];
    const catEls = getChildren(root.querySelector('CustomCategories'), 'Category');
    for (const el of catEls) {
      customCategories.push({
        id: getAttribute(el, 'id') || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: getTextContent(el.querySelector('Name')),
        color: getTextContent(el.querySelector('Color')),
        description: getTextContent(el.querySelector('Description')) || undefined,
      });
    }

    const breakdown: Breakdown = {
      id: `breakdown_${Date.now()}`,
      name,
      scriptVersionId,
      versionInfo: {
        scriptVersionId,
        scriptVersionName: 'Imported',
        createdAt: new Date(),
        lastSyncedAt: new Date(),
        missingElements: [],
        newScenes: [],
        syncStatus: 'current',
      },
      elements,
      scenes,
      customCategories,
      castList,
      locationsList,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { success: true, data: breakdown };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse breakdown file',
    };
  }
};

// ============================================
// SCHEDULE XML IMPORT
// ============================================

export const importScheduleXML = (content: string): ImportResult<Schedule> => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { success: false, error: 'Invalid XML format' };
    }

    const root = doc.querySelector('Schedule');
    if (!root) {
      return { success: false, error: 'Not a valid schedule file' };
    }

    const meta = root.querySelector('Meta');
    const projectName = getTextContent(meta?.querySelector('ProjectName')) || 'Imported Schedule';

    // Parse strips
    const strips: SceneStrip[] = [];
    const stripEls = getChildren(root.querySelector('Strips'), 'Strip');
    for (const el of stripEls) {
      strips.push({
        id: getAttribute(el, 'id') || `strip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sceneId: getTextContent(el.querySelector('SceneId')),
        sceneNumber: getTextContent(el.querySelector('SceneNumber')),
        intExt: getTextContent(el.querySelector('IntExt')),
        location: getTextContent(el.querySelector('Location')),
        timeOfDay: getTextContent(el.querySelector('TimeOfDay')),
        description: getTextContent(el.querySelector('Description')),
        pageCount: parseFloat(getTextContent(el.querySelector('PageCount'))) || 0,
        color: getTextContent(el.querySelector('Color')) as StripColor,
        castIds: getTextContent(el.querySelector('Cast')).split(',').filter(Boolean),
        castNumbers: getTextContent(el.querySelector('CastNumbers')).split(',').filter(Boolean).map(Number),
        scheduledDayId: getTextContent(el.querySelector('ScheduledDayId')) || undefined,
        orderInDay: parseInt(getTextContent(el.querySelector('OrderInDay'))) || undefined,
        isLocked: getTextContent(el.querySelector('IsLocked')) === 'true',
        hasStunts: getTextContent(el.querySelector('HasStunts')) === 'true',
        hasVFX: getTextContent(el.querySelector('HasVFX')) === 'true',
        hasSpecialEquipment: getTextContent(el.querySelector('HasSpecialEquipment')) === 'true',
        notes: getTextContent(el.querySelector('Notes')) || undefined,
      });
    }

    // Parse shoot days
    const shootDays: ShootDay[] = [];
    const dayEls = getChildren(root.querySelector('ShootDays'), 'ShootDay');
    for (const el of dayEls) {
      shootDays.push({
        id: getAttribute(el, 'id') || `day_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dayNumber: parseInt(getTextContent(el.querySelector('DayNumber'))) || 1,
        date: getTextContent(el.querySelector('Date')) ? new Date(getTextContent(el.querySelector('Date'))) : undefined,
        strips: getTextContent(el.querySelector('Strips')).split(',').filter(Boolean),
        shotPackages: [],
        callTime: getTextContent(el.querySelector('CallTime')) || '7:00 AM',
        estimatedWrap: getTextContent(el.querySelector('EstimatedWrap')) || '7:00 PM',
        lunchTime: getTextContent(el.querySelector('LunchTime')) || undefined,
        lunchDuration: parseInt(getTextContent(el.querySelector('LunchDuration'))) || undefined,
        location: getTextContent(el.querySelector('Location')) || undefined,
        locationAddress: getTextContent(el.querySelector('LocationAddress')) || undefined,
        isLocked: getTextContent(el.querySelector('IsLocked')) === 'true',
        hasNightWork: getTextContent(el.querySelector('HasNightWork')) === 'true',
        notes: getTextContent(el.querySelector('Notes')) || undefined,
      });
    }

    // Parse DOOD
    const dood: DOODEntry[] = [];
    const doodEls = getChildren(root.querySelector('DOOD'), 'Entry');
    for (const el of doodEls) {
      const dayStatuses = getChildren(el.querySelector('DayStatuses'), 'Day').map(d => ({
        dayId: getAttribute(d, 'dayId'),
        dayNumber: parseInt(getAttribute(d, 'dayNumber')) || 0,
        status: getAttribute(d, 'status') as DOODEntry['dayStatuses'][0]['status'],
      }));
      dood.push({
        castId: getAttribute(el, 'castId'),
        castName: getTextContent(el.querySelector('CastName')),
        characterName: getTextContent(el.querySelector('CharacterName')),
        dayStatuses,
      });
    }

    const schedule: Schedule = {
      id: `schedule_${Date.now()}`,
      projectName,
      strips,
      unscheduledStrips: strips.filter(s => !s.scheduledDayId).map(s => s.id),
      shotPackages: [],
      unscheduledPackages: [],
      shootDays,
      dayBreaks: [],
      companyMoves: [],
      dood,
      startDate: meta?.querySelector('StartDate') ? new Date(getTextContent(meta.querySelector('StartDate'))) : undefined,
      estimatedEndDate: meta?.querySelector('EstimatedEndDate') ? new Date(getTextContent(meta.querySelector('EstimatedEndDate'))) : undefined,
      totalShootDays: parseInt(getTextContent(meta?.querySelector('TotalShootDays'))) || shootDays.length,
      defaultCallTime: getTextContent(meta?.querySelector('DefaultCallTime')) || '7:00 AM',
      defaultLunchDuration: parseInt(getTextContent(meta?.querySelector('DefaultLunchDuration'))) || 30,
      showLunchOnBoard: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { success: true, data: schedule };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse schedule file',
    };
  }
};

// ============================================
// VIEWFINDER/SHOTS XML IMPORT
// ============================================

export const importShotListXML = (content: string): ImportResult<ViewFinder> => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { success: false, error: 'Invalid XML format' };
    }

    const root = doc.querySelector('ViewFinder');
    if (!root) {
      return { success: false, error: 'Not a valid shot list file' };
    }

    const meta = root.querySelector('Meta');
    const projectName = getTextContent(meta?.querySelector('ProjectName')) || 'Imported Shots';

    // Parse camera packages
    const cameraPackages: CameraPackage[] = [];
    const pkgEls = getChildren(root.querySelector('CameraPackages'), 'Package');
    for (const el of pkgEls) {
      cameraPackages.push({
        id: getAttribute(el, 'id') || `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: getTextContent(el.querySelector('Name')),
        cameras: getTextContent(el.querySelector('Cameras')).split(',').filter(Boolean),
        lenses: getTextContent(el.querySelector('Lenses')).split(',').filter(Boolean),
        support: getTextContent(el.querySelector('Support')).split(',').filter(Boolean),
        notes: getTextContent(el.querySelector('Notes')) || undefined,
      });
    }

    // Parse shots
    const shots: Shot[] = [];
    const shotEls = getChildren(root.querySelector('Shots'), 'Shot');
    for (const el of shotEls) {
      const equipmentEl = el.querySelector('Equipment');
      const lensEl = equipmentEl?.querySelector('Lens');

      shots.push({
        id: getAttribute(el, 'id') || `shot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sceneId: getAttribute(el, 'sceneId'),
        sceneNumber: getTextContent(el.querySelector('SceneNumber')),
        shotNumber: getTextContent(el.querySelector('ShotNumber')),
        size: getTextContent(el.querySelector('Size')) as ShotSize,
        angle: getTextContent(el.querySelector('Angle')) as CameraAngle,
        movement: getTextContent(el.querySelector('Movement')) as CameraMovement,
        subject: getTextContent(el.querySelector('Subject')),
        description: getTextContent(el.querySelector('Description')),
        equipment: {
          camera: getTextContent(equipmentEl?.querySelector('Camera')) || undefined,
          lens: lensEl ? {
            focalLength: getAttribute(lensEl, 'focalLength'),
            aperture: getAttribute(lensEl, 'aperture') || undefined,
          } : undefined,
          support: getTextContent(equipmentEl?.querySelector('Support')) || undefined,
        },
        duration: parseInt(getTextContent(el.querySelector('Duration'))) || undefined,
        status: getTextContent(el.querySelector('Status')) as ShotStatus || 'Planned',
        priority: parseInt(getTextContent(el.querySelector('Priority'))) || 0,
        directorNotes: getTextContent(el.querySelector('DirectorNotes')) || undefined,
        dpNotes: getTextContent(el.querySelector('DPNotes')) || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Parse scene coverage
    const sceneCoverage: SceneCoverage[] = [];
    const covEls = getChildren(root.querySelector('SceneCoverage'), 'Scene');
    for (const el of covEls) {
      sceneCoverage.push({
        sceneId: getAttribute(el, 'sceneId'),
        sceneNumber: getAttribute(el, 'sceneNumber'),
        shotCount: parseInt(getTextContent(el.querySelector('ShotCount'))) || 0,
        completedShots: parseInt(getTextContent(el.querySelector('CompletedShots'))) || 0,
        estimatedDuration: parseInt(getTextContent(el.querySelector('EstimatedDuration'))) || 0,
        coverageComplete: getTextContent(el.querySelector('CoverageComplete')) === 'true',
        notes: getTextContent(el.querySelector('Notes')) || undefined,
      });
    }

    const viewFinder: ViewFinder = {
      id: `vf_${Date.now()}`,
      projectName,
      shots,
      storyboards: [],
      cameraPackages,
      sceneCoverage,
      scriptSync: {
        scriptVersionId: '',
        scriptVersionName: 'Imported',
        syncedAt: new Date(),
        isOutdated: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { success: true, data: viewFinder };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse shot list file',
    };
  }
};

// ============================================
// MMS (MOVIE MAGIC SCHEDULING) IMPORT
// ============================================

export const importMMS = (content: string): ImportResult<Schedule> => {
  try {
    // MMS files are actually XML with a specific structure
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { success: false, error: 'Invalid MMS file format' };
    }

    // MMS format uses different tag names - handle common MMS structures
    const root = doc.querySelector('Schedule, ProductionSchedule, StripBoard');
    if (!root) {
      // Try to handle as generic schedule XML
      return importScheduleXML(content);
    }

    const warnings: string[] = [];

    // Parse strips from MMS format (may use different element names)
    const strips: SceneStrip[] = [];
    const stripEls = doc.querySelectorAll('Strip, Scene, BreakdownSheet');

    for (const el of Array.from(stripEls)) {
      const sceneNum = getTextContent(el.querySelector('SceneNumber, SceneNo, Number')) ||
                       getAttribute(el, 'SceneNumber') ||
                       getAttribute(el, 'Number');

      if (!sceneNum) continue;

      const intExt = getTextContent(el.querySelector('IntExt, IE, Interior_Exterior')) ||
                     getAttribute(el, 'IntExt') || 'INT';
      const location = getTextContent(el.querySelector('Location, SetName, Set')) || '';
      const timeOfDay = getTextContent(el.querySelector('TimeOfDay, DN, DayNight, Time')) || 'DAY';
      const pages = getTextContent(el.querySelector('Pages, PageCount, Eighths')) || '1';

      strips.push({
        id: getAttribute(el, 'ID') || `strip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sceneId: '',
        sceneNumber: sceneNum,
        intExt: intExt.toUpperCase(),
        location,
        timeOfDay: timeOfDay.toUpperCase(),
        description: getTextContent(el.querySelector('Description, Synopsis')) || '',
        pageCount: parseFloat(pages) || 1,
        color: 'White' as StripColor,
        castIds: [],
        castNumbers: [],
        isLocked: false,
        hasStunts: false,
        hasVFX: false,
        hasSpecialEquipment: false,
      });
    }

    if (strips.length === 0) {
      warnings.push('No scenes found in MMS file. File may use unsupported format variant.');
    }

    // Parse shoot days
    const shootDays: ShootDay[] = [];
    const dayEls = doc.querySelectorAll('ShootDay, Day, ShootingDay');

    for (const el of Array.from(dayEls)) {
      const dayNum = parseInt(getTextContent(el.querySelector('DayNumber, Number')) || getAttribute(el, 'Number') || '0');
      if (dayNum <= 0) continue;

      shootDays.push({
        id: getAttribute(el, 'ID') || `day_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dayNumber: dayNum,
        strips: [],
        shotPackages: [],
        callTime: getTextContent(el.querySelector('CallTime, Call')) || '7:00 AM',
        estimatedWrap: getTextContent(el.querySelector('Wrap, WrapTime')) || '7:00 PM',
        location: getTextContent(el.querySelector('Location')) || undefined,
        isLocked: false,
        hasNightWork: false,
      });
    }

    const schedule: Schedule = {
      id: `schedule_${Date.now()}`,
      projectName: getTextContent(doc.querySelector('ProjectName, ShowTitle, Title')) || 'Imported MMS Schedule',
      strips,
      unscheduledStrips: strips.map(s => s.id),
      shotPackages: [],
      unscheduledPackages: [],
      shootDays,
      dayBreaks: [],
      companyMoves: [],
      dood: [],
      totalShootDays: shootDays.length || Math.ceil(strips.length / 6),
      defaultCallTime: '7:00 AM',
      defaultLunchDuration: 30,
      showLunchOnBoard: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { success: true, data: schedule, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse MMS file',
    };
  }
};

// ============================================
// ALE (AVID LOG EXCHANGE) IMPORT
// ============================================

export const importALE = (content: string): ImportResult<TakeEntry[]> => {
  try {
    const lines = content.split('\n');
    const takes: TakeEntry[] = [];
    let inData = false;
    let columns: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === 'Column') {
        // Next line will be column headers
        continue;
      }

      if (trimmed === 'Data') {
        inData = true;
        continue;
      }

      if (!inData && trimmed.includes('\t') && !columns.length) {
        // This is the column header line
        columns = trimmed.split('\t');
        continue;
      }

      if (inData && trimmed) {
        const values = trimmed.split('\t');
        const row: Record<string, string> = {};

        columns.forEach((col, i) => {
          row[col.toLowerCase()] = values[i] || '';
        });

        const take: TakeEntry = {
          id: `take_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sceneNumber: row['scene'] || row['sceneno'] || '',
          shotId: '',
          shotNumber: row['shot'] || row['shotno'] || '',
          takeNumber: parseInt(row['take'] || row['takeno'] || '1') || 1,
          camera: row['camera'] || row['cam'] || 'A',
          timecodeIn: row['timecode in'] || row['tc in'] || row['start tc'] || undefined,
          timecodeOut: row['timecode out'] || row['tc out'] || row['end tc'] || undefined,
          duration: parseInt(row['duration'] || '0') || undefined,
          circled: row['circled']?.toLowerCase() === 'y' || row['circled']?.toLowerCase() === 'true',
          rating: row['circled']?.toLowerCase() === 'y' ? 'Print' : '',
          editorNotes: row['notes'] || row['comments'] || undefined,
          createdAt: new Date(),
        };

        takes.push(take);
      }
    }

    if (takes.length === 0) {
      return { success: false, error: 'No takes found in ALE file' };
    }

    return { success: true, data: takes };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse ALE file',
    };
  }
};

// ============================================
// CSV IMPORT FOR ARTCART
// ============================================

export const importArtCartCSV = (content: string): ImportResult<ArtCartItem[]> => {
  try {
    const lines = content.split('\n');
    if (lines.length < 2) {
      return { success: false, error: 'CSV file is empty or has no data rows' };
    }

    // Parse header
    const header = parseCSVLine(lines[0]);
    const items: ArtCartItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      const row: Record<string, string> = {};

      header.forEach((col, idx) => {
        row[col.toLowerCase().trim()] = values[idx] || '';
      });

      const item: ArtCartItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: row['name'] || row['item'] || row['description'] || `Item ${i}`,
        category: row['category'] || row['dept'] || row['department'] || 'Props',
        description: row['description'] || row['notes'] || undefined,
        status: (row['status'] as SourcingStatus) || 'To Find',
        priority: (row['priority'] as ItemPriority) || 'Medium',
        quantity: parseInt(row['quantity'] || row['qty'] || '1') || 1,
        options: [],
        sceneIds: row['scenes']?.split(',').filter(Boolean) || [],
        estimatedCost: parseFloat(row['estimated cost'] || row['estimate'] || '0') || undefined,
        actualCost: parseFloat(row['actual cost'] || row['cost'] || '0') || undefined,
        vendorNotes: row['vendor'] || row['source'] || undefined,
        notes: row['notes'] || row['comments'] || undefined,
        needsApproval: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      items.push(item);
    }

    return { success: true, data: items };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse CSV file',
    };
  }
};

// Helper to parse CSV lines (handling quoted values)
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

// ============================================
// UNIFIED IMPORT HANDLER
// ============================================

export interface GenericImportResult {
  type: 'screenplay' | 'breakdown' | 'schedule' | 'shots' | 'takes' | 'artcart' | 'unknown';
  data: unknown;
  warnings?: string[];
}

export const importFile = async (
  fileName: string,
  content: string
): Promise<ImportResult<GenericImportResult>> => {
  const fileType = detectFileType(fileName, content);

  switch (fileType) {
    case 'fdx': {
      const result = importFDX(content);
      if (result.success) {
        return {
          success: true,
          data: { type: 'screenplay', data: result.data },
        };
      }
      return { success: false, error: result.error };
    }

    case 'mms': {
      const result = importMMS(content);
      if (result.success) {
        return {
          success: true,
          data: { type: 'schedule', data: result.data, warnings: result.warnings },
        };
      }
      return { success: false, error: result.error };
    }

    case 'ale': {
      const result = importALE(content);
      if (result.success) {
        return {
          success: true,
          data: { type: 'takes', data: result.data },
        };
      }
      return { success: false, error: result.error };
    }

    case 'csv': {
      // Try ArtCart CSV first
      const result = importArtCartCSV(content);
      if (result.success) {
        return {
          success: true,
          data: { type: 'artcart', data: result.data },
        };
      }
      return { success: false, error: result.error };
    }

    case 'xml': {
      // Try different XML formats
      if (content.includes('<Breakdown') || content.includes('breakdown')) {
        const result = importBreakdownXML(content);
        if (result.success) {
          return {
            success: true,
            data: { type: 'breakdown', data: result.data },
          };
        }
      }
      if (content.includes('<Schedule') || content.includes('<ShootDay')) {
        const result = importScheduleXML(content);
        if (result.success) {
          return {
            success: true,
            data: { type: 'schedule', data: result.data },
          };
        }
      }
      if (content.includes('<ViewFinder') || content.includes('<Shot')) {
        const result = importShotListXML(content);
        if (result.success) {
          return {
            success: true,
            data: { type: 'shots', data: result.data },
          };
        }
      }
      return { success: false, error: 'Unrecognized XML format' };
    }

    default:
      return { success: false, error: `Unsupported file type: ${fileType}` };
  }
};
