// Builds data/spending.json from HM Treasury's PESA and OSCAR II.
//
//   node pipeline/build-spending.mjs                       discover the latest data on GOV.UK
//   node pipeline/build-spending.mjs --local <sources.json> use saved files (see tests/fixtures)
//   options: --summary <file>   write a Markdown change table (the pull request description)
//            --check            validate only; never write
//
// Sources, all found by title rather than file name or position:
// - PESA (or, failing that, the July Public Spending Statistics release): Table 5.2 for the
//   spending by function, Table 1.1 for BBC domestic services and Table 8.4 for public
//   corporations, which the taxonomy's exclusions remove.
// - OSCAR II's June in-year release for the same financial year (its final quarter), for the
//   named programmes. If that release is missing, the programmes are left out and flagged.
// All validation must pass before anything is written. Exit code 0 with "No change" when the
// data is unchanged.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWorkbook } from './xlsx.mjs';
import { parseTable52, parseLinesByTitle, mapToTaxonomy, yearOnYearFlags, validateSpending, PipelineError } from './pesa.mjs';
import { readOscar, programmeAmount } from './oscar.mjs';

const ROOT = new URL('../', import.meta.url);
const path = (p) => fileURLToPath(new URL(p, ROOT));
const CONTENT_API = 'https://www.gov.uk/api/content';

// Workbooks needed from a PESA-type release, by attachment title
const SOURCES = [
  { collection: '/government/collections/public-expenditure-statistical-analyses-pesa', document: /^Public Expenditure Statistical Analyses (\d{4})$/i,
    attachments: { ch5: /chapter 5 tables/i, ch1: /chapter 1 tables/i, ch8: /chapter 8 tables/i } },
  { collection: '/government/collections/national-statistics-release', document: /^Public Spending Statistics release: July (\d{4})$/i,
    attachments: { ch5: /^public sector spending$/i, ch1: /^departmental budgets$/i, ch8: /^public corporations.? spending$/i } },
];
const TABLES = {
  tme: /^Table 1\.1 Total Managed Expenditure,/,
  publicCorporations: /^Table 8\.4 Public corporations.? current and capital expenditure on services by function/,
};

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new PipelineError(`GET ${url}: HTTP ${res.status}`);
  return res.json();
}
async function getBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new PipelineError(`GET ${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// The newest edition's workbooks. Returns { files: { ch5, ch1, ch8 }, meta }.
async function discoverPesa() {
  const problems = [];
  for (const src of SOURCES) {
    try {
      const coll = await getJson(CONTENT_API + src.collection);
      const docs = (coll.links?.documents || [])
        .map((d) => ({ ...d, year: Number((d.title.match(src.document) || [])[1]) }))
        .filter((d) => d.year)
        .sort((a, b) => b.year - a.year);
      if (!docs.length) throw new PipelineError(`no edition found in ${src.collection}`);
      const doc = await getJson(CONTENT_API + docs[0].base_path);
      const sheets = (doc.details?.attachments || []).filter((a) => /spreadsheetml|\.xlsx$/i.test(`${a.content_type} ${a.url}`));
      const files = {};
      let ch5 = null;
      for (const [key, re] of Object.entries(src.attachments)) {
        const a = sheets.find((x) => re.test(x.title || ''));
        if (!a) throw new PipelineError(`"${doc.title}" has no attachment titled like ${re}`);
        files[key] = await getBuffer(a.url);
        if (key === 'ch5') ch5 = a;
      }
      parseTable52(readWorkbook(files.ch5)); // confirm it holds the table before choosing it
      return {
        files,
        meta: {
          title: doc.title,
          url: `https://www.gov.uk${doc.base_path}`,
          publisher: 'HM Treasury',
          published: (doc.first_published_at || doc.public_updated_at).slice(0, 10),
          file: ch5.url,
          fileTitle: ch5.title,
        },
      };
    } catch (e) {
      problems.push(`${src.collection}: ${e.message}`);
    }
  }
  throw new PipelineError(`Could not find the PESA tables:\n- ${problems.join('\n- ')}`);
}

// OSCAR II's June release for a fiscal year ("2025-26" -> June 2026), or null if not found
async function discoverOscar(fiscalYear) {
  const endYear = 2000 + Number(fiscalYear.slice(-2));
  const base = `/government/publications/oscar-ii-publishing-data-from-the-database-june-${endYear}`;
  try {
    const doc = await getJson(CONTENT_API + base);
    if (!new RegExp(`final quarterly data for the financial year ${fiscalYear}`, 'i').test(doc.details?.body || '')) return null;
    const files = doc.details?.attachments || [];
    const a = files.find((x) => /\.zip$/i.test(x.url || '')) || files.find((x) => /\.csv$/i.test(x.url || ''));
    if (!a) return null;
    return {
      buffer: await getBuffer(a.url),
      meta: { title: doc.title, url: `https://www.gov.uk${base}`, published: (doc.first_published_at || '').slice(0, 10), file: a.url },
    };
  } catch {
    return null;
  }
}

const bn = (m) => (m / 1000).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function changeTable(previous, next) {
  const prev = new Map((previous?.categories || []).map((c) => [c.id, c]));
  const rows = next.categories.map((c) => {
    const p = prev.get(c.id);
    const change = p ? `${c.amount - p.amount >= 0 ? '+' : '−'}£${bn(Math.abs(c.amount - p.amount))}bn` : 'new';
    return `| ${c.name} | ${p ? `£${bn(p.amount)}bn` : '–'} | £${bn(c.amount)}bn | ${change} | ${(c.share * 100).toFixed(1)}p |`;
  });
  return ['| Category | Old | New | Change | Share of the pound |', '|---|---|---|---|---|', ...rows].join('\n');
}

/**
 * Build the data file. `files` holds the workbooks (ch5, ch1, ch8) and optionally the OSCAR
 * dataset (oscar); `oscarMeta` describes the OSCAR release.
 */
export function build(files, sourceMeta, taxonomy, { previousYear, oscarMeta, generated = new Date().toISOString() } = {}) {
  const table = parseTable52(readWorkbook(files.ch5));
  const tables = {
    tme: parseLinesByTitle(readWorkbook(files.ch1), TABLES.tme, table.fiscalYear),
    publicCorporations: parseLinesByTitle(readWorkbook(files.ch8), TABLES.publicCorporations, table.fiscalYear),
  };
  const oscarRows = files.oscar ? readOscar(files.oscar) : null;
  const programme = oscarRows ? (match) => programmeAmount(oscarRows, match, table.fiscalYear) : null;
  const mapped = mapToTaxonomy(table, taxonomy, { tables, programme });
  const doc = {
    meta: {
      ...sourceMeta,
      table: table.title,
      fiscalYear: table.fiscalYear,
      basis: 'TES less spending not funded by the taxes modelled',
      units: '£ million',
      tes: mapped.totals.tes,
      excluded: mapped.totals.excluded,
      base: mapped.totals.base,
      exclusions: mapped.exclusions,
      accountingAdjustments: mapped.totals.accountingAdjustments,
      tme: mapped.totals.tme,
      programmes: oscarRows && oscarMeta
        ? { ...oscarMeta, fiscalYear: table.fiscalYear, note: 'Outlays recorded in HM Treasury\'s OSCAR II database (provisional), excluding depreciation, provisions, loans and income.' }
        : null,
      generated,
      taxonomyVersion: taxonomy.version,
    },
    categories: mapped.categories,
  };
  const flags = [
    ...yearOnYearFlags(doc, previousYear).map((f) => `${f.name} moved ${(f.change * 100).toFixed(0)}% from ${previousYear.meta.fiscalYear}`),
    ...mapped.flags,
    ...(oscarRows ? [] : [`OSCAR II data for ${table.fiscalYear} not found; named programmes left out`]),
  ];
  if (flags.length) doc.meta.flags = flags;
  const errors = validateSpending(doc);
  if (errors.length) throw new PipelineError(`Schema check failed:\n- ${errors.join('\n- ')}`);
  return doc;
}

// The figures and labels, without generation time, to decide whether anything changed
const substance = (d) => d && JSON.stringify({ ...d, meta: { ...d.meta, generated: null } });

// Saved sources: a JSON file naming the files (relative to it) and their metadata
function loadLocal(file) {
  const spec = JSON.parse(readFileSync(file));
  const dir = dirname(resolve(file));
  const files = Object.fromEntries(Object.entries(spec.files).map(([k, f]) => [k, readFileSync(resolve(dir, f))]));
  return { files, meta: spec.meta, oscarMeta: spec.oscar };
}

async function main() {
  const taxonomy = JSON.parse(readFileSync(path('src/spending/taxonomy.json')));
  let files, meta, oscarMeta;
  if (arg('--local')) ({ files, meta, oscarMeta } = loadLocal(arg('--local')));
  else {
    ({ files, meta } = await discoverPesa());
    const fiscalYear = parseTable52(readWorkbook(files.ch5)).fiscalYear;
    const oscar = await discoverOscar(fiscalYear);
    if (oscar) { files.oscar = oscar.buffer; oscarMeta = oscar.meta; }
  }

  const currentFile = path('data/spending.json');
  const current = existsSync(currentFile) ? JSON.parse(readFileSync(currentFile)) : null;
  // Previous fiscal year from history, for the 25% flag
  const probe = parseTable52(readWorkbook(files.ch5)).fiscalYear;
  const [y] = probe.split('-').map(Number);
  const prevYearId = `${y - 1}-${String(y % 100).padStart(2, '0')}`;
  const prevFile = path(`data/history/${prevYearId}.json`);
  const previousYear = existsSync(prevFile) ? JSON.parse(readFileSync(prevFile)) : null;

  const doc = build(files, meta, taxonomy, { previousYear, oscarMeta });
  console.log(`${doc.meta.title}, ${doc.meta.table}: ${doc.meta.fiscalYear} outturn, TES £${doc.meta.tes}m, less £${doc.meta.excluded}m excluded = £${doc.meta.base}m`);
  for (const f of doc.meta.flags || []) console.log(`  FLAG: ${f}`);

  if (substance(doc) === substance(current)) { console.log('No change.'); return; }
  if (arg('--summary')) {
    const lines = [
      `Spending data updated from [${doc.meta.title}](${doc.meta.url}), ${doc.meta.table} (${doc.meta.fiscalYear} outturn).`,
      '',
      changeTable(current, doc),
      '',
      `Total expenditure on services: £${bn(doc.meta.tes)}bn${current ? ` (was £${bn(current.meta.tes)}bn)` : ''}, less £${bn(doc.meta.excluded)}bn not funded by the taxes modelled, gives £${bn(doc.meta.base)}bn. Accounting adjustments: £${bn(doc.meta.accountingAdjustments)}bn. TME: £${bn(doc.meta.tme)}bn.`,
      '',
      '**Excluded:**',
      ...doc.meta.exclusions.map((e) => `- ${e.name}: £${bn(e.amount)}bn`),
      '',
      doc.meta.programmes ? `Named programmes from [${doc.meta.programmes.title}](${doc.meta.programmes.url}).` : 'Named programmes: OSCAR II data not found for this year, so none are shown.',
      ...(doc.meta.flags?.length ? ['', '**Flagged for review:**', ...doc.meta.flags.map((f) => `- ${f}`)] : []),
      '',
      'Built by `pipeline/build-spending.mjs`; every validation passed. Review against the source, then merge by hand (RUNBOOK.md, "Reviewing a spending pull request").',
    ];
    writeFileSync(arg('--summary'), lines.join('\n') + '\n');
  }
  if (process.argv.includes('--check')) { console.log('Changed (not written: --check).'); return; }

  const json = JSON.stringify(doc, null, 2) + '\n';
  mkdirSync(path('data/history'), { recursive: true });
  writeFileSync(currentFile, json);
  writeFileSync(path(`data/history/${doc.meta.fiscalYear}.json`), json);
  writeFileSync(path('src/spending/fallback.js'),
    `// Bundled snapshot of data/spending.json, used if the live file cannot be loaded.\n// Written by pipeline/build-spending.mjs; do not edit by hand.\nexport default ${json.trim()};\n`);
  console.log('Wrote data/spending.json, data/history and src/spending/fallback.js');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof PipelineError ? `PIPELINE FAILED: ${e.message}` : e);
    process.exit(1);
  });
}
