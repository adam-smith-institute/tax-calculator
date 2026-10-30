// Golden master: the ported engine with as-shipped parameters must reproduce the
// original calculator's compute() to the penny on every field of every case.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeTax } from '../src/engine/computeTax.js';
import { differences } from './golden/compare.mjs';

const golden = JSON.parse(readFileSync(new URL('./golden/as-shipped.json', import.meta.url)));
const params = JSON.parse(readFileSync(new URL('../params/as-shipped.json', import.meta.url)));

test(`golden master: ${golden.cases.length} cases match the original to the penny`, () => {
  const failures = [];
  let exact = 0;
  for (const c of golden.cases) {
    const actual = computeTax(structuredClone(c.inputs), params);
    const d = differences(c.result, actual);
    if (d.length) failures.push(`case ${c.id} (${c.group}): ${d.slice(0, 3).join('; ')}`);
    else if (JSON.stringify(actual) === JSON.stringify(c.result)) exact++;
  }
  assert.equal(failures.length, 0, `${failures.length} cases differ:\n${failures.slice(0, 20).join('\n')}`);
  // Informational: how many matched bit for bit, not just to the penny
  console.log(`  ${exact} of ${golden.cases.length} cases match exactly`);
});

test('golden master covers every threshold ±£1, every age band and toggle', () => {
  const groups = golden.meta.groups;
  assert.ok(groups.random >= 5000, 'at least 5,000 random cases');
  for (const t of [5000, 12570, 37700, 50270, 60000, 80000, 100000, 112570, 125140]) {
    for (const v of [t - 1, t, t + 1]) {
      assert.ok(golden.cases.some((c) => c.group === 'threshold:employment' && c.ui.empInc === v), `employment at ${v}`);
    }
  }
  for (const age of [18, 20, 21, 40, 65, 66, 70]) {
    for (const flag of ['incErNI', 'marriage', 'blind']) {
      assert.ok(golden.cases.some((c) => c.ui.age === age && c.ui[flag]), `age ${age} with ${flag}`);
    }
  }
});

test('engine is pure: same inputs give the same output and inputs are not mutated', () => {
  const inputs = structuredClone(golden.cases[42].inputs);
  const before = JSON.stringify(inputs);
  const a = computeTax(inputs, params);
  const b = computeTax(inputs, params);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(inputs), before);
});
