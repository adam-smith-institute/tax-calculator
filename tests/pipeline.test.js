// Spending pipeline, run against saved copies of the PESA 2026 workbooks (Chapters 1, 5 and 8)
// and OSCAR II's June 2026 in-year dataset (tests/fixtures/sources-2026.json).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readWorkbook } from '../pipeline/xlsx.mjs';
import { parseTable52, parseLinesByTitle, mapToTaxonomy, yearOnYearFlags, validateSpending, normalise } from '../pipeline/pesa.mjs';
import { readOscar, programmeAmount, parseCsv } from '../pipeline/oscar.mjs';
import { build, changeTable } from '../pipeline/build-spending.mjs';

const fixture = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url));
const spec = JSON.parse(fixture('sources-2026.json'));
const files = Object.fromEntries(Object.entries(spec.files).map(([k, f]) => [k, fixture(f)]));
const taxonomy = JSON.parse(readFileSync(new URL('../src/spending/taxonomy.json', import.meta.url)));
const workbook = readWorkbook(files.ch5);
const table = parseTable52(workbook);
const tables = {
  tme: parseLinesByTitle(readWorkbook(files.ch1), /^Table 1\.1 Total Managed Expenditure,/, '2025-26'),
  publicCorporations: parseLinesByTitle(readWorkbook(files.ch8), /^Table 8\.4 Public corporations.? current and capital expenditure on services by function/, '2025-26'),
};
const oscar = readOscar(files.oscar);
const programme = (match) => programmeAmount(oscar, match, '2025-26');

// Appendix C of the brief (2025-26 outturn, £ million), with the approved changes: EU
// transactions (-166) in General public services; Welfare (194,894) and Pensions (156,241)
// merged; and spending not funded by the taxes modelled taken out (TAXONOMY.md):
// pension scheme interest (19,381) and public corporation debt interest (502) from debt
// interest, BBC domestic services (4,598 + 339) from culture, and public corporations'
// capital spending from housing (8,526) and transport (2,059).
const EXPECTED = {
  'welfare-pensions': 194894 + 156241, health: 257542, 'debt-interest': 130305 - 19381 - 502, education: 125721,
  defence: 65418, 'social-care': 56135, 'public-order': 55720, transport: 48923 - 2059, economy: 45036,
  government: 28011 - 166, housing: 22470 - 8526, environment: 19157, culture: 15053 - 4598 - 339, aid: 7189,
};
const BASE = 1227648 - 19381 - 502 - 4937 - 8526 - 2059;

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

test('reads BBC and public corporation lines from Tables 1.1 and 8.4 by title', () => {
  assert.equal(tables.tme.get('bbc domestic services'), 4598 + 339); // resource + capital budgets
  assert.equal(tables.publicCorporations.get('capital/6. housing and community amenities'), 8526);
  assert.equal(tables.publicCorporations.get('capital/of which: transport'), 2059);
  assert.equal(tables.publicCorporations.get('current/of which: public sector debt interest'), 32227);
});

test('reproduces Appendix C less the exclusions, summing to TES less exclusions', () => {
  const { categories, totals, exclusions } = mapToTaxonomy(table, taxonomy, { tables });
  assert.deepEqual(Object.fromEntries(categories.map((c) => [c.id, c.amount])), EXPECTED);
  assert.equal(totals.tes, 1227648);
  assert.equal(totals.base, BASE);
  assert.ok(Math.abs(totals.categoriesSum - totals.base) <= 1);
  assert.deepEqual(exclusions.map((e) => [e.id, e.amount]), [
    ['pension-scheme-interest', 19381], ['public-corporation-debt-interest', 502], ['bbc', 4937],
    ['public-corporation-housing', 8526], ['public-corporation-transport', 2059],
  ]);
  assert.deepEqual(categories.slice(0, 3).map((c) => c.id), ['welfare-pensions', 'health', 'education']);
  // Debt interest keeps central government, Bank of England and council debt interest
  const debt = categories.find((c) => c.id === 'debt-interest');
  assert.deepEqual(debt.children.map((c) => c.amount), [96946, 12344, 1132]);
  // Exclusions taken out of the right lines
  const line = (cid, id) => categories.find((c) => c.id === cid).children.find((c) => c.id === id).amount;
  assert.equal(line('housing', 'council-housing'), 11991 - 8526);
  assert.equal(line('transport', 'railways'), 26479 - 2059);
  assert.equal(line('culture', 'broadcasting'), 5312 - 4937);
  // Shares are of TES less exclusions
  assert.ok(Math.abs(categories.reduce((s, c) => s + c.share, 0) - 1) < 1e-6);
});

test('an exclusion whose source line is missing stops the pipeline', () => {
  const broken = new Map(tables.publicCorporations);
  broken.title = tables.publicCorporations.title;
  broken.delete('capital/of which: transport');
  assert.throws(() => mapToTaxonomy(table, taxonomy, { tables: { ...tables, publicCorporations: broken } }), /line "capital\/of which: transport" not found/);
  assert.throws(() => mapToTaxonomy(table, taxonomy, { tables: {} }), /needs PESA table "tme"/);
});

test('every line is assigned exactly once: an unassigned line fails', () => {
  const t = structuredClone(taxonomy);
  t.categories.find((c) => c.id === 'aid').children[0].rows = [];
  assert.throws(() => mapToTaxonomy(table, t, { tables }), /"1\.2 Foreign economic aid \(1\)" \(1\.2\) is not assigned/);
});

test('a line cannot be both excluded and assigned to a category', () => {
  const t = structuredClone(taxonomy);
  t.categories.find((c) => c.id === 'debt-interest').children[0].rows.push('1.7/of which: public sector pensions');
  assert.throws(() => mapToTaxonomy(table, t, { tables }), /assigned twice/);
});

test('a parent and its "of which" lines cannot both be used', () => {
  const t = structuredClone(taxonomy);
  t.categories.find((c) => c.id === 'transport').children.push({ id: 'all', name: 'All transport', rows: ['4.5'] });
  assert.throws(() => mapToTaxonomy(table, t, { tables }), /counted twice, via/);
});

test('a new line in the source stops the pipeline', () => {
  const t = structuredClone(table);
  t.lines.splice(10, 0, { id: '1.8', label: '1.8 Something new', value: 5 });
  assert.throws(() => mapToTaxonomy(t, taxonomy, { tables }), /"1\.8 Something new" \(1\.8\) is not assigned/);
});

test('TES must equal the sum of the function totals', () => {
  const t = structuredClone(table);
  t.lines.find((l) => l.id === 'tes').value += 5;
  assert.throws(() => mapToTaxonomy(t, taxonomy, { tables }), /"tes" is 1227653 but its parts sum to 1227648/);
});

test('categories must sum to TES less exclusions within £1 million', () => {
  const t = structuredClone(taxonomy);
  t.categories.find((c) => c.id === 'economy').amount = { add: ['4/total'] }; // forgets to take out transport
  assert.throws(() => mapToTaxonomy(table, t, { tables }), /Categories sum to £1241167m but TES less exclusions is £1192243m/);
});

test('OSCAR: reads the zipped Windows-1252 CSV and counts outlays only', () => {
  assert.ok(oscar.length > 70000);
  // HS2: capital additions and running costs, not provisions
  assert.equal(programme({ organisation: '^High Speed 2$', subSegment: 'HSR HS2' }).amount, 7073);
  // Network Rail: £16.7bn of DEL in OSCAR, but £9.3bn of that is depreciation, which is left out
  assert.equal(programme({ organisation: '^Network Rail$' }).amount, 12150);
  // Nuclear Decommissioning Authority: provisions (£11.7bn taken up) are left out
  assert.equal(programme({ organisation: '^Nuclear Decommissioning Authority$' }).amount, 4279);
  // State Pension: the benefit payments themselves
  assert.equal(programme({ subSegment: 'STATE PENSION', department: 'Work and Pensions' }).amount, 145944);
  assert.equal(programme({ organisation: '^Hinkley Point C$' }).lines, 0); // privately financed: not in OSCAR
});

test('CSV parser handles quotes, commas and line endings', () => {
  assert.deepEqual(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\n'), [['a', 'b, c', 'd "e"'], ['1', '2', '3']]);
});

test('named programmes sit inside their lines and never exceed them', () => {
  const { categories, flags } = mapToTaxonomy(table, taxonomy, { tables, programme });
  assert.deepEqual(flags, []);
  const notable = (cid, id) => categories.find((c) => c.id === cid).children.find((c) => c.id === id).notable.map((n) => [n.name, n.amount]);
  assert.deepEqual(notable('transport', 'railways'), [['Network Rail', 12150], ['HS2', 7073], ['East West Rail', 192]]);
  assert.deepEqual(notable('economy', 'energy'), [['Sizewell C nuclear power station', 4786]]);
  for (const c of categories) for (const ch of c.children.filter((x) => x.notable)) {
    const named = (ch.notable || []).reduce((s, n) => s + n.amount, 0);
    assert.ok(named <= ch.amount * 1.02, `${ch.name}: named £${named}m within £${ch.amount}m`);
  }
});

test('a renamed programme is flagged and left out, not fatal', () => {
  const t = structuredClone(taxonomy);
  t.categories.find((c) => c.id === 'transport').children.find((c) => c.id === 'railways').notable.push({ id: 'x', name: 'Missing scheme', match: { organisation: '^No such body$' } });
  const { flags } = mapToTaxonomy(table, t, { tables, programme });
  assert.deepEqual(flags, ['Named programme "Missing scheme" not found in OSCAR; left out']);
});

test('without OSCAR data the file still builds, flagged, with no named programmes', () => {
  const doc = build({ ...files, oscar: undefined }, spec.meta, taxonomy, { generated: '2026-10-30T00:00:00.000Z' });
  assert.equal(doc.meta.programmes, null);
  assert.match(doc.meta.flags.at(-1), /OSCAR II data for 2025-26 not found/);
  assert.ok(doc.categories.every((c) => c.children.every((ch) => !ch.notable)));
});

test('flags categories that move more than 25% year on year, without failing', () => {
  const now = mapToTaxonomy(table, taxonomy, { tables });
  const prev = { categories: now.categories.map((c) => ({ ...c, amount: c.id === 'defence' ? 50000 : c.amount })) };
  assert.deepEqual(yearOnYearFlags(now, prev).map((f) => f.id), ['defence']);
});

test('builds a valid data/spending.json, and the committed file matches the fixtures', () => {
  const doc = build(files, spec.meta, taxonomy, { oscarMeta: spec.oscar, generated: '2026-10-30T00:00:00.000Z' });
  assert.deepEqual(validateSpending(doc), []);
  assert.equal(doc.meta.fiscalYear, '2025-26');
  assert.equal(doc.meta.base, BASE);
  const committed = JSON.parse(readFileSync(new URL('../data/spending.json', import.meta.url)));
  assert.deepEqual({ ...committed, meta: { ...committed.meta, generated: null } }, { ...doc, meta: { ...doc.meta, generated: null } });
});

test('schema check rejects a malformed file', () => {
  assert.ok(validateSpending({ meta: {}, categories: [] }).length > 5);
});

test('pull request table shows old, new, change and share of the pound', () => {
  const doc = build(files, spec.meta, taxonomy, { oscarMeta: spec.oscar });
  const prev = structuredClone(doc);
  prev.categories[0].amount -= 2500;
  assert.match(changeTable(prev, doc), /\| Social protection: welfare and pensions \| £348\.6bn \| £351\.1bn \| \+£2\.5bn \| 29\.5p \|/);
});

test('label normalisation', () => {
  assert.equal(normalise('1.7 Public debt transactions (2), (3)'), '1.7 public debt transactions');
  assert.equal(normalise('of which:Bank of England'), 'of which: bank of england');
  assert.equal(normalise('10.4  Family and children'), '10.4 family and children');
});
