# Spending categories

How the calculator splits a person's tax across what government spends it on. The categories
are built from HM Treasury's Public Expenditure Statistical Analyses (PESA), Table 5.2,
"Public sector expenditure on services by sub-function". The mapping lives in
`src/spending/taxonomy.json`, which ASI owns; this document explains it.

**Status:** version 1.3.0 (6 November 2026). Version 1.1.0 merged Welfare and Pensions and
gave each category a chart colour. Version 1.2.0 took out spending not paid for by the taxes
the calculator models and added named programmes from OSCAR II. Version 1.3.0 gives categories
and their parts plain names that can be matched to the departments that fund them, and names
those departments in each description. Only names and descriptions changed.

## What the data is, in plain English

- **PESA** is the Treasury's annual statistical account of all public spending. Every July it
  publishes **outturn** figures, meaning what was actually spent, for the year just ended. PESA
  2026 (16 July 2026) gives 2025-26 outturn.
- **COFOG** is the UN's "Classification of the Functions of Government". It sorts spending by
  what it is for (health, defence, education and so on), whichever department or council
  spends it. Table 5.2 uses COFOG, with some UK detail added in "of which" lines.
- **Total expenditure on services (TES)** is the Treasury's measure of spending on public
  services and benefits. It was **£1,227.6 billion** in 2025-26. It is the same basis HMRC
  uses for "how your tax was spent" in Annual Tax Summaries.
- **What TES leaves out:** £132.5 billion of **accounting adjustments** take TES to total
  managed expenditure (TME) of £1,360.1 billion. The largest are depreciation, meaning the
  wearing out of government roads, buildings and equipment (£58.0 billion: £38.4 billion
  central, £19.6 billion local), and VAT that public bodies pay and the Treasury refunds to
  them (£26.1 billion). The rest reconcile budgets to the National Accounts (PESA Table 1.13
  and Annex D). None of these has a purpose of its own to assign it to. The calculator shares
  your tax over TES, as HMRC does, and says so under the chart.

## The categories (2025-26 outturn)

Amounts are £ million, after the exclusions below. Shares are of total expenditure on services
less those exclusions (£1,192.2 billion). The Table 5.2 lines behind each category are in
`src/spending/taxonomy.json`; where a category is a whole COFOG function, its amount is the
published total for that function less any exclusion, and sub-lines can differ from it by
£1 million because the source rounds each line separately.

| # | Category | Description | £m | Share | Pence in £1 |
|---|---|---|---|---|---|
| 1 | Welfare and pensions | Mainly the Department for Work and Pensions: the State Pension, Universal Credit, and disability, family and housing benefits. | 351,135 | 29.5% | 29p |
| 2 | Health | Mainly the NHS, through the Department of Health and Social Care: hospitals, GPs, community care, public health and medical research. | 257,542 | 21.6% | 22p |
| 3 | Education | The Department for Education and councils: early years, schools, colleges and universities. | 125,721 | 10.5% | 11p |
| 4 | Debt interest | Interest on government borrowing, paid by the Treasury, and the cost of the Bank of England's quantitative easing. Excludes accounting interest on pension schemes and public corporations' own debt. | 110,422 | 9.3% | 9.3p |
| 5 | Defence | The Ministry of Defence: the armed forces, military aid and defence research. | 65,418 | 5.5% | 5.5p |
| 6 | Social care | Run by councils: care for older people, disabled adults and children. | 56,135 | 4.7% | 4.7p |
| 7 | Policing, justice and borders | Mainly the Home Office, the Ministry of Justice and councils: police, immigration and borders, courts, prisons, and fire and rescue. | 55,720 | 4.7% | 4.7p |
| 8 | Transport | The Department for Transport and councils: railways, roads, buses and other transport. Excludes investment by public corporations such as Transport for London, funded by fares and borrowing. | 46,864 | 3.9% | 3.9p |
| 9 | Business, energy and science | Mainly the departments for business, energy, science and farming: business support, energy, research, broadband and farm payments. | 45,036 | 3.8% | 3.8p |
| 10 | Running government | The Cabinet Office, the Treasury, HMRC, the Foreign Office and Parliament: central government, tax collection and diplomacy, plus net payments to the EU. | 27,845 | 2.3% | 2.3p |
| 11 | Environment | Mainly the Department for Environment, Food and Rural Affairs, councils and the Nuclear Decommissioning Authority: waste, pollution control and nature. | 19,157 | 1.6% | 1.6p |
| 12 | Housing and communities | The Ministry of Housing, Communities and Local Government and councils: social housing, community development, street lighting and water. Excludes council housing investment funded by rents and borrowing. | 13,944 | 1.2% | 1.2p |
| 13 | Culture, media and sport | The Department for Culture, Media and Sport and councils: museums, libraries, the arts, sport and broadcasting. Excludes the BBC's licence-fee-funded services. | 10,116 | 0.8% | 0.8p |
| 14 | Overseas aid | Mainly the Foreign, Commonwealth and Development Office: economic aid to other countries. Not the official development assistance total, which is measured differently; military aid is under Defence. | 7,189 | 0.6% | 0.6p |
| | **Total** | | **1,192,244** | | |
| | TES 1,227,648 less exclusions 35,405 | | 1,192,243 | | |

## Exclusions (version 1.2.0)

Total expenditure on services includes some spending that the taxes the calculator models
(income tax, National Insurance, Capital Gains Tax and the High Income Child Benefit Charge)
do not pay for. ASI decided on 30 October 2026 to leave these out, and to share the user's tax
over what remains. Each amount is read from a named PESA table by the pipeline.

| Excluded | 2025-26 | Source | Taken from | Why |
|---|---|---|---|---|
| Interest on funded public sector pension schemes | £19.4 billion | PESA Table 5.2, "of which: public sector pensions" | debt-interest (whole line) | An accounting entry for the growth of funded schemes' liabilities (chiefly the Local Government Pension Scheme), not a payment from taxes. Employers' contributions, which taxes do pay, are already counted in the services they support. |
| Public corporations' debt interest | £0.5 billion | PESA Table 5.2, "of which: public corporation debt interest" | debt-interest (whole line) | Paid by public corporations out of their own income. |
| BBC domestic services | £4.9 billion | PESA Table 1.1, "BBC domestic services" (resource and capital) | culture / broadcasting | Paid for by the television licence fee, which the calculator does not model. |
| Council housing investment through Housing Revenue Accounts | £8.5 billion | PESA Table 8.4, public corporations' capital expenditure, "6. housing and community amenities" | housing / council-housing | Capital spending by council housing public corporations, funded by rents and borrowing. |
| Investment by transport public corporations (mainly Transport for London) | £2.1 billion | PESA Table 8.4, public corporations' capital expenditure, "of which: transport" | transport / railways | Capital spending by public corporations such as Transport for London's trading arm, funded by fares and borrowing. London Underground is railway spending in PESA. |

**Kept in, deliberately:**

- **Devolved governments' spending.** It is mostly paid for by the block grant from UK-wide
  taxes, including the income tax and National Insurance the calculator models, and it pays for
  Northern Ireland's public services, which the calculator's users there rely on.
- **Company tax credits paid out** (about £10.7 billion, under HMRC in economic affairs): cash
  paid to businesses from general revenue.
- **Bank of England bond-buying losses** (£12.3 billion): the Treasury covers them in cash under
  its indemnity to the Bank.
- **Student loans** are already outside total expenditure on services: PESA removed the
  "grant-equivalent element of student loans" from it from 2011-12, and lending is a financial
  transaction.

**A limitation, not an exclusion:** some council spending is paid for by council tax, which the
calculator does not model. PESA does not split council spending by how it is funded, so it
cannot be removed accurately; the methodology says so.

## Drill-down

Each category opens to these lines, named so they can be matched to the departments that fund
them. `taxonomy.json` maps each to its official COFOG sub-function. Named programmes from
OSCAR II are shown in brackets under the line they belong to.

1. **Welfare and pensions:** State Pension and pensioner benefits (including State Pension, Pension Credit, Winter Fuel Payment); Universal Credit and tax credits (including Universal Credit); Disability and incapacity benefits (including Personal Independence Payment, Attendance Allowance); Child Benefit and family support (including Child Benefit); Housing Benefit (including Housing Benefit); Compensation schemes and other support; Jobseeker's Allowance; Bereavement benefits; Welfare research.
2. **Health:** Hospitals, GPs and community care; Public health and administration; Medical research.
3. **Education:** Secondary schools and academies; Primary schools; Early years; School meals, transport and other support; Other education; Universities; Education research; Further education.
4. **Debt interest:** Government bonds (gilts); Bank of England quantitative easing; Council borrowing.
5. **Defence:** Armed forces; Military aid (including Ukraine); Defence research; Other defence; Civil defence.
6. **Social care:** Children's social care; Care for disabled adults; Care for older people; Other social care.
7. **Policing, justice and borders:** Police; Courts; Prisons; Immigration, asylum and borders (including Asylum support and accommodation); Fire and rescue; Other justice and safety.
8. **Transport:** Railways (including HS2) (including Network Rail, HS2, East West Rail); Local roads; Motorways and major roads (including National Highways); Buses and local transport; Aviation, shipping and other.
9. **Business, energy and science:** Business support and employment; Research and development (including UK Research and Innovation); Energy (including Sizewell C nuclear power station); Farming, food and fisheries; Farm payments; Broadband and communications (including Building Digital UK (Project Gigabit broadband)); Other economic support; Manufacturing, mining and construction; Other industries; Forestry.
10. **Running government:** Government departments, tax collection and diplomacy; Other government services; Shared government services; Government research; EU payments (net).
11. **Environment:** Waste and nuclear decommissioning (including Nuclear Decommissioning Authority (Sellafield and other sites)); Other environment (including waste water); Pollution control; Nature and landscape; Environmental research.
12. **Housing and communities:** Community development; Council housing; Housing associations and other social housing; Other housing and communities; Street lighting; Water supply.
13. **Culture, media and sport:** Museums, libraries and the arts; Sport and recreation; Broadcasting; Other culture; Religious and community services.
14. **Overseas aid:** Economic aid.

Lines that are zero in a year (for example 1.4 Basic research, 5.2 Waste water management)
are still mapped, so a non-zero figure in a later year has a home, but the calculator hides
them.

## Named programmes (version 1.2.0)

PESA does not name projects. Recognisable programmes come from HM Treasury's OSCAR II
database, from its June in-year release for the same financial year (the final quarter). Each
figure counts outlays only (pay, goods and services, capital investment, grants, benefits and
subsidies), leaving out depreciation, provisions, loans, pension accounting and income, so it
is comparable with PESA. Each was placed by the COFOG code OSCAR gives its spending
(checked in the OSCAR annual release for 2024-25), and the pipeline flags any line whose
named programmes add up to more than the line.

| Programme | 2025-26 | Line | COFOG |
|---|---|---|---|
| State Pension | £145.9 billion | Welfare and pensions / State Pension and pensioner benefits | 10.2.2 |
| Pension Credit | £6.2 billion | Welfare and pensions / State Pension and pensioner benefits | 10.2.2 |
| Winter Fuel Payment | £1.9 billion | Welfare and pensions / State Pension and pensioner benefits | 10.2.2 |
| Universal Credit | £80.0 billion | Welfare and pensions / Universal Credit and tax credits | 10.7.2 |
| Personal Independence Payment | £28.5 billion | Welfare and pensions / Disability and incapacity benefits | 10.1.2 |
| Attendance Allowance | £8.4 billion | Welfare and pensions / Disability and incapacity benefits | 10.1.2 |
| Child Benefit | £13.4 billion | Welfare and pensions / Child Benefit and family support | 10.4.2 |
| Housing Benefit | £12.4 billion | Welfare and pensions / Housing Benefit | 10.6.0 |
| Asylum support and accommodation | £4.2 billion | Policing, justice and borders / Immigration, asylum and borders | 3.1.1 |
| Network Rail | £12.2 billion | Transport / Railways (including HS2) | 4.5.4 |
| HS2 | £7.1 billion | Transport / Railways (including HS2) | 4.5.4 |
| East West Rail | £0.2 billion | Transport / Railways (including HS2) | 4.5.4 |
| National Highways | £4.9 billion | Transport / Motorways and major roads | 4.5.1 |
| UK Research and Innovation | £10.3 billion | Business, energy and science / Research and development | 4.8.0 |
| Sizewell C nuclear power station | £4.8 billion | Business, energy and science / Energy | 4.3.0 |
| Building Digital UK (Project Gigabit broadband) | £0.5 billion | Business, energy and science / Broadband and communications | 4.6.0 |
| Nuclear Decommissioning Authority (Sellafield and other sites) | £4.3 billion | Environment / Waste and nuclear decommissioning | 5.1.0 |

Left out on purpose: **NHS England**, because most of what it pays goes to NHS trusts inside
the health group, so its outlays are far below its budget and would mislead; and **Border
Force**, because with asylum support it would exceed PESA's immigration line.

## Decisions on the open questions

**The "public sector pensions" line under debt interest (£19,381 million).** It is not
pensions paid to retired public servants: PESA records those separately, net of
contributions, at −£3.7 billion in 2025-26. This line is the interest that National Accounts
attribute to funded public sector pension schemes, chiefly the Local Government Pension
Scheme. Each year the scheme's promised pensions are a year closer to being paid, and the
Office for National Statistics records that growth as interest, at a set discount rate
applied to the schemes' liabilities ([ONS methodological guide](https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/methodologies/pensionsinthepublicsectorfinancesamethodologicalguide)).
It is an accounting cost, not a cash payment to lenders. Version 1.0.0 kept it inside Debt
interest as a labelled line; from version 1.2.0 it is **excluded** (see Exclusions), because the
taxes the calculator models do not pay it and employers' real contributions are already counted
in the services they support.

**"Old age: pensions".** In PESA this is almost all central government: the State Pension
(by far the largest part), Pension Credit and other pensioner benefits, plus public service
pensions counted net of the contributions paid in (a small negative in 2025-26). Its
drill-down line is called "State Pension and pensioner benefits", and does not claim to be
only the State Pension.

**Welfare and pensions together (version 1.1.0).** ASI asked for one category covering
benefits for pensioners and for people of working age, so the chart shows the whole social
security bill as a single slice (28.6% of spending in 2025-26). The drill-down keeps the
pensions and working-age lines separate.

**Colours.** Each category has a colour in `taxonomy.json` (`colour`), so it keeps the same
colour when the data is refreshed. The colours are vivid and varied, alternating warm and
cool down the ranking so neighbouring slices contrast. They depart from the ASI Design
System's palette by ASI's choice, and are used only in the spending chart. Inside a category,
its parts are shades of the category's colour, from the colour itself for the largest part to
lighter shades for the smaller ones.

**EU transactions (−£166 million).** Folded into **Running government** as a drill-down
line. A negative category of its own would show as a bar going the wrong way and add a 16th
row for 0.01p. The line is described as net payments to EU institutions, with the sign
explained.

**Education footnote.** Table 5.2 footnote 7: the Department for Education records all
academy spending as secondary education, so "Secondary schools" is overstated and "Primary
schools" understated. The drill-down says so.

**Aid wording.** Table 5.2 footnote 1: COFOG "foreign economic aid" is not the official
development assistance (ODA) figure. ODA is measured differently: it includes some spending
counted in other categories here, and loans. The category is called "Overseas aid" and its
description says it is economic aid and not the official development assistance total. Military aid (2.3, £4.0 billion in 2025-26, largely to
Ukraine) sits under Defence.

## Why this improves on the Where Does It All Go categories

The old chart's categories mixed four different kinds of thing:

- **Departments:** Home Office, Foreign Office, Work and Pensions, Energy Security and Net
  Zero. A department does many things, and the same purpose (say, police) is funded by
  several bodies.
- **A tier of government:** "Local Government" hid police, adult social care and children's
  social care inside one heading.
- **Purposes:** Health, Welfare, Education.
- **Accounting items the public can't interpret:** Depreciation, VAT Refunds, Funded Public
  Sector Pension Schemes and Environmental Levies.

Almost every category also ended in a sizeable "Other Spending" residual.

The new categories sort all spending by **purpose**, using the UN classification the
Treasury already publishes. They are mutually exclusive and add up exactly to TES. Every line
of Table 5.2 is assigned once, and the pipeline fails rather than publish if a line is
missing or assigned twice. The figures come straight from an official table refreshed every
July, with no hand-copying.

## Validation rules (enforced by the pipeline)

1. Every data line in Table 5.2 is assigned to exactly one drill-down line, excluded as a
   whole line, or listed as an aggregate (a total or a parent whose "of which" lines are used
   instead). An unknown line stops the pipeline.
2. Each aggregate equals the sum of its parts to within £2 million (source rounding).
3. Each exclusion's source line must be found in its PESA table (1.1, 5.2 or 8.4), and can
   never exceed the line it is taken from. Otherwise the pipeline stops.
4. The categories sum to TES less the exclusions within £1 million.
5. Flagged in the pull request, without failing: any category moving more than 25% from the
   previous year; a named programme not found in OSCAR (it is left out); named programmes
   adding up to more than their line; OSCAR data missing for the year (none are shown).
