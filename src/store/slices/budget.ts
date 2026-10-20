// BottomLine: the production budget (one per project)
import type { StateCreator } from 'zustand';
import type { BudgetSlice, ScreenplayState } from '../types';
import { starterBudget } from '../../engine/budget/template';

export const createBudgetSlice: StateCreator<ScreenplayState, [], [], BudgetSlice> = (set, get) => ({
  budget: null,

  initializeBudget: () => {
    if (get().budget) return;
    set({ budget: starterBudget(get().screenplay.title || 'Production Budget'), isDirty: true });
  },

  // Budget edits are pure functions over the whole budget (engine/budget/edit.ts)
  updateBudget: (change) => {
    const budget = get().budget;
    if (!budget) return;
    set({ budget: { ...change(budget), updatedAt: new Date() }, isDirty: true });
  },
});
