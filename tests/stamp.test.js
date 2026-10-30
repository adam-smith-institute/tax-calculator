// Every reference to our own CSS and JavaScript carries the current version stamp, so a
// browser never pairs a new page with old cached code (scripts/stamp.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stale, currentStamp } from '../scripts/stamp.mjs';

test('cache-busting stamps are current (run: npm run stamp)', () => {
  assert.deepEqual(stale(), [], `stamp should be ${currentStamp()}`);
});
