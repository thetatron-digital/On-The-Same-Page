// Crew lines from BaseCamp People: department picks the budget category,
// position picks above or below the line, pay rate and period fill the line.
import type { Budget, BudgetDetail } from '../../types/budget';
import type { ProductionPerson } from '../../types/screenplay';

const DEPARTMENT_CATEGORY: Record<string, string> = {
  production: '2000', direction: '2000', camera: '3300', sound: '3400', art: '2200', wardrobe: '2900',
  'hair & makeup': '3100', makeup: '3100', grip: '2500', electric: '3200', lighting: '3200', locations: '3600',
  'post-production': '4500', post: '4500', 'catering & craft services': '3600', transportation: '3500',
  aerial: '3300', 'additional crew': '2000', props: '2800', 'set dressing': '2700', construction: '2300', editorial: '4500',
};

/** Budget category number for a crew role */
export function categoryForRole(department: string, position: string): string {
  const p = position.toLowerCase();
  if (/\bwriter|screenwriter/.test(p)) return '1100';
  if (/producer/.test(p) && !/line producer|co-?ordinator/.test(p)) return '1200';
  if (/^director$|^film director$/.test(p.trim())) return '1300';
  if (/director of photography|cinematographer|\bdp\b/.test(p)) return '3300';
  return DEPARTMENT_CATEGORY[department.trim().toLowerCase()] ?? '2000';
}

const NON_LABOR = /purchase|rental|equipment|material|supplies|fee|permit|catering|vehicle|fuel|drive|media/i;

/** Lines for crew with a pay rate who aren't in the budget yet, by account id */
export function crewLinesFromPeople(budget: Budget, people: ProductionPerson[], newId: () => string): { accountId: string; detail: BudgetDetail }[] {
  const linked = new Set(budget.categories.flatMap((c) => c.accounts.flatMap((a) => a.details.map((d) => d.personId).filter(Boolean))));
  const payroll = budget.fringes.find((f) => /payroll/i.test(f.name));
  const out: { accountId: string; detail: BudgetDetail }[] = [];
  for (const person of people) {
    if (person.group !== 'Crew' || !person.payRate?.amount || linked.has(person.id)) continue;
    const role = person.roles.find((r) => r.group === 'Crew') ?? { department: '', position: '' };
    const number = categoryForRole(role.department, role.position);
    const cat = budget.categories.find((c) => c.number === number) ?? budget.categories.find((c) => c.section === 'Production');
    const account = cat?.accounts.find((a) => !NON_LABOR.test(a.name)) ?? cat?.accounts[0];
    if (!account) continue;
    const period = person.payRate.period;
    const [units, x] = period === 'Per Day' ? ['Days', 'SHOOT_DAYS'] as const
      : period === 'Per Week' ? ['Weeks', 'SHOOT_WEEKS'] as const
        : period === 'Per Hour' ? ['Hours', 'SHOOT_DAYS * 10'] as const
          : ['Flat', '1'] as const;
    out.push({
      accountId: account.id,
      detail: {
        id: newId(),
        description: `${role.position || 'Crew'}: ${`${person.firstName} ${person.lastName}`.trim()}`,
        amount: '1',
        units,
        x,
        rate: String(person.payRate.amount),
        fringeIds: payroll ? [payroll.id] : [],
        personId: person.id,
      },
    });
  }
  return out;
}
