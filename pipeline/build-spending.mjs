// Builds data/spending.json from HM Treasury's PESA Table 5.2.
//
//   node pipeline/build-spending.mjs                     discover the latest edition on GOV.UK
//   node pipeline/build-spending.mjs --file <xlsx> --meta <json>   use a local workbook
//   options: --summary <file>   write a Markdown change table (the pull request description)
//            --check            validate only; never write
//
// Discovery: the newest edition in the PESA collection, then its Chapter 5 tables workbook,
// chosen by attachment title. Falls back to the July Public Spending Statistics release,
// which carries the same table. Table 5.2 is found by its title text. All validation must
// pass before anything is written. Exit code 0 with "No change" when the data is unchanged.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readWorkbook } from './xlsx.mjs';
import { parseTable52, mapToTaxonomy, yearOnYearFlags, validateSpending, PipelineError } from './pesa.mjs';

const ROOT = new URL('../', import.meta.url);
const path = (p) => fileURLToPath(new URL(p, ROOT));
const CONTENT_API = 'https://www.gov.uk/api/content';
const SOURCES = [
  { collection: '/government/collections/public-expenditure-statistical-analyses-pesa', document: /^Public Expenditure Statistical Analyses (\d{4})$/i, attachment: /chapter 5 tables/i },
  { collection: '/government/collections/national-statistics-release', document: /^Public Spending Statistics release: July (\d{4})$/i, attachment: /^public sector spending$/i },
];

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new PipelineError(`GET ${url}: HTTP ${res.status}`);
  return res.json();
}

// Find the newest edition's Table 5.2 workbook. Returns { meta, buffer }.
async function discover() {
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
      const files = (doc.details?.attachments || []).filter((a) => /spreadsheetml|\.xlsx$/i.test(`${a.content_type} ${a.url}`));
      const picks = files.filter((a) => src.attachment.test(a.title || ''));
      if (!picks.length) throw new PipelineError(`"${doc.title}" has no attachment titled like ${src.attachment}`);
      for (const a of picks) {
        const res = await fetch(a.url);
        if (!res.ok) throw new PipelineError(`GET ${a.url}: HTTP ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        try {
          parseTable52(readWorkbook(buffer)); // confirm it holds the table before choosing it
        } catch (e) { problems.push(`${a.title}: ${e.message}`); continue; }
        return {
          buffer,
          meta: {
            title: doc.title,
            url: `https://www.gov.uk${doc.base_path}`,
            publisher: 'HM Treasury',
            published: (doc.first_published_at || doc.public_updated_at).slice(0, 10),
            file: a.url,
            fileTitle: a.title,
          },
        };
      }
    } catch (e) {
      problems.push(`${src.collection}: ${e.message}`);
    }
  }
  throw new PipelineError(`Could not find PESA Table 5.2:\n- ${problems.join('\n- ')}`);
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

export function build(buffer, sourceMeta, taxonomy, { previousYear, generated = new Date().toISOString() } = {}) {
  const table = parseTable52(readWorkbook(buffer));
  const mapped = mapToTaxonomy(table, taxonomy);
  const doc = {
    meta: {
      ...sourceMeta,
      table: table.title,
      fiscalYear: table.fiscalYear,
      basis: 'TES',
      units: '£ million',
      tes: mapped.totals.tes,
      accountingAdjustments: mapped.totals.accountingAdjustments,
      tme: mapped.totals.tme,
      generated,
      taxonomyVersion: taxonomy.version,
    },
    categories: mapped.categories,
  };
  const flags = yearOnYearFlags(doc, previousYear);
  if (flags.length) doc.meta.flags = flags.map((f) => `${f.name} moved ${(f.change * 100).toFixed(0)}% from ${previousYear.meta.fiscalYear}`);
  const errors = validateSpending(doc);
  if (errors.length) throw new PipelineError(`Schema check failed:\n- ${errors.join('\n- ')}`);
  return doc;
}

// The figures and labels, without generation time, to decide whether anything changed
const substance = (d) => d && JSON.stringify({ ...d, meta: { ...d.meta, generated: null } });

async function main() {
  const taxonomy = JSON.parse(readFileSync(path('src/spending/taxonomy.json')));
  const { buffer, meta } = arg('--file')
    ? { buffer: readFileSync(arg('--file')), meta: JSON.parse(readFileSync(arg('--meta'))) }
    : await discover();

  const currentFile = path('data/spending.json');
  const current = existsSync(currentFile) ? JSON.parse(readFileSync(currentFile)) : null;
  // Previous fiscal year from history, for the 25% flag
  const probe = parseTable52(readWorkbook(buffer)).fiscalYear;
  const [y] = probe.split('-').map(Number);
  const prevYearId = `${y - 1}-${String(y % 100).padStart(2, '0')}`;
  const prevFile = path(`data/history/${prevYearId}.json`);
  const previousYear = existsSync(prevFile) ? JSON.parse(readFileSync(prevFile)) : null;

  const doc = build(buffer, meta, taxonomy, { previousYear });
  console.log(`${doc.meta.title}, ${doc.meta.table}: ${doc.meta.fiscalYear} outturn, TES £${doc.meta.tes}m`);
  for (const f of doc.meta.flags || []) console.log(`  FLAG: ${f}`);

  if (substance(doc) === substance(current)) { console.log('No change.'); return; }
  if (arg('--summary')) {
    const lines = [
      `Spending data updated from [${doc.meta.title}](${doc.meta.url}), ${doc.meta.table} (${doc.meta.fiscalYear} outturn).`,
      '',
      changeTable(current, doc),
      '',
      `Total expenditure on services: £${bn(doc.meta.tes)}bn${current ? ` (was £${bn(current.meta.tes)}bn)` : ''}. Accounting adjustments: £${bn(doc.meta.accountingAdjustments)}bn. TME: £${bn(doc.meta.tme)}bn.`,
      ...(doc.meta.flags?.length ? ['', '**Flagged for review (moved more than 25% year on year):**', ...doc.meta.flags.map((f) => `- ${f}`)] : []),
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
