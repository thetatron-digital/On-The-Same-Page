import { describe, expect, it } from 'vitest';
import { starterBudget } from './template';
import { addDetail, addItem, applyDoodDays, blankDetail, deleteItem, updateDetail } from './edit';
import { budgetTotals } from './totals';

describe('budget edits', () => {
  it('adds and edits lines, and fringes/groups leave lines when deleted', () => {
    let b = starterBudget('x');
    const acc = b.categories[2].accounts[0];
    const fringe = b.fringes[0];
    b = addItem(b, 'groups', { name: 'Reshoots', color: '#f00' });
    const group = b.groups[0];
    b = addDetail(b, acc.id, blankDetail({ id: 'd1', description: 'Director', units: 'Weeks', x: '10', rate: '10000', fringeIds: [fringe.id], groupId: group.id }));
    b = updateDetail(b, 'd1', { rate: '12000' });
    expect(budgetTotals(b).accounts.get(acc.id)).toBe(12_000_000 + 2_400_000);
    b = deleteItem(b, 'fringes', fringe.id);
    b = deleteItem(b, 'groups', group.id);
    const line = b.categories[2].accounts[0].details[0];
    expect(line).toMatchObject({ fringeIds: [], groupId: undefined });
  });

  it('updates days on lines linked to the Day Out of Days', () => {
    let b = starterBudget('x');
    b = addDetail(b, b.categories[3].accounts[0].id, blankDetail({ id: 'c', description: '1. ADA', x: '3', doodElement: '1. ADA' }));
    const { budget, changed } = applyDoodDays(b, new Map([['1. ADA', 7], ['2. GRACE', 2]]));
    expect(changed).toBe(1);
    expect(budget.categories[3].accounts[0].details[0].x).toBe('7');
    expect(applyDoodDays(budget, new Map([['1. ADA', 7]])).changed).toBe(0);
  });
});
