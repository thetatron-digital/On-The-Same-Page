// BottomLine: Movie Magic Budgeting-style production budget. Money is in
// whole cents; amounts, X and rates are formulas that may use globals.

export type BudgetSection = 'ATL' | 'Production' | 'Post' | 'Other';

export const SECTION_LABELS: Record<BudgetSection, string> = {
  ATL: 'Total Above-the-Line',
  Production: 'Total Production',
  Post: 'Total Post Production',
  Other: 'Total Other',
};

export const UNITS = ['Allow', 'Flat', 'Days', 'Weeks', 'Hours', 'Months', 'Each', 'Episodes', 'Reels', 'Miles', 'Units'] as const;
export type BudgetUnit = (typeof UNITS)[number];

export interface BudgetGlobal {
  id: string;
  name: string;   // used in formulas, e.g. SHOOT_DAYS
  value: string;  // formula
  description?: string;
}

export interface BudgetFringe {
  id: string;
  name: string;           // e.g. "Payroll Taxes"
  kind: 'percent' | 'flat';
  rate: number;           // percent (e.g. 20) or cents per unit (flat)
  cutoffCents?: number;   // percent fringes stop at this base per line
  description?: string;
}

export interface BudgetGroup {
  id: string;
  name: string;
  color: string;
}

export interface BudgetDetail {
  id: string;
  description: string;
  amount: string;     // formula: how many (people, items)
  units: BudgetUnit;
  x: string;          // formula: how many units (days, weeks…)
  rate: string;       // formula, in currency (e.g. "1,250")
  fringeIds: string[];
  groupId?: string;
  note?: string;
  // Filled from the schedule: Day Out of Days work days for a cast member
  doodElement?: string;
}

export interface BudgetAccount {
  id: string;
  number: string;
  name: string;
  details: BudgetDetail[];
}

export interface BudgetCategory {
  id: string;
  number: string;
  name: string;
  section: BudgetSection;
  accounts: BudgetAccount[];
}

export interface BudgetContractual {
  id: string;
  name: string;               // e.g. Contingency
  percent: number;
  appliesTo: BudgetSection[]; // sections it's a percentage of
  excludeGroupIds: string[];  // groups not included in the base
}

/** A saved copy of the totals, to compare the budget against later */
export interface BudgetSnapshot {
  id: string;
  name: string;               // e.g. "Locked 10/20", "Studio draft"
  createdAt: Date;
  categories: Record<string, number>; // category id -> cents
  accounts: Record<string, number>;   // account id -> cents
  sections: Record<BudgetSection, number>;
  contractuals: number;
  grandTotal: number;
}

export interface Budget {
  id: string;
  name: string;
  currency: string; // ISO code
  globals: BudgetGlobal[];
  fringes: BudgetFringe[];
  groups: BudgetGroup[];
  categories: BudgetCategory[];
  contractuals: BudgetContractual[];
  /** Money spent so far, entered per account (cents) */
  actuals?: Record<string, number>;
  /** Count ArtCart purchases and rentals as actuals */
  artCartActuals?: boolean;
  snapshots?: BudgetSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}
