import { describe, expect, it } from 'vitest';
import type { Budget } from '../../types/budget';
import { budgetTotals, detailTotal, money } from './totals';

const budget: Budget = {
  id: 'b', name: 'Test', currency: 'USD', createdAt: new Date(), updatedAt: new Date(),
  globals: [{ id: 'g1', name: 'SHOOT_DAYS', value: '20' }, { id: 'g2', name: 'SHOOT_WEEKS', value: 'SHOOT_DAYS / 5' }],
  fringes: [
    { id: 'tax', name: 'Payroll Taxes', kind: 'percent', rate: 20 },
    { id: 'cap', name: 'Capped', kind: 'percent', rate: 10, cutoffCents: 1_000_000 },
    { id: 'hw', name: 'Health per day', kind: 'flat', rate: 5000 },
  ],
  groups: [{ id: 'loc', name: 'Location shoot', color: '#f00' }],
  categories: [
    { id: 'c1', number: '1300', name: 'Director', section: 'ATL', accounts: [
      { id: 'a1', number: '1301', name: 'Director', details: [
        { id: 'd1', description: 'Director', amount: '1', units: 'Weeks', x: 'SHOOT_WEEKS + 6', rate: '15,000', fringeIds: ['tax', 'cap'] },
      ] },
    ] },
    { id: 'c2', number: '3300', name: 'Camera', section: 'Production', accounts: [
      { id: 'a2', number: '3301', name: 'Director of Photography', details: [
        { id: 'd2', description: 'DP', amount: '1', units: 'Days', x: 'SHOOT_DAYS', rate: '1500', fringeIds: ['hw'] },
        { id: 'd3', description: 'Camera rental', amount: '1', units: 'Weeks', x: 'SHOOT_WEEKS', rate: '8000', fringeIds: [], groupId: 'loc' },
      ] },
    ] },
  ],
  contractuals: [{ id: 'k', name: 'Contingency', percent: 10, appliesTo: ['Production'], excludeGroupIds: ['loc'] }],
};

describe('budget totals', () => {
  it('multiplies amount × X × rate and adds fringes (percent with cutoff, flat per unit)', () => {
    const t = budgetTotals(budget);
    // Director: 10 weeks × $15,000 = $150,000; tax 20% = $30,000; capped 10% of $10,000 = $1,000
    expect(t.details.get('d1')).toMatchObject({ subtotal: 15_000_000, fringes: 3_100_000, total: 18_100_000 });
    // DP: 20 days × $1,500 = $30,000; $50/day health = $1,000
    expect(t.details.get('d2')).toMatchObject({ subtotal: 3_000_000, fringes: 100_000 });
  });

  it('rolls up to the topsheet with contractual charges', () => {
    const t = budgetTotals(budget);
    expect(t.sections).toEqual({ ATL: 18_100_000, Production: 3_100_000 + 3_200_000, Post: 0, Other: 0 });
    expect(t.belowTheLine).toBe(6_300_000);
    // Contingency 10% of Production excluding the "Location shoot" group (camera rental $32,000)
    expect(t.contractuals[0].amount).toBe(310_000);
    expect(t.grandTotal).toBe(18_100_000 + 6_300_000 + 310_000);
    expect(t.fringeTotals.get('tax')).toBe(3_000_000);
  });

  it('flags formula errors on the line and treats them as zero', () => {
    const d = { id: 'x', description: '', amount: '1', units: 'Days' as const, x: 'NOPE', rate: '100', fringeIds: [] };
    expect(detailTotal(d, budget, {})).toMatchObject({ subtotal: 0, errors: ['Unknown global NOPE'] });
  });

  it('formats money', () => {
    expect(money(123456789)).toMatch(/1,234,568/);
    expect(money(123456, 'USD', true)).toMatch(/1,234\.56/);
  });
});

describe('starter budget and schedule link', async () => {
  const { starterBudget } = await import('./template');
  const { castLinesFromDood, scheduleGlobals } = await import('./scheduleLink');

  it('builds a working starter chart that uses SHOOT_DAYS from the schedule', () => {
    const b = starterBudget('Night Shift');
    expect(b.categories.map((c) => c.number)).toContain('1400');
    expect(b.categories.every((c) => c.accounts.length > 0)).toBe(true);
    const t = budgetTotals(b, scheduleGlobals({ shootDays: Array(25) } as never));
    expect(t.globals.SHOOT_WEEKS).toBe(5);
    expect(t.grandTotal).toBe(0);
  });

  it('adds a cast line per DOOD row and leaves linked ones alone', () => {
    const b = starterBudget('x');
    b.categories[3].accounts[0].details.push({ id: 'l', description: '1. ADA', amount: '1', units: 'Days', x: '3', rate: '2000', fringeIds: [], doodElement: '1. ADA' });
    const dood = { category: 'Cast Members', columns: [], rows: [
      { elementId: 'a', name: '1. ADA', cells: [], totals: { total: 5, work: 4, hold: 1, companyTravel: 0, holiday: 0, start: null, finish: null } },
      { elementId: 'b', name: '2. GRACE', cells: [], totals: { total: 2, work: 2, hold: 0, companyTravel: 0, holiday: 0, start: null, finish: null } },
    ] };
    let k = 0;
    const { added, days } = castLinesFromDood(b, dood, () => `n${k++}`);
    expect(added.map((d) => [d.description, d.x, d.units])).toEqual([['2. GRACE', '2', 'Days']]);
    expect(days.get('1. ADA')).toBe(5);
  });
});
