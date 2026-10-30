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
const spending = JSON.parse(readFileSync(new URL('../../data/spending.json', import.meta.url)));
let server, url, browser;

before(async () => {
  ({ server, url } = await serve());
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

// Animations are switched off (as for users who ask for reduced motion) so the tests can click
// straight through; the animation itself has its own test below.
async function open(width = 1280, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion });
  const page = await context.newPage();
  page.on('close', () => context.close().catch(() => {}));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('body.ready');
  return { page, errors };
}

const openGroups = async (page) => { for (const s of await page.$$('details.group:not([open]) > summary')) await s.click(); };

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
  await openGroups(page);
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

test('pie chart shares the headline total over TES less exclusions, with every category in the legend', async () => {
  const { page } = await open();
  await page.click('#tab-spend');
  const total = money(await page.textContent('#total'));
  const amounts = await page.$$eval('#pie .legend-item .legend-amount', (els) => els.map((e) => e.textContent));
  assert.equal(amounts.length, spending.categories.length);
  assert.equal(await page.$$eval('#pie .slice', (els) => els.length), spending.categories.length);
  const first = spending.categories[0];
  assert.equal(amounts[0], `£${Math.round(total * first.amount / spending.meta.base).toLocaleString('en-GB')}`);
  assert.equal(await page.textContent('#pie .legend-item >> nth=0 >> .legend-name'), first.name);
  const sum = amounts.reduce((s, f) => s + money(f), 0);
  assert.ok(Math.abs(sum - total) <= spending.categories.length, `categories add to £${sum}, total £${total}`);
  // Slice colours come from the taxonomy
  assert.equal(await page.getAttribute('#pie .slice >> nth=0', 'fill'), first.colour);
  await page.close();
});

test('selecting a category shows its parts; "All spending" goes back', async () => {
  const { page } = await open();
  await page.click('#tab-spend');
  await page.click('#pie .legend-item >> nth=0');
  assert.equal(await page.textContent('.pie-title'), spending.categories[0].name);
  assert.equal(await page.$$eval('#pie .legend-item', (els) => els.length), spending.categories[0].children.filter((c) => c.amount !== 0).length);
  await page.click('.back-button');
  assert.equal(await page.$$eval('#pie button.legend-item', (els) => els.length), spending.categories.length);
  // Clicking a slice also drills down
  await page.click('#pie .slice >> nth=1', { force: true });
  assert.equal(await page.textContent('.pie-title'), spending.categories[1].name);
  await page.close();
});

for (const width of [320, 375, 768, 1280]) {
  test(`no horizontal scroll at ${width}px, with everything open`, async () => {
    const { page } = await open(width);
    await openGroups(page);
    await page.fill('#age', '66');
    for (const s of await page.$$('#panel-tax details.detail > summary')) await s.click();
    for (const b of await page.$$('button[data-explain]')) if (await b.isVisible()) await b.click();
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, 'Your tax');
    await page.click('#tab-spend');
    for (const s of await page.$$('#panel-spend details.detail > summary')) await s.click();
    await page.click('#pie .legend-item >> nth=0');
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, 'Where it goes');
    await page.close();
  });
}

test('axe: no serious or critical accessibility issues (WCAG 2.2 AA), on both tabs', async () => {
  const { page } = await open();
  await openGroups(page);
  await page.fill('#age', '66');
  await page.click('#panel-tax details.detail > summary');
  for (const b of await page.$$('button[data-explain]')) if (await b.isVisible()) await b.click();
  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
  const check = async (label) => {
    const results = await new AxeBuilder({ page }).withTags(tags).analyze();
    const bad = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    assert.deepEqual(bad.map((v) => `${label} ${v.id}: ${v.nodes.length} (${v.help})`), []);
  };
  await check('Your tax:');
  await page.click('#tab-spend');
  for (const s of await page.$$('#panel-spend details.detail > summary')) await s.click();
  await check('Where it goes:');
  await page.click('#pie .legend-item >> nth=0');
  await check('Category:');
  await page.close();
});

test('keyboard: tabs move with arrow keys; a category opens with Enter and closes with "All spending"', async () => {
  const { page } = await open();
  await page.focus('#tab-tax');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('#tab-spend', 'aria-selected'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-spend');
  assert.equal(await page.isVisible('#panel-spend'), true);
  assert.equal(await page.isVisible('#panel-tax'), false);
  await page.focus('#pie .legend-item >> nth=1');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'pie-title');
  await page.focus('.back-button');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), spending.categories[1].id);
  // Every visible interactive element gets a visible focus ring
  const focusable = await page.$$eval('button, input, summary, a[href], [tabindex="0"]', (els) => els.filter((e) => e.offsetParent !== null && e.tabIndex >= 0).length);
  let ringed = 0;
  await page.focus('body');
  for (let i = 0; i < focusable; i++) {
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    if (outline !== 'none') ringed++;
  }
  assert.ok(ringed >= focusable * 0.9, `focus ring on ${ringed} of ${focusable} stops`);
  await page.close();
});

test('"See where it goes" switches to the second tab', async () => {
  const { page } = await open();
  await page.click('#go-spend');
  assert.equal(await page.getAttribute('#tab-spend', 'aria-selected'), 'true');
  await page.close();
});

test('closed input groups summarise what has been entered', async () => {
  const { page } = await open();
  await fill(page, { savInc: '3,000', divInc: '4,000', kids: '2', marriage: true, pensSac: '5' });
  assert.equal(await page.textContent('[data-status="invest"]'), '£7,000 entered');
  assert.equal(await page.textContent('[data-status="family"]'), 'Marriage Allowance, 2 children');
  assert.equal(await page.textContent('[data-status="pension"]'), '5% of salary');
  await page.close();
});

test('employer NI explanation states the incidence used', async () => {
  const { page } = await open();
  await page.click('[aria-controls="explain-erni"]');
  assert.match(await page.textContent('#explain-erni'), new RegExp(`${Math.round(params['2026-27'].assumptions.employerNicIncidence * 100)}%`));
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
  assert.ok((await height.jsonValue()) > 1000);
  const frameHeight = await page.$eval('iframe', (f) => f.getBoundingClientRect().height);
  assert.ok(frameHeight > 1000, `iframe resized to ${frameHeight}px`);
  await page.close();
});

test('a browser holding an old cached page reloads once to the current version', async () => {
  // The previous release's page: no version tag, unstamped addresses
  const old = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    .replace(/<meta name="asi-version"[^>]*>\n?/, '').replace(/\?v=[0-9a-f]{10}/g, '');
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route(/\/(index\.html)?(\?.*)?$/, (r) => (new URL(r.request().url()).searchParams.has('fresh')
    ? r.continue() : r.fulfill({ body: old, contentType: 'text/html' })));
  await page.goto(url);
  await page.waitForURL(/fresh=unstamped/);
  await page.waitForSelector('body.ready');
  assert.equal(await page.textContent('#total'), '£9,080');
  await context.close();
});

test('if the code fails to load, the page says so instead of showing £0', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/src/ui/pie.js*', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(url);
  await page.waitForSelector('#load-error:not([hidden])', { timeout: 15000 });
  await context.close();
});

test('pie chart animates: sweeps in, grows a slice into its parts, and back', async () => {
  const { page } = await open(1280, 'no-preference');
  const slices = () => page.$$eval('#pie .slice', (els) => els.map((e) => e.getAttribute('d')));
  const lit = (ds) => ds.filter(Boolean).length;
  await page.click('#tab-spend');
  await page.waitForTimeout(150);
  const early = await slices();
  await page.waitForTimeout(900);
  const settled = await slices();
  assert.notDeepEqual(early, settled, 'slices still moving shortly after the tab opens');
  assert.equal(lit(settled), spending.categories.length);

  await page.click('#pie .legend-item >> nth=0');
  await page.waitForTimeout(300); // first phase: the chosen slice grows, the rest shrink away
  assert.equal((await slices()).length, spending.categories.length, 'still the top-level slices mid-transition');
  await page.waitForTimeout(900); // second phase: split into the parts
  const parts = spending.categories[0].children.filter((c) => c.amount > 0).length;
  assert.equal(lit(await slices()), parts);

  await page.click('.back-button');
  await page.waitForTimeout(1300);
  assert.equal(lit(await slices()), spending.categories.length);
  await page.close();
});

test('help buttons are round with a centred question mark', async () => {
  const { page } = await open();
  const box = await page.$eval('.help', (b) => {
    const s = getComputedStyle(b);
    return { radius: s.borderRadius, w: b.offsetWidth, h: b.offsetHeight, label: b.getAttribute('aria-label') };
  });
  assert.equal(box.radius, '50%');
  assert.equal(box.w, box.h);
  assert.ok(box.label.length > 5);
  await page.close();
});

test('share image: white card, top three shares as bars in the pie chart colours with their share of spending, mark in the footer', async () => {
  const { page } = await open();
  await page.fill('#empInc', '72,000');
  const r = await page.evaluate(async () => {
    const v = document.querySelector('meta[name="asi-version"]').content;
    const { drawShareCard, shareContent } = await import(`./src/ui/share.js?v=${v}`);
    const { loadSpending, allocate } = await import(`./src/ui/spending-data.js?v=${v}`);
    const { data } = await loadSpending();
    const total = Number(document.getElementById('total').textContent.replace(/[£,]/g, ''));
    const content = shareContent(total, '2026-27', allocate(total, data), data.meta);
    const out = await drawShareCard(document.createElement('canvas'), content, 'assets/logo/asi_logo_navy.svg');
    const ctx = out.canvas.getContext('2d');
    const hex = (x, y) => '#' + [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
    return {
      background: [hex(5, 5), hex(540, 1340), hex(5, 700)],
      bars: out.bars.map((b) => ({ want: b.colour.toUpperCase(), got: hex(b.x + b.w / 2, b.y + b.h / 2), w: b.w })),
      names: content.bars.map((b) => b.name),
      percents: content.bars.map((b) => b.percent),
      contentBottom: out.contentBottom, footerTop: out.footerTop, mark: out.mark,
    };
  });
  assert.deepEqual(r.background, ['#FFFFFF', '#FFFFFF', '#FFFFFF']);
  assert.deepEqual(r.names, spending.categories.slice(0, 3).map((c) => c.name));
  for (const b of r.bars) assert.equal(b.got, b.want);
  assert.ok(r.bars[0].w > r.bars[1].w && r.bars[1].w > r.bars[2].w, 'bars ranked by size');
  assert.deepEqual(r.percents, spending.categories.slice(0, 3).map((c) => `${(c.amount / spending.meta.base * 100).toFixed(1)}% of spending`));
  assert.ok(r.contentBottom < r.footerTop - 40, `content ends at ${r.contentBottom}, footer at ${r.footerTop}`);
  // The mark sits bottom right, beside the footer, at least 8% of the width, clear of the content
  assert.ok(r.mark.x > 1080 / 2 && r.mark.y > r.footerTop - r.mark.size, 'mark in the bottom-right footer');
  assert.ok(r.mark.size >= 0.08 * 1080);
  assert.ok(r.mark.x + r.mark.size <= 1080 - 79 + 1 && r.mark.y + r.mark.size <= 1350);
  assert.ok(r.contentBottom < r.mark.y, 'content ends above the mark');
  await page.close();
});

test('parts are shades of their category colour, largest in the full colour, lighter as they shrink', async () => {
  const { page } = await open();
  await page.click('#tab-spend');
  await page.click('#pie .legend-item >> nth=0');
  const fills = await page.$$eval('#pie .slice', (els) => els.map((e) => e.getAttribute('fill')));
  const swatches = await page.$$eval('#pie .legend-item .swatch', (els) => els.map((e) => getComputedStyle(e).backgroundColor));
  const cat = spending.categories[0];
  assert.equal(fills[0].toUpperCase(), cat.colour.toUpperCase());
  assert.equal(new Set(fills).size, fills.length, 'every part has its own shade');
  // Relative luminance rises from each part to the next
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, k) => s + c * [0.2126, 0.7152, 0.0722][k], 0);
  for (let j = 1; j < fills.length; j++) assert.ok(lum(fills[j]) > lum(fills[j - 1]), `part ${j} lighter than part ${j - 1}`);
  assert.equal(swatches.length, fills.length);
  await page.close();
});

test('named programmes (HS2, Sizewell C) appear inside their lines with total and your share', async () => {
  const { page } = await open();
  await page.fill('#empInc', '45,000');
  await page.click('#tab-spend');
  const transport = spending.categories.findIndex((c) => c.id === 'transport');
  await page.click(`#pie .legend-item >> nth=${transport}`);
  const items = await page.$$eval('.notable-item', (els) => els.map((e) => [e.querySelector('.notable-name').textContent, e.querySelector('.notable-total').textContent, e.querySelector('.notable-yours').textContent]));
  const hs2 = spending.categories[transport].children.find((c) => c.id === 'railways').notable.find((n) => n.id === 'hs2');
  const row = items.find(([name]) => name === 'HS2');
  assert.ok(row, 'HS2 listed');
  assert.equal(row[1], `£${(hs2.amount / 1000).toFixed(1)} billion`);
  assert.equal(row[2], `£${Math.round(9080 * hs2.amount / spending.meta.base)}`);
  // The exclusions are listed with their reasons under "About these figures"
  await page.click('#panel-spend details.detail:nth-of-type(2) > summary');
  const excl = await page.$$eval('#exclusions li', (els) => els.map((e) => e.textContent));
  assert.equal(excl.length, spending.meta.exclusions.length);
  assert.match(excl.join(' '), /BBC domestic services/);
  await page.close();
});
