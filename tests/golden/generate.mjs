// Builds tests/golden/as-shipped.json by running every case through the ORIGINAL page.
//
//   node tests/golden/generate.mjs
//
// This reproduces the baseline as shipped. Approved fixes are then applied on top with
// tests/golden/update.mjs (see meta.fixesApplied), so regenerating discards them.
//
// Loads legacy/original.html in headless Chromium and calls window.compute(inputs), the
// live engine, for each case. Also records the legacy engine's currentEffBase (the figure
// the original's spending split used) purely to document finding A1 in AUDIT.md.

import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateCases } from './cases.mjs';

const ORIGINAL = fileURLToPath(new URL('../../legacy/original.html', import.meta.url));
const OUT = fileURLToPath(new URL('./as-shipped.json', import.meta.url));
const SEED = 20261029;

const cases = generateCases(SEED);
const sha256 = createHash('sha256').update(readFileSync(ORIGINAL)).digest('hex');

const browser = await chromium.launch();
const page = await browser.newPage();
// The original loads Google Fonts (not needed for maths) and d3 from jsDelivr.
await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
await page.goto(pathToFileURL(ORIGINAL).href, { waitUntil: 'load' });

const ok = await page.evaluate(() => typeof window.compute === 'function' && typeof computeTaxes_legacy === 'function');
if (!ok) throw new Error('compute() or computeTaxes_legacy() not found on the original page');

const BATCH = 250;
for (let i = 0; i < cases.length; i += BATCH) {
  const batch = cases.slice(i, i + BATCH).map(({ ui, inputs }) => ({ ui, inputs }));
  const out = await page.evaluate((batch) => {
    const setNum = (id, v) => { document.getElementById(id).value = String(v); };
    const setBool = (id, v) => { document.getElementById(id).checked = !!v; };
    return batch.map(({ ui, inputs }) => {
      const result = window.compute(structuredClone(inputs));
      setNum('age', ui.age); setNum('empInc', ui.empInc); setNum('seInc', ui.seInc);
      setNum('pensSac', ui.pensSacPct); setNum('pensEmp', ui.pensEmpPct);
      setNum('divInc', ui.divInc); setNum('savInc', ui.savInc);
      setNum('cgtGain', ui.cgtGain); setNum('cgtProp', ui.cgtProp); setNum('cbKids', ui.cbKids);
      setBool('marriage', ui.marriage); setBool('blind', ui.blind); setBool('incErNI', ui.incErNI);
      computeTaxes_legacy();
      return { result, legacy: currentEffBase }; // eslint-disable-line no-undef
    });
  }, batch);
  out.forEach((o, j) => {
    cases[i + j].result = o.result;
    cases[i + j].legacyCurrentEffBase = o.legacy;
  });
}
await browser.close();

// Refuse to write values JSON cannot represent faithfully
JSON.stringify(cases, (k, v) => {
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`Non-finite ${k}=${v}`);
  if (Object.is(v, -0)) throw new Error(`Negative zero at ${k}`);
  return v;
});

const meta = {
  description: 'Golden master: outputs of compute() in the original calculator, as shipped.',
  source: 'legacy/original.html',
  sourceSha256: sha256,
  seed: SEED,
  count: cases.length,
  groups: Object.fromEntries(Object.entries(cases.reduce((m, c) => ((m[c.group] = (m[c.group] || 0) + 1), m), {}))),
  generatedBy: 'tests/golden/generate.mjs',
  note: 'legacyCurrentEffBase is the old computeTaxes_legacy() total, recorded only to document finding A1.',
};
// One case per line keeps diffs readable when a fix updates individual cases.
const body = cases.map((c) => '    ' + JSON.stringify(c)).join(',\n');
writeFileSync(OUT, `{\n  "meta": ${JSON.stringify(meta)},\n  "cases": [\n${body}\n  ]\n}\n`);
console.log(`Wrote ${cases.length} cases to ${OUT}`);
