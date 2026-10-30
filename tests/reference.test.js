// Random cases against an independent reference. The reference below is written from the
// legislation, not from the engine: it shares no code with it, sets the allowances by
// brute-force search (ITA 2007 s25(2)) rather than by breakpoints, and works each tax out
// in the most direct way. Any disagreement of more than a penny fails.
//
// Statutory references: ITA 2007 ss6-16 (rates and bands, nil rates), s25 (allowances),
// s35 (taper), s55B (Marriage Allowance); ITTOIA 2005 s274AA (finance costs); ITEPA 2003
// s681C (HICBC); SSCBA 1992 ss8, 9, 15 (NI); TCGA 1992 ss1H, 1I (CGT).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeTax } from '../src/engine/computeTax.js';

const load = (id) => JSON.parse(readFileSync(new URL(`../params/${id}.json`, import.meta.url)));
const YEARS = { '2026-27': load('2026-27'), '2027-28': load('2027-28') };
const r2 = (x) => Math.round(x * 100) / 100;

// Income tax on taxable amounts, stacked other income, property, savings, dividends
function liability(y, ns, pr, sv, dv) {
  const BRL = y.incomeTax.basicRateLimit;
  const HRL = y.incomeTax.additionalRateThreshold;
  let pos = 0;
  let tax = 0;
  let taxedAboveBasic = false; // for Marriage Allowance: anything but savings nil rates above the basic band
  const charge = (amount, rates, nilSavings = false) => {
    const basic = Math.max(0, Math.min(amount, BRL - pos));
    const higher = Math.max(0, Math.min(amount - basic, HRL - Math.max(pos, BRL)));
    const additional = amount - basic - higher;
    if (rates) tax += basic * rates.basic + higher * rates.higher + additional * rates.additional;
    if (amount - basic > 0 && !nilSavings) taxedAboveBasic = true;
    pos += amount;
  };
  const T = ns + pr + sv + dv;
  charge(ns, y.incomeTax.rates);
  charge(pr, y.property.rates || y.incomeTax.rates);
  const srs = Math.min(sv, Math.max(0, y.savings.startingRateBand - (ns + pr)));
  const psaFor = T > HRL ? 'additional' : T > BRL ? 'higher' : 'basic';
  const psa = Math.min(sv - srs, y.savings.personalSavingsAllowance[psaFor]);
  charge(srs, null, true);
  charge(psa, null, true);
  charge(sv - srs - psa, y.savings.rates);
  const da = Math.min(dv, y.dividends.allowance);
  charge(da, null);
  charge(dv - da, y.dividends.rates);
  return { tax, T, maEligible: !taxedAboveBasic };
}

function reference(inp, y) {
  const it = y.incomeTax;
  const n = y.nic;
  const separate = !!y.property.rates;
  const emp = Math.max(0, inp.employmentIncome - inp.salarySacrifice - inp.pensionNetPay);
  const other = emp + inp.selfEmployedProfit + (separate ? 0 : inp.propertyProfit);
  const inc = [other, separate ? inp.propertyProfit : 0, inp.savingsInterest, inp.dividends];
  const ani = inc.reduce((a, b) => a + b, 0);
  const pa = Math.max(0, it.personalAllowance - Math.floor(Math.max(0, ani - it.paTaperStart) / 2));
  const A = Math.min(ani, pa + (inp.blind ? it.blindPersonsAllowance : 0));
  const ati = Math.max(0, inc[0] + inc[1] - A); // ITTOIA s274AA(6)
  const fcr = Math.min(inp.propertyFinanceCosts, inp.propertyProfit, ati) * y.property.financeCostReliefRate;

  const netTax = (a) => {
    const L = liability(y, inc[0] - a[0], inc[1] - a[1], inc[2] - a[2], inc[3] - a[3]);
    const ma = inp.marriageAllowanceRecipient && L.maEligible ? it.marriageAllowance.credit : 0;
    return Math.max(0, L.tax - ma - fcr);
  };
  // Brute force: a £50 grid over every split, then £1 steps around the best. From 2027-28
  // (s25(3A)) other income takes the allowance first.
  let best = null;
  const range = (lo, hi, step) => { const out = []; for (let v = lo; v < hi; v += step) out.push(v); out.push(hi); return out; };
  const search = (lo, hi, step) => {
    const r = (k) => range(Math.max(lo[k], 0), Math.max(Math.max(lo[k], 0), Math.min(hi[k], inc[k], A)), step);
    for (const a0 of it.otherIncomeFirst ? [Math.min(A, inc[0])] : r(0)) for (const a1 of r(1)) for (const a2 of r(2)) {
      let rem = A - a0 - a1 - a2; // what the grid leaves goes to dividends, savings, then property
      if (rem < 0) continue;
      const a3 = Math.min(inc[3], rem); rem -= a3;
      const x2 = Math.min(inc[2] - a2, rem); rem -= x2;
      const x1 = Math.min(inc[1] - a1, rem); rem -= x1;
      if (rem > 0) continue;
      const a = [a0, a1 + x1, a2 + x2, a3];
      const c = netTax(a);
      if (!best || c < best.c - 1e-9) best = { a, c };
    }
  };
  search([0, 0, 0], [A, A, A], 50);
  search(best.a.map((v) => v - 60), best.a.map((v) => v + 60), 1);
  const incomeTax = r2(best.c);

  const spa = n.statePensionAge;
  const overSPA = inp.age >= spa.certainFrom || (inp.age >= spa.askFrom && inp.reachedStatePensionAge);
  const pay = inp.employmentIncome - inp.salarySacrifice; // net pay pension doesn't reduce NI
  const bands = (x, lo, hi, r1, rUp) => Math.max(0, Math.min(x, hi) - lo) * r1 + Math.max(0, x - hi) * rUp;
  const ee = overSPA ? 0 : r2(bands(pay, n.class1Employee.primaryThreshold, n.class1Employee.upperEarningsLimit, n.class1Employee.mainRate, n.class1Employee.additionalRate));
  const c4 = overSPA ? 0 : r2(bands(inp.selfEmployedProfit, n.class4.lowerProfitsLimit, n.class4.upperProfitsLimit, n.class4.mainRate, n.class4.additionalRate));
  const erThreshold = inp.age < n.class1Employer.under21Age ? n.class1Employer.upperSecondaryThreshold : n.class1Employer.secondaryThreshold;
  const er = inp.includeEmployerNIC ? r2(Math.max(0, pay - erThreshold) * n.class1Employer.rate) : 0;

  const T = inc.reduce((a, b) => a + b, 0) - A;
  const gains = Math.max(0, inp.gainsOther + inp.gainsResidential - y.cgt.annualExemptAmount);
  const room = Math.max(0, it.basicRateLimit - T);
  const cgt = r2(Math.min(gains, room) * y.cgt.rates.basic + Math.max(0, gains - room) * y.cgt.rates.higher);

  const cb = y.childBenefit;
  const benefit = inp.children ? Math.floor(cb.weeksPerYear * (cb.weeklyEldest + (inp.children - 1) * cb.weeklyAdditional)) : 0;
  const h = y.hicbc;
  const percent = ani >= h.thresholdEnd ? 100 : ani <= h.thresholdStart ? 0 : Math.floor((ani - h.thresholdStart) / h.stepPounds);
  const hicbc = Math.floor(benefit * percent / 100);

  const borne = er * y.assumptions.employerNicIncidence;
  return { incomeTax, nic: r2(ee + c4), employerNic: er, cgt, hicbc, total: r2(incomeTax + ee + c4 + borne + cgt + hicbc) };
}

// Seeded random cases (mulberry32)
function randomCases(seed, count) {
  let s = seed;
  const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const maybe = (p, f) => (rnd() < p ? f() : 0);
  const money = (lo, hi) => Math.round((lo + rnd() * (hi - lo)) / 10) * 10;
  const cases = [];
  while (cases.length < count) {
    const employmentIncome = maybe(0.8, () => money(8000, 160000));
    const age = rnd() < 0.1 ? 19 + Math.floor(rnd() * 2) : rnd() < 0.12 ? 66 + Math.floor(rnd() * 8) : 22 + Math.floor(rnd() * 44);
    const inputs = {
      employmentIncome,
      selfEmployedProfit: maybe(0.3, () => money(2000, 70000)),
      savingsInterest: maybe(0.5, () => money(100, 15000)),
      dividends: maybe(0.4, () => money(100, 30000)),
      propertyProfit: 0, propertyFinanceCosts: 0,
      gainsOther: maybe(0.25, () => money(1000, 60000)),
      gainsResidential: maybe(0.15, () => money(5000, 120000)),
      salarySacrifice: employmentIncome && rnd() < 0.3 ? Math.round(employmentIncome * (0.03 + rnd() * 0.1)) : 0,
      pensionNetPay: employmentIncome && rnd() < 0.2 ? Math.round(employmentIncome * (0.03 + rnd() * 0.05)) : 0,
      blind: rnd() < 0.1,
      marriageAllowanceRecipient: rnd() < 0.2,
      children: rnd() < 0.35 ? 1 + Math.floor(rnd() * 3) : 0,
      age,
      reachedStatePensionAge: age === 66 && rnd() < 0.5,
      includeEmployerNIC: rnd() < 0.5,
    };
    if (rnd() < 0.3) {
      inputs.propertyProfit = money(3000, 40000);
      inputs.propertyFinanceCosts = maybe(0.6, () => money(500, inputs.propertyProfit));
    }
    const any = inputs.employmentIncome + inputs.selfEmployedProfit + inputs.savingsInterest + inputs.dividends
      + inputs.propertyProfit + inputs.gainsOther + inputs.gainsResidential;
    if (any > 0) cases.push(inputs);
  }
  return cases;
}

for (const [year, y] of Object.entries(YEARS)) {
  test(`${year}: 1,000 random cases match an independent reference to the penny`, () => {
    const failures = [];
    for (const inputs of randomCases(year === '2026-27' ? 2026 : 2027, 1000)) {
      const e = computeTax(structuredClone(inputs), y);
      const engine = {
        incomeTax: e.breakdown.incomeTax, nic: e.breakdown.totalPersonalNIC, employerNic: e.breakdown.erNIC,
        cgt: e.breakdown.cgt, hicbc: e.breakdown.hicbc, total: e.totals.totalTax,
      };
      const ref = reference(inputs, y);
      const off = Object.keys(engine).filter((k) => Math.abs(engine[k] - ref[k]) > 0.011);
      if (off.length) failures.push(`${JSON.stringify(inputs)}\n  ${off.map((k) => `${k}: engine ${engine[k]}, reference ${ref[k]}`).join('; ')}`);
    }
    assert.equal(failures.length, 0, failures.slice(0, 5).join('\n'));
  });
}
