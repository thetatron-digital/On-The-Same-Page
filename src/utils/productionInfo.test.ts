import { describe, expect, it } from 'vitest';
import type { ProductionPerson, ProductionSettings } from '../types/screenplay';
import { productionInfoLine, resolveProductionInfo } from './productionInfo';

const crew = (id: string, first: string, position: string): ProductionPerson => ({
  id, firstName: first, lastName: 'Smith', email: '', phone: '', group: 'Crew',
  roles: [{ group: 'Crew', department: 'Production', position }], tags: [], notes: '', avatarColor: '#000',
});

const settings: ProductionSettings = {
  projectName: 'Night Shift', defaultCallTime: '7:00 AM', defaultLunchDuration: 30, defaultDisclaimer: '',
  productionInfo: { company: 'Thetatron Pictures', producer: 'Pat Override' },
};

describe('production info', () => {
  it('uses the project name as Picture Title and fills crew from People', () => {
    const info = resolveProductionInfo(settings, [crew('a', 'Dana', 'Director'), crew('b', 'Lee', 'Producer'), crew('c', 'Kim', '1st Assistant Director')]);
    expect(info).toMatchObject({ pictureTitle: 'Night Shift', company: 'Thetatron Pictures', director: 'Dana Smith', producer: 'Pat Override', assistantDirector: 'Kim Smith' });
  });

  it('builds a header credit line from what is filled in', () => {
    expect(productionInfoLine({ company: 'Thetatron Pictures', director: 'Dana Smith', scriptDated: '2026-03-01' }))
      .toBe('Thetatron Pictures  ·  Director: Dana Smith  ·  Script dated 2026-03-01');
  });
});
