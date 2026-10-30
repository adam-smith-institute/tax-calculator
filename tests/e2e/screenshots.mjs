// Screenshots of key states at 375px and 1280px wide: node tests/e2e/screenshots.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { serve } from './server.mjs';

const out = process.argv[2] || 'docs/screenshots';
mkdirSync(out, { recursive: true });
const { server, url } = await serve();
const browser = await chromium.launch();
const errors = [];

for (const width of [375, 1280]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: width < 500 ? 2 : 1 });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${width}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${width}: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector('body.ready');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/${width}-1-your-tax.png`, fullPage: true });

  // A fuller case
  await page.fill('#empInc', '72,000');
  await page.check('#erNI');
  await page.click('#g-invest summary');
  await page.fill('#savInc', '3,000');
  await page.fill('#divInc', '4,000');
  await page.click('#g-invest summary');
  await page.click('#g-family summary');
  await page.fill('#kids', '2');
  await page.click('#g-family summary');
  await page.click('#panel-tax details.detail summary');
  await page.screenshot({ path: `${out}/${width}-2-your-tax-detail.png`, fullPage: true });

  await page.click('#tab-spend');
  await page.screenshot({ path: `${out}/${width}-3-where-it-goes.png`, fullPage: true });
  await page.click('.legend-item >> nth=0');
  await page.screenshot({ path: `${out}/${width}-4-category.png`, fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) errors.push(`${width}: horizontal overflow of ${overflow}px`);
  await context.close();
}
await browser.close();
server.close();
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; } else console.log(`Screenshots in ${out}`);
