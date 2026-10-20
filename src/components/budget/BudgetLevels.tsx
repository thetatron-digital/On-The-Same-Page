// The three budget levels: Topsheet, a category's accounts, an account's
// detail lines (amount × units × X × rate, fringes, groups)
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import { SECTION_LABELS, UNITS, type Budget, type BudgetAccount, type BudgetCategory, type BudgetSection, type BudgetUnit } from '../../types/budget';
import { SECTIONS, money, type BudgetTotals } from '../../engine/budget/totals';
import {
  addAccount, addCategory, addDetail, applyDoodDays, blankDetail, deleteAccount, deleteCategory, deleteDetail, newBudgetId, updateAccount, updateCategory, updateDetail,
} from '../../engine/budget/edit';
import { castLinesFromDood } from '../../engine/budget/scheduleLink';
import { buildScheduleDOOD, CAST_CATEGORY } from '../../utils/doodReport';

type Change = (fn: (b: Budget) => Budget) => void;

const SECTION_TITLES: Record<BudgetSection, string> = { ATL: 'Above-the-Line', Production: 'Production', Post: 'Post Production', Other: 'Other' };

function AddRow({ cols, onAdd, numberLabel, nameLabel, withSection }: { cols: number; onAdd: (number: string, name: string, section: BudgetSection) => void; numberLabel: string; nameLabel: string; withSection?: boolean }) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [section, setSection] = useState<BudgetSection>('Production');
  const add = () => { if (!number.trim() || !name.trim()) return; onAdd(number.trim(), name.trim(), section); setNumber(''); setName(''); };
  return (
    <tr className="bl-add-row">
      <td><input placeholder={numberLabel} value={number} onChange={(e) => setNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label={numberLabel} /></td>
      <td colSpan={cols - 2}>
        <span className="bl-inline">
          <input placeholder={nameLabel} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label={nameLabel} />
          {withSection && (
            <select value={section} onChange={(e) => setSection(e.target.value as BudgetSection)} aria-label="Section">
              {SECTIONS.map((s) => <option key={s} value={s}>{SECTION_TITLES[s]}</option>)}
            </select>
          )}
        </span>
      </td>
      <td><button className="bl-btn small" onClick={add} disabled={!number.trim() || !name.trim()}>Add</button></td>
    </tr>
  );
}

export function Topsheet({ budget, totals, onOpen, onChange }: { budget: Budget; totals: BudgetTotals; onOpen: (id: string) => void; onChange: Change }) {
  const c = budget.currency;
  const pct = (cents: number) => (totals.grandTotal ? `${((cents / totals.grandTotal) * 100).toFixed(1)}%` : '');
  return (
    <div className="bl-sheet">
      <div className="bl-sheet-head">
        <input className="bl-title" value={budget.name} onChange={(e) => onChange((b) => ({ ...b, name: e.target.value }))} aria-label="Budget name" />
        <span className="bl-grand">{money(totals.grandTotal, c)}</span>
      </div>
      <table className="bl-table">
        <thead><tr><th className="num">Acct #</th><th>Category</th><th className="money">Total</th><th className="money">%</th><th></th></tr></thead>
        <tbody>
          {SECTIONS.map((section) => {
            const cats = budget.categories.filter((cat) => cat.section === section);
            return [
              <tr key={`${section}-h`} className="bl-section-head"><td colSpan={5}>{SECTION_TITLES[section]}</td></tr>,
              ...cats.map((cat) => (
                <tr key={cat.id} className="bl-row" onDoubleClick={() => onOpen(cat.id)}>
                  <td className="num">{cat.number}</td>
                  <td><button className="bl-open" onClick={() => onOpen(cat.id)}>{cat.name}</button></td>
                  <td className="money">{money(totals.categories.get(cat.id) ?? 0, c)}</td>
                  <td className="money bl-muted">{pct(totals.categories.get(cat.id) ?? 0)}</td>
                  <td className="bl-row-actions"><button className="bl-x" title="Delete category" aria-label={`Delete ${cat.name}`} onClick={() => { if (confirm(`Delete ${cat.number} ${cat.name} and all its accounts?`)) onChange((b) => deleteCategory(b, cat.id)); }}>×</button></td>
                </tr>
              )),
              <tr key={`${section}-t`} className="bl-subtotal"><td></td><td>{SECTION_LABELS[section]}</td><td className="money">{money(totals.sections[section], c)}</td><td className="money bl-muted">{pct(totals.sections[section])}</td><td></td></tr>,
              ...(section === 'ATL' ? [] : section === 'Other' ? [<tr key="btl" className="bl-total"><td></td><td>Total Below-the-Line</td><td className="money">{money(totals.belowTheLine, c)}</td><td className="money bl-muted">{pct(totals.belowTheLine)}</td><td></td></tr>] : []),
            ];
          })}
          <tr className="bl-total"><td></td><td>Total Above and Below-the-Line</td><td className="money">{money(totals.direct, c)}</td><td className="money bl-muted">{pct(totals.direct)}</td><td></td></tr>
          {totals.contractuals.map((k) => {
            const def = budget.contractuals.find((x) => x.id === k.id)!;
            return <tr key={k.id} className="bl-row"><td></td><td>{k.name} <span className="bl-muted">{def.percent}% of {def.appliesTo.map((s) => SECTION_TITLES[s]).join(', ')}</span></td><td className="money">{money(k.amount, c)}</td><td className="money bl-muted">{pct(k.amount)}</td><td></td></tr>;
          })}
          <tr className="bl-grand-row"><td></td><td>Grand Total</td><td className="money">{money(totals.grandTotal, c)}</td><td></td><td></td></tr>
          <AddRow cols={5} numberLabel="Acct #" nameLabel="New category" withSection onAdd={(number, name, section) => onChange((b) => addCategory(b, { number, name, section }))} />
        </tbody>
      </table>
    </div>
  );
}

export function CategoryLevel({ budget, category, totals, onOpen, onChange }: { budget: Budget; category: BudgetCategory; totals: BudgetTotals; onOpen: (id: string) => void; onChange: Change }) {
  const c = budget.currency;
  return (
    <div className="bl-sheet">
      <div className="bl-sheet-head">
        <span className="bl-inline">
          <input className="bl-num-input" value={category.number} onChange={(e) => onChange((b) => updateCategory(b, category.id, { number: e.target.value }))} aria-label="Category number" />
          <input className="bl-title" value={category.name} onChange={(e) => onChange((b) => updateCategory(b, category.id, { name: e.target.value }))} aria-label="Category name" />
          <select value={category.section} onChange={(e) => onChange((b) => updateCategory(b, category.id, { section: e.target.value as BudgetSection }))} aria-label="Section">
            {SECTIONS.map((s) => <option key={s} value={s}>{SECTION_TITLES[s]}</option>)}
          </select>
        </span>
        <span className="bl-grand">{money(totals.categories.get(category.id) ?? 0, c)}</span>
      </div>
      <table className="bl-table">
        <thead><tr><th className="num">Acct #</th><th>Account</th><th className="money">Lines</th><th className="money">Total</th><th></th></tr></thead>
        <tbody>
          {category.accounts.map((acc) => (
            <tr key={acc.id} className="bl-row" onDoubleClick={() => onOpen(acc.id)}>
              <td className="num">{acc.number}</td>
              <td><button className="bl-open" onClick={() => onOpen(acc.id)}>{acc.name}</button></td>
              <td className="money bl-muted">{acc.details.length || ''}</td>
              <td className="money">{money(totals.accounts.get(acc.id) ?? 0, c)}</td>
              <td className="bl-row-actions"><button className="bl-x" aria-label={`Delete ${acc.name}`} onClick={() => { if (!acc.details.length || confirm(`Delete ${acc.number} ${acc.name} and its ${acc.details.length} lines?`)) onChange((b) => deleteAccount(b, acc.id)); }}>×</button></td>
            </tr>
          ))}
          <tr className="bl-subtotal"><td></td><td>Total {category.number} {category.name}</td><td></td><td className="money">{money(totals.categories.get(category.id) ?? 0, c)}</td><td></td></tr>
          <AddRow cols={5} numberLabel="Acct #" nameLabel="New account" onAdd={(number, name) => onChange((b) => addAccount(b, category.id, number, name))} />
        </tbody>
      </table>
    </div>
  );
}

export function AccountLevel({ budget, category, account, totals, onChange }: { budget: Budget; category: BudgetCategory; account: BudgetAccount; totals: BudgetTotals; onChange: Change }) {
  const c = budget.currency;
  const { schedule, breakdown, people } = useScreenplayStore(useShallow((s) => ({ schedule: s.schedule, breakdown: s.breakdown, people: s.productionData.people })));
  const dood = useMemo(() => (schedule?.shootDays.length ? buildScheduleDOOD(schedule, CAST_CATEGORY, { breakdown, people }) : null), [schedule, breakdown, people]);
  const [fringeMenu, setFringeMenu] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isCast = /cast/i.test(category.name) || /cast|player/i.test(account.name);
  const linked = account.details.some((d) => d.doodElement);

  const pullCast = () => {
    if (!dood) return;
    const { added, days } = castLinesFromDood(budget, dood, () => newBudgetId('d'));
    onChange((b) => {
      let next = applyDoodDays(b, days).budget;
      for (const d of added) next = addDetail(next, account.id, d);
      return next;
    });
    setMessage(`${added.length} cast member${added.length === 1 ? '' : 's'} added; days from the Day Out of Days (work + hold + travel). Fill in the rates.`);
  };

  const syncDays = () => {
    if (!dood) return;
    const { days } = castLinesFromDood(budget, dood, () => '');
    let changed = 0;
    onChange((b) => { const r = applyDoodDays(b, days); changed = r.changed; return r.budget; });
    setMessage(changed ? `Updated days on ${changed} line${changed === 1 ? '' : 's'}.` : 'Days already match the schedule.');
  };

  return (
    <div className="bl-sheet">
      <div className="bl-sheet-head">
        <span className="bl-inline">
          <input className="bl-num-input" value={account.number} onChange={(e) => onChange((b) => updateAccount(b, account.id, { number: e.target.value }))} aria-label="Account number" />
          <input className="bl-title" value={account.name} onChange={(e) => onChange((b) => updateAccount(b, account.id, { name: e.target.value }))} aria-label="Account name" />
        </span>
        <span className="bl-grand">{money(totals.accounts.get(account.id) ?? 0, c)}</span>
      </div>
      {(isCast || linked) && dood && (
        <div className="bl-callout">
          {isCast && <button className="bl-btn" onClick={pullCast}>Add Cast from Day Out of Days</button>}
          {linked && <button className="bl-btn" onClick={syncDays}>Update Days from Schedule</button>}
          {message && <span className="bl-muted">{message}</span>}
        </div>
      )}
      <div className="bl-table-wrap">
        <table className="bl-table bl-detail">
          <thead>
            <tr>
              <th>Description</th><th className="money">Amount</th><th>Units</th><th className="money">X</th><th className="money">Rate</th>
              <th className="money">Subtotal</th><th>Fringes</th><th className="money">Total</th><th>Group</th><th></th>
            </tr>
          </thead>
          <tbody>
            {account.details.map((d) => {
              const t = totals.details.get(d.id);
              const cell = (field: 'amount' | 'x' | 'rate', label: string) => (
                <td className="money">
                  <input className={`bl-cell ${t?.errors.length ? 'error' : ''}`} value={d[field]} aria-label={label}
                    title={t?.errors.join('; ') || 'Number or formula, e.g. SHOOT_WEEKS + 2'}
                    onChange={(e) => onChange((b) => updateDetail(b, d.id, { [field]: e.target.value }))} />
                </td>
              );
              const fringeNames = d.fringeIds.map((id) => budget.fringes.find((f) => f.id === id)?.name).filter(Boolean);
              return (
                <tr key={d.id} className="bl-row">
                  <td>
                    <input className="bl-cell wide" value={d.description} placeholder="Description" aria-label="Description" onChange={(e) => onChange((b) => updateDetail(b, d.id, { description: e.target.value }))} />
                    {d.doodElement && <span className="bl-link-badge" title="Days come from the Day Out of Days">DOOD</span>}
                  </td>
                  {cell('amount', 'Amount')}
                  <td>
                    <select value={d.units} onChange={(e) => onChange((b) => updateDetail(b, d.id, { units: e.target.value as BudgetUnit }))} aria-label="Units">
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  {cell('x', 'X')}
                  {cell('rate', 'Rate')}
                  <td className="money">{money(t?.subtotal ?? 0, c, true)}</td>
                  <td className="bl-fringe-cell">
                    <button className="bl-chip" onClick={() => setFringeMenu(fringeMenu === d.id ? null : d.id)} title={fringeNames.join(', ') || 'No fringes'}>
                      {fringeNames.length ? `${fringeNames.length} · ${money(t?.fringes ?? 0, c)}` : 'None'}
                    </button>
                    {fringeMenu === d.id && (
                      <div className="bl-popover" onMouseLeave={() => setFringeMenu(null)}>
                        {budget.fringes.length === 0 && <span className="bl-muted">Add fringes in Fringes.</span>}
                        {budget.fringes.map((f) => (
                          <label key={f.id} className="bl-check">
                            <input type="checkbox" checked={d.fringeIds.includes(f.id)}
                              onChange={(e) => onChange((b) => updateDetail(b, d.id, { fringeIds: e.target.checked ? [...d.fringeIds, f.id] : d.fringeIds.filter((x) => x !== f.id) }))} />
                            {f.name} <span className="bl-muted">{f.kind === 'percent' ? `${f.rate}%` : `${money(f.rate, c, true)}/unit`}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="money"><strong>{money(t?.total ?? 0, c, true)}</strong></td>
                  <td>
                    <select value={d.groupId ?? ''} onChange={(e) => onChange((b) => updateDetail(b, d.id, { groupId: e.target.value || undefined }))} aria-label="Group">
                      <option value=""></option>
                      {budget.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </td>
                  <td className="bl-row-actions">
                    <button className="bl-x" title="Insert line below" aria-label="Insert line" onClick={() => onChange((b) => addDetail(b, account.id, blankDetail(), d.id))}>+</button>
                    <button className="bl-x" title="Delete line" aria-label="Delete line" onClick={() => onChange((b) => deleteDetail(b, d.id))}>×</button>
                  </td>
                </tr>
              );
            })}
            <tr className="bl-subtotal">
              <td colSpan={7}>Total {account.number} {account.name}</td>
              <td className="money">{money(totals.accounts.get(account.id) ?? 0, c, true)}</td><td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button className="bl-btn" onClick={() => onChange((b) => addDetail(b, account.id))}>+ Line</button>
      <p className="bl-muted">Amount, X and Rate take numbers or formulas with globals (e.g. <code>SHOOT_WEEKS + PREP_WEEKS</code>). Subtotal = Amount × X × Rate.</p>
    </div>
  );
}
