// Spending pipeline, run against a saved copy of the PESA 2026 Chapter 5 workbook.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readWorkbook } from '../pipeline/xlsx.mjs';
import { parseTable52, mapToTaxonomy, yearOnYearFlags, validateSpending, normalise } from '../pipeline/pesa.mjs';
import { build, changeTable } from '../pipeline/build-spending.mjs';

const buffer = readFileSync(new URL('./fixtures/PESA_2026_CP_Chapter_5_tables.xlsx', import.meta.url));
const sourceMeta = JSON.parse(readFileSync(new URL('./fixtures/PESA_2026_source.json', import.meta.url)));
const taxonomy = JSON.parse(readFileSync(new URL('../src/spending/taxonomy.json', import.meta.url)));
const workbook = readWorkbook(buffer);
const table = parseTable52(workbook);

// Appendix C of the brief (2025-26 outturn, £ million). "Running the government" includes
// EU transactions (-166), as approved in TAXONOMY.md.
const APPENDIX_C = {
  health: 257542, welfare: 194894, pensions: 156241, 'debt-interest': 130305, education: 125721,
  defence: 65418, 'social-care': 56135, 'public-order': 55720, transport: 48923, economy: 45036,
  government: 28011 - 166, housing: 22470, environment: 19157, culture: 15053, aid: 7189,
};

test('finds Table 5.2 by its title and takes the latest outturn year', () => {
  assert.match(table.title, /^Table 5\.2 Public sector expenditure on services by sub-function/);
  assert.equal(table.fiscalYear, '2025-26');
  const get = (id) => table.lines.find((l) => l.id === id)?.value;
  assert.equal(get('tes'), 1227648);
  assert.equal(get('adjustments'), 132474);
  assert.equal(get('tme'), 1360122);
  assert.equal(get('1.7/of which: public sector pensions'), 19381);
  assert.equal(get('1.4'), 0); // "-" in the source
});

test('does not depend on sheet names or position', () => {
  const renamed = structuredClone(workbook).reverse().map((s, i) => ({ ...s, name: `Sheet${i}` }));
  assert.deepEqual(parseTable52(renamed).lines, table.lines);
});

test('fails loudly when the table is missing', () => {
  const without = workbook.filter((s) => !s.rows.some((r) => r.some((c) => typeof c === 'string' && /^Table 5\.2/.test(c))));
  assert.throws(() => parseTable52(without), /Table 5\.2 .* not found/);
});

test('reproduces the 2025-26 figures in Appendix C', () => {
  const { categories, totals } = mapToTaxonomy(table, taxonomy);
  assert.deepEqual(Object.fromEntries(categories.map((c) => [c.id, c.amount])), APPENDIX_C);
  assert.equal(totals.tes, 1227648);
  assert.ok(Math.abs(totals.categoriesSum - totals.tes) <= 1);
  // Ranked largest first
  assert.deepEqual(categories.slice(0, 3).map((c) => c.name), ['Health', 'Welfare', 'Pensions']);
  // Drill-down splits debt interest into its parts
  const debt = categories.find((c) => c.id === 'debt-interest');
  assert.deepEqual(debt.children.map((c) => c.amount), [96946, 19381, 12344, 1132, 502]);
});

test('every line is assigned exactly once: an unassigned line fails', () => {
  const t = structuredClone(taxonomy);
  t.categories.find((c) => c.id === 'aid').children[0].rows = [];
  assert.throws(() => mapToTaxonomy(table, t), /"1\.2 Foreign economic aid \(1\)" \(1\.2\) is not assigned/);
});

test('a parent and its "of which" lines cannot both be used', () => {
  const t = structuredClone(taxonomy);
  t.categories.find((c) => c.id === 'transport').children.push({ id: 'all', name: 'All transport', rows: ['4.5'] });
  assert.throws(() => mapToTaxonomy(table, t), /counted twice, via/);
});

test('a new line in the source stops the pipeline', () => {
  const t = structuredClone(table);
  t.lines.splice(10, 0, { id: '1.8', label: '1.8 Something new', value: 5 });
  assert.throws(() => mapToTaxonomy(t, taxonomy), /"1\.8 Something new" \(1\.8\) is not assigned/);
});

test('TES must equal the sum of the function totals', () => {
  const t = structuredClone(table);
  t.lines.find((l) => l.id === 'tes').value += 5;
  assert.throws(() => mapToTaxonomy(t, taxonomy), /"tes" is 1227653 but its parts sum to 1227648/);
});

test('categories must sum to TES within £1 million', () => {
  const t = structuredClone(taxonomy);
  t.categories.find((c) => c.id === 'economy').amount = { add: ['4/total'] }; // forgets to take out transport
  assert.throws(() => mapToTaxonomy(table, t), /Categories sum to £1276572m but TES is £1227648m/);
});

test('flags categories that move more than 25% year on year, without failing', () => {
  const now = mapToTaxonomy(table, taxonomy);
  const prev = { categories: now.categories.map((c) => ({ ...c, amount: c.id === 'defence' ? 50000 : c.amount })) };
  const flags = yearOnYearFlags(now, prev);
  assert.deepEqual(flags.map((f) => f.id), ['defence']);
});

test('builds a valid data/spending.json, and the committed file matches the fixture', () => {
  const doc = build(buffer, sourceMeta, taxonomy, { generated: '2026-10-29T00:00:00.000Z' });
  assert.deepEqual(validateSpending(doc), []);
  assert.equal(doc.meta.basis, 'TES');
  assert.equal(doc.meta.fiscalYear, '2025-26');
  const committed = JSON.parse(readFileSync(new URL('../data/spending.json', import.meta.url)));
  assert.deepEqual({ ...committed, meta: { ...committed.meta, generated: null } }, { ...doc, meta: { ...doc.meta, generated: null } });
});

test('schema check rejects a malformed file', () => {
  assert.ok(validateSpending({ meta: {}, categories: [] }).length > 5);
});

test('pull request table shows old, new, change and share of the pound', () => {
  const doc = build(buffer, sourceMeta, taxonomy);
  const prev = structuredClone(doc);
  prev.categories[0].amount -= 2500;
  const md = changeTable(prev, doc);
  assert.match(md, /\| Health \| £255\.0bn \| £257\.5bn \| \+£2\.5bn \| 21\.0p \|/);
});

test('label normalisation', () => {
  assert.equal(normalise('1.7 Public debt transactions (2), (3)'), '1.7 public debt transactions');
  assert.equal(normalise('of which:Bank of England'), 'of which: bank of england');
  assert.equal(normalise('10.4  Family and children'), '10.4 family and children');
});
