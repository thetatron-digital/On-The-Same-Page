import { describe, expect, it } from 'vitest';
import type { ArtCartItem } from '../../types/screenplay';
import { starterBudget } from './template';
import { actualTotals, artCartAccount, takeSnapshot } from './actuals';
import { budgetTotals } from './totals';
import { addDetail, blankDetail } from './edit';

const item = (category: string, actualCost: number | undefined, quantity = 1) => ({ id: category, name: category, category, quantity, actualCost } as unknown as ArtCartItem);

describe('budget actuals and versions', () => {
  it('sends ArtCart spending to the purchases account of the matching category', () => {
    const b = starterBudget('x');
    const props = b.categories.find((c) => c.number === '2800')!;
    expect(artCartAccount(b, 'Props')).toBe(props.accounts.find((a) => /Purchases/.test(a.name))!.id);
    expect(artCartAccount(b, 'Unknown')).toBeNull();
  });

  it('adds manual actuals and ArtCart actuals (cost × quantity) when switched on', () => {
    const b = starterBudget('x');
    const dir = b.categories.find((c) => c.number === '1300')!.accounts[0];
    const withActuals = { ...b, actuals: { [dir.id]: 500_000 }, artCartActuals: true };
    const items = [item('Props', 120, 3), item('Wardrobe', 80), item('Props', undefined)];
    const a = actualTotals(withActuals, items);
    expect(a.sections.ATL).toBe(500_000);
    expect(a.sections.Production).toBe(36_000 + 8_000);
    expect(actualTotals({ ...withActuals, artCartActuals: false }, items).sections.Production).toBe(0);
  });

  it('snapshots totals to compare later', () => {
    let b = starterBudget('x');
    const acc = b.categories[0].accounts[0];
    b = addDetail(b, acc.id, blankDetail({ rate: '1000' }));
    const snap = takeSnapshot(budgetTotals(b), 'Draft', 's1');
    expect(snap).toMatchObject({ name: 'Draft', grandTotal: 100_000, accounts: { [acc.id]: 100_000 } });
  });
});
