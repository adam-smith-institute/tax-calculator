// Minimal, dependency-free .xlsx reader: enough to read cell values (numbers and text) from
// every sheet of a workbook. An .xlsx file is a zip of XML parts; this reads the zip central
// directory, inflates the parts it needs with node:zlib, and pulls cells out of the sheet XML.
// Formulas are read as their cached values. Styles, dates and merged cells are ignored.

import { inflateRawSync } from 'node:zlib';

function unzip(buf) {
  // End of central directory record: signature 0x06054b50, within the last 64 KB
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file (no end of central directory)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataStart, dataStart + compressed);
    files.set(name, () => (method === 0 ? raw : inflateRawSync(raw)).toString('utf8'));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, '&');

// Text of a string item: concatenate every <t> run (rich text has several)
const textOf = (xml) => decode([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

function colIndex(ref) {
  let n = 0;
  for (const ch of ref.match(/^[A-Z]+/)[0]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Read a workbook. Returns [{ name, rows }] in workbook order, where rows is an array of
 * arrays of cell values (number, string or null), indexed from row 1 / column A at [0][0].
 */
export function readWorkbook(buf) {
  const files = unzip(buf);
  const get = (name) => {
    const f = files.get(name);
    if (!f) throw new Error(`Workbook part missing: ${name}`);
    return f();
  };
  const shared = files.has('xl/sharedStrings.xml')
    ? [...get('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : [];
  const rels = new Map([...get('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].map((m) => {
    const id = m[0].match(/Id="([^"]+)"/)[1];
    const target = m[0].match(/Target="([^"]+)"/)[1];
    return [id, target.startsWith('/') ? target.slice(1) : `xl/${target}`];
  }));
  const sheets = [...get('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    name: decode(m[0].match(/name="([^"]*)"/)[1]),
    path: rels.get(m[0].match(/r:id="([^"]+)"/)[1]),
  }));

  return sheets.map(({ name, path }) => {
    const xml = get(path);
    const rows = [];
    for (const rm of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const r = +rm[0].match(/\br="(\d+)"/)[1] - 1;
      const row = (rows[r] = rows[r] || []);
      for (const cm of (rm[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1];
        const body = cm[2] || '';
        const ref = attrs.match(/\br="([A-Z]+)\d+"/)[1];
        const type = (attrs.match(/\bt="([^"]+)"/) || [])[1];
        const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let value = null;
        if (type === 's') value = shared[+v];
        else if (type === 'inlineStr') value = textOf(body);
        else if (type === 'str') value = v === undefined ? null : decode(v);
        else if (type === 'b') value = v === '1';
        else if (v !== undefined && v !== '') value = Number(v);
        row[colIndex(ref)] = value;
      }
    }
    return { name, rows: Array.from(rows, (r) => r || []) };
  });
}
