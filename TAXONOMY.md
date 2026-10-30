# Spending categories

How the calculator splits a person's tax across what government spends it on. The categories
are built from HM Treasury's Public Expenditure Statistical Analyses (PESA), Table 5.2,
"Public sector expenditure on services by sub-function". The mapping lives in
`src/spending/taxonomy.json`, which ASI owns; this document explains it.

**Status:** approved 29 October 2026 (you asked for every recommended change to go ahead).
Version 1.0.0.

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

Amounts are £ million. "Built from" names the Table 5.2 lines. Where a category is a whole
COFOG function, its amount is the published total for that function, and its drill-down shows
the published sub-lines. Sub-lines can differ from the total by £1 million because the source
rounds each line separately.

| # | Category | Plain-English description | Built from | £m | Share | Pence in £1 |
|---|---|---|---|---|---|---|
| 1 | Health | The NHS: hospitals, GPs, medicines, public health and medical research | 7. Health | 257,542 | 21.0% | 21p |
| 2 | Welfare | Benefits for people of working age, disabled people and families, including Universal Credit and Child Benefit | 10. Social protection, less pensions, survivors and personal social services: the benefit lines of 10.1, 10.4 and 10.7, plus 10.5, 10.6 and 10.9 | 194,894 | 15.9% | 16p |
| 3 | Pensions | The State Pension, Pension Credit and other help for pensioners | 10.2 "of which: pensions" + 10.3 Survivors | 156,241 | 12.7% | 13p |
| 4 | Debt interest | Interest on government borrowing, the Bank of England's bond-buying losses, and interest building up in public sector pension schemes | 1.7 Public debt transactions | 130,305 | 10.6% | 11p |
| 5 | Education | Nurseries, schools, colleges and universities | 9. Education | 125,721 | 10.2% | 10p |
| 6 | Defence | The armed forces, military aid and defence research | 2. Defence | 65,418 | 5.3% | 5p |
| 7 | Social care | Care for older people, disabled adults and children, run by councils | Every "of which: personal social services" line in 10. | 56,135 | 4.6% | 5p |
| 8 | Police, courts and prisons | Police, border control, fire and rescue, courts and prisons | 3. Public order and safety | 55,720 | 4.5% | 5p |
| 9 | Transport | Railways, roads, buses and other transport | 4.5 Transport | 48,923 | 4.0% | 4p |
| 10 | Business, energy, farming and science | Support for business and jobs, energy, farming, broadband and research | 4. Economic affairs, less 4.5 | 45,036 | 3.7% | 4p |
| 11 | Running the government | Parliament, ministries, tax collection, diplomacy and payments to and from EU institutions | 1.1, 1.3, 1.4, 1.5, 1.6 and EU transactions | 27,845 | 2.3% | 2p |
| 12 | Housing and communities | Council and social housing, local regeneration, street lighting and water | 6. Housing and community amenities | 22,470 | 1.8% | 2p |
| 13 | Environment | Rubbish collection and disposal, pollution control and nature | 5. Environment protection | 19,157 | 1.6% | 2p |
| 14 | Culture, sport and broadcasting | Museums, libraries, the arts, sport and the BBC | 8. Recreation, culture and religion | 15,053 | 1.2% | 1p |
| 15 | Aid to other countries | Economic help to other countries (one part of the overseas aid budget) | 1.2 Foreign economic aid | 7,189 | 0.6% | 1p |
| | **Total** | | | **1,227,649** | | |
| | TES as published | | | 1,227,648 | | |

The categories add up to £1 million more than TES because of rounding in the published
totals. The validation tolerance is £1 million.

The pence column is rounded to whole pence. The calculator shows one decimal place where a
category is under 1p.

## Drill-down

Each category opens to these lines (Table 5.2 line in brackets):

1. **Health:** Hospitals, GPs and other medical services (Medical services); Health
   administration and public health (Central and other health services); Medical research.
2. **Welfare:** Universal Credit, tax credits and income support (10.7 benefits); Disability
   and incapacity benefits (10.1 benefits); Family benefits, such as Child Benefit (10.4
   benefits); Help with housing costs, such as Housing Benefit (10.6); Unemployment benefits
   (10.5 benefits); Other support, including compensation schemes such as for infected blood
   and the Post Office Horizon scandal (10.9).
3. **Pensions:** State Pension and pensioner benefits (10.2 pensions); Benefits for widows and
   other survivors (10.3).
4. **Debt interest:** Interest on central government debt; Bank of England bond-buying
   (Asset Purchase Facility) costs; Interest building up in public sector pension schemes;
   Council and public corporation debt interest. See the note below.
5. **Education:** Under-fives; Primary schools; Secondary schools (includes all academies:
   see the note below); Universities and other higher education; Further education below
   degree level; School meals, transport and other support services; Education research;
   Other education.
6. **Defence:** Armed forces; Military aid to other countries; Defence research; Civil
   defence; Other defence.
7. **Social care:** Care for disabled adults; Care for older people; Children's social care;
   Other social care.
8. **Police, courts and prisons:** Police; Immigration and border control; Fire and rescue;
   Courts; Prisons; Other.
9. **Transport:** Railways; Local roads; National roads; Buses and local public transport;
   Other transport.
10. **Business, energy, farming and science:** Business, trade and employment support;
    Research and development; Energy; Farm payments; Farming, food and fisheries; Forestry;
    Broadband and communications; Mining, manufacturing and construction; Other industries;
    Other.
11. **Running the government:** Parliament, ministries, tax collection and diplomacy; General
    government services; Other government services; Government research; Net payments to EU
    institutions (−£166 million in 2025-26: receipts exceeded payments).
12. **Housing and communities:** Council housing; Other social housing; Community
    development; Street lighting; Water supply; Other.
13. **Environment:** Rubbish collection and disposal; Pollution control; Wildlife and
    countryside; Environmental research; Other.
14. **Culture, sport and broadcasting:** Museums, libraries and the arts; Broadcasting and
    publishing; Sport and recreation; Religious and community services; Other.
15. **Aid to other countries:** one line.

Lines that are zero in a year (for example 1.4 Basic research, 5.2 Waste water management)
are still mapped, so a non-zero figure in a later year has a home, but the calculator hides
them.

## Decisions on the open questions

**The "public sector pensions" line under debt interest (£19,381 million).** It is not
pensions paid to retired public servants: PESA records those separately, net of
contributions, at −£3.7 billion in 2025-26. This line is the interest that National Accounts
attribute to funded public sector pension schemes, chiefly the Local Government Pension
Scheme. Each year the scheme's promised pensions are a year closer to being paid, and the
Office for National Statistics records that growth as interest, at a set discount rate
applied to the schemes' liabilities ([ONS methodological guide](https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/methodologies/pensionsinthepublicsectorfinancesamethodologicalguide)).
It is an accounting cost, not a cash payment to lenders. It stays inside **Debt interest**,
since that is where the Treasury classifies it, but the drill-down shows it as its own line
with that explanation, so the headline category isn't mistaken for cash interest on gilts.

**"Old age: pensions".** In PESA this is almost all central government: the State Pension
(by far the largest part), Pension Credit and other pensioner benefits, plus public service
pensions counted net of the contributions paid in (a small negative in 2025-26). The category
is called **Pensions** and described as "the State Pension, Pension Credit and other help for
pensioners". It does not claim to be only the State Pension.

**EU transactions (−£166 million).** Folded into **Running the government** as a drill-down
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

1. Every data line in Table 5.2 is assigned to exactly one drill-down line, or listed as an
   aggregate (a total or a parent whose "of which" lines are used instead). An unknown line
   stops the pipeline.
2. Each aggregate equals the sum of its parts to within £2 million (source rounding).
3. The categories sum to TES within £1 million.
4. Any category moving more than 25% from the previous year is flagged in the pull request,
   without failing.
