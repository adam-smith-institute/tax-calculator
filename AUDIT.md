# Audit of the existing tax engine

Phase 2 of the rebuild. Each item below was reproduced by running the original page
(`legacy/original.html`) or its ported engine (`src/engine/computeTax.js`, which matches the
original bit for bit on 7,611 cases), then checked against legislation and HMRC guidance.

**Decision (29 October 2026): all fixes approved, with the recommended option wherever there
was a choice.** Engine fixes landed as one commit each, with hand-worked tests in
`tests/fixes.test.js`; the golden master was updated only for the cases each fix changed
(`meta.fixesApplied` in `tests/golden/as-shipped.json`). Outcomes are under
[What changed](#what-changed) at the end.

How to read the £ figures: they use the calculator as shipped (its mixed 2025-26 and later
parameters, see A2), so they show the size of each error rather than final 2026-27 bills. A
negative change means the user currently pays too much; a positive one means too little.
"Golden cases changed" counts how many of the 7,611 test cases a fix moves. It shows reach in
the test set, not in the population.

## Summary

| # | Issue | Evidence | Who it affects | £ impact (worked examples) | Proposed fix | Risk | Decision |
|---|---|---|---|---|---|---|---|
| A1 | Two engines disagree: the spending split uses the old engine | Reproduced in the original page (table below) | Almost everyone: every £ figure in "Where your money goes", the chart and the share image | £45k salary + £5k savings + £5k dividends: headline £11,487, split £10,554 | Delete the legacy engine; drive everything from `computeTax()` | Low | Approved (Phase 5) |
| A2 | Parameters from three tax years in one file | [Dividends](https://www.gov.uk/tax-on-dividends), [rate changes policy paper](https://www.gov.uk/government/publications/income-tax-changes-to-tax-rates-for-property-savings-and-dividend-income/income-tax-changes-to-tax-rates-for-property-savings-and-dividend-income) | Anyone with taxable savings, children or Blind Person's Allowance | £45k salary + £5k savings: £80 too much savings tax for 2026-27 | One parameter file per tax year (Phase 3) | Low | Approved (Phase 3) |
| A3 | £2,000 salary sacrifice NI cap applied now; it starts 6 April 2029 | [HMRC policy paper](https://www.gov.uk/government/publications/salary-sacrifice-reform-for-pension-contributions-effective-from-6-april-2029/salary-sacrifice-reform-for-pension-contributions) | Anyone sacrificing more than £2,000 a year | £40k, 10% sacrifice: −£160. £60k, 5%, employer NI on: −£132.50 | Cap becomes a parameter, `null` before 2029-30 | Low | Done |
| A4 | Personal Savings Allowance withdrawn £12,570 too early | [ITA 2007 s12B](https://www.legislation.gov.uk/ukpga/2007/3/section/12B) | Savers with taxable income £112,570 to £125,140 | £115k salary + £2k interest: −£210 | Decide PSA by position in the bands (folded into A5) | Low | Done |
| A5 | Nil-rate amounts (dividend allowance, PSA, starting rate for savings) don't use up band space | [ITA 2007 s12B(8)](https://www.legislation.gov.uk/ukpga/2007/3/section/12B), [s13A](https://www.legislation.gov.uk/ukpga/2007/3/section/13A), [GOV.UK: "add your total dividend income to your other income"](https://www.gov.uk/tax-on-dividends/how-dividends-are-taxed) | Anyone with savings or dividends whose income reaches a band boundary | £48,570 + £3k dividends: +£125. £60k interest only: +£1,100 | Count nil-rate income in the bands, the PSA test, the Marriage Allowance test and CGT band space | Medium | Done |
| A6 | £1,000 trading allowance deducted from profit, on top of expenses | [GOV.UK trading allowance](https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income) | All self-employed users with profit above £1,000 | £30k profit: +£260 (+£780 once the allowance is £3,000) | Option (a): no allowance on a profit input | Low | Done: option (a) |
| A7 | State Pension age fixed at 66 | [SPA timetable](https://www.gov.uk/government/publications/state-pension-age-timetable/state-pension-age-timetable) | People aged 66 who haven't reached SPA | Age 66, £30k salary, not yet at SPA: +£1,394.40 | Ask at 66; treat 67+ as over SPA | Low | Done (input in Phase 5) |
| A8 | Average tax rate leaves gains (and employer NI) out of the denominator | Design choice | Anyone with gains or the employer NI toggle on | £30k salary + £100k gain shows 89.8%; with gains counted, 20.7% | Divide by all income entered, including gains and the employer NI counted as tax | Low | Done |
| A9 | Share image hardcodes "Welfare", "Health", "Debt interest" and colours by name | `legacy/original.html:1337`, `:1147` | Everyone sharing the image | Wrong categories as soon as the data changes | Rank from the data (Phase 5) | Low | Approved (Phase 5) |
| A10a | Dead code | Read of the original | Nobody (no inputs reach it) | None | Remove (list below) | Low | Done |
| A10b | HICBC charged continuously; the law rounds down to whole percentages and pounds | [ITEPA 2003 s681C(3)](https://www.legislation.gov.uk/ukpga/2003/1/section/681C) | Parents with adjusted net income £60,000 to £80,000 | ANI £61,399, 3 children: −£32.24 | Whole percentages, rounded down; charge rounded down to £1 | Low | Done |
| A11 | `compute()` reads globals from another script | Read of the original | Nobody directly | None | Done in Phase 1: every value comes from `params/` | None | Done |
| N1 | Tiles count savings, dividend and property CGT twice | Read and run of the original | Anyone with savings, dividends or property gains | £45k + £5k savings + £5k dividends + £10k gains + £10k property gains: tiles add to £19,653, headline £15,567 | Tiles show components that sum to the headline | Low | Approved (Phase 5) |
| N2 | Personal Allowance always set against savings before dividends; until 2027-28 the law gives the order that minimises tax | [ITA 2007 s25(2)](https://www.legislation.gov.uk/ukpga/2007/3/section/25) | Mainly people living on savings and dividends | £6k interest + £20k dividends: −£645 | 2026-27: choose the allocation with the lowest tax. 2027-28: statutory order (s25(3A)) | Medium | Done |
| N3 | Child Benefit for 52 weeks; 2026-27 has 53 benefit weeks | [SSCBA 1992 s147](https://www.legislation.gov.uk/ukpga/1992/4/section/147), [ITEPA s681B](https://www.legislation.gov.uk/ukpga/2003/1/section/681B) | Parents paying the full HICBC in 2026-27 | £85k salary, 2 children: +£43.30 | Weeks per year as a parameter: 53 in 2026-27, 52 in 2027-28 | Low | Approved (Phase 3) |
| N4 | Tile amounts formatted in the browser's locale, without £ | `legacy/original.html:2277` | Users with non-UK browser settings | "1.234,00" on a German browser | Format en-GB with £ (redesign) | Low | Approved (Phase 5) |
| N5 | Until 2027-28, allowances always set against other income first; s25(2) lets them go wherever tax is lowest | [ITA 2007 s25(2)](https://www.legislation.gov.uk/ukpga/2007/3/section/25); s25(3A) applies only from 2027-28 | Higher-rate taxpayers with savings or dividends | 2026-27, £50k salary + £3k dividends: −£42.52 | Search every split of the allowance, other income included, in years without s25(3A) | Medium | Done (30 October 2026) |
| N6 | Finance cost relief capped by income after only the allowances set against rent and other income | [ITTOIA 2005 s274AA(6)](https://www.legislation.gov.uk/ukpga/2005/5/section/274AA) | Landlords with savings or dividends in 2027-28 | 2027-28, £16,060 rent, £9,570 interest, £7,150 savings: +£1,096.80 (£16.80 charged; the law gives £1,113.60) | Adjusted total income less every allowance deducted, wherever it was set | Low | Done (30 October 2026) |

## Detail

### A1. Two engines

`window.computeTaxes()` runs `compute()` for the headline and tiles, then still calls
`computeTaxes_legacy()`, which rewrites the Detailed breakdown table and sets `currentEffBase`.
The chart tooltips, the "Where your money goes" table and the share image's category amounts
all use `currentEffBase`. Reproduced in the original page:

| Case | Headline (`compute`) | Spending split (legacy) | "Where your money goes" rows add up to |
|---|---|---|---|
| £45k salary + £5k savings + £5k dividends | £11,487 | £10,554.15 | £10,556 |
| £30k dividends only | £1,820 | £3,171.25 | £3,171 |
| £110k salary, 2 children | £39,894 | £37,380.20 | £37,378 |
| £60k salary, 5% salary sacrifice | £13,403 | £12,056.60 | £12,055 |

The legacy engine applies the gross band limits (£50,270, £125,140) to taxable income. It
also adds Marriage Allowance to the Personal Allowance instead of giving the £252 tax
reduction, and taxes savings without the starting rate or a correct PSA. The golden master
records `legacyCurrentEffBase` for every case; it differs from the headline by at least £1 in
4,260 of the 7,311 cases the page can produce, by up to £23,851.

**Fix:** delete `computeTaxes_legacy()` and every helper only it uses. The breakdown table,
the spending split and the share image all read one `computeTax()` result.

### A2. Mixed tax years

`RATES` is labelled 2025/26 but holds:

| Value | In the file | Belongs to |
|---|---|---|
| Dividend rates 10.75 / 35.75 / 39.35% | 2026-27 onwards | 2025-26 was 8.75 / 33.75 / 39.35% |
| Savings rates 22 / 42 / 47% | 2027-28, as announced in November 2025 | 2025-26 and 2026-27 are 20 / 40 / 45%. Appendix B says Budget 2026 changed 2027-28 to 24 / 44 / 49%; to verify in Phase 3 |
| £2,000 salary sacrifice cap | From 6 April 2029 | See A3 |
| Child Benefit £26.05 / £17.25 a week | 2025-26 | Phase 3 sets the 2026-27 and 2027-28 rates |
| Blind Person's Allowance £3,130 | 2025-26 | Phase 3 |

Worked example: £45,000 salary and £5,000 interest. £4,000 of interest is taxable in the
basic rate band, at 22% instead of 20%: **£80 too much**.

**Fix:** Phase 3 replaces this with `params/2026-27.json` and `params/2027-28.json`, every
value cited to Budget 2026 Annex A. `params/as-shipped.json` stays only for the golden master.

### A3. Salary sacrifice

Both engines cap the NI saving from salary sacrifice at £2,000 a year. HMRC's policy paper says
the cap applies to earnings forgone **from 6 April 2029**. Until then, sacrificed pay is fully
outside Class 1 NI for both employee and employer.

| Example | Now | Correct before 2029-30 | Change |
|---|---|---|---|
| £60,000, 5% sacrifice (£3,000) | £13,402.60 | £13,382.60 | −£20.00 (2% on £1,000 above the UEL) |
| Same, employer NI on | £19,365.10 | £19,232.60 | −£132.50 |
| £40,000, 10% sacrifice (£4,000) | £6,720.40 | £6,560.40 | −£160.00 (8% on £2,000) |

**Fix:** `nic.salarySacrificeCap` in each year's parameters, `null` (no cap) for 2026-27 and
2027-28. The engine applies the cap only when the year sets one, so 2029-30 switches it on
without a code change.

### A4. Personal Savings Allowance

`taxpayerBand()` calls a taxpayer "additional rate" once taxable income passes £112,570
(£125,140 minus a fixed £12,570). But additional rate starts at £125,140 of *taxable*
income, and by then the Personal Allowance is already nil. s12B gives £500 to anyone with
higher-rate income and no additional-rate income.

£115,000 salary plus £2,000 interest: taxable income is £112,930 (PA tapered to £4,070),
so the engine gives £0 PSA. The correct PSA is £500: **−£210** at the shipped 42% savings rate
(£200 at 40%). 50 golden cases change, by up to £235.

**Fix:** decide status by where income falls in the bands (above the basic rate limit is higher
rate; above £125,140 is additional rate). This is part of the A5 fix.

### A5. Nil-rate amounts and band space

**What the law says.** The dividend allowance, PSA and starting rate for savings are nil
*rates*, not deductions. Income taxed at them still occupies the band it would otherwise sit
in:

- s13A applies "if, ignoring this section, … income would be charged at the dividend ordinary
  rate, … upper rate or … additional rate" and then charges that income at the nil rate
  "rather than" those rates. The income keeps its place in the bands.
- s12A does the same for savings ("charged at the savings nil rate (rather than the basic,
  higher or additional rate)"), and the starting rate for savings is a rate within the basic
  band.
- s12B(8) says income counts as higher or additional rate income for the PSA test even if it
  is only nil-rated "but for section 12A" or "but for section 13A".
- GOV.UK: "To work out your tax band, add your total dividend income to your other income."

**What the engine does.** It moves nil-rated amounts out of the bands entirely. Savings in the
starting rate band, savings covered by the PSA and dividends covered by the allowance do not
use up basic rate band, so the income above them is taxed at a lower rate than it should be.
The same understated figure feeds the PSA test, the Marriage Allowance eligibility test and
the basic rate band left for capital gains.

**The same applies to all three nil rates**, as you suspected. The engine is consistent in
getting all three wrong, and the fix treats them the same way.

| Example | Now | Correct | Change |
|---|---|---|---|
| £48,570 salary + £3,000 dividends | dividend tax £468.75 | £593.75 | +£125.00 |
| £49,000 salary + £1,500 interest | £10,420.40 | £10,466.40 | +£46.00 |
| £60,000 interest, no other income | £10,070.60 | £11,170.60 | +£1,100.00 (starting rate and PSA now use £5,500 of band) |
| £45,000 salary + £5,000 savings + £5,000 dividends | £11,486.65 | £11,679.15 | +£192.50 |
| GOV.UK's own example: £29,570 wages + £3,000 dividends | £5,028.75 | £5,028.75 | none (wholly basic rate, so band space doesn't bite) |

980 golden cases change, by up to £1,573.

**Fix:** taxable income is allocated to the bands in full (non-savings, then savings with the
starting rate and PSA slices first, then dividends with the allowance first), each slice at its
own rate. PSA status, Marriage Allowance eligibility and the CGT basic rate band use the full
total. **Risk: medium**, because this is the core banding logic. Mitigation: hand-worked
tests at each boundary, and the golden master update is limited to the 980 affected cases.

### A6. Trading allowance

The trading allowance is an alternative to deducting expenses. GOV.UK: "You cannot deduct any
other expenses or allowances if you claim the allowances". The input is labelled
"Self-employment profit", which means after expenses, yet the engine deducts £1,000 more.

£30,000 profit: income tax and Class 4 are understated by £260 (£1,000 at 20% + 6%). In
2027-28, if the allowance rises to £3,000, that becomes £780.

Options:

- **(a) Recommended.** Keep the single "profit" input and deduct no allowance. Explain in the
  label: "profit after expenses (or after the £1,000 trading allowance, if you use that
  instead)". No new input. Slightly overstates tax for the few whose expenses are below the
  allowance.
- **(b)** Replace the input with "takings" and "expenses", and use the larger of expenses or
  the allowance. Exact, but it **adds an input**, so it needs your approval.
- **(c)** Keep profit, add a checkbox "I use the trading allowance instead of expenses", and
  treat the figure as takings when ticked. Also adds an input.

### A7. State Pension age

SPA is rising from 66 to 67. People born 6 April 1960 to 5 March 1961 reach it at 66 plus 1
to 11 months; anyone born on or after 6 March 1961 reaches it at 67. In 2026-27 a 66-year-old
may or may not be over SPA, and in 2027-28 nearly every 66-year-old is under it.

The rules also bite on different dates: Class 1 employee NI stops from the day you reach SPA,
whereas Class 4 stops only from the tax year after. A one-line rule can't capture both, so I
propose one simplification and to say so.

Age 66, £30,000 salary, not yet at SPA: the calculator charges no NI when £1,394.40 is due.

**Proposed handling**, explainable in one line: *"If you are 67 or over we treat you as over
State Pension age. At 66, tell us whether you have reached it."* At 66 a yes/no question
appears; it defaults to "no" in 2027-28 and must be answered in 2026-27. The methodology
states that we treat SPA as reached for the whole year. This **adds an input** (shown only at
66), so it needs your approval. The alternative, a month and year of birth, is exact but is a
heavier ask.

### A8. Average tax rate denominator

The rate divides total tax, which includes CGT and 75% of employer NI when that is on, by
income that excludes gains and employer NI. Gains therefore inflate the rate (£30,000 salary
plus a £100,000 gain shows **89.81%**), and the employer NI toggle mixes bases.

**Proposal:** divide by everything the user entered, gains included, plus the employer NI
treated as theirs when the toggle is on. Tax and income then share one base. The label reads
"Average tax rate: total tax as a share of all income and gains entered".

| Example | Now | Proposed |
|---|---|---|
| £30k salary + £100k gain | 89.81% | 20.73% |
| £50k salary, employer NI on | 31.09% | 28.23% |
| Salary only, employer NI off | unchanged | unchanged |

### A9. Share image

`getTopThreeCategories()` filters to the names "Welfare", "Health" and "Debt Interest"
(line 1337), and colours come from `baseColors`, keyed by name (line 1147). Any change to the
data or to the category names breaks it. The new taxonomy has neither "Welfare" in that form
nor "Debt Interest". **Fix (Phase 5):** sort by amount and take the top three, with colours by
rank from the chart palette.

### A10a. Dead code to remove

Unreachable or unused: carried interest (no input; the carried interest regime moved into
income tax from 6 April 2026), `propRent` and `rentRoom` (no inputs), the Married Couple's
Allowance comment block, BADR and Investors' Relief rates, Class 2 parameters, the unused
`RATES.ni.self_employed.class4` (the engine read the globals instead), the RAS pension path
(no input), and the kickstart, `__asiBindAll` and `updatePieChart` re-binding shims. Removing
carried interest and RAS drops 300 engine-only golden cases. The RAS path is the one piece I'd
keep if you might add a "personal pension (relief at source)" input later. Tell me if so.

### A10b. HICBC rounding

s681C(3): if the percentage "is not a whole number, it is to be rounded down to the nearest
whole number", and the charge is likewise "rounded down to the nearest whole number" of pounds.
The engine is continuous: it charges 6.75% at £1,350 over.

| Example (shipped Child Benefit rates) | Now | Correct | Change |
|---|---|---|---|
| ANI £61,350, 1 child | £91.44 charge | £81 | −£10.44 |
| ANI £61,399, 3 children | | | −£32.24 |

181 golden cases change, by up to £48.61. **Fix:** `floor(excess / £200)`% capped at 100,
then round the charge down to £1.

### N1. Tiles double-count

The "Income Tax (earnings)" tile shows total income tax, which already includes savings and
dividend tax, and those also have their own tiles. The "Capital Gains Tax" tile includes
property CGT, which also has its own tile. "Employer NI" shows the full employer NI, but
only 75% enters the total. For £45k salary, £5k savings, £5k dividends, £10k gains and £10k
property gains, the tiles add up to £19,652.90 against a headline of £15,566.65. **Fix
(Phase 5):** a breakdown whose lines sum to the headline, with employer NI shown as "75% of
£X" when it is on.

### N2. Order of allowances (until 2027-28)

ITA 2007 s25(2): reliefs and allowances are deducted "in the way which will result in the
greatest reduction" in tax. The engine always sets the Personal Allowance against savings
before dividends. When savings would be covered anyway by the starting rate and PSA, setting
the allowance against dividends saves tax:

- £6,000 interest + £20,000 dividends, no other income: engine £1,389.98; best allocation
  £744.98 (**−£645**).
- £10,000 interest + £15,000 dividends: −£645 (£1,282.47 to £637.48, using a split of the
  allowance between the two rather than either extreme).

From 2027-28 the Finance Act 2026 inserts s25(3A): reliefs go against other income first,
then property, savings and dividends. Phase 3 will check the exact statutory order.

**Fix:** 2026-27 tries the candidate allocations of the allowance between savings and
dividends (the tax is piecewise linear, so checking the breakpoints is enough) and takes the
lowest. 2027-28 uses the statutory order, switched by a parameter. **Risk: medium.** Tests
compare against a brute-force search on the random cases.

### N3. 53 Child Benefit weeks in 2026-27

For Child Benefit a week is "a period of 7 days beginning with a Monday" (SSCBA 1992 s147).
HICBC counts benefit "for a week in the tax year" (s681B). 6 April 2026 and 5 April 2027 are
both Mondays, so 2026-27 has **53** benefit weeks. 2025-26 and 2027-28 have 52. A family
claiming all year gets, and repays, one extra week. £85,000 salary, 2 children: +£43.30 at the
shipped rates (+£44.95 at 2026-27 rates). **Fix:** `childBenefit.weeksPerYear` per year,
cited to the calendar.

### N5 and N6. Found by random testing (30 October 2026)

`tests/reference.test.js` checks the engine against an independent reference written from
the legislation, with its own brute-force search for the allowance split. On 3,000 random
cases it found two faults, both in income tax on mixed income.

**N5. Other income doesn't have to take the allowances first until 2027-28.** The engine set
the Personal Allowance against salary, profit and rent before savings and dividends, on the
view that s25(2) would choose that anyway. It doesn't always. The nil-rate amounts (PSA,
dividend allowance) use up band space where they sit. Setting a little allowance against
savings or dividends instead of salary can move them out of the basic rate band, where they
waste 20% band space, into the higher rate band.

- 2026-27, £50,000 salary and £3,000 dividends. Salary first: taxable salary £37,430
  (£7,486), the £500 dividend allowance £270 inside the basic band, £2,500 at 35.75%
  (£893.75), so **£8,379.75**. With £270 of allowance against dividends: salary £37,700
  (£7,540), dividends £2,730 with the allowance wholly in the higher band, £2,230 at 35.75%
  (£797.23), so **£8,337.23** (−£42.52).
- 2026-27, £44,110 profit, £9,380 interest, £28,110 dividends: £18,598.57 to £18,498.57
  (−£100, the PSA moved out of the basic band).

From 2027-28, s25(3A) (Finance Act 2026 s6(6)) requires other income first, so the fault
affected 2026-27 only. **Fix:** a parameter, `incomeTax.otherIncomeFirst` (false before
2027-28, true from it). In years without it, the allowance split covers other income too. The
search was also made exact: tax is piecewise linear in the split, every kink lies on a line
of one of three forms, and the engine tries every crossing of two such lines.

**N6. Finance cost relief.** Relief is the property basic rate on the lowest of finance
costs, property profit and adjusted total income. s274AA(6) defines adjusted total income as
net income less savings and dividend income, "reduced by the amount of any allowances
deducted ... at Step 3", which means all of them, wherever they were set. The engine deducted
only the allowances set against rent and other income. In 2027-28, where allowances can go
against savings or dividends after other income, it moved them there to raise the cap.

- 2027-28, £16,060 rent, £9,570 mortgage interest, £7,150 interest: adjusted total income is
  £16,060 − £12,570 = £3,490, so relief is **£837.60**, not £2,296.80. Income tax is £1,113.60, not
  £16.80.

Before 2027-28 the two definitions gave the same answer, because the allowances went against
other income first; N5 would have made them differ. **Fix:** adjusted total income computed
once, from all allowances deducted, so the cap no longer depends on the split.

**Golden master:** 502 cases changed, all of them falling or level (as shipped, savings
are taxed at 42% and salary at 40%, so allowance against savings often saves tax). 43 keep the
same total with a different split: on a tie the engine now keeps the statutory order. The
largest change is −£414.

### Checked and correct

- Personal Allowance taper (£1 per £2 above £100,000, to nil at £125,140); Blind Person's
  Allowance is not tapered.
- Starting rate for savings, reduced £1 for £1 by taxable non-savings income.
- Marriage Allowance as a £252 tax reduction (20% of £1,260) for a basic rate recipient,
  capped at the tax due. The eligibility test is fixed by A5.
- Adjusted net income: includes savings and dividends; net-pay pension contributions and
  salary sacrifice come off it, which carries through to the PA taper and HICBC.
- Employee NI 8% / 2%, Class 4 6% / 2%, employer NI 15% above £5,000. Under-21s: no employer
  NI below the Upper Secondary Threshold. No employee or Class 4 NI above SPA (subject to A7).
- CGT at 18% / 24%, sharing the basic rate band left after income. The order the annual exempt
  amount is set against residential and other gains makes no difference while their rates
  match.
- The 75% employer NI incidence is applied as described. (Changed to 76%, the OBR's figure,
  on 30 October 2026 at ASI's request. The as-shipped parameters keep 75% as the record of the
  original.)

### Limitations to state in METHODOLOGY.md

NI is worked out on annual earnings, though in reality it is charged per pay period. The
calculator assumes the user is the HICBC-liable partner, that they are not an apprentice
under 25 (employer NI relief), and that they are an English or Northern Irish taxpayer. Welsh
rates currently match English ones, but Wales may set its own property rates from 2027-28.
Should the title say "England, Wales and Northern Ireland"? That is a question for you.

## What changed

| Fix | Commit message | Golden cases changed | Largest change in total tax |
|---|---|---|---|
| A10a | Remove dead carried interest and relief-at-source paths | 300 engine-only cases dropped; `carriedInterest` and `banding` fields removed from all | none |
| A3 | No salary sacrifice NI cap before 2029-30 | 492 | £7,847.98 (large sacrifice, employer NI on) |
| A4 + A5 | Nil-rate amounts use band space; PSA status by band position | 1,199 (923 in total tax; 276 only in `taxableAfterPA`) | £1,573.00 |
| A6 | No trading allowance deducted from a profit input | 1,760 | £735.00 |
| A10b | HICBC by complete £200 steps, rounded down | 790 (including every full-charge case: the benefit total now rounds down to £1) | £48.61 |
| N2 | Allowances go where they reduce tax most | 65, all reductions | £645.00 |
| A7 | State Pension age as a range while it rises to 67 | none (as-shipped keeps 66; the 2026-27 and 2027-28 files set 66 to ask and 67 certain) | none |
| A8 | Average rate over all income and gains, plus employer NI borne | 3,011 (`effectiveRatePct` only) | none |
| N5 + N6 | Allowances may go against any income before 2027-28; finance cost relief capped after all allowances | 502, none higher | £414.00 |

The A6 count is higher than the 1,497 in the summary table because it was measured after A5.
Writing the N2 test showed that my first hand-worked figure for the second example was wrong:
the best allocation splits the allowance, which the engine found and a £1 brute-force search
confirms.

Still to land, in the phases that own them: A1, A9, N1 and N4 with the new front end
(Phase 5); A2 and N3 with the per-year parameter files (Phase 3).
