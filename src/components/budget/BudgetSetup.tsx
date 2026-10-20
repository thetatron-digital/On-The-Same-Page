// Budget setup: globals (named values for formulas), fringes, groups and
// contractual charges, like MMB's setup windows
import type { Budget, BudgetSection } from '../../types/budget';
import { SECTIONS, money, type BudgetTotals } from '../../engine/budget/totals';
import { addItem, deleteItem, updateItem } from '../../engine/budget/edit';
import { resolveGlobals } from '../../engine/budget/totals';

export type SetupTab = 'globals' | 'fringes' | 'groups' | 'contractuals';
type Change = (fn: (b: Budget) => Budget) => void;

const SECTION_SHORT: Record<BudgetSection, string> = { ATL: 'ATL', Production: 'Production', Post: 'Post', Other: 'Other' };
const NAME_OK = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface Props {
  tab: SetupTab;
  budget: Budget;
  totals: BudgetTotals;
  scheduleGlobals: Record<string, number>;
  onChange: Change;
  onClose: () => void;
}

export function BudgetSetup({ tab, budget, totals, scheduleGlobals, onChange, onClose }: Props) {
  const c = budget.currency;
  const globalErrors = resolveGlobals(budget, scheduleGlobals).errors;
  return (
    <aside className="bl-setup">
      <div className="bl-setup-head">
        <h3>{tab === 'contractuals' ? 'Contractual Charges' : tab.charAt(0).toUpperCase() + tab.slice(1)}</h3>
        <button className="bl-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      {tab === 'globals' && (
        <>
          <p className="bl-muted">Named values for formulas in Amount, X and Rate. Later globals can use earlier ones.</p>
          <table className="bl-table compact">
            <thead><tr><th>Name</th><th>Value</th><th className="money">=</th><th></th></tr></thead>
            <tbody>
              {Object.entries(scheduleGlobals).map(([name, value]) => (
                <tr key={name} className="bl-row"><td><code>{name}</code></td><td className="bl-muted">from the schedule</td><td className="money">{value}</td><td></td></tr>
              ))}
              {budget.globals.map((g) => (
                <tr key={g.id} className="bl-row" title={g.description}>
                  <td><input className={`bl-cell ${NAME_OK.test(g.name) ? '' : 'error'}`} value={g.name} aria-label="Global name"
                    onChange={(e) => onChange((b) => updateItem(b, 'globals', g.id, { name: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} /></td>
                  <td><input className={`bl-cell ${globalErrors[g.id] ? 'error' : ''}`} value={g.value} title={globalErrors[g.id]} aria-label={`${g.name} value`}
                    onChange={(e) => onChange((b) => updateItem(b, 'globals', g.id, { value: e.target.value }))} /></td>
                  <td className="money">{Math.round((totals.globals[g.name] ?? 0) * 1000) / 1000}</td>
                  <td><button className="bl-x" aria-label={`Delete ${g.name}`} onClick={() => onChange((b) => deleteItem(b, 'globals', g.id))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="bl-btn" onClick={() => onChange((b) => addItem(b, 'globals', { name: `GLOBAL_${b.globals.length + 1}`, value: '0' }))}>+ Global</button>
        </>
      )}

      {tab === 'fringes' && (
        <>
          <p className="bl-muted">Payroll taxes, union pension and health, and other charges on top of labor lines. Percent fringes can stop at a cutoff (per line); flat fringes are an amount per unit (day, week…). Rates here are placeholders: use current figures.</p>
          {budget.fringes.map((f) => (
            <div key={f.id} className="bl-setup-card">
              <div className="bl-inline">
                <input className="bl-cell wide" value={f.name} aria-label="Fringe name" onChange={(e) => onChange((b) => updateItem(b, 'fringes', f.id, { name: e.target.value }))} />
                <button className="bl-x" aria-label={`Delete ${f.name}`} onClick={() => { if (confirm(`Delete the fringe ${f.name}? Lines using it lose it.`)) onChange((b) => deleteItem(b, 'fringes', f.id)); }}>×</button>
              </div>
              <div className="bl-inline">
                <select value={f.kind} aria-label="Kind" onChange={(e) => onChange((b) => updateItem(b, 'fringes', f.id, { kind: e.target.value as 'percent' | 'flat', rate: 0 }))}>
                  <option value="percent">Percent</option>
                  <option value="flat">Flat per unit</option>
                </select>
                {f.kind === 'percent' ? (
                  <label className="bl-mini">Rate %<input className="bl-cell" type="number" step="0.01" value={f.rate} onChange={(e) => onChange((b) => updateItem(b, 'fringes', f.id, { rate: Number(e.target.value) }))} /></label>
                ) : (
                  <label className="bl-mini">Per unit<input className="bl-cell" type="number" step="0.01" value={f.rate / 100} onChange={(e) => onChange((b) => updateItem(b, 'fringes', f.id, { rate: Math.round(Number(e.target.value) * 100) }))} /></label>
                )}
                {f.kind === 'percent' && (
                  <label className="bl-mini">Cutoff<input className="bl-cell" type="number" step="1" placeholder="none" value={f.cutoffCents !== undefined ? f.cutoffCents / 100 : ''}
                    onChange={(e) => onChange((b) => updateItem(b, 'fringes', f.id, { cutoffCents: e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 100) }))} /></label>
                )}
              </div>
              <span className="bl-muted">{money(totals.fringeTotals.get(f.id) ?? 0, c)} in this budget{f.description ? ` · ${f.description}` : ''}</span>
            </div>
          ))}
          <button className="bl-btn" onClick={() => onChange((b) => addItem(b, 'fringes', { name: 'New Fringe', kind: 'percent', rate: 0 }))}>+ Fringe</button>
        </>
      )}

      {tab === 'groups' && (
        <>
          <p className="bl-muted">Tag lines (e.g. Reshoots, Second Unit, Location Shoot) to see what they cost and to leave them out of contractual charges.</p>
          {budget.groups.map((g) => {
            const total = budget.categories.flatMap((cat) => cat.accounts.flatMap((a) => a.details)).filter((d) => d.groupId === g.id).reduce((n, d) => n + (totals.details.get(d.id)?.total ?? 0), 0);
            return (
              <div key={g.id} className="bl-inline bl-setup-row">
                <input type="color" value={g.color} aria-label="Colour" onChange={(e) => onChange((b) => updateItem(b, 'groups', g.id, { color: e.target.value }))} />
                <input className="bl-cell wide" value={g.name} aria-label="Group name" onChange={(e) => onChange((b) => updateItem(b, 'groups', g.id, { name: e.target.value }))} />
                <span className="money">{money(total, c)}</span>
                <button className="bl-x" aria-label={`Delete ${g.name}`} onClick={() => onChange((b) => deleteItem(b, 'groups', g.id))}>×</button>
              </div>
            );
          })}
          <button className="bl-btn" onClick={() => onChange((b) => addItem(b, 'groups', { name: 'New Group', color: '#8B5CF6' }))}>+ Group</button>
        </>
      )}

      {tab === 'contractuals' && (
        <>
          <p className="bl-muted">Percentages of chosen sections added below the line total: contingency, insurance, completion bond, fees.</p>
          {budget.contractuals.map((k) => (
            <div key={k.id} className="bl-setup-card">
              <div className="bl-inline">
                <input className="bl-cell wide" value={k.name} aria-label="Charge name" onChange={(e) => onChange((b) => updateItem(b, 'contractuals', k.id, { name: e.target.value }))} />
                <label className="bl-mini">%<input className="bl-cell" type="number" step="0.1" value={k.percent} onChange={(e) => onChange((b) => updateItem(b, 'contractuals', k.id, { percent: Number(e.target.value) }))} /></label>
                <button className="bl-x" aria-label={`Delete ${k.name}`} onClick={() => onChange((b) => deleteItem(b, 'contractuals', k.id))}>×</button>
              </div>
              <div className="bl-inline">
                {SECTIONS.map((s) => (
                  <label key={s} className="bl-check">
                    <input type="checkbox" checked={k.appliesTo.includes(s)} onChange={(e) => onChange((b) => updateItem(b, 'contractuals', k.id, { appliesTo: e.target.checked ? [...k.appliesTo, s] : k.appliesTo.filter((x) => x !== s) }))} />
                    {SECTION_SHORT[s]}
                  </label>
                ))}
              </div>
              {budget.groups.length > 0 && (
                <div className="bl-inline">
                  <span className="bl-muted">Leave out:</span>
                  {budget.groups.map((g) => (
                    <label key={g.id} className="bl-check">
                      <input type="checkbox" checked={k.excludeGroupIds.includes(g.id)} onChange={(e) => onChange((b) => updateItem(b, 'contractuals', k.id, { excludeGroupIds: e.target.checked ? [...k.excludeGroupIds, g.id] : k.excludeGroupIds.filter((x) => x !== g.id) }))} />
                      {g.name}
                    </label>
                  ))}
                </div>
              )}
              <span className="bl-muted">{money(totals.contractuals.find((x) => x.id === k.id)?.amount ?? 0, c)}</span>
            </div>
          ))}
          <button className="bl-btn" onClick={() => onChange((b) => addItem(b, 'contractuals', { name: 'Insurance', percent: 2, appliesTo: ['ATL', 'Production', 'Post', 'Other'], excludeGroupIds: [] }))}>+ Charge</button>
        </>
      )}
    </aside>
  );
}
