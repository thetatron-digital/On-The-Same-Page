// Budget exports: a Topsheet PDF and the whole budget as CSV
import jsPDF from 'jspdf';
import { SECTION_LABELS, type Budget } from '../../types/budget';
import { SECTIONS, money, type BudgetTotals } from '../../engine/budget/totals';

export function topsheetPdf(budget: Budget, totals: BudgetTotals): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, M = 48;
  const c = budget.currency;
  let y = M;
  doc.setFont('helvetica', 'bold').setFontSize(16).text(budget.name, M, y);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor('#666666').text(`Budget Topsheet · ${new Date().toLocaleDateString()}`, W - M, y, { align: 'right' });
  doc.setTextColor('#1a1a1a');
  y += 24;
  const row = (num: string, label: string, amount: number, style: 'normal' | 'bold' = 'normal', rule = false) => {
    if (y > 740) { doc.addPage(); y = M; }
    if (rule) { doc.setDrawColor('#999999').setLineWidth(0.5).line(M, y - 9, W - M, y - 9); }
    doc.setFont('helvetica', style).setFontSize(10);
    doc.text(num, M, y);
    doc.text(label, M + 50, y);
    doc.text(money(amount, c), W - M, y, { align: 'right' });
    y += 15;
  };
  for (const section of SECTIONS) {
    const cats = budget.categories.filter((cat) => cat.section === section);
    if (!cats.length) continue;
    for (const cat of cats) row(cat.number, cat.name, totals.categories.get(cat.id) ?? 0);
    row('', SECTION_LABELS[section], totals.sections[section], 'bold', true);
    y += 6;
  }
  row('', 'Total Below-the-Line', totals.belowTheLine, 'bold', true);
  row('', 'Total Above and Below-the-Line', totals.direct, 'bold');
  y += 4;
  for (const k of totals.contractuals) row('', k.name, k.amount);
  y += 4;
  doc.setFontSize(12);
  row('', 'GRAND TOTAL', totals.grandTotal, 'bold', true);
  const g = Object.entries(totals.globals).map(([k, v]) => `${k} ${Math.round(v * 100) / 100}`).join(' · ');
  if (g) { y += 10; doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor('#666666').text(doc.splitTextToSize(`Globals: ${g}`, W - 2 * M), M, y); }
  return doc;
}

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function budgetCsv(budget: Budget, totals: BudgetTotals): string {
  const rows: (string | number)[][] = [['Section', 'Category', 'Account', 'Description', 'Amount', 'Units', 'X', 'Rate', 'Subtotal', 'Fringes', 'Total', 'Fringe Names', 'Group']];
  const cents = (n: number) => (n / 100).toFixed(2);
  for (const cat of budget.categories) {
    for (const acc of cat.accounts) {
      for (const d of acc.details) {
        const t = totals.details.get(d.id);
        rows.push([
          cat.section, `${cat.number} ${cat.name}`, `${acc.number} ${acc.name}`, d.description, d.amount, d.units, d.x, d.rate,
          cents(t?.subtotal ?? 0), cents(t?.fringes ?? 0), cents(t?.total ?? 0),
          d.fringeIds.map((id) => budget.fringes.find((f) => f.id === id)?.name).filter(Boolean).join('; '),
          budget.groups.find((g) => g.id === d.groupId)?.name ?? '',
        ]);
      }
    }
  }
  rows.push([], ['', '', '', 'Total Above and Below-the-Line', '', '', '', '', '', '', cents(totals.direct)]);
  for (const k of totals.contractuals) rows.push(['', '', '', k.name, '', '', '', '', '', '', cents(k.amount)]);
  rows.push(['', '', '', 'Grand Total', '', '', '', '', '', '', cents(totals.grandTotal)]);
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}
