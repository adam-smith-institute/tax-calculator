// Every parameter value must carry a source, and every source must point at a value.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../params/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

function leaves(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
}

for (const file of files) {
  test(`params/${file}: every value has a source`, () => {
    const p = JSON.parse(readFileSync(new URL(file, dir)));
    const { meta, sources, ...values } = p;
    assert.ok(meta?.id && meta?.version, 'meta.id and meta.version are set');
    const paths = leaves(values);
    const missing = paths.filter((path) => !sources?.[path]);
    assert.deepEqual(missing, [], `values without a source: ${missing.join(', ')}`);
    const orphans = Object.keys(sources).filter((s) => !paths.includes(s));
    assert.deepEqual(orphans, [], `sources without a value: ${orphans.join(', ')}`);
  });
}
