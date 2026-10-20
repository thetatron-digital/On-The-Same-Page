// BottomLine: a Movie Magic Budgeting-style budget. Three levels like MMB
// (Topsheet → Category → Account detail), plus setup for globals, fringes,
// groups and contractual charges. Shoot days and cast days come from
// BaseCamp's schedule and Day Out of Days.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import { budgetTotals } from '../../engine/budget/totals';
import { scheduleGlobals } from '../../engine/budget/scheduleLink';
import { AccountLevel, CategoryLevel, Topsheet } from './BudgetLevels';
import { BudgetSetup, type SetupTab } from './BudgetSetup';
import { budgetCsv, topsheetPdf } from './budgetExport';
import './bottomline.css';

export type Level = { kind: 'topsheet' } | { kind: 'category'; id: string } | { kind: 'account'; id: string };

export default function BottomLine() {
  const { budget, schedule, darkMode, initializeBudget, updateBudget } = useScreenplayStore(
    useShallow((s) => ({ budget: s.budget, schedule: s.schedule, darkMode: s.darkMode, initializeBudget: s.initializeBudget, updateBudget: s.updateBudget }))
  );
  const [level, setLevel] = useState<Level>({ kind: 'topsheet' });
  const [setup, setSetup] = useState<SetupTab | null>(null);
  const extra = useMemo(() => scheduleGlobals(schedule), [schedule]);
  const totals = useMemo(() => (budget ? budgetTotals(budget, extra) : null), [budget, extra]);

  if (!budget || !totals) {
    return (
      <div className={`bl-app ${darkMode ? 'dark' : 'light'}`}>
        <div className="bl-empty">
          <h2>BottomLine</h2>
          <p>Budget the production: a topsheet over categories, accounts and detail lines, with fringes, globals and contractual charges. Shoot days and cast days come from the schedule.</p>
          <button className="bl-btn primary" onClick={initializeBudget}>Start a Budget</button>
          <p className="bl-muted">Starts from a generic feature-film chart of accounts. Fringe rates are placeholders to replace with current ones.</p>
        </div>
      </div>
    );
  }

  const category = level.kind === 'category' ? budget.categories.find((c) => c.id === level.id)
    : level.kind === 'account' ? budget.categories.find((c) => c.accounts.some((a) => a.id === level.id)) : undefined;
  const account = level.kind === 'account' ? category?.accounts.find((a) => a.id === level.id) : undefined;

  const save = (blob: Blob, name: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className={`bl-app ${darkMode ? 'dark' : 'light'}`}>
      <div className="bl-header">
        <nav className="bl-crumbs" aria-label="Budget level">
          <button className={level.kind === 'topsheet' ? 'current' : ''} onClick={() => setLevel({ kind: 'topsheet' })}>Topsheet</button>
          {category && <><span>›</span><button className={level.kind === 'category' ? 'current' : ''} onClick={() => setLevel({ kind: 'category', id: category.id })}>{category.number} {category.name}</button></>}
          {account && <><span>›</span><button className="current">{account.number} {account.name}</button></>}
        </nav>
        <div className="bl-header-end">
          {(['globals', 'fringes', 'groups', 'contractuals'] as SetupTab[]).map((t) => (
            <button key={t} className={`bl-btn ${setup === t ? 'on' : ''}`} onClick={() => setSetup(setup === t ? null : t)}>
              {t === 'contractuals' ? 'Contractual Charges' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button className="bl-btn" onClick={() => save(topsheetPdf(budget, totals).output('blob'), `${budget.name} Topsheet.pdf`)}>Topsheet PDF</button>
          <button className="bl-btn" onClick={() => save(new Blob([budgetCsv(budget, totals)], { type: 'text/csv;charset=utf-8' }), `${budget.name} Budget.csv`)}>CSV</button>
        </div>
      </div>

      <div className="bl-body">
        <main className="bl-main">
          {level.kind === 'topsheet' && <Topsheet budget={budget} totals={totals} onOpen={(id) => setLevel({ kind: 'category', id })} onChange={updateBudget} />}
          {level.kind === 'category' && category && <CategoryLevel budget={budget} category={category} totals={totals} onOpen={(id) => setLevel({ kind: 'account', id })} onChange={updateBudget} />}
          {level.kind === 'account' && account && category && <AccountLevel budget={budget} category={category} account={account} totals={totals} onChange={updateBudget} />}
          {level.kind !== 'topsheet' && !category && <p className="bl-muted">That part of the budget was removed. <button className="bl-link" onClick={() => setLevel({ kind: 'topsheet' })}>Back to the Topsheet</button></p>}
        </main>
        {setup && <BudgetSetup tab={setup} budget={budget} totals={totals} scheduleGlobals={extra} onChange={updateBudget} onClose={() => setSetup(null)} />}
      </div>
    </div>
  );
}
