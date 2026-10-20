// Budget vs actual, and saved versions to compare against
import type { Budget, BudgetSection, BudgetSnapshot } from '../../types/budget';
import type { ArtCartItem } from '../../types/screenplay';
import { SECTIONS, type BudgetTotals } from './totals';

// ArtCart categories and the budget category numbers they're spent in
const ARTCART_TO_CATEGORY: Record<string, string[]> = {
  Props: ['2800'],
  'Set Dressing': ['2700'],
  Greenery: ['2700'],
  Vehicles: ['3500'],
  Wardrobe: ['2900'],
  Makeup: ['3100'],
  'Special Equipment': ['2200'],
};

/** Account an ArtCart category's spending goes to: the category's purchases account, else its first */
export function artCartAccount(budget: Budget, artCategory: string): string | null {
  const numbers = ARTCART_TO_CATEGORY[artCategory] ?? [];
  const cat = budget.categories.find((c) => numbers.includes(c.number))
    ?? budget.categories.find((c) => c.name.toLowerCase().includes(artCategory.toLowerCase()));
  if (!cat || !cat.accounts.length) return null;
  return (cat.accounts.find((a) => /purchase|rental/i.test(a.name)) ?? cat.accounts[cat.accounts.length - 1]).id;
}

/** ArtCart spending per account (actual cost × quantity; estimate when no actual yet is not spent) */
export function artCartSpend(budget: Budget, items: ArtCartItem[]): Map<string, number> {
  const spend = new Map<string, number>();
  for (const item of items) {
    if (!item.actualCost) continue;
    const account = artCartAccount(budget, String(item.category));
    if (!account) continue;
    spend.set(account, (spend.get(account) ?? 0) + Math.round(item.actualCost * (item.quantity || 1) * 100));
  }
  return spend;
}

export interface ActualTotals {
  accounts: Map<string, number>;
  categories: Map<string, number>;
  sections: Record<BudgetSection, number>;
  total: number;
}

export function actualTotals(budget: Budget, artCartItems: ArtCartItem[] = []): ActualTotals {
  const fromArt = budget.artCartActuals ? artCartSpend(budget, artCartItems) : new Map<string, number>();
  const accounts = new Map<string, number>();
  const categories = new Map<string, number>();
  const sections: Record<BudgetSection, number> = { ATL: 0, Production: 0, Post: 0, Other: 0 };
  for (const cat of budget.categories) {
    let catTotal = 0;
    for (const acc of cat.accounts) {
      const v = (budget.actuals?.[acc.id] ?? 0) + (fromArt.get(acc.id) ?? 0);
      if (v) accounts.set(acc.id, v);
      catTotal += v;
    }
    categories.set(cat.id, catTotal);
    sections[cat.section] += catTotal;
  }
  return { accounts, categories, sections, total: SECTIONS.reduce((n, s) => n + sections[s], 0) };
}

export function takeSnapshot(totals: BudgetTotals, name: string, id: string): BudgetSnapshot {
  return {
    id,
    name,
    createdAt: new Date(),
    categories: Object.fromEntries(totals.categories),
    accounts: Object.fromEntries(totals.accounts),
    sections: { ...totals.sections },
    contractuals: totals.contractuals.reduce((n, k) => n + k.amount, 0),
    grandTotal: totals.grandTotal,
  };
}
