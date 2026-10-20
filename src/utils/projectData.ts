// ============================================
// PROJECT DATA (DE)SERIALIZATION + MIGRATIONS
// ============================================
// Every path that reads a saved project (Google Drive, local storage)
// goes through parseProjectData / migrateProjectData so that:
//   1. Date fields come back as Date objects (JSON turns them into strings)
//   2. Older files are upgraded to the current format version

import { PROJECT_DATA_VERSION, type ProjectData } from '../types/user';
import { LEGACY_CATEGORY_NAMES } from '../types/screenplay';

// Fields declared as `Date` in src/types. Only these keys are revived.
// Some same-named fields are plain strings (e.g. CallSheet.date,
// availability.startDate), but those hold date-only values like
// "2026-02-25", which never match ISO_TIMESTAMP below.
const DATE_KEYS = new Set([
  'createdAt', 'updatedAt', 'lastSyncedAt', 'addedAt', 'lastFetched',
  'savedAt', 'lockedAt', 'timestamp', 'modifiedAt', 'lastModified', 'approvalDate',
  'dueDate', 'acquiredDate', 'returnDate', 'syncedAt', 'date', 'startDate',
  'estimatedEndDate', 'dayStartedAt', 'currentSetupStartedAt', 'lastUpdated',
  'startedAt', 'completedAt', 'lunchStartedAt', 'endedAt', 'exportedAt',
  'approvedAt', 'uploadedAt',
]);

// The exact shape Date.prototype.toISOString() produces
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export function reviveDates(key: string, value: unknown): unknown {
  if (typeof value === 'string' && DATE_KEYS.has(key) && ISO_TIMESTAMP.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return value;
}

type RawProjectData = Record<string, unknown> & { version?: unknown };

// MIGRATIONS[n] upgrades a version-n file to version n+1
const MIGRATIONS: Record<number, (data: RawProjectData) => RawProjectData> = {
  // v1 -> v2: BaseCamp `productionData` added to the saved file.
  // v1 files simply don't have it; the loader falls back to defaults.
  1: (data) => data,
  // v2 -> v3: breakdown categories take Movie Magic's names
  // (Cast -> Cast Members, Extras -> Background Actors, SFX, Makeup, VFX)
  2: (data) => renameLegacyCategories(data),
};

const renameCategory = (category: unknown) =>
  typeof category === 'string' ? (LEGACY_CATEGORY_NAMES[category] ?? category) : category;

type Rec = Record<string, unknown>;

function renameLegacyCategories(data: RawProjectData): RawProjectData {
  const breakdown = data.breakdown as Rec | undefined;
  const schedule = data.schedule as Rec | undefined;
  const next: RawProjectData = { ...data };
  if (breakdown) {
    const withCategory = (items: unknown) =>
      Array.isArray(items) ? items.map((item: Rec) => ({ ...item, category: renameCategory(item.category) })) : items;
    next.breakdown = { ...breakdown, elements: withCategory(breakdown.elements), elementList: withCategory(breakdown.elementList) };
  }
  const dood = schedule?.doodSettings as Rec | undefined;
  if (schedule && dood?.categoryOptions) {
    const options = Object.fromEntries(
      Object.entries(dood.categoryOptions as Rec).map(([k, v]) => [renameCategory(k) as string, v])
    );
    next.schedule = { ...schedule, doodSettings: { ...dood, categoryOptions: options } };
  }
  return next;
}

export function migrateProjectData(raw: unknown): ProjectData {
  if (!raw || typeof raw !== 'object' || !('screenplay' in raw)) {
    throw new Error('This file is not an OTSP project.');
  }

  let data = raw as RawProjectData;
  const fromVersion = typeof data.version === 'number' ? data.version : 1;

  if (fromVersion > PROJECT_DATA_VERSION) {
    throw new Error(
      `This project was saved by a newer version of OTSP (format v${fromVersion}). Please refresh the page.`
    );
  }

  for (let v = fromVersion; v < PROJECT_DATA_VERSION; v++) {
    data = MIGRATIONS[v](data);
  }

  return { ...data, version: PROJECT_DATA_VERSION } as unknown as ProjectData;
}

export function parseProjectData(json: string): ProjectData {
  return migrateProjectData(JSON.parse(json, reviveDates));
}
