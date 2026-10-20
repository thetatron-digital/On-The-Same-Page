import { describe, expect, it } from 'vitest';
import { migrateProjectData, parseProjectData, reviveDates } from './projectData';
import { PROJECT_DATA_VERSION } from '../types/user';
import { createNewScreenplay } from './fdx';

describe('reviveDates', () => {
  it('turns ISO timestamps on Date fields back into Dates', () => {
    const revived = reviveDates('createdAt', '2026-02-25T18:30:00.000Z');
    expect(revived).toBeInstanceOf(Date);
    expect((revived as Date).toISOString()).toBe('2026-02-25T18:30:00.000Z');
  });

  it('leaves date-only strings alone (CallSheet.date, availability.startDate)', () => {
    expect(reviveDates('date', '2026-02-25')).toBe('2026-02-25');
    expect(reviveDates('startDate', '2026-03-01')).toBe('2026-03-01');
  });

  it('leaves timestamps on non-date fields alone', () => {
    expect(reviveDates('notes', '2026-02-25T18:30:00.000Z')).toBe('2026-02-25T18:30:00.000Z');
  });
});

describe('migrateProjectData', () => {
  const v1 = { screenplay: createNewScreenplay(), version: 1, savedAt: new Date() };

  it('upgrades a v1 file to the current version without productionData', () => {
    const data = migrateProjectData(v1);
    expect(data.version).toBe(PROJECT_DATA_VERSION);
    expect(data.productionData).toBeUndefined();
  });

  it('treats files with no version as v1', () => {
    const { version: _, ...unversioned } = v1;
    expect(migrateProjectData(unversioned).version).toBe(PROJECT_DATA_VERSION);
  });

  it('rejects files from a newer OTSP', () => {
    expect(() => migrateProjectData({ ...v1, version: PROJECT_DATA_VERSION + 1 })).toThrow(/newer version/);
  });

  it('rejects things that are not projects', () => {
    expect(() => migrateProjectData({ hello: 'world' })).toThrow(/not an OTSP project/);
    expect(() => migrateProjectData(null)).toThrow(/not an OTSP project/);
  });
});

describe('parseProjectData', () => {
  it('round-trips nested Dates through JSON', () => {
    const lockedAt = new Date('2026-02-25T18:30:00.000Z');
    const json = JSON.stringify({
      screenplay: createNewScreenplay(),
      pageLocks: [{ pageNumber: 1, lockedAt, color: 'blue' }],
      version: PROJECT_DATA_VERSION,
      savedAt: new Date(),
    });
    const data = parseProjectData(json);
    expect(data.savedAt).toBeInstanceOf(Date);
    expect(data.pageLocks?.[0].lockedAt).toEqual(lockedAt);
  });
});
