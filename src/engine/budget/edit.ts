// Pure edits over a budget, so the store keeps one update path
import type { Budget, BudgetAccount, BudgetCategory, BudgetContractual, BudgetDetail, BudgetFringe, BudgetGlobal, BudgetGroup } from '../../types/budget';

let n = 0;
export const newBudgetId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(n++).toString(36)}`;

const mapAccounts = (b: Budget, fn: (a: BudgetAccount, c: BudgetCategory) => BudgetAccount): Budget => ({
  ...b,
  categories: b.categories.map((c) => ({ ...c, accounts: c.accounts.map((a) => fn(a, c)) })),
});

export const blankDetail = (extra: Partial<BudgetDetail> = {}): BudgetDetail => ({
  id: newBudgetId('d'), description: '', amount: '1', units: 'Allow', x: '1', rate: '', fringeIds: [], ...extra,
});

export const addDetail = (b: Budget, accountId: string, detail: BudgetDetail = blankDetail(), afterId?: string): Budget =>
  mapAccounts(b, (a) => {
    if (a.id !== accountId) return a;
    const i = afterId ? a.details.findIndex((d) => d.id === afterId) : -1;
    const details = [...a.details];
    details.splice(i >= 0 ? i + 1 : details.length, 0, detail);
    return { ...a, details };
  });

export const updateDetail = (b: Budget, detailId: string, patch: Partial<BudgetDetail>): Budget =>
  mapAccounts(b, (a) => (a.details.some((d) => d.id === detailId) ? { ...a, details: a.details.map((d) => (d.id === detailId ? { ...d, ...patch } : d)) } : a));

export const deleteDetail = (b: Budget, detailId: string): Budget =>
  mapAccounts(b, (a) => ({ ...a, details: a.details.filter((d) => d.id !== detailId) }));

export const addAccount = (b: Budget, categoryId: string, number: string, name: string): Budget => ({
  ...b,
  categories: b.categories.map((c) => (c.id !== categoryId ? c : {
    ...c,
    accounts: [...c.accounts, { id: newBudgetId('acc'), number, name, details: [] }].sort((x, y) => x.number.localeCompare(y.number, undefined, { numeric: true })),
  })),
});

export const updateAccount = (b: Budget, accountId: string, patch: Partial<Omit<BudgetAccount, 'details'>>): Budget =>
  mapAccounts(b, (a) => (a.id === accountId ? { ...a, ...patch } : a));

export const deleteAccount = (b: Budget, accountId: string): Budget => ({
  ...b, categories: b.categories.map((c) => ({ ...c, accounts: c.accounts.filter((a) => a.id !== accountId) })),
});

export const addCategory = (b: Budget, cat: Omit<BudgetCategory, 'id' | 'accounts'>): Budget => ({
  ...b,
  categories: [...b.categories, { ...cat, id: newBudgetId('cat'), accounts: [] }].sort((x, y) => x.number.localeCompare(y.number, undefined, { numeric: true })),
});

export const updateCategory = (b: Budget, categoryId: string, patch: Partial<Omit<BudgetCategory, 'accounts'>>): Budget => ({
  ...b, categories: b.categories.map((c) => (c.id === categoryId ? { ...c, ...patch } : c)),
});

export const deleteCategory = (b: Budget, categoryId: string): Budget => ({ ...b, categories: b.categories.filter((c) => c.id !== categoryId) });

// Globals, fringes, groups, contractual charges
type Listed = 'globals' | 'fringes' | 'groups' | 'contractuals';
type ItemOf<K extends Listed> = K extends 'globals' ? BudgetGlobal : K extends 'fringes' ? BudgetFringe : K extends 'groups' ? BudgetGroup : BudgetContractual;

export const addItem = <K extends Listed>(b: Budget, key: K, item: Omit<ItemOf<K>, 'id'>): Budget =>
  ({ ...b, [key]: [...(b[key] as ItemOf<K>[]), { ...item, id: newBudgetId(key.slice(0, 1)) }] });

export const updateItem = <K extends Listed>(b: Budget, key: K, id: string, patch: Partial<ItemOf<K>>): Budget =>
  ({ ...b, [key]: (b[key] as ItemOf<K>[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) });

/** Remove a global/fringe/group/charge; fringes and groups also leave the lines that use them */
export function deleteItem(b: Budget, key: Listed, id: string): Budget {
  let next: Budget = { ...b, [key]: (b[key] as { id: string }[]).filter((x) => x.id !== id) };
  if (key === 'fringes') next = mapAccounts(next, (a) => ({ ...a, details: a.details.map((d) => (d.fringeIds.includes(id) ? { ...d, fringeIds: d.fringeIds.filter((f) => f !== id) } : d)) }));
  if (key === 'groups') {
    next = mapAccounts(next, (a) => ({ ...a, details: a.details.map((d) => (d.groupId === id ? { ...d, groupId: undefined } : d)) }));
    next = { ...next, contractuals: next.contractuals.map((c) => ({ ...c, excludeGroupIds: c.excludeGroupIds.filter((g) => g !== id) })) };
  }
  return next;
}

/** Set X (days) on lines linked to Day Out of Days elements; returns how many changed */
export function applyDoodDays(b: Budget, days: Map<string, number>): { budget: Budget; changed: number } {
  let changed = 0;
  const budget = mapAccounts(b, (a) => ({
    ...a,
    details: a.details.map((d) => {
      if (!d.doodElement || !days.has(d.doodElement)) return d;
      const x = String(days.get(d.doodElement));
      if (x === d.x) return d;
      changed++;
      return { ...d, x };
    }),
  }));
  return { budget, changed };
}
