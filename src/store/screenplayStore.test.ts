import { beforeEach, describe, expect, it } from 'vitest';
import { useScreenplayStore } from './screenplayStore';
import { parseProjectData } from '../utils/projectData';

const store = () => useScreenplayStore.getState();

const addTalent = () =>
  store().addPerson({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: '',
    phone: '',
    group: 'Talent',
    roles: [{ group: 'Talent', department: '', position: 'Lead', characterName: 'ADA' }],
    tags: [],
    notes: '',
    castNumber: 1,
    availability: { startDate: '2026-03-01', blockedDates: ['2026-03-04'] },
  });

// Simulates saving to Drive/local storage and opening the project again
const saveAndReopen = () => {
  const json = JSON.stringify(store().getProjectData());
  store().resetToNew();
  store().loadFromProjectData(parseProjectData(json));
};

describe('project save/load', () => {
  beforeEach(() => store().resetToNew());

  it('keeps BaseCamp productionData', () => {
    addTalent();
    saveAndReopen();

    const [person] = store().productionData.people;
    expect(person.firstName).toBe('Ada');
    expect(person.availability?.startDate).toBe('2026-03-01');
    expect(person.availability?.blockedDates).toEqual(['2026-03-04']);
    expect(store().productionData.departments.length).toBeGreaterThan(0);
  });

  it('restores Date fields as Dates', () => {
    store().lockPage(1, 'blue');
    saveAndReopen();
    expect(store().pageLocks[0].lockedAt).toBeInstanceOf(Date);
  });

  it('gives v1 files (no productionData) default production data', () => {
    addTalent();
    const { productionData: _, ...v1 } = store().getProjectData();
    store().loadFromProjectData(parseProjectData(JSON.stringify({ ...v1, version: 1 })));
    expect(store().productionData.people).toEqual([]);
    expect(store().productionData.departments.length).toBeGreaterThan(0);
  });

  it('does not carry production data into a new project', () => {
    addTalent();
    store().resetToNew();
    expect(store().productionData.people).toEqual([]);
  });
});
