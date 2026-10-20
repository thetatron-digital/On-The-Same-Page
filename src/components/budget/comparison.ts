// What the budget is compared with: money spent (actuals) or a saved version
import type { Budget, BudgetSection } from '../../types/budget';
import type { ArtCartItem } from '../../types/screenplay';
import { actualTotals } from '../../engine/budget/actuals';

export interface Comparison {
  kind: 'actuals' | 'version';
  label: string;          // column heading
  varianceLabel: string;
  category: (id: string) => number;
  account: (id: string) => number;
  sections: Record<BudgetSection, number>;
  total: number;
  /** variance shown for a budget figure against the compared one */
  variance: (budgeted: number, compared: number) => number;
}

export function makeComparison(budget: Budget, key: string, artCartItems: ArtCartItem[]): Comparison | null {
  if (key === 'actuals') {
    const a = actualTotals(budget, artCartItems);
    return {
      kind: 'actuals', label: 'Actual', varianceLabel: 'Remaining',
      category: (id) => a.categories.get(id) ?? 0, account: (id) => a.accounts.get(id) ?? 0,
      sections: a.sections, total: a.total, variance: (b, c) => b - c,
    };
  }
  const snap = budget.snapshots?.find((s) => s.id === key);
  if (!snap) return null;
  return {
    kind: 'version', label: snap.name, varianceLabel: 'Change',
    category: (id) => snap.categories[id] ?? 0, account: (id) => snap.accounts[id] ?? 0,
    sections: snap.sections, total: snap.grandTotal, variance: (b, c) => b - c,
  };
}
