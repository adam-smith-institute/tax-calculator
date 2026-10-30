// Weekly check for new HM Treasury fiscal events (Budget, Spring or Autumn Statement, or an
// Overview of Tax Legislation and Rates) published since the tax parameters' sources.
//
//   node scripts/check-fiscal-events.mjs            print what it finds
//   node scripts/check-fiscal-events.mjs --issue    also open a GitHub issue (needs GITHUB_TOKEN
//                                                   and GITHUB_REPOSITORY, as in Actions)
//
// It never changes rates. A person reviews the publication and follows RUNBOOK.md.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ISSUE_TITLE = 'New fiscal event: review tax parameters';
const SEARCH = 'https://www.gov.uk/api/search.json';
const PHRASES = ['budget', 'spring statement', 'autumn statement', 'overview of tax legislation and rates'];

// Titles of the core documents of a fiscal event, e.g. "Budget 2026 document",
// "Spring Statement 2027", "Budget 2026: Overview of tax legislation and rates (OOTLAR)"
const EVENT_TITLE = /^((spring |autumn )?budget \d{4}( document|: documents|:? ?.*overview of tax legislation)|(spring|autumn) statement \d{4}( document|: documents|:? ?.*overview of tax legislation)?|.*overview of tax legislation and rates)/i;

// The fiscal event a title belongs to ("Budget 2026"), so updates to a known event are ignored
export function eventName(title) {
  const m = title.match(/((spring |autumn )?budget|(spring|autumn) statement) (\d{4})/i);
  return m ? `${m[1]} ${m[4]}`.toLowerCase() : null;
}

export function currentSources(paramsDir) {
  const years = readdirSync(paramsDir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f));
  const events = years.map((f) => JSON.parse(readFileSync(new URL(f, paramsDir))).meta.fiscalEvent);
  const latest = events.map((e) => e.date).sort().at(-1);
  return { latest, known: new Set(events.map((e) => e.name.toLowerCase())) };
}

// Pure: pick new fiscal-event publications out of search results
export function newEvents(results, { latest, known }) {
  const seen = new Map();
  for (const r of results) {
    if (!EVENT_TITLE.test(r.title)) continue;
    const name = eventName(r.title);
    if (name && known.has(name)) continue;
    if ((r.public_timestamp || '').slice(0, 10) < latest) continue;
    seen.set(r.link, { title: r.title, url: `https://www.gov.uk${r.link}`, date: r.public_timestamp.slice(0, 10) });
  }
  return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date));
}

async function search(phrase, from) {
  const q = new URLSearchParams({
    q: phrase, filter_content_store_document_type: 'policy_paper', filter_public_timestamp: `from:${from}`,
    count: '50', fields: 'title,link,public_timestamp',
  });
  q.append('filter_organisations[]', 'hm-treasury');
  q.append('filter_organisations[]', 'hm-revenue-customs');
  const res = await fetch(`${SEARCH}?${q}`);
  if (!res.ok) throw new Error(`GOV.UK search failed: HTTP ${res.status}`);
  return (await res.json()).results;
}

async function github(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' },
  });
  if (!res.ok) throw new Error(`GitHub ${path}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const sources = currentSources(new URL('../params/', import.meta.url));
  const results = (await Promise.all(PHRASES.map((p) => search(p, sources.latest)))).flat();
  const found = newEvents(results, sources);
  console.log(`Parameters cite fiscal events up to ${sources.latest} (${[...sources.known].join(', ')}).`);
  if (!found.length) { console.log('No newer fiscal event publications.'); return; }
  console.log('New fiscal event publications:');
  for (const f of found) console.log(`  ${f.date}  ${f.title}  ${f.url}`);

  if (!process.argv.includes('--issue')) return;
  const open = await github(`/issues?state=open&per_page=100`);
  const body = [
    'GOV.UK has published fiscal event documents newer than the sources of the tax parameters:',
    '',
    ...found.map((f) => `- ${f.date}: [${f.title}](${f.url})`),
    '',
    'Review the rates and allowances and follow RUNBOOK.md, "Adding a tax year after a fiscal event".',
    'This check never changes rates itself.',
  ].join('\n');
  const existing = open.find((i) => i.title === ISSUE_TITLE && !i.pull_request);
  if (existing) {
    await github(`/issues/${existing.number}/comments`, { method: 'POST', body: JSON.stringify({ body: `Still outstanding.\n\n${body}` }) });
    console.log(`Commented on issue #${existing.number}`);
  } else {
    const issue = await github('/issues', { method: 'POST', body: JSON.stringify({ title: ISSUE_TITLE, body }) });
    console.log(`Opened issue #${issue.number}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
