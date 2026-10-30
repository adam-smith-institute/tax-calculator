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
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: width < 500 ? 2 : 1 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${width}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${width}: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector('body.ready');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/${width}-default.png`, fullPage: true });

  // A fuller case: savings, dividends, children, employer NI, one category open
  await page.fill('#empInc', '72,000');
  await page.click('#more summary');
  await page.fill('#savInc', '3,000');
  await page.fill('#divInc', '4,000');
  await page.fill('#kids', '2');
  await page.check('#erNI');
  await page.click('#bars .bar-toggle >> nth=0');
  await page.click('details.detail summary');
  await page.screenshot({ path: `${out}/${width}-detailed.png`, fullPage: true });

  await page.click('[data-year="2027-28"]');
  await page.screenshot({ path: `${out}/${width}-2027-28.png`, fullPage: false });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) errors.push(`${width}: horizontal overflow of ${overflow}px`);
  await page.close();
}
await browser.close();
server.close();
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; } else console.log(`Screenshots in ${out}`);
