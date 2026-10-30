// Parse PESA Table 5.2 and map it onto the ASI spending taxonomy. Pure functions: no I/O.

export const TABLE_TITLE = /^\s*Table 5\.2\b.*expenditure on services by sub-function/i;

export class PipelineError extends Error {}
const fail = (msg) => { throw new PipelineError(msg); };

// Lower-case, drop footnote markers like "(2), (3)", fix "of which:Bank", collapse spaces
export function normalise(label) {
  return String(label)
    .replace(/\(\d+\)(\s*,\s*\(\d+\))*/g, '')
    .replace(/of which:\s*/i, 'of which: ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const toNumber = (v) => {
  if (typeof v === 'number') return v;
  if (v === '-' || v === '–' || v === '..') return 0; // the table uses "-" for nil
  if (typeof v === 'string' && /^-?[\d,]+(\.\d+)?$/.test(v.trim())) return Number(v.replace(/,/g, ''));
  return null;
};

/**
 * Find Table 5.2 by its title text in a workbook from readWorkbook(). Returns the fiscal year
 * of the latest outturn column and the table's lines as [{ id, label, value }] in £ million.
 */
export function parseTable52(workbook) {
  let sheet = null;
  let titleRow = -1;
  for (const s of workbook) {
    const r = s.rows.findIndex((row) => row.some((c) => typeof c === 'string' && TABLE_TITLE.test(c)));
    if (r >= 0) { sheet = s; titleRow = r; break; }
  }
  if (!sheet) fail('Table 5.2 "Public sector expenditure on services by sub-function" not found in the workbook');
  const title = sheet.rows[titleRow].find((c) => typeof c === 'string' && TABLE_TITLE.test(c)).trim();

  // Header: a row of fiscal years, with "outturn" or "plans" in the row below
  const yearRe = /^\d{4}-\d{2}$/;
  const headerRow = sheet.rows.findIndex((row, i) => i > titleRow && row.filter((c) => typeof c === 'string' && yearRe.test(c.trim())).length >= 2);
  if (headerRow < 0) fail('Table 5.2: no row of fiscal-year column headings found');
  const kinds = sheet.rows[headerRow + 1] || [];
  let col = -1;
  sheet.rows[headerRow].forEach((c, j) => {
    if (typeof c === 'string' && yearRe.test(c.trim()) && /outturn/i.test(String(kinds[j] || ''))) col = j;
  });
  if (col < 0) fail('Table 5.2: no outturn column found');
  const fiscalYear = sheet.rows[headerRow][col].trim();

  const lines = [];
  let fn = null; // current function ("1".."10" or "eu")
  let sub = null; // current numbered sub-function ("10.2")
  const ids = new Set();
  const push = (id, label, value) => {
    if (ids.has(id)) fail(`Table 5.2: line id "${id}" appears twice`);
    ids.add(id);
    lines.push({ id, label, value });
  };

  for (let i = headerRow + 2; i < sheet.rows.length; i++) {
    const row = sheet.rows[i];
    const labelCell = row.slice(0, col).find((c) => typeof c === 'string' && c.trim());
    if (!labelCell) continue;
    const label = labelCell.trim();
    const n = normalise(label);
    const value = toNumber(row[col]);

    if (n === 'public sector expenditure on services') { push('tes', label, value); continue; }
    if (n === 'accounting adjustments') { push('adjustments', label, value); continue; }
    if (n.startsWith('total managed expenditure')) { push('tme', label, value); break; }

    let m;
    if ((m = n.match(/^(\d+)\. /)) && value === null) { fn = m[1]; sub = null; continue; }
    if (n.startsWith('eu transactions') && value === null) { fn = 'eu'; sub = null; continue; }
    if (n === 'derived as:') continue; // EU breakdown heading; the taxonomy says which lines it covers
    if (value === null) fail(`Table 5.2: no ${fiscalYear} value on line "${label}"`);
    if (!fn) fail(`Table 5.2: line "${label}" comes before any function heading`);

    if (n === 'total eu transactions') { push('eu/total', label, value); sub = null; continue; }
    if (n.startsWith('total ')) { push(`${fn}/total`, label, value); sub = null; continue; }
    if ((m = n.match(/^(\d+\.\d+) /))) { sub = m[1]; push(sub, label, value); continue; }
    if (n.startsWith('of which: ')) { push(`${sub || fn}/${n}`, label, value); continue; }
    push(`${fn}/${n}`, label, value);
  }
  for (const id of ['tes', 'adjustments', 'tme']) if (!ids.has(id)) fail(`Table 5.2: "${id}" line not found`);
  return { title, fiscalYear, lines };
}

/**
 * Read the lines of another PESA table, found by its title, for one fiscal year's outturn
 * column. Returns a Map of normalised label -> £ million, with lines of the same label summed
 * (Table 1.1 lists "BBC domestic services" under both resource and capital budgets). Section
 * headings with no figures ("Public corporations' capital expenditure on services") prefix
 * the labels below them: "capital/6. housing and community amenities".
 */
export function parseLinesByTitle(workbook, titleRe, fiscalYear) {
  const sheet = workbook.find((s) => s.rows.slice(0, 6).some((r) => r.some((c) => typeof c === 'string' && titleRe.test(c.replace(/\s+/g, ' ')))));
  if (!sheet) fail(`PESA table matching ${titleRe} not found`);
  const title = sheet.rows.slice(0, 6).flat().find((c) => typeof c === 'string' && titleRe.test(c.replace(/\s+/g, ' '))).replace(/\s+/g, ' ').trim();
  const headerRow = sheet.rows.findIndex((row) => row.some((c) => typeof c === 'string' && c.trim() === fiscalYear));
  if (headerRow < 0) fail(`${title}: no ${fiscalYear} column`);
  const col = sheet.rows[headerRow].findIndex((c) => typeof c === 'string' && c.trim() === fiscalYear);
  if (!/outturn/i.test(String(sheet.rows[headerRow + 1]?.[col] || ''))) fail(`${title}: ${fiscalYear} is not outturn`);
  const lines = new Map();
  let section = '';
  for (const row of sheet.rows.slice(headerRow + 2)) {
    const label = row.slice(0, col).find((c) => typeof c === 'string' && c.trim());
    if (!label) continue;
    const n = normalise(label);
    const value = toNumber(row[col]);
    if (value === null) {
      const m = n.match(/^public corporations['\u2019]? (current|capital) expenditure on services$/);
      if (m) section = `${m[1]}/`;
      continue;
    }
    const key = section + n;
    lines.set(key, (lines.get(key) || 0) + value);
  }
  lines.title = title;
  return lines;
}

/**
 * Map parsed lines onto the taxonomy and validate. Throws PipelineError if any rule fails, so
 * nothing is written. Options: `tables` (other PESA tables the exclusions read, from
 * parseLinesByTitle) and `programme` (a function giving a named programme's £m from OSCAR).
 */
export function mapToTaxonomy(table, taxonomy, { tables = {}, programme = null } = {}) {
  const value = new Map(table.lines.map((l) => [l.id, l.value]));
  const errors = [];
  const flags = [];
  const get = (id) => {
    if (!value.has(id)) { errors.push(`Taxonomy refers to "${id}", which is not in Table 5.2`); return 0; }
    return value.get(id);
  };

  // Aggregates must match their parts (source rounding: within £2 million)
  const parents = new Map(); // part -> [aggregates it belongs to]
  for (const [agg, parts] of Object.entries(taxonomy.aggregates)) {
    const sum = parts.reduce((s, p) => s + get(p), 0);
    const diff = get(agg) - sum;
    if (Math.abs(diff) > 2) errors.push(`"${agg}" is ${get(agg)} but its parts sum to ${sum}`);
    for (const p of parts) parents.set(p, [...(parents.get(p) || []), agg]);
  }
  const ancestors = (id, seen = new Set()) => {
    for (const a of parents.get(id) || []) if (!seen.has(a)) { seen.add(a); ancestors(a, seen); }
    return seen;
  };

  // Every line is assigned exactly once: to a category, or excluded as a whole line
  const assigned = new Map();
  const assign = (r, where) => {
    if (assigned.has(r)) errors.push(`"${r}" is assigned twice (${assigned.get(r)} and ${where})`);
    assigned.set(r, where);
  };
  for (const c of taxonomy.categories) for (const ch of c.children) for (const r of ch.rows) assign(r, `${c.id}/${ch.id}`);
  for (const ex of taxonomy.exclusions || []) if (!ex.amount.table) for (const r of ex.amount.rows) assign(r, `excluded: ${ex.id}`);
  const special = new Set(['tes', 'adjustments', 'tme']);
  const isAggregate = (id) => id in taxonomy.aggregates;
  for (const { id, label } of table.lines) {
    if (special.has(id) || isAggregate(id)) continue;
    const hits = [id, ...ancestors(id)].filter((x) => assigned.has(x));
    if (hits.length === 0) errors.push(`Line "${label}" (${id}) is not assigned to any category`);
    if (hits.length > 1) errors.push(`Line "${label}" (${id}) is counted twice, via ${hits.join(' and ')}`);
  }
  for (const id of assigned.keys()) if (!value.has(id)) errors.push(`Taxonomy assigns "${id}", which is not in Table 5.2`);
  if (errors.length) throw new PipelineError(`Taxonomy validation failed:\n- ${errors.join('\n- ')}`);

  // Spending in TES not paid for by the taxes the calculator models
  const exclusions = (taxonomy.exclusions || []).map((ex) => {
    let amount = 0;
    if (!ex.amount.table) amount = ex.amount.rows.reduce((s, r) => s + get(r), 0);
    else {
      const t = tables[ex.amount.table];
      if (!t) errors.push(`Exclusion "${ex.name}" needs PESA table "${ex.amount.table}", which was not loaded`);
      else for (const r of ex.amount.rows) {
        if (!t.has(r)) errors.push(`Exclusion "${ex.name}": line "${r}" not found in ${t.title}`);
        else amount += t.get(r);
      }
    }
    return { id: ex.id, name: ex.name, reason: ex.reason, amount, ...(ex.from ? { from: ex.from } : {}) };
  });
  const takenFrom = new Map();
  for (const ex of exclusions) if (ex.from) takenFrom.set(ex.from, (takenFrom.get(ex.from) || 0) + ex.amount);

  const tes = get('tes');
  const categories = taxonomy.categories.map((c) => {
    let taken = 0;
    const children = c.children.map((ch) => {
      const gross = ch.rows.reduce((s, r) => s + get(r), 0);
      const less = takenFrom.get(`${c.id}/${ch.id}`) || 0;
      if (less > 0 && less > gross) errors.push(`${c.name} / ${ch.name}: excluding £${less}m from a line of £${gross}m`);
      taken += less;
      const out = { id: ch.id, name: ch.name, ...(ch.description ? { description: ch.description } : {}), amount: gross - less };
      if (programme && ch.notable) {
        const items = [];
        for (const n of ch.notable) {
          const { amount, lines } = programme(n.match);
          if (!lines) { flags.push(`Named programme "${n.name}" not found in OSCAR; left out`); continue; }
          if (amount > out.amount * 1.05) flags.push(`"${n.name}" (£${amount}m in OSCAR) is larger than its line, ${ch.name} (£${out.amount}m)`);
          if (amount > 0) items.push({ id: n.id, name: n.name, amount, ...(n.note ? { note: n.note } : {}) });
        }
        const named = items.reduce((t, n) => t + n.amount, 0);
        if (named > out.amount * 1.02) flags.push(`Named programmes under ${ch.name} add up to £${named}m, more than the line (£${out.amount}m)`);
        if (items.length) out.notable = items.sort((a, b) => b.amount - a.amount);
      }
      return out;
    });
    const childSum = children.reduce((s, ch) => s + ch.amount, 0);
    const amount = c.amount
      ? (c.amount.add || []).reduce((s, r) => s + get(r), 0) - (c.amount.subtract || []).reduce((s, r) => s + get(r), 0) - taken
      : childSum;
    if (Math.abs(amount - childSum) > 2) errors.push(`${c.name}: published total ${amount} but its lines sum to ${childSum}`);
    return { id: c.id, name: c.name, ...(c.colour ? { colour: c.colour } : {}), description: c.description, amount, children };
  });
  const excluded = exclusions.reduce((s, e) => s + e.amount, 0);
  const base = tes - excluded;
  const sum = categories.reduce((s, c) => s + c.amount, 0);
  if (Math.abs(sum - base) > 1) errors.push(`Categories sum to £${sum}m but TES less exclusions is £${base}m`);
  if (errors.length) throw new PipelineError(`Validation failed:\n- ${errors.join('\n- ')}`);

  categories.sort((a, b) => b.amount - a.amount);
  for (const c of categories) {
    c.share = c.amount / base;
    c.children.sort((a, b) => b.amount - a.amount);
  }
  return {
    categories,
    exclusions,
    totals: { tes, accountingAdjustments: get('adjustments'), tme: get('tme'), excluded, base, categoriesSum: sum },
    flags,
  };
}

// Categories that moved more than 25% from the previous year (flagged, never fatal)
export function yearOnYearFlags(current, previous, threshold = 0.25) {
  if (!previous) return [];
  const prev = new Map(previous.categories.map((c) => [c.id, c.amount]));
  return current.categories
    .filter((c) => prev.has(c.id) && prev.get(c.id) !== 0 && Math.abs(c.amount / prev.get(c.id) - 1) > threshold)
    .map((c) => ({ id: c.id, name: c.name, previous: prev.get(c.id), current: c.amount, change: c.amount / prev.get(c.id) - 1 }));
}

// Light schema check of data/spending.json (see data/spending.schema.json)
export function validateSpending(doc) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  const m = doc?.meta;
  need(m && typeof m === 'object', 'meta missing');
  if (m) {
    for (const k of ['title', 'url', 'publisher', 'published', 'table', 'fiscalYear', 'basis', 'generated', 'taxonomyVersion']) need(typeof m[k] === 'string' && m[k], `meta.${k} must be a non-empty string`);
    for (const k of ['tes', 'accountingAdjustments', 'tme', 'excluded', 'base']) need(Number.isFinite(m[k]), `meta.${k} must be a number`);
    need(Array.isArray(m.exclusions), 'meta.exclusions must be an array');
    for (const e of m.exclusions || []) need(typeof e.name === 'string' && Number.isFinite(e.amount) && typeof e.reason === 'string', 'each exclusion needs name, amount and reason');
    need(/^TES\b/.test(m.basis || ''), 'meta.basis must start "TES"');
    need(/^\d{4}-\d{2}$/.test(m.fiscalYear || ''), 'meta.fiscalYear must look like 2025-26');
    need(/^\d{4}-\d{2}-\d{2}$/.test(m.published || ''), 'meta.published must be a date');
  }
  need(Array.isArray(doc?.categories) && doc.categories.length > 0, 'categories must be a non-empty array');
  for (const c of doc?.categories || []) {
    for (const k of ['id', 'name', 'description']) need(typeof c[k] === 'string' && c[k], `category.${k} must be a non-empty string`);
    need(Number.isFinite(c.amount), `${c.id}: amount must be a number`);
    need(c.colour === undefined || /^#[0-9A-Fa-f]{6}$/.test(c.colour), `${c.id}: colour must be a hex colour like #E4572E`);
    need(Array.isArray(c.children) && c.children.length > 0, `${c.id}: children must be a non-empty array`);
    for (const ch of c.children || []) {
      need(typeof ch.id === 'string' && typeof ch.name === 'string', `${c.id}: child id and name must be strings`);
      need(Number.isFinite(ch.amount), `${c.id}/${ch.id}: amount must be a number`);
      for (const n of ch.notable || []) need(typeof n.name === 'string' && Number.isFinite(n.amount), `${c.id}/${ch.id}: each named programme needs name and amount`);
    }
  }
  return errors;
}
