// End to end: one small production from script to wrap, through the real
// store and engines. Guards the hand-offs between apps.
import { beforeAll, describe, expect, it } from 'vitest';
import { useScreenplayStore } from './store/screenplayStore';
import { parseFountain } from './utils/fountain';
import { tagAllCharacters } from './commands/tagging';
import { buildScheduleDOOD, CAST_CATEGORY } from './utils/doodReport';
import { callSheetRecipients } from './utils/callSheetDistribution';
import { buildProductionReport } from './engine/schedule/productionReport';
import { budgetTotals } from './engine/budget/totals';
import { castLinesFromDood, scheduleGlobals } from './engine/budget/scheduleLink';
import { addDetail, newBudgetId, updateDetail } from './engine/budget/edit';
import { buildSearchIndex, searchIndex } from './engine/search';
import { parseProjectData } from './utils/projectData';

const S = () => useScreenplayStore.getState();

const SCRIPT = `Title: Night Shift

INT. DINER - NIGHT

Rain streaks the windows. MAYA (30s) wipes the counter.

MAYA
We're closed.

LEO
Not for me.

EXT. PARKING LOT - NIGHT

Leo's car idles under a flickering light.

LEO
Get in.

INT. DINER - DAY

Morning light. Maya alone, counting the till.

MAYA
Same as always.
`;

describe('script to wrap', () => {
  beforeAll(() => {
    S().resetToNew();
    S().setScreenplay(parseFountain(SCRIPT).screenplay);
  });

  it('breaks the script down: scenes and cast', () => {
    S().initializeBreakdown();
    const added = tagAllCharacters();
    expect(added).toBe(4); // MAYA ×2 scenes, LEO ×2 scenes
    const b = S().breakdown!;
    expect(b.scenes).toHaveLength(3);
    expect(b.elementList!.filter((e) => e.category === 'Cast Members').map((e) => e.name).sort()).toEqual(['LEO', 'MAYA']);
  });

  it('schedules it and works out the Day Out of Days', () => {
    S().initializeSchedule();
    S().importStripsFromBreakdown();
    const schedule = S().schedule!;
    expect(schedule.strips).toHaveLength(3);
    const day1 = S().addShootDay();
    const day2 = S().addShootDay();
    const [diner, lot, morning] = S().schedule!.strips;
    S().assignStripToDay(diner.id, day1);
    S().assignStripToDay(lot.id, day1);
    S().assignStripToDay(morning.id, day2);
    const dood = buildScheduleDOOD(S().schedule!, CAST_CATEGORY, { breakdown: S().breakdown, people: S().productionData.people });
    const byName = Object.fromEntries(dood.rows.map((r) => [r.name.replace(/^\d+\.\s*/, ''), r.totals.work]));
    expect(byName).toEqual({ MAYA: 2, LEO: 1 });
  });

  it('sends a call sheet to the cast with their own call times', () => {
    const maya = S().addPerson({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '', group: 'Talent', roles: [{ group: 'Talent', department: '', position: '', characterName: 'MAYA' }], tags: [], notes: '', castNumber: 1 });
    const day1 = S().schedule!.shootDays[0];
    const cs = S().addCallSheet({
      title: 'Night Shift', date: '2026-11-02', dayNumber: 1, totalDays: 2, crewCall: '6:00 PM', shootingCall: '7:00 PM', firstMeal: '12:00 AM', estimatedWrap: '6:00 AM',
      producer: '', director: '', locationIds: [], scenes: [], talentCalls: [{ personId: maya, callTime: '6:30 PM' }], crewCalls: [], notes: '', nearestHospital: '', disclaimer: '', status: 'draft', shootDayId: day1.id,
    });
    const sheet = S().productionData.callSheets.find((c) => c.id === cs)!;
    expect(callSheetRecipients(sheet, S().productionData.people).recipients).toEqual([
      expect.objectContaining({ name: 'Ada Lovelace', role: 'Cast: MAYA', callTime: '6:30 PM' }),
    ]);
  });

  it('runs the day on OnSet and SuperVisor, and writes the Production Report', () => {
    const day1 = S().schedule!.shootDays[0];
    S().startProductionDay(day1.id);
    S().markStripComplete(day1.strips[0]);
    S().startSupervisorSession(day1.id);
    S().logTake({ sceneNumber: '1', shotId: '', shotNumber: '1A', takeNumber: 1, camera: 'A', circled: false, rating: 'NG' });
    S().logTake({ sceneNumber: '1', shotId: '', shotNumber: '1A', takeNumber: 2, camera: 'A', circled: true, rating: 'Print' });
    const report = buildProductionReport(S().schedule!, day1.id, { superVisor: S().superVisor, onSet: S().onSet })!;
    expect(report.scenes.map((s) => s.status)).toEqual(['complete', 'not-shot']);
    expect(report.supervisor).toMatchObject({ takes: 2, prints: 1, ng: 1 });
    expect(report.scenesProgress).toMatchObject({ today: 1, toDate: 1, total: 3 });
  });

  it('budgets the cast from the Day Out of Days', () => {
    S().initializeBudget();
    const cast = S().budget!.categories.find((c) => c.number === '1400')!.accounts[0];
    const dood = buildScheduleDOOD(S().schedule!, CAST_CATEGORY, { breakdown: S().breakdown, people: S().productionData.people });
    const { added } = castLinesFromDood(S().budget!, dood, () => newBudgetId('d'));
    S().updateBudget((b) => added.reduce((acc, d) => addDetail(acc, cast.id, d), b));
    const maya = S().budget!.categories.flatMap((c) => c.accounts.flatMap((a) => a.details)).find((d) => d.description.includes('MAYA'))!;
    S().updateBudget((b) => updateDetail(b, maya.id, { rate: '1000' }));
    const totals = budgetTotals(S().budget!, scheduleGlobals(S().schedule));
    expect(totals.details.get(maya.id)?.subtotal).toBe(2 * 1000 * 100); // 2 days × $1,000
    expect(totals.globals.SHOOT_DAYS).toBe(2);
  });

  it('finds things across apps', () => {
    const index = buildSearchIndex(S().getProjectData());
    expect(searchIndex(index, 'parking')[0]).toMatchObject({ kind: 'scene', app: 'rewriter' });
    expect(searchIndex(index, 'leo').some((r) => r.kind === 'character')).toBe(true);
    expect(searchIndex(index, 'lovelace')[0]).toMatchObject({ kind: 'person', app: 'basecamp' });
  });

  it('saves and reopens with every app intact', () => {
    const json = JSON.stringify(S().getProjectData());
    S().resetToNew();
    S().loadFromProjectData(parseProjectData(json));
    expect(S().breakdown!.scenes).toHaveLength(3);
    expect(S().schedule!.shootDays).toHaveLength(2);
    expect(S().productionData.callSheets).toHaveLength(1);
    expect(S().superVisor!.sessions[0].takes).toHaveLength(2);
    expect(S().budget!.categories.length).toBeGreaterThan(10);
    expect(S().screenplay.elements.filter((e) => e.type === 'Scene Heading')).toHaveLength(3);
  });
});
