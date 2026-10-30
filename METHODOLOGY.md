# How the tax calculator works

The Adam Smith Institute's tax calculator estimates the direct taxes a person pays in a year
and shows how that sum compares with what government spends. This note sets out what it
covers, the assumptions it makes, and its limits.

## What it covers

- **Income tax** on earnings, self-employment profit, rental profit, savings interest and
  dividends, for a taxpayer in England or Northern Ireland. Welsh rates of income tax
  currently match English ones. Scottish rates are not covered.
- **National Insurance:** employee (Class 1) and self-employed (Class 4). Employer National
  Insurance can be included; see below.
- **Capital Gains Tax** on residential property and on other assets.
- **The High Income Child Benefit Charge.**

It does not cover VAT, council tax, fuel and alcohol duties, stamp duty, inheritance tax or
any other tax. So it understates the total tax most people pay.

## Tax years and rates

You can choose **2026-27**, the current year, or **2027-28**, using the rates and allowances
announced at Budget 2026 on 28 October 2026. Every figure comes from the Budget's Overview of
Tax Legislation and Rates (Annex A), HMRC guidance or legislation. Each one is listed, with
its source, in `params/2026-27.json` and `params/2027-28.json`.

From April 2027 savings income and property income have their own, higher rates: 24%, 44%
and 49%. Personal allowances must then be set against other income before rent, savings or
dividends. Some 2027-28 rates still need Parliament to pass the Finance Bill.

## How the tax is worked out

The calculator follows HMRC's rules:

- **Personal Allowance:** £12,570. It is reduced by £1 for every £2 of adjusted net income
  over £100,000, so it is gone at £125,140. Blind Person's Allowance is added, and is not
  reduced.
- **Order of income:** income is taxed in layers: earnings and other income first, then rent
  (from 2027-28), then savings, then dividends. Allowances are set against the layers in the
  way that gives the lowest tax. From 2027-28 they must go against earnings and other income
  first.
- **Tax-free amounts still count towards your band.** The £5,000 starting rate for savings,
  the Personal Savings Allowance and the £500 dividend allowance are taxed at 0%, but the
  income still uses up the basic rate band. This can push other income into the higher rate,
  as HMRC's guidance explains.
- **Personal Savings Allowance:** £1,000 if none of your income falls in the higher rate
  band, £500 if some does, and nothing if any falls in the additional rate band.
- **Marriage Allowance:** if you receive it, your tax falls by £252, provided none of your
  income is taxed above the basic rate.
- **Landlords:** rental profit is entered after expenses but before mortgage interest.
  Mortgage interest gets relief as a tax reduction at the basic rate (20% in 2026-27, and the
  24% property basic rate in 2027-28). The relief is limited to your property profit and to
  your income other than savings and dividends after allowances.
- **Self-employment and property allowances:** the £1,000 trading allowance (£3,000 from
  2027-28) and the £1,000 property allowance replace expenses; they are not deducted on top.
  Enter profit after whichever you use.
- **Pensions:** salary sacrifice reduces the pay that is taxed and that National Insurance is
  charged on. The £2,000 limit on National Insurance-free salary sacrifice starts in April
  2029, so it doesn't apply in these years. Contributions from pay before tax (net pay) reduce
  taxable pay but not National Insurance.
- **National Insurance:** worked out on annual earnings. In reality it is charged on each pay
  period, so people whose pay varies through the year may pay a different amount.
- **State Pension age:** above State Pension age you pay no employee or self-employed
  National Insurance. State Pension age is rising from 66 to 67. The calculator treats anyone
  67 or over as past it, and asks people who are 66. It assumes State Pension age was reached
  before the tax year began.
- **Under 21:** employers pay no National Insurance on earnings up to £50,270. The relief for
  apprentices under 25 is not included.
- **Capital Gains Tax:** 18% on gains within the basic rate band left after income, and 24%
  above it, after the £3,000 annual exempt amount.
- **High Income Child Benefit Charge:** 1% of the year's Child Benefit for every complete
  £200 of adjusted net income over £60,000, rounded down, as the law requires. 2026-27 has 53
  Child Benefit weeks, because it starts and ends on a Monday. The calculator assumes you are
  the higher earner in your household, who is the one liable for the charge, and that you
  get Child Benefit for the whole year.

## Employer National Insurance

Employers pay National Insurance of 15% on pay above £5,000. The law puts the bill on the
employer, but economists generally find that most of it is passed on to workers through lower
wages. If you choose to include it, the calculator counts **76%** of your employer's National
Insurance as tax you bear. This is the Office for Budget Responsibility's assumption that, in
the long run, 76% of the cost of the 2025 increase passes to workers (Economic and fiscal
outlook, October 2024).

## Average tax rate

The average tax rate is total tax divided by everything it is charged on. That is all the
income and gains you entered, plus, if you include it, the employer National Insurance
counted as yours. It is an average, not the rate on your next pound of income, which is
often higher.

## Where your tax goes

**Data.** HM Treasury's Public Expenditure Statistical Analyses (PESA), Table 5.2, "Public
sector expenditure on services by sub-function", for the latest year with **outturn**
figures, meaning actual spending rather than plans. PESA 2026 gives 2025-26 outturn. A
weekly automated check picks up each new edition, and a person reviews the change before
it goes live.

**Basis.** Spending is measured as **total expenditure on services** (TES): £1,227.6 billion
in 2025-26. This covers public services, benefits and debt interest. It leaves out £132.5
billion of accounting adjustments, mostly depreciation and VAT that public bodies pay and are
refunded. Those take total managed expenditure to £1,360.1 billion. HMRC uses the same basis
for the "how your tax was spent" section of Annual Tax Summaries.

**Categories.** Spending is grouped by purpose, using the UN's Classification of the
Functions of Government (COFOG), whichever department or council spends it. There are 15
categories in plain English. Each is mutually exclusive, and together they add up to TES.
[TAXONOMY.md](TAXONOMY.md) lists exactly which lines of the table make up each one. Points to
note:

- **Debt interest** includes £19.4 billion of interest building up in funded public sector
  pension schemes, chiefly the Local Government Pension Scheme. This is an accounting cost,
  not cash paid to lenders, and it is shown as its own line.
- **Pensions** is mostly the State Pension, with Pension Credit and other help for
  pensioners.
- **Education:** the Department for Education records all academy spending as secondary, so
  secondary schools are overstated and primary understated.
- **Aid to other countries** is the UN measure of economic aid. It is not the official
  development assistance total, which is measured differently. Military aid counts under
  Defence.

**How your tax is shared.** Taxes are not earmarked for particular services: the government
pools what it raises and decides spending separately. In most years it also borrows to cover
part of its spending, so taxes pay for less than all of it. The calculator shares your tax
across categories in proportion to their share of total spending. It shows each category as
"£X of your tax" and as pence in every £1.

## Limitations

The calculator is an illustration to inform debate. It is not tax advice. It assumes a
single taxpayer with a full year's income, no other reliefs (Gift Aid, personal pension
relief at source, losses, the marriage allowance transferor's position, and so on), and
income taxed in the year it is received. Rates for 2027-28 are as announced and could change
before they become law.

Code, data and the full audit trail are at
<https://github.com/adam-smith-institute/tax-calculator>.
