import { describe, expect, it } from 'vitest';
import type { ProductionPerson } from '../../types/screenplay';
import { starterBudget } from './template';
import { categoryForRole, crewLinesFromPeople } from './crewLink';

const person = (id: string, department: string, position: string, payRate?: ProductionPerson['payRate'], group: ProductionPerson['group'] = 'Crew'): ProductionPerson => ({
  id, firstName: id, lastName: 'X', email: '', phone: '', group, roles: [{ group, department, position }], tags: [], notes: '', avatarColor: '', payRate,
});

describe('crew lines from People', () => {
  it('places roles in the right categories', () => {
    expect(categoryForRole('Camera', '1st AC')).toBe('3300');
    expect(categoryForRole('Production', 'Producer')).toBe('1200');
    expect(categoryForRole('Production', 'Line Producer')).toBe('2000');
    expect(categoryForRole('Direction', 'Director')).toBe('1300');
    expect(categoryForRole('Direction', '1st Assistant Director')).toBe('2000');
    expect(categoryForRole('Electric', 'Gaffer')).toBe('3200');
    expect(categoryForRole('Mystery', 'Thing')).toBe('2000');
  });

  it('makes a line per paid crew member in a labor account, once', () => {
    const b = starterBudget('x');
    const people = [
      person('gaffer', 'Electric', 'Gaffer', { amount: 650, currency: 'USD', period: 'Per Day' }),
      person('dp', 'Camera', 'Director of Photography', { amount: 7500, currency: 'USD', period: 'Per Week' }),
      person('pa', 'Production', 'PA'),                                   // no rate
      person('ada', '', 'ADA', { amount: 900, currency: 'USD', period: 'Per Day' }, 'Talent'), // cast comes from DOOD
    ];
    let k = 0;
    const lines = crewLinesFromPeople(b, people, () => `n${k++}`);
    expect(lines.map((l) => [l.detail.description, l.detail.units, l.detail.x, l.detail.rate])).toEqual([
      ['Gaffer: gaffer X', 'Days', 'SHOOT_DAYS', '650'],
      ['Director of Photography: dp X', 'Weeks', 'SHOOT_WEEKS', '7500'],
    ]);
    const lighting = b.categories.find((c) => c.number === '3200')!;
    expect(lines[0].accountId).toBe(lighting.accounts.find((a) => a.name.startsWith('Gaffer'))!.id);
    expect(lines[0].detail.fringeIds).toEqual([b.fringes.find((f) => f.name === 'Payroll Taxes')!.id]);
    // already linked: not added again
    lighting.accounts[0].details.push({ ...lines[0].detail });
    expect(crewLinesFromPeople(b, people, () => 'z').map((l) => l.detail.personId)).toEqual(['dp']);
  });
});
