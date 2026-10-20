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
import { crewLinesFromPeople } from '../../engine/budget/crewLink';
import { buildScheduleDOOD, CAST_CATEGORY } from '../../utils/doodReport';
import type { Comparison } from './comparison';
import { artCartSpend } from '../../engine/budget/actuals';

type Change = (fn: (b: Budget) => Budget) => void;

// Extra columns when comparing: the compared figure and the variance
function CompareCells({ compare, budgeted, compared, currency }: { compare: Comparison | null; budgeted: number; compared: number; currency: string }) {
  if (!compare) return null;
  const v = compare.variance(budgeted, compared);
  const bad = compare.kind === 'actuals' ? v < 0 : v > 0;
  return (
    <>
      <td className="money bl-compare">{money(compared, currency)}</td>
      <td className={`money ${v === 0 ? 'bl-muted' : bad ? 'bl-over' : 'bl-under'}`}>{v > 0 && compare.kind === 'version' ? '+' : ''}{money(v, currency)}</td>
    </>
  );
}
const CompareHeads = ({ compare }: { compare: Comparison | null }) =>
  compare ? <><th className="money bl-compare">{compare.label}</th><th className="money">{compare.varianceLabel}</th></> : null;

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

export function Topsheet({ budget, totals, compare, onOpen, onChange }: { budget: Budget; totals: BudgetTotals; compare: Comparison | null; onOpen: (id: string) => void; onChange: Change }) {
  const c = budget.currency;
  const pct = (cents: number) => (totals.grandTotal ? `${((cents / totals.grandTotal) * 100).toFixed(1)}%` : '');
  const people = useScreenplayStore((s) => s.productionData.people);
  const [crewMessage, setCrewMessage] = useState<string | null>(null);
  const addCrew = () => {
    const lines = crewLinesFromPeople(budget, people, () => newBudgetId('d'));
    if (lines.length) onChange((b) => lines.reduce((acc, l) => addDetail(acc, l.accountId, l.detail), b));
    const unpaid = people.filter((p) => p.group === 'Crew' && !p.payRate?.amount).length;
    setCrewMessage(lines.length
      ? `${lines.length} crew line${lines.length === 1 ? '' : 's'} added from People (pay rate × shoot days or weeks).${unpaid ? ` ${unpaid} crew without a pay rate were skipped.` : ''}`
      : unpaid ? `Add pay rates to crew in BaseCamp > All People first (${unpaid} without one).` : 'Everyone with a pay rate is already in the budget.');
  };
  return (
    <div className="bl-sheet">
      <div className="bl-sheet-head">
        <input className="bl-title" value={budget.name} onChange={(e) => onChange((b) => ({ ...b, name: e.target.value }))} aria-label="Budget name" />
        <span className="bl-grand">{money(totals.grandTotal, c)}</span>
      </div>
      <div className="bl-callout">
        <button className="bl-btn" onClick={addCrew} title="A line per crew member with a pay rate, in their department's account">Add Crew from People</button>
        {crewMessage && <span className="bl-muted">{crewMessage}</span>}
      </div>
      <table className="bl-table">
        <thead><tr><th className="num">Acct #</th><th>Category</th><th className="money">Total</th><CompareHeads compare={compare} /><th className="money">%</th><th></th></tr></thead>
        <tbody>
          {SECTIONS.map((section) => {
            const cats = budget.categories.filter((cat) => cat.section === section);
            return [
              <tr key={`${section}-h`} className="bl-section-head"><td colSpan={compare ? 7 : 5}>{SECTION_TITLES[section]}</td></tr>,
              ...cats.map((cat) => (
                <tr key={cat.id} className="bl-row" onDoubleClick={() => onOpen(cat.id)}>
                  <td className="num">{cat.number}</td>
                  <td><button className="bl-open" onClick={() => onOpen(cat.id)}>{cat.name}</button></td>
                  <td className="money">{money(totals.categories.get(cat.id) ?? 0, c)}</td>
                  <CompareCells compare={compare} budgeted={totals.categories.get(cat.id) ?? 0} compared={compare?.category(cat.id) ?? 0} currency={c} />
                  <td className="money bl-muted">{pct(totals.categories.get(cat.id) ?? 0)}</td>
                  <td className="bl-row-actions"><button className="bl-x" title="Delete category" aria-label={`Delete ${cat.name}`} onClick={() => { if (confirm(`Delete ${cat.number} ${cat.name} and all its accounts?`)) onChange((b) => deleteCategory(b, cat.id)); }}>×</button></td>
                </tr>
              )),
              <tr key={`${section}-t`} className="bl-subtotal"><td></td><td>{SECTION_LABELS[section]}</td><td className="money">{money(totals.sections[section], c)}</td><CompareCells compare={compare} budgeted={totals.sections[section]} compared={compare?.sections[section] ?? 0} currency={c} /><td className="money bl-muted">{pct(totals.sections[section])}</td><td></td></tr>,
              ...(section === 'ATL' ? [] : section === 'Other' ? [<tr key="btl" className="bl-total"><td></td><td>Total Below-the-Line</td><td className="money">{money(totals.belowTheLine, c)}</td><CompareCells compare={compare} budgeted={totals.belowTheLine} compared={compare ? compare.sections.Production + compare.sections.Post + compare.sections.Other : 0} currency={c} /><td className="money bl-muted">{pct(totals.belowTheLine)}</td><td></td></tr>] : []),
            ];
          })}
          <tr className="bl-total"><td></td><td>Total Above and Below-the-Line</td><td className="money">{money(totals.direct, c)}</td><CompareCells compare={compare} budgeted={totals.direct} compared={compare ? Object.values(compare.sections).reduce((a, b) => a + b, 0) : 0} currency={c} /><td className="money bl-muted">{pct(totals.direct)}</td><td></td></tr>
          {totals.contractuals.map((k) => {
            const def = budget.contractuals.find((x) => x.id === k.id)!;
            return <tr key={k.id} className="bl-row"><td></td><td>{k.name} <span className="bl-muted">{def.percent}% of {def.appliesTo.map((s) => SECTION_TITLES[s]).join(', ')}</span></td><td className="money">{money(k.amount, c)}</td>{compare && <><td></td><td></td></>}<td className="money bl-muted">{pct(k.amount)}</td><td></td></tr>;
          })}
          <tr className="bl-grand-row"><td></td><td>Grand Total</td><td className="money">{money(totals.grandTotal, c)}</td><CompareCells compare={compare} budgeted={totals.grandTotal} compared={compare?.total ?? 0} currency={c} /><td></td><td></td></tr>
          <AddRow cols={compare ? 7 : 5} numberLabel="Acct #" nameLabel="New category" withSection onAdd={(number, name, section) => onChange((b) => addCategory(b, { number, name, section }))} />
        </tbody>
      </table>
      {compare?.kind === 'actuals' && (
        <label className="bl-check">
          <input type="checkbox" checked={!!budget.artCartActuals} onChange={(e) => onChange((b) => ({ ...b, artCartActuals: e.target.checked }))} />
          Count ArtCart purchases and rentals (actual cost × quantity) as spent, in the matching art, props, wardrobe and makeup accounts
        </label>
      )}
    </div>
  );
}

export function CategoryLevel({ budget, category, totals, compare, onOpen, onChange }: { budget: Budget; category: BudgetCategory; totals: BudgetTotals; compare: Comparison | null; onOpen: (id: string) => void; onChange: Change }) {
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
        <thead><tr><th className="num">Acct #</th><th>Account</th><th className="money">Lines</th><th className="money">Total</th><CompareHeads compare={compare} /><th></th></tr></thead>
        <tbody>
          {category.accounts.map((acc) => (
            <tr key={acc.id} className="bl-row" onDoubleClick={() => onOpen(acc.id)}>
              <td className="num">{acc.number}</td>
              <td><button className="bl-open" onClick={() => onOpen(acc.id)}>{acc.name}</button></td>
              <td className="money bl-muted">{acc.details.length || ''}</td>
              <td className="money">{money(totals.accounts.get(acc.id) ?? 0, c)}</td>
              <CompareCells compare={compare} budgeted={totals.accounts.get(acc.id) ?? 0} compared={compare?.account(acc.id) ?? 0} currency={c} />
              <td className="bl-row-actions"><button className="bl-x" aria-label={`Delete ${acc.name}`} onClick={() => { if (!acc.details.length || confirm(`Delete ${acc.number} ${acc.name} and its ${acc.details.length} lines?`)) onChange((b) => deleteAccount(b, acc.id)); }}>×</button></td>
            </tr>
          ))}
          <tr className="bl-subtotal"><td></td><td>Total {category.number} {category.name}</td><td></td><td className="money">{money(totals.categories.get(category.id) ?? 0, c)}</td><CompareCells compare={compare} budgeted={totals.categories.get(category.id) ?? 0} compared={compare?.category(category.id) ?? 0} currency={c} /><td></td></tr>
          <AddRow cols={compare ? 7 : 5} numberLabel="Acct #" nameLabel="New account" onAdd={(number, name) => onChange((b) => addAccount(b, category.id, number, name))} />
        </tbody>
      </table>
    </div>
  );
}

export function AccountLevel({ budget, category, account, totals, onChange }: { budget: Budget; category: BudgetCategory; account: BudgetAccount; totals: BudgetTotals; onChange: Change }) {
  const c = budget.currency;
  const { schedule, breakdown, people, artItems } = useScreenplayStore(useShallow((s) => ({ schedule: s.schedule, breakdown: s.breakdown, people: s.productionData.people, artItems: s.artCart?.items })));
  const artSpend = budget.artCartActuals ? artCartSpend(budget, artItems ?? []).get(account.id) ?? 0 : 0;
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
      <div className="bl-callout">
        <label className="bl-mini">Actual spent
          <input className="bl-cell" type="number" step="0.01" min={0} value={budget.actuals?.[account.id] !== undefined ? budget.actuals[account.id] / 100 : ''} placeholder="0"
            onChange={(e) => onChange((b) => ({ ...b, actuals: { ...b.actuals, [account.id]: Math.round(Number(e.target.value || 0) * 100) } }))} />
        </label>
        {artSpend > 0 && <span className="bl-muted">+ {money(artSpend, c, true)} from ArtCart</span>}
        <span className="bl-muted">Remaining {money((totals.accounts.get(account.id) ?? 0) - (budget.actuals?.[account.id] ?? 0) - artSpend, c)}</span>
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
                    {d.personId && <span className="bl-link-badge" title="Made from a person in BaseCamp People">PEOPLE</span>}
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
