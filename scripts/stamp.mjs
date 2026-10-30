// Cache-busting without a build step.
//
//   node scripts/stamp.mjs          update the stamps
//   node scripts/stamp.mjs --check  exit 1 if any stamp is out of date (run by the tests)
//
// GitHub Pages lets browsers cache each file for 10 minutes, so after a release a browser
// could pair the new index.html with an old app.js or stylesheet and break. To stop that,
// every reference to our own CSS and JavaScript carries "?v=<stamp>", where the stamp is a
// hash of the code itself (ignoring the stamps). New code means new addresses, so a browser
// always fetches a matching set.
//
// The bundled spending snapshot (src/spending/fallback.js) is left out of the hash, so the
// weekly data pull requests need no restamp; the live data file is fetched fresh anyway.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STAMP = /\?v=[0-9a-f]{10}|(?<=<meta name="asi-version" content=")[0-9a-f]{10}/g;
const EXCLUDE_FROM_HASH = new Set(['src/spending/fallback.js']);

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const files = ['index.html', ...walk(join(ROOT, 'src')).map((p) => relative(ROOT, p))]
  .filter((f) => /\.(html|js|css)$/.test(f))
  .sort();

export function currentStamp() {
  const h = createHash('sha256');
  for (const f of files) {
    if (EXCLUDE_FROM_HASH.has(f)) continue;
    h.update(f).update('\0').update(readFileSync(join(ROOT, f), 'utf8').replace(STAMP, '')).update('\0');
  }
  return h.digest('hex').slice(0, 10);
}

// Add or replace the stamp on every reference to our own .js and .css files
function stampText(text, file, v) {
  const add = (url) => `${url.replace(STAMP, '')}?v=${v}`;
  if (file.endsWith('.html')) {
    text = text.replace(/(<meta name="asi-version" content=")[0-9a-f]{10}(">)/, `$1${v}$2`);
    return text.replace(/((?:src|href)=")((?:src\/)[^"?]+\.(?:js|css))(\?v=[0-9a-f]{10})?(")/g, (m, a, url, _s, b) => `${a}${add(url)}${b}`);
  }
  if (file.endsWith('.js')) {
    return text.replace(/(\bfrom\s+'|\bimport\(\s*')(\.{1,2}\/[^'?]+\.js)(\?v=[0-9a-f]{10})?(')/g, (m, a, url, _s, b) => `${a}${add(url)}${b}`);
  }
  return text;
}

export function stale() {
  const v = currentStamp();
  return files.filter((f) => {
    const text = readFileSync(join(ROOT, f), 'utf8');
    return stampText(text, f, v) !== text;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const v = currentStamp();
  const out = stale();
  if (process.argv.includes('--check')) {
    if (out.length) { console.error(`Stamps out of date in: ${out.join(', ')}. Run: npm run stamp`); process.exit(1); }
    console.log(`Stamps current (${v}).`);
  } else {
    for (const f of out) writeFileSync(join(ROOT, f), stampText(readFileSync(join(ROOT, f), 'utf8'), f, v));
    console.log(out.length ? `Stamped ${out.length} files with ${v}.` : `Stamps already current (${v}).`);
  }
}
