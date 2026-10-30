// Hand-worked checks for each approved audit fix (AUDIT.md), using as-shipped parameters
// so they isolate the fix. Full-year worked examples are in tests/worked-examples.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeTax } from '../src/engine/computeTax.js';

const params = JSON.parse(readFileSync(new URL('../params/as-shipped.json', import.meta.url)));
const BASE = {
  employmentIncome: 0, selfEmployedProfit: 0, savingsInterest: 0, dividends: 0,
  gainsOther: 0, gainsResidential: 0, salarySacrifice: 0, pensionNetPay: 0,
  blind: false, marriageAllowanceRecipient: false, children: 0, age: 40, includeEmployerNIC: false,
};
const run = (inputs, p = params) => computeTax({ ...BASE, ...inputs }, p);

test('A3: salary sacrifice is fully outside NI when no cap is set', () => {
  // £40,000 salary, £4,000 sacrificed: NIC base £36,000
  const r = run({ employmentIncome: 40000, salarySacrifice: 4000, includeEmployerNIC: true });
  assert.equal(r.breakdown.eeNIC, 1874.40); // (36,000 - 12,570) x 8%
  assert.equal(r.breakdown.erNIC, 4650.00); // (36,000 - 5,000) x 15%
});

test('A3: a year that sets the £2,000 cap charges NI on sacrifice above it', () => {
  const p = structuredClone(params);
  p.nic.salarySacrificeCap = 2000;
  // NIC base £40,000 - £2,000 = £38,000
  const r = run({ employmentIncome: 40000, salarySacrifice: 4000, includeEmployerNIC: true }, p);
  assert.equal(r.breakdown.eeNIC, 2034.40); // (38,000 - 12,570) x 8%
  assert.equal(r.breakdown.erNIC, 4950.00); // (38,000 - 5,000) x 15%
});

test('A4: a higher-rate taxpayer below £125,140 of taxable income keeps the £500 PSA', () => {
  // £115,000 salary + £2,000 interest: ANI £117,000, PA £12,570 - £8,500 = £4,070.
  // Taxable £112,930: higher rate, not additional, so PSA £500.
  const r = run({ employmentIncome: 115000, savingsInterest: 2000 });
  assert.equal(r.internals.PA, 4070);
  assert.equal(r.breakdown.zeroRateSavings.psaApplied, 500);
  assert.equal(r.breakdown.componentTaxes.savings, 630); // £1,500 x 42% (as-shipped savings rate)
});

test('A5: the dividend allowance uses up basic rate band', () => {
  // £48,570 salary: taxable £36,000, leaving £1,700 of basic band.
  // Dividends £3,000: £500 at 0% uses band to £36,500; £1,200 at 10.75% = £129;
  // £1,300 at 35.75% = £464.75. Total £593.75 (the engine gave £468.75).
  const r = run({ employmentIncome: 48570, dividends: 3000 });
  assert.equal(r.breakdown.componentTaxes.dividends, 593.75);
});

test('A5: GOV.UK worked example, £29,570 wages and £3,000 dividends', () => {
  // https://www.gov.uk/tax-on-dividends/how-dividends-are-taxed: £3,400 + £268.75
  const r = run({ employmentIncome: 29570, dividends: 3000 });
  assert.equal(r.breakdown.componentTaxes.nonSavings, 3400);
  assert.equal(r.breakdown.componentTaxes.dividends, 268.75);
});

test('A5: the starting rate for savings and PSA use up band space; PSA status counts them', () => {
  // £60,000 interest only: PA £12,570, taxable £47,430 (higher rate, so PSA £500).
  // Starting rate £5,000 and PSA £500 occupy band to £5,500; £32,200 at 22% = £7,084;
  // £9,730 at 42% = £4,086.60. Total £11,170.60.
  const r = run({ savingsInterest: 60000 });
  assert.equal(r.breakdown.zeroRateSavings.srsApplied, 5000);
  assert.equal(r.breakdown.zeroRateSavings.psaApplied, 500);
  assert.equal(r.breakdown.componentTaxes.savings, 11170.60);
});

test('A5: capital gains get only the basic rate band left after all taxable income', () => {
  // £20,000 interest: taxable £7,430 (£5,000 starting rate, £1,000 PSA, £1,430 at 22%).
  // Basic band left £30,270. Gain £50,000 - £3,000 = £47,000: £30,270 at 18% + £16,730 at 24%.
  const r = run({ savingsInterest: 20000, gainsOther: 50000 });
  assert.equal(r.breakdown.cgtOther, 9463.80);
});

test('A5: Marriage Allowance is lost if dividends in the allowance cross the basic rate limit', () => {
  // £50,000 salary: taxable £37,430 (with MA eligible). Add £400 dividends: all within the
  // allowance, but £130 of it would be upper-rate income (s55B(2)(ba)): no MA.
  assert.equal(run({ employmentIncome: 50000, marriageAllowanceRecipient: true }).breakdown.reducers.marriageAllowanceApplied, true);
  assert.equal(run({ employmentIncome: 50000, dividends: 400, marriageAllowanceRecipient: true }).breakdown.reducers.marriageAllowanceApplied, false);
  // Interest within the PSA above the limit does not disqualify (savings nil rate is permitted)
  assert.equal(run({ employmentIncome: 50000, savingsInterest: 400, marriageAllowanceRecipient: true }).breakdown.reducers.marriageAllowanceApplied, true);
});

test('A6: no trading allowance comes off a profit figure', () => {
  // £30,000 profit after expenses: income tax £17,430 x 20% = £3,486;
  // Class 4 £17,430 x 6% = £1,045.80
  const r = run({ selfEmployedProfit: 30000 });
  assert.equal(r.breakdown.incomeTax, 3486);
  assert.equal(r.breakdown.seNIC, 1045.80);
});
