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
  // As shipped, savings are taxed at 42% and salary at 40%, so the allowance goes against the
  // £1,500 of interest the PSA leaves (N5): salary taxable £112,430, tax £7,540 + £74,730 x 40%
  assert.equal(r.breakdown.componentTaxes.savings, 0);
  assert.equal(r.breakdown.incomeTax, 37432);
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

test('A10b: HICBC is 1% per complete £200, rounded down to whole pounds', () => {
  // 1 child, as-shipped rate: 52 x £26.05 = £1,354.60, rounded down to £1,354.
  // ANI £61,350: £1,350 over = 6 complete steps = 6%. £1,354 x 6% = £81.24, so £81.
  assert.equal(run({ employmentIncome: 61350, children: 1 }).breakdown.hicbc, 81);
  // £199 over: no complete step, no charge
  assert.equal(run({ employmentIncome: 60199, children: 1 }).breakdown.hicbc, 0);
  // £80,000 and above: the whole (rounded-down) benefit
  assert.equal(run({ employmentIncome: 80000, children: 1 }).breakdown.hicbc, 1354);
  // 3 children: 52 x (26.05 + 2 x 17.25) = £3,148.60 -> £3,148. ANI £70,100: 50 steps = 50%.
  assert.equal(run({ employmentIncome: 70100, children: 3 }).breakdown.hicbc, 1574);
});

test('N2: allowances go where they save most tax (ITA 2007 s25(2))', () => {
  // £6,000 interest + £20,000 dividends, nothing else. Savings first: PA covers the interest,
  // £13,430 of dividends taxable, £500 at 0%, £12,930 at 10.75% = £1,389.98.
  // Best: PA against dividends. Interest £6,000 = £5,000 starting rate + £1,000 PSA, all at 0%.
  // Dividends £7,430: £500 at 0%, £6,930 at 10.75% = £744.98.
  const r = run({ savingsInterest: 6000, dividends: 20000 });
  assert.equal(r.breakdown.incomeTax, 744.98);
  assert.equal(r.breakdown.componentTaxes.savings, 0);
  // £10,000 interest + £15,000 dividends. Savings first: £1,282.47. All PA on dividends:
  // £1,087.48. Best is in between: £4,000 of PA on interest leaves exactly £6,000, covered by
  // the £5,000 starting rate and £1,000 PSA; £8,570 on dividends leaves £6,430, of which
  // £500 at 0% and £5,930 at 10.75% = £637.48.
  const r2 = run({ savingsInterest: 10000, dividends: 15000 });
  assert.equal(r2.breakdown.incomeTax, 637.48);
  assert.equal(r2.breakdown.componentTaxes.savings, 0);
});

test('N2, N5: the allowance split beats or matches a brute-force search over every split', async () => {
  // Allowance on salary (a), on dividends (t), the rest on savings: a £50 grid, then £1
  // steps around the best point. The engine must do at least as well.
  const { incomeTaxOn } = await import('../src/engine/computeTax.js');
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const A = 12570;
  for (let i = 0; i < 100; i++) {
    const ns = rand() < 0.3 ? 0 : Math.round(rand() * 60000);
    const sv = Math.round(rand() * 20000);
    const dv = Math.round(rand() * 40000);
    if (ns + sv + dv > 100000 || ns + sv + dv < A) continue; // full allowance, all used
    const tax = (a, t) => {
      const s = A - a - t;
      if (a < 0 || t < 0 || s < 0 || a > ns || t > dv || s > sv) return Infinity;
      const x = incomeTaxOn(ns - a, 0, sv - s, dv - t, params);
      return x.nonSavingsTax + x.savingsTax + x.dividendTax;
    };
    let best = { c: Infinity };
    const scan = (a0, a1, t0, t1, step) => {
      for (let a = a0; a <= a1; a += step) for (let t = t0; t <= t1; t += step) {
        const fill = [t, A - a - sv, dv].filter((v) => v >= t0 && v <= t1); // also try savings exactly full
        for (const tt of new Set(fill)) { const c = tax(a, tt); if (c < best.c) best = { a, t: tt, c }; }
      }
    };
    scan(0, Math.min(A, ns), 0, Math.min(A, dv), 50);
    scan(Math.max(0, best.a - 60), Math.min(A, ns, best.a + 60), Math.max(0, best.t - 60), Math.min(A, dv, best.t + 60), 1);
    if (best.c === Infinity) continue;
    const got = run({ employmentIncome: ns, savingsInterest: sv, dividends: dv }).breakdown.incomeTax;
    assert.ok(got <= Math.round(best.c * 100) / 100 + 0.01, `ns ${ns} sv ${sv} dv ${dv}: engine ${got}, brute force ${best.c}`);
  }
});

test('N5: before 2027-28 allowances need not go against salary first', () => {
  const y26 = JSON.parse(readFileSync(new URL('../params/2026-27.json', import.meta.url)));
  // £50,000 salary + £3,000 dividends. Salary first: taxable £37,430 at 20% = £7,486; the
  // £500 dividend allowance sits £270 in the basic band; £2,500 at 35.75% = £893.75; £8,379.75.
  // Better: £270 of allowance against dividends. Salary taxable £37,700 = £7,540; the
  // allowance then sits wholly in the higher band; £2,230 at 35.75% = £797.225; £8,337.23.
  const r = run({ employmentIncome: 50000, dividends: 3000 }, y26);
  assert.equal(r.breakdown.incomeTax, 8337.23);
  // Same with the Personal Savings Allowance: £44,110 profit, £9,380 interest, £28,110
  // dividends. Salary first gives £18,598.57; putting the PSA in the higher band, £18,498.57.
  assert.equal(run({ selfEmployedProfit: 44110, savingsInterest: 9380, dividends: 28110 }, y26).breakdown.incomeTax, 18498.57);
});

test('N6: finance cost relief is capped by income after all allowances, wherever they are set', () => {
  const y27 = JSON.parse(readFileSync(new URL('../params/2027-28.json', import.meta.url)));
  // 2027-28: £16,060 rent, £9,570 mortgage interest, £7,150 interest. Adjusted total income
  // (ITTOIA 2005 s274AA(6)) = £16,060 - £12,570 = £3,490, so relief = £3,490 x 24% = £837.60.
  // Allowance all against rent: property £3,490 x 24% = £837.60; savings £1,510 starting rate
  // and £1,000 PSA at 0%, £4,640 x 24% = £1,113.60. Tax £1,951.20 - £837.60 = £1,113.60.
  // (The engine used to count only the allowance set against rent, giving £2,296.80 relief.)
  const r = run({ propertyProfit: 16060, propertyFinanceCosts: 9570, savingsInterest: 7150 }, y27);
  assert.equal(r.breakdown.reducers.financeCostRelief, 837.6);
  assert.equal(r.breakdown.incomeTax, 1113.6);
});

test('N2: a year with the statutory order sets allowances against savings before dividends', () => {
  const p = structuredClone(params);
  p.incomeTax.allowanceAllocation = 'statutoryOrder';
  assert.equal(run({ savingsInterest: 6000, dividends: 20000 }, p).breakdown.incomeTax, 1389.98);
});

test('A7: State Pension age while it rises from 66 to 67', () => {
  const p = structuredClone(params);
  p.nic.statePensionAge = { askFrom: 66, certainFrom: 67 };
  const nic = (age, reachedStatePensionAge) => run({ employmentIncome: 30000, age, reachedStatePensionAge }, p).breakdown.eeNIC;
  assert.equal(nic(65), 1394.40); // (30,000 - 12,570) x 8%
  assert.equal(nic(66), 1394.40); // not answered: treated as not yet reached
  assert.equal(nic(66, false), 1394.40);
  assert.equal(nic(66, true), 0);
  assert.equal(nic(67), 0);
  assert.equal(nic(67, false), 0); // 67 and over: always past SPA
});

test('A8: average rate divides by all income and gains, plus employer NI borne', () => {
  // £30,000 salary + £100,000 gain: total tax £26,944.20 over £130,000 = 20.73%
  const r = run({ employmentIncome: 30000, gainsOther: 100000 });
  assert.equal(r.totals.totalTax, 26944.20);
  assert.equal(r.totals.effectiveRatePct, 20.73);
  // £50,000 salary, employer NI on: employer NI £6,750, 75% = £5,062.50 counted as tax and
  // as pay. Tax £10,480.40 + £5,062.50 = £15,542.90 over £55,062.50 = 28.23%
  const e = run({ employmentIncome: 50000, includeEmployerNIC: true });
  assert.equal(e.totals.totalTax, 15542.90);
  assert.equal(e.totals.effectiveRatePct, 28.23);
});
