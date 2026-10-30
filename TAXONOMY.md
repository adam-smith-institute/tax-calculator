# Spending categories

How the calculator splits a person's tax across what government spends it on. The categories
are built from HM Treasury's Public Expenditure Statistical Analyses (PESA), Table 5.2,
"Public sector expenditure on services by sub-function". The mapping lives in
`src/spending/taxonomy.json`, which ASI owns; this document explains it.

**Status:** version 1.2.0 (30 October 2026). Version 1.1.0 merged Welfare and Pensions and
gave each category a chart colour. Version 1.2.0 uses official COFOG names, takes out spending
not paid for by the taxes the calculator models, and adds named programmes from OSCAR II.

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
| 1 | Social protection: welfare and pensions | Cash benefits: the State Pension and other help for pensioners, Universal Credit, disability and family benefits, and housing support (COFOG 10, less personal social services). | 351,135 | 29.5% | 29p |
| 2 | Health | The NHS and other health services: hospital and community care, GPs, public health, administration and medical research (COFOG 7). | 257,542 | 21.6% | 22p |
| 3 | Education | Early years, schools, further and higher education, and services that support them (COFOG 9). | 125,721 | 10.5% | 11p |
| 4 | Public sector debt interest | Interest on government borrowing and the cost of the Bank of England's bond-buying (COFOG 1.7). Excludes accounting interest on pension schemes and public corporations' own debt. | 110,422 | 9.3% | 9.3p |
| 5 | Defence | The armed forces, military aid to other countries and defence research (COFOG 2). | 65,418 | 5.5% | 5.5p |
| 6 | Personal social services (social care) | Social care run by councils for older people, disabled adults and children (the personal social services lines of COFOG 10). | 56,135 | 4.7% | 4.7p |
| 7 | Public order and safety | Police, immigration and border control, fire and rescue, courts and prisons (COFOG 3). | 55,720 | 4.7% | 4.7p |
| 8 | Transport | Railways, national and local roads, local public transport and other transport (COFOG 4.5). Excludes investment by public corporations such as Transport for London, funded by fares and borrowing. | 46,864 | 3.9% | 3.9p |
| 9 | Economic affairs: industry, energy, agriculture and R&D | Support for business and employment, energy, agriculture, broadband and research and development (COFOG 4, less transport). | 45,036 | 3.8% | 3.8p |
| 10 | General public services | Parliament, central government, tax collection, diplomacy and net payments to EU institutions (COFOG 1, less debt interest and foreign economic aid). | 27,845 | 2.3% | 2.3p |
| 11 | Environmental protection | Waste management (including nuclear decommissioning), pollution control and nature (COFOG 5). | 19,157 | 1.6% | 1.6p |
| 12 | Housing and community amenities | Social housing, community development, street lighting and water supply (COFOG 6). Excludes council housing investment funded by rents through Housing Revenue Accounts. | 13,944 | 1.2% | 1.2p |
| 13 | Recreation, culture and religion | Museums, libraries, the arts, sport and broadcasting (COFOG 8). Excludes the BBC's licence-fee-funded services. | 10,116 | 0.8% | 0.8p |
| 14 | International development (foreign economic aid) | Economic aid to other countries (COFOG 1.2). Not the official development assistance (ODA) total, which is measured differently; military aid is under Defence. | 7,189 | 0.6% | 0.6p |
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

Each category opens to these lines (official sub-function names, with a plain gloss). Named
programmes from OSCAR II are shown in brackets under the line they belong to.

1. **Social protection: welfare and pensions:** Old age: State Pension and pensioner benefits (including State Pension, Pension Credit, Winter Fuel Payment); Social exclusion: Universal Credit, tax credits and income support (including Universal Credit); Sickness and disability: incapacity and disability benefits (including Personal Independence Payment, Attendance Allowance); Family and children: Child Benefit and family support (including Child Benefit); Housing: Housing Benefit (including Housing Benefit); Social protection n.e.c., including compensation schemes; Unemployment: Jobseeker's Allowance and related benefits; Survivors: bereavement and widows' benefits; R&D social protection.
2. **Health:** Medical services: hospital, GP and community care; Central and other health services: public health and administration; Medical research.
3. **Education:** Secondary education (including all academies); Primary education; Pre-primary education (under fives); Subsidiary services: school meals, transport and other support; Education n.e.c. and not definable by level; Tertiary education (higher education); R&D education; Post-secondary non-tertiary education (further education).
4. **Public sector debt interest:** Central government debt interest: gilts and Treasury bills; Bank of England Asset Purchase Facility (quantitative easing); Local government debt interest.
5. **Defence:** Military defence; Foreign military aid (including to Ukraine); R&D defence; Defence n.e.c.; Civil defence.
6. **Personal social services (social care):** Family and children: children's social care; Sickness and disability: social care for disabled adults; Old age: social care for older people; Other personal social services.
7. **Public order and safety:** Police services; Law courts; Prisons; Immigration and citizenship (including Asylum support and accommodation); Fire-protection services; Public order and safety n.e.c. and R&D.
8. **Transport:** Railway (including London Underground and HS2) (including Network Rail, HS2, East West Rail); Local roads; National roads (strategic road network) (including National Highways); Local public transport (mainly buses); Other transport (aviation, shipping and other).
9. **Economic affairs: industry, energy, agriculture and R&D:** General economic, commercial and labour affairs; R&D economic affairs (including UK Research and Innovation); Fuel and energy (including Sizewell C nuclear power station); Agriculture, food and fisheries policy; Agriculture: market support (farm payments); Communication (including broadband rollout) (including Building Digital UK (Project Gigabit broadband)); Economic affairs n.e.c.; Mining, manufacturing and construction; Other industries; Forestry.
10. **General public services:** Executive and legislative organs, financial and fiscal affairs, external affairs; General public services n.e.c.; General services; Basic research and R&D general public services; EU transactions (net).
11. **Environmental protection:** Waste management (including nuclear decommissioning) (including Nuclear Decommissioning Authority (Sellafield and other sites)); Environmental protection n.e.c. and waste water; Pollution abatement; Protection of biodiversity and landscape; R&D environmental protection.
12. **Housing and community amenities:** Community development; Housing development: local authority housing; Housing development: other social housing; Housing and community amenities n.e.c. and R&D; Street lighting; Water supply.
13. **Recreation, culture and religion:** Cultural services: museums, libraries and the arts; Recreational and sporting services; Broadcasting and publishing; Recreation, culture and religion n.e.c. and R&D; Religious and other community services.
14. **International development (foreign economic aid):** Foreign economic aid.

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
| State Pension | £145.9 billion | Social protection: welfare and pensions / Old age: State Pension and pensioner benefits | 10.2.2 |
| Pension Credit | £6.2 billion | Social protection: welfare and pensions / Old age: State Pension and pensioner benefits | 10.2.2 |
| Winter Fuel Payment | £1.9 billion | Social protection: welfare and pensions / Old age: State Pension and pensioner benefits | 10.2.2 |
| Universal Credit | £80.0 billion | Social protection: welfare and pensions / Social exclusion: Universal Credit, tax credits and income support | 10.7.2 |
| Personal Independence Payment | £28.5 billion | Social protection: welfare and pensions / Sickness and disability: incapacity and disability benefits | 10.1.2 |
| Attendance Allowance | £8.4 billion | Social protection: welfare and pensions / Sickness and disability: incapacity and disability benefits | 10.1.2 |
| Child Benefit | £13.4 billion | Social protection: welfare and pensions / Family and children: Child Benefit and family support | 10.4.2 |
| Housing Benefit | £12.4 billion | Social protection: welfare and pensions / Housing: Housing Benefit | 10.6.0 |
| Asylum support and accommodation | £4.2 billion | Public order and safety / Immigration and citizenship | 3.1.1 |
| Network Rail | £12.2 billion | Transport / Railway (including London Underground and HS2) | 4.5.4 |
| HS2 | £7.1 billion | Transport / Railway (including London Underground and HS2) | 4.5.4 |
| East West Rail | £0.2 billion | Transport / Railway (including London Underground and HS2) | 4.5.4 |
| National Highways | £4.9 billion | Transport / National roads (strategic road network) | 4.5.1 |
| UK Research and Innovation | £10.3 billion | Economic affairs: industry, energy, agriculture and R&D / R&D economic affairs | 4.8.0 |
| Sizewell C nuclear power station | £4.8 billion | Economic affairs: industry, energy, agriculture and R&D / Fuel and energy | 4.3.0 |
| Building Digital UK (Project Gigabit broadband) | £0.5 billion | Economic affairs: industry, energy, agriculture and R&D / Communication (including broadband rollout) | 4.6.0 |
| Nuclear Decommissioning Authority (Sellafield and other sites) | £4.3 billion | Environmental protection / Waste management (including nuclear decommissioning) | 5.1.0 |

Left out on purpose: **NHS England**, because most of what it pays goes to NHS trusts inside
the health group, so its outlays are far below its budget and would mislead; **Border Force**,
because with asylum support it would exceed PESA's immigration line; and **Hinkley Point C**,
which is privately financed by EDF and paid for through electricity bills, not taxes.

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

**EU transactions (−£166 million).** Folded into **General public services** as a drill-down
line. A negative category of its own would show as a bar going the wrong way and add a 16th
row for 0.01p. The line is described as net payments to EU institutions, with the sign
explained.

**Education footnote.** Table 5.2 footnote 7: the Department for Education records all
academy spending as secondary education, so "Secondary schools" is overstated and "Primary
schools" understated. The drill-down says so.

**Aid wording.** Table 5.2 footnote 1: COFOG "foreign economic aid" is not the official
development assistance (ODA) figure. ODA is measured differently: it includes some spending
counted in other categories here, and loans. The category is therefore called "Aid to other
countries" and described as "economic help to other countries (one part of the overseas aid
budget)", never "the aid budget". Military aid (2.3, £4.0 billion in 2025-26, largely to
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
