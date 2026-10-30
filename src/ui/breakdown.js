// The per-tax summary (lines that add up to the headline) and the detailed working table.

import { gbp, gbpPence, rate } from './format.js';

const COMPONENT = {
  nonSavings: 'Earnings and other income',
  property: 'Rental profit',
  savingsStartingRate: 'Savings interest, starting rate for savings',
  savingsAllowance: 'Savings interest, Personal Savings Allowance',
  savings: 'Savings interest',
  dividendAllowance: 'Dividends, dividend allowance',
  dividends: 'Dividends',
};
const BAND = { basic: 'basic rate', higher: 'higher rate', additional: 'additional rate' };

function row(cells, cls) {
  const tr = document.createElement('tr');
  if (cls) tr.className = cls;
  cells.forEach((c, i) => {
    const cell = document.createElement(i === 0 ? 'th' : 'td');
    if (i === 0) cell.scope = 'row';
    else cell.className = 'num';
    cell.textContent = c ?? '';
    tr.append(cell);
  });
  return tr;
}

// Summary lines. Each is a whole tax; together they make the headline total.
export function summaryLines(r) {
  const b = r.breakdown;
  const lines = [
    ['Income tax', b.incomeTax],
    ['National Insurance', b.totalPersonalNIC],
  ];
  if (b.erNIC > 0) lines.push([`Employer National Insurance (${Math.round(r.detail.nic.employer.incidence * 100)}% of ${gbp(b.erNIC)})`, r.detail.employerNicBorne]);
  if (b.cgt > 0) lines.push(['Capital Gains Tax', b.cgt]);
  if (b.hicbc > 0) lines.push(['High Income Child Benefit Charge', b.hicbc]);
  return lines;
}

export function renderSummary(tbody, r) {
  tbody.replaceChildren(
    ...summaryLines(r).map(([label, v]) => row([label, gbp(v)])),
    row(['Total', gbp(r.totals.totalTax)], 'total-row'),
  );
}

export function renderDetail(tbody, r) {
  const d = r.detail;
  const b = r.breakdown;
  const rows = [];
  const section = (title) => {
    const tr = document.createElement('tr');
    tr.className = 'section-row';
    const th = document.createElement('th');
    th.scope = 'colgroup';
    th.colSpan = 4;
    th.textContent = title;
    tr.append(th);
    rows.push(tr);
  };

  section('Income tax');
  const allowance = d.allowances.personalAllowance + d.allowances.blindPersonsAllowance;
  rows.push(row([
    d.allowances.blindPersonsAllowance
      ? `Tax-free allowances (Personal Allowance ${gbp(d.allowances.personalAllowance)}, Blind Person's Allowance ${gbp(d.allowances.blindPersonsAllowance)})`
      : 'Personal Allowance (tax-free)',
    gbp(allowance), '0%', gbpPence(0)], 'note-row'));
  for (const x of d.incomeTaxBands) {
    const nil = /StartingRate|Allowance$/.test(x.component);
    rows.push(row([nil ? COMPONENT[x.component] : `${COMPONENT[x.component]}, ${BAND[x.band]}`, gbp(x.amount), rate(x.rate), gbpPence(x.amount * x.rate)]));
  }
  if (b.reducers.marriageAllowanceApplied) rows.push(row(['Marriage Allowance (tax reduction)', '', '', gbpPence(-b.reducers.marriageAllowanceValue)]));
  if (b.reducers.financeCostRelief > 0) rows.push(row(['Finance cost relief on mortgage interest (tax reduction)', '', '', gbpPence(-b.reducers.financeCostRelief)]));
  rows.push(row(['Income tax', '', '', gbpPence(b.incomeTax)], 'subtotal-row'));

  section('National Insurance');
  if (d.nic.overStatePensionAge) rows.push(row(['None: over State Pension age', '', '', gbpPence(0)], 'note-row'));
  for (const x of d.nic.employee) rows.push(row([`Employee National Insurance, ${x.band === 'main' ? 'main rate' : 'above the Upper Earnings Limit'}`, gbp(x.amount), rate(x.rate), gbpPence(x.amount * x.rate)]));
  for (const x of d.nic.class4) rows.push(row([`Class 4 (self-employed), ${x.band === 'main' ? 'main rate' : 'above the Upper Profits Limit'}`, gbp(x.amount), rate(x.rate), gbpPence(x.amount * x.rate)]));
  if (d.nic.employer) {
    rows.push(row([`Employer National Insurance, ${rate(d.nic.employer.rate)} (paid by your employer)`, '', '', gbpPence(d.nic.employer.amount)], 'note-row'));
    rows.push(row([`Employer National Insurance counted as yours (${Math.round(d.nic.employer.incidence * 100)}%)`, '', '', gbpPence(d.employerNicBorne)]));
  }

  if (d.cgt.length || d.cgtExempt.residential || d.cgtExempt.other) {
    section('Capital Gains Tax');
    const exempt = d.cgtExempt.residential + d.cgtExempt.other;
    if (exempt) rows.push(row(['Annual exempt amount (tax-free)', gbp(exempt), '0%', gbpPence(0)], 'note-row'));
    for (const x of d.cgt) rows.push(row([`${x.component === 'residential' ? 'Residential property' : 'Shares and other assets'}, ${x.band === 'basic' ? 'within the basic rate band' : 'above it'}`, gbp(x.amount), rate(x.rate), gbpPence(x.amount * x.rate)]));
  }

  if (d.hicbc) {
    section('High Income Child Benefit Charge');
    rows.push(row([`Child Benefit for the year (${d.hicbc.weeks} weeks)`, gbp(d.hicbc.childBenefit), `${d.hicbc.percent}%`, gbpPence(b.hicbc)]));
  }

  rows.push(row(['Total', '', '', gbpPence(r.totals.totalTax)], 'total-row'));
  tbody.replaceChildren(...rows);
}
