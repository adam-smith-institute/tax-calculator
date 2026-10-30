# Worked examples

Hand-worked bills for 2026-27 and 2027-28, using `params/2026-27.json` and
`params/2027-28.json`. Each is asserted in `tests/worked-examples.test.js`. Unless stated,
the person is 40, has no children, and the employer NI toggle is off.

Shorthand: PA is the Personal Allowance (£12,570), BRB the basic rate band (£37,700 of
taxable income), PSA the Personal Savings Allowance, DA the dividend allowance (£500).
Employee NI is 8% from £12,570 to £50,270 and 2% above. The full basic band of employee NI
is therefore (£50,270 − £12,570) × 8% = £3,016.

## 1. Salary only: £35,000

| | 2026-27 | 2027-28 |
|---|---|---|
| Income tax: (£35,000 − £12,570) × 20% | £4,486.00 | £4,486.00 |
| Employee NI: (£35,000 − £12,570) × 8% | £1,794.40 | £1,794.40 |
| **Total** | **£6,280.40** | **£6,280.40** |
| Average rate (÷ £35,000) | 17.94% | 17.94% |

## 2. Salary and savings: £45,000 salary, £3,000 interest

Taxable salary £32,430, all basic rate: £6,486. Total taxable income £35,430 is within the
BRB, so the PSA is £1,000. The starting rate for savings is nil (taxable salary is over
£5,000). The PSA takes £1,000 of band (to £33,430); the other £2,000 is taxed at the savings
basic rate.

| | 2026-27 | 2027-28 |
|---|---|---|
| Income tax on salary | £6,486.00 | £6,486.00 |
| Savings: £2,000 × 20% / 24% | £400.00 | £480.00 |
| Employee NI: £32,430 × 8% | £2,594.40 | £2,594.40 |
| **Total** | **£9,480.40** | **£9,560.40** |

## 3. Dividends only: £31,970

The PA is set against dividends: £19,400 taxable. The DA covers £500; £18,900 × 10.75% =
£2,031.75. No NI on dividends.

| | 2026-27 | 2027-28 |
|---|---|---|
| **Total** | **£2,031.75** | **£2,031.75** |

## 4. Higher rate with savings and dividends: £60,000 salary, £2,000 interest, £5,000 dividends

Taxable salary £47,430: £37,700 × 20% = £7,540, plus £9,730 × 40% = £3,892, giving £11,432.
Total taxable income £54,430 is above the BRB, so the PSA is £500. Interest: £500 at 0%, then
£1,500 at the savings higher rate. Dividends: £500 at 0% (DA), then £4,500 × 35.75% =
£1,608.75. NI: £3,016 + (£60,000 − £50,270) × 2% = £3,210.60.

| | 2026-27 | 2027-28 |
|---|---|---|
| Income tax on salary | £11,432.00 | £11,432.00 |
| Savings: £1,500 × 40% / 44% | £600.00 | £660.00 |
| Dividends | £1,608.75 | £1,608.75 |
| Employee NI | £3,210.60 | £3,210.60 |
| **Total** | **£16,851.35** | **£16,911.35** |

## 5. The £100,000 to £125,140 taper: £110,000 salary

Adjusted net income is £10,000 over £100,000, so the PA falls by £5,000 to £7,570. Taxable
£102,430: £7,540 + £64,730 × 40% = £25,892, giving £33,432. NI: £3,016 + £59,730 × 2% =
£1,194.60, giving £4,210.60.

| | 2026-27 | 2027-28 |
|---|---|---|
| **Total** | **£37,642.60** | **£37,642.60** |

## 6. High Income Child Benefit Charge: £70,000 salary, 2 children

Income tax: £7,540 + £19,730 × 40% = £15,432. NI: £3,016 + £19,730 × 2% = £3,410.60.
Adjusted net income is £10,000 over £60,000: 50 complete £200 steps, so 50%.

| | 2026-27 | 2027-28 |
|---|---|---|
| Child Benefit for the year | 53 weeks × (£27.05 + £17.90) = £2,382.35, rounded down to £2,382 | 52 × (£28.00 + £18.55) = £2,420.60, rounded down to £2,420 |
| HICBC at 50% | £1,191 | £1,210 |
| **Total** | **£20,033.60** | **£20,052.60** |

## 7. Salary sacrifice: £60,000 salary, 10% sacrificed, employer NI included

£6,000 is sacrificed, leaving pay of £54,000 for both tax and NI (no NI cap before 2029-30).
Income tax: £41,430 taxable, so £7,540 + £3,730 × 40% = £9,032. Employee NI: £3,016 +
£3,730 × 2% = £3,090.60. Employer NI: (£54,000 − £5,000) × 15% = £7,350, of which 75%,
£5,512.50, counts as the employee's.

| | 2026-27 | 2027-28 |
|---|---|---|
| **Total** | **£17,635.10** | **£17,635.10** |
| Average rate: £17,635.10 ÷ (£60,000 + £5,512.50) | 26.92% | 26.92% |

## 8. Self-employed: £40,000 profit

Income tax: £27,430 × 20% = £5,486. Class 4: £27,430 × 6% = £1,645.80. No trading
allowance is deducted, because the figure entered is profit.

| | 2026-27 | 2027-28 |
|---|---|---|
| **Total** | **£7,131.80** | **£7,131.80** |

## 9. Capital gains: £40,000 salary, £30,000 gain on shares, £20,000 gain on a second home

Income tax £5,486; NI £2,194.40. Basic rate band left: £37,700 − £27,430 = £10,270. The
£3,000 annual exempt amount goes against the residential gain, leaving £17,000:
£10,270 × 18% = £1,848.60 and £6,730 × 24% = £1,615.20. The share gain is all at 24%: £7,200.
CGT £10,663.80.

| | 2026-27 | 2027-28 |
|---|---|---|
| **Total** | **£18,344.20** | **£18,344.20** |
| Average rate: ÷ £90,000 of income and gains | 20.38% | 20.38% |

## 10. Over State Pension age: aged 70, £30,000 salary, £1,000 interest

No employee NI. Income tax £17,430 × 20% = £3,486. The interest is within the £1,000 PSA.

| | 2026-27 | 2027-28 |
|---|---|---|
| **Total** | **£3,486.00** | **£3,486.00** |

Aged 66 on £30,000: £4,880.40 if not yet at State Pension age (NI £1,394.40), £3,486.00 if
already over it. Aged 67: £3,486.00 whatever the answer.

## 11. Landlord: £30,000 salary, £3,000 rental profit, £1,000 mortgage interest, £400 interest, £200 dividends

This is HMRC's example in the technical note on the new property rates. The PA goes against
salary: £17,430 × 20% = £3,486. Interest is within the PSA and dividends within the DA.
Finance cost relief is the relief rate × the lowest of £1,000 costs, £3,000 profit and
£20,430 adjusted total income.

| | 2026-27 (property at main rates) | 2027-28 (property rates) |
|---|---|---|
| Property: £3,000 × 20% / 24% | £600.00 | £720.00 |
| Finance cost relief: £1,000 × 20% / 24% | −£200.00 | −£240.00 |
| Income tax | £3,886.00 | £3,966.00 |
| Employee NI | £1,394.40 | £1,394.40 |
| **Total** | **£5,280.40** | **£5,360.40** |

HMRC's note gives £3,926 of income tax at its then-proposed 22% property rate. At 22% this
engine also gives £3,926 (see the test).

## 12. Landlord with little other income: £10,000 salary, £20,000 rental profit

| | 2026-27 | 2027-28 |
|---|---|---|
| Working | Rent is non-savings income: (£30,000 − £12,570) × 20% = £3,486 | £10,000 of the PA goes against salary first (s25(3A)); £2,570 against rent; £17,430 × 24% = £4,183.20 |
| Employee NI | none (below £12,570) | none |
| **Total** | **£3,486.00** | **£4,183.20** |

## 13. Living on savings and dividends: £10,000 interest, £15,070 dividends

Total taxable income is £12,500, all basic rate, so the PSA is £1,000. The cheapest use of
the PA leaves exactly £6,000 of interest taxable, covered by the £5,000 starting rate and the
£1,000 PSA, so £4,000 of PA goes against interest and £8,570 against dividends. Dividends
taxable: £6,500, of which £500 at 0% and £6,000 × 10.75% = £645. Setting the PA against
interest first would give £1,290; against dividends first, £1,015 (2026-27) or £1,175
(2027-28).

| | 2026-27 | 2027-28 |
|---|---|---|
| **Total** | **£645.00** | **£645.00** |

## 14. Blind Person's Allowance: £30,000 salary

| | 2026-27 | 2027-28 |
|---|---|---|
| Allowances | £12,570 + £3,250 = £15,820 | £12,570 + £3,370 = £15,940 |
| Income tax | £14,180 × 20% = £2,836.00 | £14,060 × 20% = £2,812.00 |
| Employee NI | £1,394.40 | £1,394.40 |
| **Total** | **£4,230.40** | **£4,206.40** |

## 15. Marriage Allowance received: £25,000 salary

Income tax £12,430 × 20% = £2,486, less the £252 reduction = £2,234. NI £994.40.

| | 2026-27 | 2027-28 |
|---|---|---|
| **Total** | **£3,228.40** | **£3,228.40** |

## 16. Under 21, employer NI included: aged 20, £30,000 salary

No employer NI below the £50,270 Upper Secondary Threshold. Income tax £3,486, NI £1,394.40.

| | 2026-27 | 2027-28 |
|---|---|---|
| **Total** | **£4,880.40** | **£4,880.40** |
