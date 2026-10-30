// Re-baselines the golden master after an approved fix.
//
//   node tests/golden/update.mjs "A3: no salary sacrifice NI cap before 2029-30"
//
// Recomputes every case with the current engine and as-shipped parameters, and rewrites
// ONLY the cases whose result changes by half a penny or more on some field (or whose
// fields change). Unaffected lines stay byte-identical, so the commit diff shows exactly
// which cases the fix moved. The fix is appended to meta.fixesApplied.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeTax } from '../../src/engine/computeTax.js';
import { differences } from './compare.mjs';

const FILE = fileURLToPath(new URL('./as-shipped.json', import.meta.url));
const label = process.argv[2];
if (!label) throw new Error('Usage: node tests/golden/update.mjs "<fix id: description>"');

const golden = JSON.parse(readFileSync(FILE));
const params = JSON.parse(readFileSync(new URL('../../params/as-shipped.json', import.meta.url)));
const lines = readFileSync(FILE, 'utf8').split('\n');

const changed = {};
let maxDelta = 0;
const cases = golden.cases.map((c) => {
  const actual = computeTax(structuredClone(c.inputs), params);
  if (differences(c.result, actual).length === 0) return c;
  changed[c.group] = (changed[c.group] || 0) + 1;
  maxDelta = Math.max(maxDelta, Math.abs(actual.totals.totalTax - c.result.totals.totalTax));
  return { ...c, result: actual };
});
const n = Object.values(changed).reduce((a, b) => a + b, 0);

golden.meta.fixesApplied = [...(golden.meta.fixesApplied || []), { fix: label, casesChanged: n }];
// Rewrite the meta line and the changed case lines only
const out = [];
let i = 0;
for (const line of lines) {
  if (line.startsWith('  "meta": ')) out.push(`  "meta": ${JSON.stringify(golden.meta)},`);
  else if (line.startsWith('    {')) {
    const c = cases[i++];
    out.push('    ' + JSON.stringify(c) + (line.endsWith(',') ? ',' : ''));
  } else out.push(line);
}
// Untouched cases re-serialise identically (same JSON.stringify of the parsed object)
writeFileSync(FILE, out.join('\n'));
console.log(`${label}\n  ${n} of ${cases.length} cases changed; largest change in total tax £${maxDelta.toFixed(2)}`);
for (const [g, k] of Object.entries(changed)) console.log(`    ${g}: ${k}`);
