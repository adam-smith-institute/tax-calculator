# Runbook

## Adding a tax year after a fiscal event

The weekly **Check for new fiscal events** workflow opens an issue titled "New fiscal event:
review tax parameters" when GOV.UK publishes a Budget, Spring or Autumn Statement, or OOTLAR
newer than the parameters. It never changes rates. When it fires (or after any Budget):

1. **Read the sources.** The OOTLAR's Annex A (rates and allowances) and the policy papers
   for any change to how a tax works, not just its rates.
2. **Branch:** `git switch -c params-<event>` (for example `params-spring-statement-2027`).
3. **New year.** Copy the latest file (`cp params/2027-28.json params/2028-29.json`), then
   change `meta` (`id`, `label`, `taxYear`, `start`, `end`, `fiscalEvent` with the event's
   name, date and Annex A link, `checked`) and each value that changes.
4. **Every value needs a source.** Update the matching entry in `sources` with the document
   and paragraph and a GOV.UK, legislation.gov.uk or OBR link. `npm test` fails if any value
   lacks a source or a source isn't official.
5. **Changed rates for an existing year.** Edit that year's file the same way, and say in
   the commit which figures changed and why.
6. **Watch for these:**
   - Child Benefit weeks: count the Mondays from 6 April to 5 April. 53 when the tax year
     starts on a Monday, or starts on a Sunday in a leap year.
   - `nic.salarySacrificeCap`: set it to 2000 from 2029-30 (or to whatever the regulations
     say).
   - `nic.statePensionAge`: from 2028-29 everyone 67 or over is past it; set
     `askFrom: 67, certainFrom: 67` until the rise to 68 begins.
   - `property.rates`, savings rates and `property.financeCostReliefRate` (the property
     basic rate).
   - `incomeTax.allowanceAllocation` stays `greatestReduction`. The engine always sets
     allowances against other income first, as s25(3A) requires.
7. **A rule change, not just a rate.** Change the engine only behind a parameter, so
   earlier years keep their behaviour. Add hand-worked cases to `tests/worked-examples.md`
   and `tests/worked-examples.test.js`.
8. **Offer the year in the calculator.** Add it to `YEARS` in `src/app.js` and add a button
   to the year switch in `index.html`. If the "current" year has moved on, change
   `DEFAULT_YEAR` and the labels.
9. **Worked examples.** Add the new year's figures for the 16 examples and check them by
   hand.
10. Run `npm test` and `npm run test:e2e`, open a pull request, have a second person check
    the figures against Annex A, then merge. GitHub Pages publishes within a few minutes.
11. Close the issue.

## Reviewing a spending pull request

The weekly **Update spending data** workflow opens a pull request titled "Spending data: …"
when PESA (or the July Public Spending Statistics release) changes the figures. Every
validation has already passed: each Table 5.2 line is assigned exactly once, totals match
their parts, the categories sum to TES within £1 million, and the file matches the schema.

1. **Read the description.** It has a table of each category's old and new £ billion, the
   change, and its share of the pound, followed by TES, accounting adjustments and TME.
   Categories that moved more than 25% from the previous year are flagged.
2. **Check against the source.** Open the linked publication and Table 5.2. Spot-check TES,
   the largest three categories, and any flagged ones.
3. **New year or revision?** A new edition moves `fiscalYear` on (2025-26 to 2026-27), and a
   copy is kept in `data/history/`. A mid-year revision keeps the year.
4. **Flags.** A big move is usually real: a policy change, or a reclassification noted in
   the PESA text. If it is a reclassification, say so in the pull request before merging.
5. **Labels.** If the Treasury renamed a line, the pipeline would have failed rather than
   guessed, so a passing pull request means every line matched.
6. **Merge** by hand. The live page reads `data/spending.json`, and the bundled fallback
   updates in the same commit.

## When the spending pipeline fails

The workflow opens an issue, "Spending data pipeline failed", linking to the run log.
Nothing is written. Common causes:

- **A new or renamed line in Table 5.2** ("Line … is not assigned to any category"). Decide
  where it belongs, add its id to a category's `rows` in `src/spending/taxonomy.json` (and
  to `aggregates` if it is a total or has "of which" lines), bump `version`, and update
  TAXONOMY.md.
- **Totals don't match** ("… but its parts sum to …"). Check the source table. A difference
  beyond £2 million is unusual and worth asking HM Treasury about.
- **Table or attachment not found.** GOV.UK may have renamed the attachment. Adjust the
  title pattern in `SOURCES` in `pipeline/build-spending.mjs`.
- **GOV.UK unavailable.** Re-run the workflow later.

To run it locally: `npm run spending` (or `node pipeline/build-spending.mjs --check` to
validate without writing).

## One-off settings in the GitHub repository

- **Settings → Pages:** deploy from the `main` branch, root folder (as now).
- **Settings → Actions → General → Workflow permissions:** read and write, and tick "Allow
  GitHub Actions to create and approve pull requests". The spending workflow needs both to
  open its pull request. It never approves or merges.
