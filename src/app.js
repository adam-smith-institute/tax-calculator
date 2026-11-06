// ASI tax calculator: reads the form, runs the engine for the chosen tax year (and the other
// year, for the comparison line), and renders the results and the spending split.

import { computeTax } from './engine/computeTax.js?v=569d6163c9';
import { loadSpending, allocate } from './ui/spending-data.js?v=569d6163c9';
import { buildPie } from './ui/pie.js?v=569d6163c9';
import { renderSummary, renderDetail } from './ui/breakdown.js?v=569d6163c9';
import { shareContent, downloadShareCard } from './ui/share.js?v=569d6163c9';
import { startAutoResize } from './ui/embed.js?v=569d6163c9';
import { gbp, percent, parseMoney, billions } from './ui/format.js?v=569d6163c9';

const YEARS = ['2026-27', '2027-28'];
const DEFAULT_YEAR = '2026-27';
const $ = (id) => document.getElementById(id);

const MONEY_FIELDS = ['empInc', 'seInc', 'savInc', 'divInc', 'cgtGain', 'cgtProp', 'rentProfit', 'rentInterest'];
const PERCENT_FIELDS = ['pensSac', 'pensNet'];

const state = { year: DEFAULT_YEAR, params: {}, spending: null, chart: null, last: null };

function setError(id, message) {
  const input = $(id);
  const msg = $(`${id}-error`);
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    msg.textContent = message;
    msg.hidden = false;
  } else {
    input.removeAttribute('aria-invalid');
    msg.textContent = '';
    msg.hidden = true;
  }
}

// Read and check the form. Invalid fields count as 0 and show a message.
function readForm() {
  const ui = {};
  for (const id of MONEY_FIELDS) {
    const x = parseMoney($(id).value);
    const bad = Number.isNaN(x) || x < 0;
    setError(id, bad ? 'Enter an amount in pounds, for example 45,000' : null);
    ui[id] = bad ? 0 : x;
  }
  for (const id of PERCENT_FIELDS) {
    const s = $(id).value.trim().replace('%', '');
    const x = s === '' ? 0 : Number(s);
    const bad = !Number.isFinite(x) || x < 0 || x > 100;
    setError(id, bad ? 'Enter a percentage from 0 to 100' : null);
    ui[id] = bad ? 0 : x;
  }
  if (ui.pensSac + ui.pensNet > 100) setError('pensNet', 'The two pension percentages add up to more than 100%');

  const ageText = $('age').value.trim();
  const age = ageText === '' ? 0 : Number(ageText);
  const ageBad = ageText !== '' && (!Number.isInteger(age) || age < 16 || age > 120);
  setError('age', ageBad ? 'Enter your age in whole years, from 16' : null);
  ui.age = ageBad ? 0 : age;

  const kidsText = $('kids').value.trim();
  const kids = kidsText === '' ? 0 : Number(kidsText);
  const kidsBad = !Number.isInteger(kids) || kids < 0 || kids > 20;
  setError('kids', kidsBad ? 'Enter a whole number of children' : null);
  ui.kids = kidsBad ? 0 : kids;

  ui.marriage = $('marriage').checked;
  ui.blind = $('blind').checked;
  ui.erNI = $('erNI').checked;
  ui.spa = document.querySelector('input[name="spa"]:checked')?.value === 'yes';
  return ui;
}

// Pension percentages apply to gross employment income
function toInputs(ui) {
  return {
    employmentIncome: ui.empInc,
    selfEmployedProfit: ui.seInc,
    savingsInterest: ui.savInc,
    dividends: ui.divInc,
    gainsOther: ui.cgtGain,
    gainsResidential: ui.cgtProp,
    propertyProfit: ui.rentProfit,
    propertyFinanceCosts: ui.rentInterest,
    salarySacrifice: ui.empInc * (ui.pensSac / 100),
    pensionNetPay: ui.empInc * (ui.pensNet / 100),
    blind: ui.blind,
    marriageAllowanceRecipient: ui.marriage,
    children: ui.kids,
    age: ui.age,
    reachedStatePensionAge: ui.spa,
    includeEmployerNIC: ui.erNI,
  };
}

// A word joiner after the hyphen keeps "2027-28" on one line
const nb = (text) => text.replace(/(\d{4})-(\d{2})/g, '$1-\u2060$2');

function compareLine(year, results) {
  const [a, b] = YEARS.map((y) => results[y].totals.totalTax);
  const diff = b - a; // 2027-28 minus 2026-27
  const same = Math.abs(diff) < 0.5;
  if (year === '2026-27') {
    if (same) return 'Your tax would be the same in 2027-28, after Budget 2026.';
    return `In 2027-28, after Budget 2026, the same income would be taxed ${gbp(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} a year.`;
  }
  if (same) return 'That is the same as in 2026-27.';
  return `That is ${gbp(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than in 2026-27, after Budget 2026.`;
}

let announceTimer;
function render() {
  const ui = readForm();
  const p = state.params[state.year];

  // State Pension age question: only for ages where it depends on date of birth
  const spa = p.nic.statePensionAge;
  $('spa-question').hidden = !(ui.age >= spa.askFrom && ui.age < spa.certainFrom);

  const inputs = toInputs(ui);
  const results = Object.fromEntries(YEARS.map((y) => [y, computeTax(inputs, state.params[y])]));
  const r = results[state.year];
  state.last = { r, year: state.year };

  for (const n of document.querySelectorAll('[data-year-label]')) n.textContent = state.year;
  $('total').textContent = gbp(r.totals.totalTax);
  $('rate').textContent = percent(r.totals.effectiveRatePct / 100);
  $('compare').textContent = nb(compareLine(state.year, results));
  renderSummary($('summary-body'), r);
  renderDetail($('detail-body'), r);
  state.chart?.update(r.totals.totalTax);
  for (const n of document.querySelectorAll('[data-tax-total]')) n.textContent = gbp(r.totals.totalTax);
  for (const n of document.querySelectorAll('[data-incidence]')) n.textContent = `${Math.round(p.assumptions.employerNicIncidence * 100)}%`;
  groupStatus(ui);

  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    $('announce').textContent = `Total tax ${gbp(r.totals.totalTax)} a year in ${state.year}. Average tax rate ${percent(r.totals.effectiveRatePct / 100)}.`;
  }, 800);
}

function wireExplainers() {
  for (const button of document.querySelectorAll('button[data-explain]')) {
    const panel = $(button.getAttribute('aria-controls'));
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
    });
  }
}

// One line on each closed group saying what has been entered in it
function groupStatus(ui) {
  const money = (...ids) => ids.reduce((t, id) => t + ui[id], 0);
  const status = {
    invest: money('savInc', 'divInc', 'cgtGain', 'cgtProp') > 0 ? `${gbp(money('savInc', 'divInc', 'cgtGain', 'cgtProp'))} entered` : '',
    property: ui.rentProfit > 0 ? `${gbp(ui.rentProfit)} profit` : '',
    pension: ui.pensSac + ui.pensNet > 0 ? `${+(ui.pensSac + ui.pensNet).toFixed(2)}% of salary` : '',
    family: [ui.marriage && 'Marriage Allowance', ui.blind && "Blind Person's Allowance", ui.kids > 0 && `${ui.kids} ${ui.kids === 1 ? 'child' : 'children'}`].filter(Boolean).join(', '),
  };
  for (const [k, v] of Object.entries(status)) document.querySelector(`[data-status="${k}"]`).textContent = v;
}

// Tabs (WAI-ARIA tabs pattern: arrow keys, Home and End move between tabs)
function selectTab(tab, focus = false) {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const changed = tab.getAttribute('aria-selected') !== 'true';
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(t.getAttribute('aria-controls')).hidden = !on;
  }
  if (focus) tab.focus();
  if (tab.id === 'tab-spend' && changed) state.chart?.reveal();
}

function wireTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  for (const t of tabs) {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(t);
      const next = { ArrowRight: tabs[(i + 1) % tabs.length], ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length], Home: tabs[0], End: tabs.at(-1) }[e.key];
      if (next) { e.preventDefault(); selectTab(next, true); }
    });
  }
  $('go-spend').addEventListener('click', () => {
    selectTab($('tab-spend'), true);
    $('tab-spend').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function wireYearSwitch() {
  for (const button of document.querySelectorAll('[data-year]')) {
    button.addEventListener('click', () => {
      state.year = button.dataset.year;
      for (const b of document.querySelectorAll('[data-year]')) b.setAttribute('aria-pressed', String(b === button));
      render();
    });
  }
}

function showSpendingSource(data, live) {
  const m = data.meta;
  const link = $('source-link');
  link.href = m.url;
  link.textContent = m.title;
  $('source-year').textContent = m.fiscalYear;
  for (const n of document.querySelectorAll('[data-spend-year]')) n.textContent = m.fiscalYear;
  $('tes').textContent = billions(m.tes);
  $('adjustments').textContent = billions(m.accountingAdjustments);
  $('tme').textContent = billions(m.tme);
  $('excluded').textContent = billions(m.excluded ?? 0);
  $('base').textContent = billions(m.base ?? m.tes);
  $('exclusions').replaceChildren(...(m.exclusions || []).map((e) => {
    const li = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = `${e.name}, ${billions(e.amount)}: `;
    li.append(name, e.reason);
    return li;
  }));
  if (m.programmes) $('programmes-link').href = m.programmes.url;
  else { $('programmes-about').hidden = true; $('programmes-source').hidden = true; }
  if (!live) $('source-note').hidden = false;
}

// The page and this script carry the same version stamp (scripts/stamp.mjs). If a browser
// has paired a cached old page with new code, reload once to fetch the page afresh.
function versionsMatch() {
  const code = new URL(import.meta.url).searchParams.get('v') || 'unstamped';
  const page = document.querySelector('meta[name="asi-version"]')?.content;
  if (code === page) return true;
  const url = new URL(location.href);
  if (url.searchParams.get('fresh') === code) return true; // already tried once; carry on
  url.searchParams.set('fresh', code);
  location.replace(url);
  return false;
}

async function main() {
  if (!versionsMatch()) return;
  const [spending, ...params] = await Promise.all([
    loadSpending(),
    ...YEARS.map((y) => fetch(`params/${y}.json`, { cache: 'no-cache' }).then((res) => {
      if (!res.ok) throw new Error(`Could not load tax parameters for ${y}`);
      return res.json();
    })),
  ]);
  YEARS.forEach((y, i) => { state.params[y] = params[i]; });
  state.spending = spending.data;
  state.chart = buildPie({ root: $('pie'), tableBody: $('spend-table-body'), data: spending.data });
  showSpendingSource(spending.data, spending.live);

  wireExplainers();
  wireYearSwitch();
  wireTabs();
  $('inputs').addEventListener('input', render);
  $('inputs').addEventListener('change', render);
  $('inputs').addEventListener('submit', (e) => e.preventDefault());
  $('share').addEventListener('click', async () => {
    const { r, year } = state.last;
    const button = $('share');
    button.disabled = true;
    try {
      const content = shareContent(r.totals.totalTax, year, allocate(r.totals.totalTax, state.spending), state.spending.meta);
      await downloadShareCard(content, 'assets/logo/asi_logo_navy.svg', `ASI_TaxCalculator_${year}.png`);
    } finally {
      button.disabled = false;
    }
  });

  render();
  document.body.classList.add('ready');
  startAutoResize();
}

main().catch((e) => {
  console.error(e);
  $('load-error').hidden = false;
});
