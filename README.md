# ASI tax calculator

The Adam Smith Institute's tax calculator: enter your income to see your income tax,
National Insurance, Capital Gains Tax and High Income Child Benefit Charge for 2026-27 and
2027-28, and how your tax is shared across what government spends.

Live at <https://adam-smith-institute.github.io/tax-calculator/>, embedded on
[adamsmith.org/tax-calculator](https://www.adamsmith.org/tax-calculator) (see
[EMBED.md](EMBED.md)).

## How it works

It is a static site: plain HTML, CSS and ES modules, with no build step and no server. GitHub
Pages serves the repository root.

| Part | Where | What it does |
|---|---|---|
| Tax engine | `src/engine/computeTax.js` | `computeTax(inputs, params)`, a pure function with no DOM access |
| Tax parameters | `params/2026-27.json`, `params/2027-28.json` | Every rate and threshold for a year, each with its source |
| Spending data | `data/spending.json` | Built from HM Treasury PESA Table 5.2 by `pipeline/` |
| Spending categories | `src/spending/taxonomy.json`, [TAXONOMY.md](TAXONOMY.md) | Maps every Table 5.2 line to a plain-English category. ASI owns this. |
| Front end | `index.html`, `src/app.js`, `src/ui/`, `src/styles.css` | Form, results, chart, share image, embed resizing |
| Design | [DESIGN-EXTENSION.md](DESIGN-EXTENSION.md) | The interactive patterns added to the ASI Design System |

Two GitHub Actions keep it current, and neither changes anything without a person:

- **Update spending data** (weekly, `.github/workflows/spending-data.yml`) rebuilds the
  spending data from the latest PESA. If the figures changed, it opens a pull request. It
  never merges, and any failure opens an issue.
- **Check for new fiscal events** (weekly, `.github/workflows/fiscal-events.yml`) opens an
  issue when GOV.UK publishes a Budget, Spring or Autumn Statement, or OOTLAR newer than the
  tax parameters. It never changes rates.

Every pull request runs the tests (`.github/workflows/test.yml`).

## Running it

You need Node 22. Then:

```sh
npm ci
npx playwright install chromium   # once, for the browser tests
npm test                          # engine, golden master, worked examples, parameters, pipeline
npm run test:e2e                  # browser: numbers end to end, accessibility, layout, embed
npm run serve                     # then open http://127.0.0.1:8000
```

Opening `index.html` straight from disk won't work, because browsers block ES modules and
`fetch` on `file://`.

Other scripts:

- `npm run stamp`: update the version stamps on the page's CSS and JavaScript after any
  change to `index.html` or `src/` (see RUNBOOK.md). `npm test` checks they are current.
- `npm run spending`: rebuild `data/spending.json` from GOV.UK (add `-- --check` to validate
  without writing).
- `npm run check-fiscal-events`: see whether a newer fiscal event has been published.
- `npm run screenshots`: save screenshots of key states to `docs/screenshots/`.
- `npm run golden`: regenerate the golden master from the original page. This discards the
  approved fixes, which `tests/golden/update.mjs` then reapplies.

## Tests

| Suite | What it proves |
|---|---|
| `tests/engine.golden.test.js` | 7,311 cases match the original calculator's `compute()` to the penny, apart from the approved fixes in [AUDIT.md](AUDIT.md) |
| `tests/fixes.test.js` | Each audit fix, worked by hand |
| `tests/worked-examples.test.js` | 16 hand-worked cases per year ([tests/worked-examples.md](tests/worked-examples.md)), plus a brute-force check of the allowance allocation |
| `tests/params.test.js` | Every parameter has a source; year files cite GOV.UK, legislation.gov.uk or the OBR |
| `tests/pipeline.test.js` | The spending pipeline, on a saved PESA 2026 workbook, reproduces the published figures and rejects bad data |
| `tests/check-fiscal-events.test.js` | The fiscal event check |
| `tests/e2e/browser.test.js` | Five cases end to end in the browser against the engine; axe accessibility scan; no sideways scroll from 320px; keyboard use; share image; embedding |

## History

`legacy/original.html` is the calculator as it was before this rebuild, kept unchanged.
[AUDIT.md](AUDIT.md) records what was wrong with it and what changed.

## Documents

- [METHODOLOGY.md](METHODOLOGY.md): public-facing assumptions, spending basis and limitations
- [RUNBOOK.md](RUNBOOK.md): adding a tax year after a Budget; reviewing a spending pull request
- [AUDIT.md](AUDIT.md): the audit of the original engine and the fixes made
- [TAXONOMY.md](TAXONOMY.md): the spending categories
- [DESIGN-EXTENSION.md](DESIGN-EXTENSION.md): interactive patterns for the ASI Design System
- [EMBED.md](EMBED.md): the Squarespace embed snippet
