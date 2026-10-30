// Named programmes (HS2, Sizewell C, Universal Credit...) from HM Treasury's OSCAR II
// database. PESA does not name projects, so these come from OSCAR's in-year dataset for the
// same financial year: the June release carries the final quarter's data.
//
// OSCAR records every budget entry, including non-cash items. A programme's figure here is
// its outlays only: pay, goods and services, capital investment, grants, benefits and
// subsidies. Depreciation, provisions, loans, pension-scheme accounting and income are left
// out, so the figure is comparable with the spending in PESA. Amounts in OSCAR are £ thousands.

import { unzip } from './xlsx.mjs';
import { PipelineError } from './pesa.mjs';

export const OUTLAY_GROUPS = new Set([
  'STAFF COSTS',
  'PURCHASE OF GOODS AND SERVICES',
  'PURCHASE OF ASSETS',
  'CURRENT GRANTS TO PERSONS AND NON-PROFIT (NET)',
  'CURRENT GRANTS TO LOCAL GOVERNMENT (NET)',
  'CURRENT GRANTS ABROAD (NET)',
  'CAPITAL GRANTS TO PRIVATE SECTOR COMPANIES (NET)',
  'CAPITAL GRANTS TO PERSONS & NON-PROFIT (NET)',
  'CAPITAL SUPPORT FOR LOCAL GOVERNMENT (NET)',
  'CAPITAL GRANTS ABROAD (NET)',
  'SUBSIDIES TO PRIVATE SECTOR COMPANIES',
  'SUBSIDIES TO PUBLIC CORPORATIONS',
  'CAPITAL SUPPORT FOR PUBLIC CORPORATIONS',
]);

// RFC 4180 CSV: quoted fields may contain commas, quotes ("") and newlines
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const REQUIRED = ['Organisation', 'Segment Department Long Name', 'Sub Segment Long Name', 'Control Budget Code', 'PESA Economic Group Code', 'Year', 'Amount'];

// Read the dataset (a .zip holding one .csv, or the .csv itself; Windows-1252 text)
export function readOscar(buf) {
  let bytes = buf;
  if (buf.readUInt32LE(0) === 0x04034b50) {
    const files = unzip(buf);
    const csv = [...files.keys()].find((n) => /\.csv$/i.test(n));
    if (!csv) throw new PipelineError('OSCAR zip holds no .csv file');
    bytes = files.get(csv)(true);
  }
  const text = new TextDecoder('windows-1252').decode(bytes);
  const [head, ...body] = parseCsv(text);
  const col = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  const missing = REQUIRED.filter((c) => !(c in col));
  if (missing.length) throw new PipelineError(`OSCAR dataset is missing columns: ${missing.join(', ')}`);
  return body.map((r) => Object.fromEntries(REQUIRED.map((c) => [c, r[col[c]] ?? ''])));
}

/**
 * £ million of outlays for one programme. `match` gives regular expressions (case-insensitive):
 * organisation and/or subSegment (a row matches if either does) and an optional department.
 */
export function programmeAmount(rows, match, fiscalYear) {
  const org = match.organisation && new RegExp(match.organisation, 'i');
  const seg = match.subSegment && new RegExp(match.subSegment, 'i');
  const dept = match.department && new RegExp(match.department, 'i');
  let thousands = 0;
  let lines = 0;
  for (const r of rows) {
    if (r.Year !== fiscalYear) continue;
    if (/NON-BUDGET/.test(r['Control Budget Code'])) continue;
    if (!OUTLAY_GROUPS.has(r['PESA Economic Group Code'])) continue;
    if (dept && !dept.test(r['Segment Department Long Name'])) continue;
    if (!((org && org.test(r.Organisation)) || (seg && seg.test(r['Sub Segment Long Name'])))) continue;
    thousands += Number(r.Amount) || 0;
    lines++;
  }
  return { amount: Math.round(thousands / 1000), lines };
}
