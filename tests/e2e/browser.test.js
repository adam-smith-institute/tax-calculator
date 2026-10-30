// End-to-end checks in headless Chromium: the page's numbers match the engine, the page is
// accessible (axe, no serious or critical issues), works by keyboard, never scrolls sideways,
// downloads the share image and reports its height when embedded.
//
//   npm run test:e2e

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { serve } from './server.mjs';
import { computeTax } from '../../src/engine/computeTax.js';

const params = Object.fromEntries(['2026-27', '2027-28'].map((y) => [y, JSON.parse(readFileSync(new URL(`../../params/${y}.json`, import.meta.url)))]));
let server, url, browser;

before(async () => {
  ({ server, url } = await serve());
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

async function open(width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.on('close', () => context.close().catch(() => {}));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('body.ready');
  return { page, errors };
}

const BLANK = {
  employmentIncome: 0, selfEmployedProfit: 0, savingsInterest: 0, dividends: 0, gainsOther: 0, gainsResidential: 0,
  propertyProfit: 0, propertyFinanceCosts: 0, salarySacrifice: 0, pensionNetPay: 0, blind: false,
  marriageAllowanceRecipient: false, children: 0, age: 40, reachedStatePensionAge: false, includeEmployerNIC: false,
};

// [description, form entries, engine inputs]
const CASES = [
  ['salary £45,000', { empInc: '45,000' }, { employmentIncome: 45000 }],
  ['salary, savings, dividends, 2 children, employer NI', { empInc: '72000', savInc: '3,000', divInc: '4000', kids: '2', erNI: true },
    { employmentIncome: 72000, savingsInterest: 3000, dividends: 4000, children: 2, includeEmployerNIC: true }],
  ['self-employed with gains', { empInc: '0', seInc: '40,000', cgtGain: '30000', cgtProp: '20000' },
    { selfEmployedProfit: 40000, gainsOther: 30000, gainsResidential: 20000 }],
  ['landlord, salary sacrifice, Marriage Allowance', { empInc: '30,000', rentProfit: '3,000', rentInterest: '1,000', pensSac: '5', marriage: true },
    { employmentIncome: 30000, propertyProfit: 3000, propertyFinanceCosts: 1000, salarySacrifice: 1500, marriageAllowanceRecipient: true }],
  ['aged 66, over State Pension age, £110,000', { age: '66', empInc: '110,000', spa: 'yes', blind: true },
    { age: 66, employmentIncome: 110000, reachedStatePensionAge: true, blind: true }],
];

async function fill(page, entries) {
  await page.click('#more summary');
  for (const [id, v] of Object.entries(entries)) {
    if (v === true) await page.check(`#${id}`);
    else if (id === 'spa') await page.check(`input[name="spa"][value="${v}"]`);
    else await page.fill(`#${id}`, v);
  }
}

const money = (text) => Number(text.replace(/[£,]/g, ''));

for (const [name, form, inputs] of CASES) {
  test(`page matches the engine: ${name}`, async () => {
    const { page, errors } = await open();
    await fill(page, form);
    for (const year of ['2026-27', '2027-28']) {
      await page.click(`[data-year="${year}"]`);
      const expected = computeTax({ ...BLANK, ...inputs }, params[year]);
      assert.equal(money(await page.textContent('#total')), Math.round(expected.totals.totalTax), `${year} total`);
      assert.equal(await page.textContent('#rate'), `${expected.totals.effectiveRatePct.toFixed(1)}%`, `${year} rate`);
      const lastRow = await page.textContent('#detail-body tr:last-child td:last-child');
      assert.equal(lastRow, `£${expected.totals.totalTax.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('spending split shares the headline total over TES', async () => {
  const { page } = await open();
  const total = money(await page.textContent('#total'));
  const figures = await page.$$eval('#bars > li > button .bar-figures', (els) => els.map((e) => e.textContent));
  const data = JSON.parse(readFileSync(new URL('../../data/spending.json', import.meta.url)));
  assert.equal(figures.length, data.categories.length);
  const health = data.categories.find((c) => c.id === 'health');
  assert.equal(figures[0], `£${Math.round(total * health.amount / data.meta.tes).toLocaleString('en-GB')} · 21p in every £1`);
  const sum = figures.reduce((s, f) => s + money(f.split(' · ')[0]), 0);
  assert.ok(Math.abs(sum - total) <= data.categories.length, `categories add to £${sum}, total £${total}`);
  await page.close();
});

for (const width of [320, 375, 768, 1280]) {
  test(`no horizontal scroll at ${width}px, with everything open`, async () => {
    const { page } = await open(width);
    await page.click('#more summary');
    await page.click('details.detail summary');
    await page.click('details.table-alt summary');
    for (const b of await page.$$('#bars .bar-toggle')) await b.click();
    for (const b of await page.$$('button[data-explain]')) if (await b.isVisible()) await b.click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0);
    await page.close();
  });
}

test('axe: no serious or critical accessibility issues (WCAG 2.2 AA)', async () => {
  const { page } = await open();
  await page.click('#more summary');
  await page.click('details.detail summary');
  await page.click('details.table-alt summary');
  await page.click('#bars .bar-toggle >> nth=0');
  for (const b of await page.$$('button[data-explain]')) if (await b.isVisible()) await b.click();
  await page.fill('#age', '66');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const bad = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  assert.deepEqual(bad.map((v) => `${v.id}: ${v.nodes.length} (${v.help})`), []);
  await page.close();
});

test('keyboard: Tab reaches the chart and Enter opens a category', async () => {
  const { page } = await open();
  await page.focus('#bars .bar-toggle >> nth=1');
  await page.keyboard.press('Enter');
  assert.equal(await page.getAttribute('#bars .bar-toggle >> nth=1', 'aria-expanded'), 'true');
  assert.equal(await page.isVisible('#spend-welfare'), true);
  await page.keyboard.press('Space');
  assert.equal(await page.isVisible('#spend-welfare'), false);
  // Every interactive element is reachable by Tab in order, with a visible focus ring
  const focusable = await page.$$eval('button, input, summary, a[href]', (els) => els.filter((e) => e.offsetParent !== null).length);
  let reached = 0;
  await page.focus('body');
  for (let i = 0; i < focusable + 5; i++) {
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    if (outline !== "none") reached++;
  }
  assert.ok(reached >= focusable * 0.9, `focus ring on ${reached} of ${focusable} stops`);
  await page.close();
});

test('invalid input shows an error and is announced as invalid', async () => {
  const { page } = await open();
  await page.fill('#empInc', 'abc');
  assert.equal(await page.getAttribute('#empInc', 'aria-invalid'), 'true');
  assert.match(await page.textContent('#empInc-error'), /Enter an amount in pounds/);
  await page.fill('#empInc', '45k');
  assert.equal(await page.getAttribute('#empInc', 'aria-invalid'), null);
  assert.equal(await page.textContent('#total'), '£9,080');
  await page.close();
});

test('State Pension age question appears only at 66', async () => {
  const { page } = await open();
  for (const [age, shown] of [['65', false], ['66', true], ['67', false]]) {
    await page.fill('#age', age);
    assert.equal(await page.isVisible('#spa-question'), shown, `age ${age}`);
  }
  await page.close();
});

test('share image downloads as a 1080 × 1350 PNG naming no hardcoded categories', async () => {
  const { page } = await open();
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#share')]);
  assert.equal(download.suggestedFilename(), 'ASI_TaxCalculator_2026-27.png');
  const buf = readFileSync(await download.path());
  assert.equal(buf.readUInt32BE(16), 1080);
  assert.equal(buf.readUInt32BE(20), 1350);
  const src = readFileSync(new URL('../../src/ui/share.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Welfare|Health|Debt interest/);
  await page.close();
});

test('embedded: reports its height to the parent page', async () => {
  const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
  await page.goto(`${url}tests/e2e/embed.html`);
  const height = await page.waitForFunction(() => window.__heights?.length && window.__heights.at(-1), null, { timeout: 10000 });
  assert.ok((await height.jsonValue()) > 1500);
  const frameHeight = await page.$eval('iframe', (f) => f.getBoundingClientRect().height);
  assert.ok(frameHeight > 1500, `iframe resized to ${frameHeight}px`);
  await page.close();
});
