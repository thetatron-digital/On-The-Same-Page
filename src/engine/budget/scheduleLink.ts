// Budget ↔ schedule: shoot days as a global, and cast lines that take
// their days from the Day Out of Days (work + hold + travel).
import type { Budget, BudgetDetail } from '../../types/budget';
import type { DOODReport } from '../../utils/doodReport';
import type { Schedule } from '../../types/screenplay';

export const scheduleGlobals = (schedule: Schedule | null) => ({ SHOOT_DAYS: schedule?.shootDays.length ?? 0 });

/**
 * Lines for every cast member on the DOOD (new ones to add to the cast
 * account) and the days to set on lines already linked.
 */
export function castLinesFromDood(budget: Budget, dood: DOODReport, newId: () => string): { added: BudgetDetail[]; days: Map<string, number> } {
  const linked = new Set(budget.categories.flatMap((c) => c.accounts.flatMap((a) => a.details.map((d) => d.doodElement).filter(Boolean))));
  const days = new Map(dood.rows.map((r) => [r.name, r.totals.total]));
  const added = dood.rows
    .filter((r) => !linked.has(r.name))
    .map((r) => ({
      id: newId(),
      description: r.name,
      amount: '1',
      units: 'Days' as const,
      x: String(r.totals.total),
      rate: '',
      fringeIds: [],
      doodElement: r.name,
    }));
  return { added, days };
}
