// Asserts the hand-worked examples in tests/worked-examples.md for both tax years.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeTax, incomeTaxOn } from '../src/engine/computeTax.js';

const load = (id) => JSON.parse(readFileSync(new URL(`../params/${id}.json`, import.meta.url)));
const Y26 = load('2026-27');
const Y27 = load('2027-28');

const BASE = {
  employmentIncome: 0, selfEmployedProfit: 0, savingsInterest: 0, dividends: 0,
  propertyProfit: 0, propertyFinanceCosts: 0, gainsOther: 0, gainsResidential: 0,
  salarySacrifice: 0, pensionNetPay: 0, blind: false, marriageAllowanceRecipient: false,
  children: 0, age: 40, includeEmployerNIC: false,
};
const run = (inputs, p) => computeTax({ ...BASE, ...inputs }, p);

// [example, inputs, total 2026-27, total 2027-28, extra checks]
const EXAMPLES = [
  ['1. salary only', { employmentIncome: 35000 }, 6280.40, 6280.40,
    (r) => assert.equal(r.totals.effectiveRatePct, 17.94)],
  ['2. salary and savings', { employmentIncome: 45000, savingsInterest: 3000 }, 9480.40, 9560.40],
  ['3. dividends only', { dividends: 31970 }, 2031.75, 2031.75],
  ['4. higher rate, savings and dividends', { employmentIncome: 60000, savingsInterest: 2000, dividends: 5000 }, 16851.35, 16911.35,
    (r) => { assert.equal(r.breakdown.zeroRateSavings.psaApplied, 500); assert.equal(r.breakdown.componentTaxes.dividends, 1608.75); }],
  ['5. taper', { employmentIncome: 110000 }, 37642.60, 37642.60,
    (r) => assert.equal(r.internals.PA, 7570)],
  ['6. HICBC', { employmentIncome: 70000, children: 2 }, 20033.60, 20052.60],
  ['7. salary sacrifice, employer NI', { employmentIncome: 60000, salarySacrifice: 6000, includeEmployerNIC: true }, 17635.10, 17635.10,
    (r) => { assert.equal(r.breakdown.erNIC, 7350); assert.equal(r.totals.effectiveRatePct, 26.92); }],
  ['8. self-employed', { selfEmployedProfit: 40000 }, 7131.80, 7131.80,
    (r) => assert.equal(r.breakdown.seNIC, 1645.80)],
  ['9. capital gains', { employmentIncome: 40000, gainsOther: 30000, gainsResidential: 20000 }, 18344.20, 18344.20,
    (r) => { assert.equal(r.breakdown.cgtProperty, 3463.80); assert.equal(r.breakdown.cgtOther, 7200); assert.equal(r.totals.effectiveRatePct, 20.38); }],
  ['10. over State Pension age', { age: 70, employmentIncome: 30000, savingsInterest: 1000 }, 3486, 3486],
  ['10b. aged 66, not yet at SPA', { age: 66, employmentIncome: 30000, reachedStatePensionAge: false }, 4880.40, 4880.40],
  ['10c. aged 66, over SPA', { age: 66, employmentIncome: 30000, reachedStatePensionAge: true }, 3486, 3486],
  ['10d. aged 67', { age: 67, employmentIncome: 30000, reachedStatePensionAge: false }, 3486, 3486],
  ['11. landlord (HMRC example)', { employmentIncome: 30000, propertyProfit: 3000, propertyFinanceCosts: 1000, savingsInterest: 400, dividends: 200 }, 5280.40, 5360.40],
  ['12. landlord, little other income', { employmentIncome: 10000, propertyProfit: 20000 }, 3486, 4183.20],
  ['13. savings and dividends', { savingsInterest: 10000, dividends: 15070 }, 645, 645,
    (r) => assert.equal(r.breakdown.componentTaxes.savings, 0)],
  ['14. Blind Person\'s Allowance', { employmentIncome: 30000, blind: true }, 4230.40, 4206.40],
  ['15. Marriage Allowance', { employmentIncome: 25000, marriageAllowanceRecipient: true }, 3228.40, 3228.40],
  ['16. under 21, employer NI', { age: 20, employmentIncome: 30000, includeEmployerNIC: true }, 4880.40, 4880.40,
    (r) => assert.equal(r.breakdown.erNIC, 0)],
];

for (const [name, inputs, t26, t27, extra] of EXAMPLES) {
  test(`2026-27 example ${name}: £${t26}`, () => {
    const r = run(inputs, Y26);
    assert.equal(r.totals.totalTax, t26);
    extra?.(r);
  });
  test(`2027-28 example ${name}: £${t27}`, () => {
    const r = run(inputs, Y27);
    assert.equal(r.totals.totalTax, t27);
    extra?.(r);
  });
}

test('example 6: Child Benefit for 53 weeks in 2026-27, 52 in 2027-28', () => {
  assert.equal(run({ employmentIncome: 90000, children: 2 }, Y26).breakdown.hicbc, 2382);
  assert.equal(run({ employmentIncome: 90000, children: 2 }, Y27).breakdown.hicbc, 2420);
});

test('example 11: HMRC technical note figure (£3,926) at its 22% property rate', () => {
  const p = structuredClone(Y27);
  p.property.rates = { basic: 0.22, higher: 0.42, additional: 0.47 };
  p.property.financeCostReliefRate = 0.22;
  const r = run({ employmentIncome: 30000, propertyProfit: 3000, propertyFinanceCosts: 1000, savingsInterest: 400, dividends: 200 }, p);
  assert.equal(r.breakdown.incomeTax, 3926);
  assert.equal(r.breakdown.reducers.financeCostRelief, 220);
});

test('finance cost relief is limited by adjusted total income', () => {
  // £15,000 rental profit, £10,000 mortgage interest, no other income. Adjusted total income
  // £15,000 - £12,570 = £2,430, so relief is £2,430 x 24% = £583.20.
  const r = run({ propertyProfit: 15000, propertyFinanceCosts: 10000 }, Y27);
  assert.equal(r.breakdown.reducers.financeCostRelief, 583.20);
  assert.equal(r.breakdown.incomeTax, 0); // £2,430 x 24% = £583.20 tax, all relieved
});

test('2027-28: three-way allowance split beats or matches a £25-step grid search', () => {
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const ns = Math.round(rand() * 8000);
    const pr = Math.round(rand() * 12000);
    const sv = Math.round(rand() * 15000);
    const dv = Math.round(rand() * 20000);
    if (ns + pr + sv + dv > 100000) continue;
    const R = Math.max(0, 12570 - ns);
    let best = Infinity;
    for (let tp = 0; tp <= Math.min(R, pr); tp += 25) {
      for (let td = 0; td <= Math.min(R - tp, dv); td += 25) {
        if (R - tp - td > sv) continue;
        const x = incomeTaxOn(Math.max(0, ns - 12570), pr - tp, sv - (R - tp - td), dv - td, Y27);
        best = Math.min(best, x.nonSavingsTax + x.propertyTax + x.savingsTax + x.dividendTax);
      }
    }
    if (best === Infinity) continue;
    const got = run({ employmentIncome: ns, propertyProfit: pr, savingsInterest: sv, dividends: dv }, Y27).breakdown.incomeTax;
    assert.ok(got <= best + 0.01, `ns ${ns} pr ${pr} sv ${sv} dv ${dv}: engine £${got}, grid £${best.toFixed(2)}`);
  }
});
