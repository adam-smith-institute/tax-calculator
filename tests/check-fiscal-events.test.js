import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newEvents, eventName, currentSources } from '../scripts/check-fiscal-events.mjs';

const sources = { latest: '2026-10-28', known: new Set(['budget 2026']) };
const r = (title, date, link = '/government/publications/' + title.toLowerCase().replace(/\W+/g, '-')) =>
  ({ title, public_timestamp: `${date}T09:30:00Z`, link });

test('names fiscal events from titles', () => {
  assert.equal(eventName('Budget 2026: Overview of tax legislation and rates (OOTLAR)'), 'budget 2026');
  assert.equal(eventName('Spring Statement 2027 document'), 'spring statement 2027');
  assert.equal(eventName('Autumn Budget 2028 document'), 'autumn budget 2028');
});

test('flags a later Spring Statement and its OOTLAR, newest first', () => {
  const found = newEvents([
    r('Spring Statement 2027', '2027-03-18'),
    r('Spring Statement 2027: Overview of tax legislation and rates (OOTLAR)', '2027-03-19'),
  ], sources);
  assert.deepEqual(found.map((f) => f.title), [
    'Spring Statement 2027: Overview of tax legislation and rates (OOTLAR)',
    'Spring Statement 2027',
  ]);
});

test('ignores updates to the event the parameters already cite, and unrelated papers', () => {
  const found = newEvents([
    r('Budget 2026 document', '2026-11-30'),
    r('Budget 2026: Overview of tax legislation and rates (OOTLAR)', '2026-12-05'),
    r('Budget 2026 Fact Sheet: Delivering for Every Region', '2026-11-01'),
    r('UK-Australia Financial Regulatory Forum: Joint Statement', '2026-11-02'),
    r('Budget 2025 document', '2025-11-28'),
  ], sources);
  assert.deepEqual(found, []);
});

test('reads the newest fiscal event from the parameter files', () => {
  const s = currentSources(new URL('../params/', import.meta.url));
  assert.equal(s.latest, '2026-10-28');
  assert.ok(s.known.has('budget 2026'));
});
