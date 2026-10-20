// Budget arithmetic: detail line = amount × X × rate (in cents), fringes
// on top, rolled up to accounts, categories, sections and the topsheet,
// plus contractual charges (percentages of chosen sections).
import type { Budget, BudgetDetail, BudgetSection } from '../../types/budget';
import { tryEvaluate, type Globals } from './formula';

export const SECTIONS: BudgetSection[] = ['ATL', 'Production', 'Post', 'Other'];

export interface DetailTotal {
  subtotal: number; // cents
  fringes: number;  // cents
  total: number;    // cents
  units: number;    // amount × X (for flat fringes)
  errors: string[];
}

/** Globals in order: later ones may use earlier ones */
export function resolveGlobals(budget: Budget, extra: Globals = {}): { values: Globals; errors: Record<string, string> } {
  const values: Globals = { ...extra };
  const errors: Record<string, string> = {};
  for (const g of budget.globals) {
    const r = tryEvaluate(g.value, values);
    values[g.name] = r.value;
    if (r.error) errors[g.id] = r.error;
  }
  return { values, errors };
}

export function detailTotal(d: BudgetDetail, budget: Budget, globals: Globals): DetailTotal {
  const errors: string[] = [];
  const val = (f: string, fallback: number) => {
    if (!f.trim()) return fallback;
    const r = tryEvaluate(f, globals);
    if (r.error) errors.push(r.error);
    return r.value;
  };
  const amount = val(d.amount, 1);
  const x = val(d.x, 1);
  const rate = val(d.rate, 0);
  const subtotal = Math.round(amount * x * rate * 100);
  const units = amount * x;
  let fringes = 0;
  for (const id of d.fringeIds) {
    const f = budget.fringes.find((fr) => fr.id === id);
    if (!f) continue;
    if (f.kind === 'percent') {
      const base = f.cutoffCents !== undefined ? Math.min(subtotal, f.cutoffCents) : subtotal;
      fringes += Math.round((base * f.rate) / 100);
    } else {
      fringes += Math.round(f.rate * units);
    }
  }
  return { subtotal, fringes, total: subtotal + fringes, units, errors };
}

export interface BudgetTotals {
  globals: Globals;
  details: Map<string, DetailTotal>;
  accounts: Map<string, number>;    // cents incl. fringes
  categories: Map<string, number>;
  sections: Record<BudgetSection, number>;
  fringeTotals: Map<string, number>; // per fringe, cents
  belowTheLine: number;
  direct: number;                    // all sections
  contractuals: { id: string; name: string; amount: number }[];
  grandTotal: number;
}

export function budgetTotals(budget: Budget, extraGlobals: Globals = {}): BudgetTotals {
  const { values } = resolveGlobals(budget, extraGlobals);
  const details = new Map<string, DetailTotal>();
  const accounts = new Map<string, number>();
  const categories = new Map<string, number>();
  const fringeTotals = new Map<string, number>();
  const sections: Record<BudgetSection, number> = { ATL: 0, Production: 0, Post: 0, Other: 0 };
  // Base for contractuals: per section, excluding chosen groups
  const groupInSection = new Map<string, number>(); // `${section}|${groupId}` -> cents

  for (const cat of budget.categories) {
    let catTotal = 0;
    for (const acc of cat.accounts) {
      let accTotal = 0;
      for (const d of acc.details) {
        const t = detailTotal(d, budget, values);
        details.set(d.id, t);
        accTotal += t.total;
        if (d.groupId) groupInSection.set(`${cat.section}|${d.groupId}`, (groupInSection.get(`${cat.section}|${d.groupId}`) ?? 0) + t.total);
        // fringe breakdown
        for (const id of d.fringeIds) {
          const f = budget.fringes.find((fr) => fr.id === id);
          if (!f) continue;
          const one = detailTotal({ ...d, fringeIds: [id] }, budget, values).fringes;
          fringeTotals.set(id, (fringeTotals.get(id) ?? 0) + one);
        }
      }
      accounts.set(acc.id, accTotal);
      catTotal += accTotal;
    }
    categories.set(cat.id, catTotal);
    sections[cat.section] += catTotal;
  }

  const direct = SECTIONS.reduce((n, s) => n + sections[s], 0);
  const contractuals = budget.contractuals.map((c) => {
    const base = c.appliesTo.reduce((n, s) => n + sections[s] - c.excludeGroupIds.reduce((m, g) => m + (groupInSection.get(`${s}|${g}`) ?? 0), 0), 0);
    return { id: c.id, name: c.name, amount: Math.round((base * c.percent) / 100) };
  });
  return {
    globals: values,
    details,
    accounts,
    categories,
    sections,
    fringeTotals,
    belowTheLine: sections.Production + sections.Post + sections.Other,
    direct,
    contractuals,
    grandTotal: direct + contractuals.reduce((n, c) => n + c.amount, 0),
  };
}

/** "$1,234,567" (whole units) or with cents */
export function money(cents: number, currency = 'USD', withCents = false): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: withCents ? 2 : 0, maximumFractionDigits: withCents ? 2 : 0 }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(withCents ? 2 : 0);
  }
}
