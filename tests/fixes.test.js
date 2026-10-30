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
