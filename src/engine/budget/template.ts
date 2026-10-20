// A starter feature-film budget: a generic chart of accounts in the usual
// order (above the line, production, post, other), placeholder fringes
// to replace with current rates, schedule globals and a contingency.
import type { Budget, BudgetCategory, BudgetSection } from '../../types/budget';

let n = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}`;

const CHART: [BudgetSection, string, string, [string, string][]][] = [
  ['ATL', '1100', 'Story & Rights', [['1101', 'Rights Purchase'], ['1102', 'Writers'], ['1103', 'Research & Clearances']]],
  ['ATL', '1200', 'Producers', [['1201', 'Executive Producers'], ['1202', 'Producers'], ['1203', 'Producer Assistants']]],
  ['ATL', '1300', 'Director', [['1301', 'Director'], ['1302', 'Director Assistant']]],
  ['ATL', '1400', 'Cast', [['1401', 'Principal Cast'], ['1402', 'Day Players'], ['1403', 'Stunt Performers'], ['1404', 'Casting']]],
  ['ATL', '1500', 'Above-the-Line Travel & Living', [['1501', 'Travel'], ['1502', 'Hotels & Per Diem']]],
  ['Production', '2000', 'Production Staff', [['2001', 'Unit Production Manager'], ['2002', 'Assistant Directors'], ['2003', 'Production Coordinator'], ['2004', 'Script Supervisor'], ['2005', 'Production Assistants']]],
  ['Production', '2100', 'Background & Stand-ins', [['2101', 'Background Actors'], ['2102', 'Stand-ins']]],
  ['Production', '2200', 'Art Department', [['2201', 'Production Designer'], ['2202', 'Art Director'], ['2203', 'Art Department Purchases']]],
  ['Production', '2300', 'Set Construction', [['2301', 'Construction Labor'], ['2302', 'Construction Materials']]],
  ['Production', '2500', 'Grip', [['2501', 'Key Grip & Crew'], ['2502', 'Grip Equipment']]],
  ['Production', '2700', 'Set Dressing', [['2701', 'Set Decorator & Crew'], ['2702', 'Set Dressing Purchases & Rentals']]],
  ['Production', '2800', 'Props', [['2801', 'Prop Master & Crew'], ['2802', 'Props Purchases & Rentals']]],
  ['Production', '2900', 'Wardrobe', [['2901', 'Costume Designer & Crew'], ['2902', 'Wardrobe Purchases & Rentals']]],
  ['Production', '3100', 'Makeup & Hair', [['3101', 'Makeup & Hair Crew'], ['3102', 'Supplies']]],
  ['Production', '3200', 'Lighting', [['3201', 'Gaffer & Crew'], ['3202', 'Lighting Equipment'], ['3203', 'Generator & Fuel']]],
  ['Production', '3300', 'Camera', [['3301', 'Director of Photography'], ['3302', 'Camera Crew'], ['3303', 'Camera Equipment']]],
  ['Production', '3400', 'Production Sound', [['3401', 'Sound Mixer & Crew'], ['3402', 'Sound Equipment']]],
  ['Production', '3500', 'Transportation', [['3501', 'Drivers'], ['3502', 'Vehicles & Fuel']]],
  ['Production', '3600', 'Locations', [['3601', 'Location Manager & Staff'], ['3602', 'Site Fees & Permits'], ['3603', 'Catering & Craft Services']]],
  ['Production', '3700', 'Media & Data', [['3701', 'DIT & Data Management'], ['3702', 'Media & Drives']]],
  ['Post', '4500', 'Editorial', [['4501', 'Editor & Assistants'], ['4502', 'Edit Equipment']]],
  ['Post', '4600', 'Music', [['4601', 'Composer'], ['4602', 'Licensing']]],
  ['Post', '4700', 'Post Sound', [['4701', 'Sound Editing & Mix'], ['4702', 'ADR & Foley']]],
  ['Post', '4800', 'Picture Finishing', [['4801', 'Color Grading'], ['4802', 'Deliverables']]],
  ['Post', '4900', 'Visual Effects & Titles', [['4901', 'Visual Effects'], ['4902', 'Titles & Graphics']]],
  ['Other', '6500', 'Publicity', [['6501', 'Stills & EPK'], ['6502', 'Festivals']]],
  ['Other', '6700', 'Insurance', [['6701', 'Production Package'], ['6702', 'Errors & Omissions']]],
  ['Other', '6800', 'General Expense', [['6801', 'Legal & Accounting'], ['6802', 'Office & Communications']]],
];

export function starterBudget(name: string): Budget {
  const categories: BudgetCategory[] = CHART.map(([section, number, catName, accounts]) => ({
    id: id('cat'), number, name: catName, section,
    accounts: accounts.map(([accNumber, accName]) => ({ id: id('acc'), number: accNumber, name: accName, details: [] })),
  }));
  return {
    id: id('budget'),
    name,
    currency: 'USD',
    globals: [
      { id: id('g'), name: 'PREP_WEEKS', value: '6', description: 'Weeks of prep' },
      { id: id('g'), name: 'SHOOT_WEEKS', value: `SHOOT_DAYS / 5`, description: 'Weeks of shooting (5-day weeks); SHOOT_DAYS comes from the schedule' },
      { id: id('g'), name: 'WRAP_WEEKS', value: '2', description: 'Weeks of wrap' },
      { id: id('g'), name: 'POST_WEEKS', value: '20', description: 'Weeks of post' },
    ],
    fringes: [
      { id: id('f'), name: 'Payroll Taxes', kind: 'percent', rate: 20, description: 'Placeholder: employer taxes and payroll fees. Replace with current rates.' },
      { id: id('f'), name: 'Union Pension & Health', kind: 'percent', rate: 15, description: 'Placeholder: check the current guild agreements.' },
      { id: id('f'), name: 'Workers Comp', kind: 'percent', rate: 3, description: 'Placeholder' },
    ],
    groups: [],
    categories,
    contractuals: [
      { id: id('k'), name: 'Contingency', percent: 10, appliesTo: ['Production', 'Post', 'Other'], excludeGroupIds: [] },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
