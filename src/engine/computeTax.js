// ASI tax engine (England and Northern Ireland).
//
// computeTax(inputs, params) is pure: no DOM, no globals, no I/O. Every rate and threshold
// comes from `params` (one JSON file per tax year in /params). All amounts are annual £.
//
// It began as a port of compute() in legacy/original.html and still reproduces it to the
// penny (tests/golden/as-shipped.json), apart from the approved fixes in AUDIT.md. The
// arithmetic keeps the original's expressions and their order where it can; re-run the
// golden master after touching any expression.

export const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

function paAfterTaper(ani, it) {
  if (ani <= it.paTaperStart) return it.personalAllowance;
  if (ani >= it.paTaperZero) return 0;
  const loss = Math.floor((ani - it.paTaperStart) / it.paTaperDivisor);
  return Math.max(0, it.personalAllowance - loss);
}

function childBenefitAnnual(nChildren, cb) {
  if (!nChildren || nChildren <= 0) return 0;
  return cb.weeksPerYear * (cb.weeklyEldest + (nChildren - 1) * cb.weeklyAdditional);
}

// High Income Child Benefit Charge (ITEPA 2003 s681C): 1% of the Child Benefit for every
// complete £200 of adjusted net income over the threshold, up to 100%. The benefit total,
// the percentage and the charge are each rounded down to a whole number (s681C(3)).
function hicbcCharge(ani, nChildren, params) {
  const { thresholdStart: start, thresholdEnd: end, stepPounds, percentPerStep } = params.hicbc;
  const cb = Math.floor(childBenefitAnnual(nChildren, params.childBenefit));
  if (cb <= 0) return 0;
  if (ani <= start) return 0;
  if (ani >= end) return cb;
  const percent = Math.min(100, Math.floor((ani - start) / stepPounds) * Math.round(percentPerStep * 100));
  return Math.floor(cb * percent / 100);
}

// Working figures for the breakdown table (presentation only)
function nicDetail(nicBase, sePro, overSPA, erNIC, inputs, params) {
  const { class1Employee: ee, class4: c4, class1Employer: er } = params.nic;
  const slices = (base, lower, upper, main, add) => [
    { band: 'main', amount: Math.max(0, Math.min(base, upper) - lower), rate: main },
    { band: 'upper', amount: Math.max(0, base - upper), rate: add },
  ].filter((r) => r.amount > 0);
  return {
    overStatePensionAge: overSPA,
    employee: overSPA ? [] : slices(nicBase, ee.primaryThreshold, ee.upperEarningsLimit, ee.mainRate, ee.additionalRate),
    class4: overSPA ? [] : slices(sePro, c4.lowerProfitsLimit, c4.upperProfitsLimit, c4.mainRate, c4.additionalRate),
    employer: inputs.includeEmployerNIC ? { amount: erNIC, rate: er.rate, incidence: params.assumptions.employerNicIncidence } : null,
  };
}

function hicbcDetail(ani, nChildren, params) {
  const benefit = Math.floor(childBenefitAnnual(nChildren, params.childBenefit));
  if (benefit <= 0) return null;
  const { thresholdStart: start, thresholdEnd: end, stepPounds, percentPerStep } = params.hicbc;
  const percent = ani <= start ? 0 : ani >= end ? 100
    : Math.min(100, Math.floor((ani - start) / stepPounds) * Math.round(percentPerStep * 100));
  return { childBenefit: benefit, weeks: params.childBenefit.weeksPerYear, percent };
}

const NIL = { basic: 0, higher: 0, additional: 0 };

// Tax `amount` through the basic, higher and additional bands at `rates`, given that
// `already` of taxable income (after allowances) sits below it. Band limits are in
// taxable-income space: basic up to basicTop, higher up to higherTop. Returns the tax, the
// new position, and one piece per band touched (for the breakdown table).
function taxThroughBands(amount, already, rates, basicTop, higherTop) {
  let tax = 0;
  let remaining = amount;
  const pieces = [];
  const higherBandWidth = Math.max(0, higherTop - basicTop);
  const basicRoom = Math.max(0, basicTop - Math.min(already, basicTop));
  const higherRoom = Math.max(0, higherBandWidth - Math.max(0, already - basicTop));

  if (basicRoom > 0 && remaining > 0) {
    const slice = Math.min(remaining, basicRoom);
    tax += slice * rates.basic;
    pieces.push({ band: 'basic', amount: slice, rate: rates.basic });
    remaining -= slice;
    already += slice;
  }
  if (higherRoom > 0 && remaining > 0) {
    const slice = Math.min(remaining, higherRoom);
    tax += slice * rates.higher;
    pieces.push({ band: 'higher', amount: slice, rate: rates.higher });
    remaining -= slice;
    already += slice;
  }
  if (remaining > 0) {
    tax += remaining * rates.additional;
    pieces.push({ band: 'additional', amount: remaining, rate: rates.additional });
    already += remaining;
  }
  return { tax, already, pieces };
}

// Income tax on taxable income (after allowances) split into non-savings, property, savings
// and dividend components, stacked in that order. Property is a separate component only in
// years with property rates (from 2027-28); before that it is part of non-savings. The
// nil rates (starting rate for savings, Personal Savings Allowance, dividend allowance) are
// rates, not deductions: income charged at them still occupies its place in the bands
// (ITA 2007 ss12A, 13A; s12B(8)).
export function incomeTaxOn(nsTaxable, prTaxable, svTaxable, dvTaxable, params) {
  const it = params.incomeTax;
  const sav = params.savings;
  const div = params.dividends;
  const basicTop = it.basicRateLimit;
  const higherTop = Math.max(basicTop, it.additionalRateThreshold);
  const totalTaxable = nsTaxable + prTaxable + svTaxable + dvTaxable;

  // Personal Savings Allowance by status: does any income, nil-rated or not, fall in the
  // higher or additional rate band? (ITA 2007 s12B)
  const status = totalTaxable > higherTop ? 'additional' : totalTaxable > basicTop ? 'higher' : 'basic';

  // Starting rate for savings: reduced £ for £ by taxable income other than savings and
  // dividends (property income included)
  const srsApplied = Math.min(Math.max(0, sav.startingRateBand - (nsTaxable + prTaxable)), svTaxable);
  const psaApplied = Math.min(sav.personalSavingsAllowance[status] || 0, svTaxable - srsApplied);
  const divAllowApplied = Math.min(div.allowance, dvTaxable);

  const slices = [
    { key: 'nonSavings', amount: nsTaxable, rates: it.rates },
    { key: 'property', amount: prTaxable, rates: params.property.rates || it.rates },
    { key: 'savingsStartingRate', amount: srsApplied, rates: NIL },
    { key: 'savingsAllowance', amount: psaApplied, rates: NIL },
    { key: 'savings', amount: svTaxable - srsApplied - psaApplied, rates: sav.rates },
    { key: 'dividendAllowance', amount: divAllowApplied, rates: NIL },
    { key: 'dividends', amount: dvTaxable - divAllowApplied, rates: div.rates },
  ];
  let position = 0;
  const tax = {};
  const rows = [];
  for (const s of slices) {
    tax[s.key] = 0;
    if (!(s.amount > 0)) continue;
    const r = taxThroughBands(s.amount, position, s.rates, basicTop, higherTop);
    tax[s.key] += r.tax;
    position = r.already;
    for (const piece of r.pieces) rows.push({ component: s.key, ...piece });
  }

  // Marriage Allowance recipients must not be liable above the basic rate, counting
  // dividends in the dividend allowance as if taxed (ITA 2007 s55B(2)(b), (ba))
  const maEligible = !rows.some((r) => r.band !== 'basic' && (r.rate > 0 || r.component === 'dividendAllowance'));

  return {
    nonSavingsTax: tax.nonSavings, propertyTax: tax.property, savingsTax: tax.savings, dividendTax: tax.dividends,
    srsApplied, psaApplied, divAllowApplied, totalTaxable, status, maEligible, rows,
  };
}

// Set the allowances (Personal Allowance plus Blind Person's Allowance) against the
// components of income. Other (non-savings) income always comes first. From 2027-28 the law
// requires it (ITA 2007 s25(3A)); before that it is what the greatest-reduction rule picks
// anyway, because that income is taxed at the highest rates in each band and also reduces
// the starting rate for savings.
//
// What is left is set against property, savings and dividends. With "statutoryOrder" it
// goes in that order. With "greatestReduction" (ITA 2007 s25(2), which still governs the
// excess after s25(3A)) it goes wherever it saves the most tax. Tax is piecewise linear in
// the split, so it is enough to try every breakpoint: the allowance put on property (tp),
// and for each tp the allowance put on dividends (td), the rest going on savings.
//
// `cost(split)` returns the income tax for a split, after tax reductions.
function allocateAllowances(allowances, ns, pr, sv, dv, params, cost) {
  const nsTaxable = Math.max(0, ns - allowances);
  const R = Math.max(0, allowances - ns);
  const split = (tp, td) => ({
    nsTaxable,
    prTaxable: Math.max(0, pr - tp),
    svTaxable: Math.max(0, sv - (R - tp - td)),
    dvTaxable: Math.max(0, dv - td),
  });
  // Statutory order: property, then savings, then dividends
  const tpStat = Math.min(R, pr);
  const tdStat = Math.max(0, Math.min(dv, R - tpStat - sv));
  if (params.incomeTax.allowanceAllocation !== 'greatestReduction' || R <= 0) return split(tpStat, tdStat);

  const it = params.incomeTax;
  const total = Math.max(0, nsTaxable + pr + sv + dv - R); // the same whatever the split
  const status = total > Math.max(it.basicRateLimit, it.additionalRateThreshold) ? 'additional'
    : total > it.basicRateLimit ? 'higher' : 'basic';
  const psa = params.savings.personalSavingsAllowance[status] || 0;
  const da = params.dividends.allowance;
  const limits = [it.basicRateLimit, it.additionalRateThreshold];

  // For a given tp, the best td: breakpoints where savings leave their nil-rate slices, where
  // the savings top or the top of the dividend allowance crosses a band limit, and where
  // dividends fall to the allowance.
  const bestTd = (tp) => {
    const Rr = R - tp;
    const lo = Math.max(0, Rr - sv);
    const hi = Math.min(Rr, dv);
    if (hi <= lo) return [Math.max(0, Math.min(lo, hi)), cost(split(tp, Math.max(0, Math.min(lo, hi))))];
    const below = nsTaxable + Math.max(0, pr - tp);
    const nilSavings = Math.max(0, params.savings.startingRateBand - below) + psa;
    const svPoints = [nilSavings];
    for (const limit of limits) svPoints.push(limit - below, limit - below - da);
    const candidates = [hi, dv - da, ...svPoints.map((x) => x - sv + Rr)].filter((t) => t > lo && t <= hi);
    let best = lo;
    let bestCost = cost(split(tp, lo));
    for (const t of candidates) {
      const c = cost(split(tp, t));
      if (c < bestCost - 1e-9) { best = t; bestCost = c; }
    }
    return [best, bestCost];
  };

  // Candidate tp: none or all; property top at a band limit; the property slice ending where
  // the starting rate for savings starts to bite; and leaving exactly the savings nil slices
  // and the dividend allowance uncovered.
  const tpMax = Math.min(R, pr);
  const tpPoints = [0, tpMax];
  if (tpMax > 0) {
    for (const limit of limits) tpPoints.push(pr - (limit - nsTaxable));
    tpPoints.push(pr - (params.savings.startingRateBand - nsTaxable));
    for (const keepSv of [0, psa, params.savings.startingRateBand + psa]) {
      for (const keepDv of [0, da]) tpPoints.push(R - Math.max(0, sv - keepSv) - Math.max(0, dv - keepDv));
    }
  }
  let best = null;
  for (const tp of tpPoints.filter((t) => t >= 0 && t <= tpMax)) {
    const [td, c] = bestTd(tp);
    if (!best || c < best.cost - 1e-9) best = { tp, td, cost: c };
  }
  return split(best.tp, best.td);
}

/**
 * @param {object} inputs
 *   employmentIncome, selfEmployedProfit, savingsInterest, dividends, gainsOther,
 *   gainsResidential: £ a year
 *   propertyProfit: rental profit after expenses, before mortgage interest; £ a year
 *   propertyFinanceCosts: residential mortgage interest and other finance costs; £ a year
 *   salarySacrifice, pensionNetPay: £ a year
 *   blind, marriageAllowanceRecipient, includeEmployerNIC: boolean
 *   children: number of children for Child Benefit; age: years (0 = not given)
 *   reachedStatePensionAge: boolean, used only between the year's spa.askFrom and certainFrom
 * @param {object} params  one of the files in /params
 */
export function computeTax(inputs, params) {
  const it = params.incomeTax;
  const nic = params.nic;

  const bpa = inputs.blind ? it.blindPersonsAllowance : 0;
  const salarySacrifice = inputs.salarySacrifice || 0;
  const pensionNetPay = inputs.pensionNetPay || 0;

  // Employment income after salary sacrifice and net-pay pension contributions
  const employmentIncome = Math.max(0, (inputs.employmentIncome || 0) - (salarySacrifice + pensionNetPay));

  // Self-employment profit: after expenses, or after the trading allowance for those who
  // claim it instead. The allowance replaces expenses, so nothing more comes off here.
  const selfEmployedProfit = Math.max(0, inputs.selfEmployedProfit || 0);

  // Property profit after expenses (or after the property allowance, if claimed instead).
  // Finance costs are not deductible: they get a basic-rate tax reduction below. Before
  // 2027-28 property is ordinary non-savings income.
  const propertyProfit = Math.max(0, inputs.propertyProfit || 0);
  const separateProperty = !!params.property.rates;
  const otherIncome = employmentIncome + selfEmployedProfit;
  const nonSavingsIncome = separateProperty ? otherIncome : otherIncome + propertyProfit;
  const propertyIncome = separateProperty ? propertyProfit : 0;
  const savingsInterest = Math.max(0, inputs.savingsInterest || 0);
  const dividendIncome = Math.max(0, inputs.dividends || 0);

  // Adjusted net income
  const totalIncomeBeforePA = nonSavingsIncome + propertyIncome + savingsInterest + dividendIncome;
  const ANI = Math.max(0, totalIncomeBeforePA);

  // Tax reductions (ITA 2007 s23 Step 6): Marriage Allowance for a recipient who is not
  // liable above the basic rate, then finance cost relief for landlords (ITTOIA 2005 s274A):
  // the relief rate times the lowest of finance costs, property profit and adjusted total
  // income (income other than savings and dividends, after allowances).
  const financeCosts = Math.max(0, inputs.propertyFinanceCosts || 0);
  const reductions = (x, nsT, prT) => {
    const ma = inputs.marriageAllowanceRecipient && x.maEligible ? it.marriageAllowance.credit : 0;
    const fcrBase = Math.min(financeCosts, propertyProfit, nsT + prT);
    const fcr = financeCosts > 0 ? fcrBase * params.property.financeCostReliefRate : 0;
    return { ma, fcr };
  };

  // Personal Allowance (tapered) plus Blind Person's Allowance
  const PA = paAfterTaper(ANI, it);
  const alloc = allocateAllowances(PA + bpa, nonSavingsIncome, propertyIncome, savingsInterest, dividendIncome, params,
    (sp) => {
      const x = incomeTaxOn(sp.nsTaxable, sp.prTaxable, sp.svTaxable, sp.dvTaxable, params);
      const r = reductions(x, sp.nsTaxable, sp.prTaxable);
      return Math.max(0, x.nonSavingsTax + x.propertyTax + x.savingsTax + x.dividendTax - r.ma - r.fcr);
    });
  const nsTaxable = alloc.nsTaxable;
  const svTaxablePreZeroRates = alloc.svTaxable;
  const dvTaxablePreZeroRates = alloc.dvTaxable;

  const itx = incomeTaxOn(nsTaxable, alloc.prTaxable, svTaxablePreZeroRates, dvTaxablePreZeroRates, params);
  const { nonSavingsTax, propertyTax, savingsTax, dividendTax, srsApplied, psaApplied, divAllowApplied } = itx;
  const taxableAfterPA = itx.totalTaxable;

  let incomeTax = round2(nonSavingsTax + propertyTax + savingsTax + dividendTax);
  const componentTaxes = {
    nonSavings: round2(nonSavingsTax), property: round2(propertyTax),
    savings: round2(savingsTax), dividends: round2(dividendTax),
  };

  // Each reduction is limited to the tax left to reduce
  const red = reductions(itx, nsTaxable, alloc.prTaxable);
  const maApplied = red.ma > 0;
  if (maApplied) incomeTax = Math.max(0, round2(incomeTax - red.ma));
  const financeCostRelief = round2(Math.min(incomeTax, red.fcr));
  incomeTax = round2(incomeTax - financeCostRelief);

  // Employee Class 1 NICs. Salary sacrifice comes off the NIC base in full, or only up to
  // the cap in years that set one (from 2029-30: params nic.salarySacrificeCap).
  const ee = nic.class1Employee;
  const sacrificeOffNic = Math.min(salarySacrifice, nic.salarySacrificeCap ?? Infinity);
  const nicBase = Math.max(0, (inputs.employmentIncome || 0) - sacrificeOffNic);
  let eeNIC = 0;
  if (nicBase > ee.primaryThreshold) {
    const mainSlice = Math.min(nicBase, ee.upperEarningsLimit) - ee.primaryThreshold;
    if (mainSlice > 0) eeNIC += mainSlice * ee.mainRate;
    const addSlice = Math.max(0, nicBase - ee.upperEarningsLimit);
    if (addSlice > 0) eeNIC += addSlice * ee.additionalRate;
  }
  eeNIC = round2(eeNIC);

  const age = inputs.age || 0;

  // Class 4 NICs on self-employed profit
  const c4 = nic.class4;
  let seNIC = 0;
  if (selfEmployedProfit > c4.lowerProfitsLimit) {
    const mainSlice = Math.min(selfEmployedProfit, c4.upperProfitsLimit) - c4.lowerProfitsLimit;
    if (mainSlice > 0) seNIC += mainSlice * c4.mainRate;
    const addSlice = Math.max(0, selfEmployedProfit - c4.upperProfitsLimit);
    if (addSlice > 0) seNIC += addSlice * c4.additionalRate;
  }
  seNIC = round2(seNIC);

  // Over State Pension age: no employee Class 1 or Class 4 NICs. While SPA is rising, the
  // year's parameters give the age from which everyone is over it (certainFrom) and the age
  // from which it depends on date of birth (askFrom); in between, the user says.
  const spa = nic.statePensionAge;
  const overSPA = !!age && (age >= spa.certainFrom || (age >= spa.askFrom && !!inputs.reachedStatePensionAge));
  if (overSPA) {
    eeNIC = 0;
    seNIC = 0;
  }

  // Employer Class 1 NICs (optional); under-21s only above the Upper Secondary Threshold
  let erNIC = 0;
  if (inputs.includeEmployerNIC) {
    const er = nic.class1Employer;
    const erBase = Math.max(0, (inputs.employmentIncome || 0) - sacrificeOffNic);
    if (age && age < er.under21Age) {
      const UST = er.upperSecondaryThreshold || er.secondaryThreshold;
      if (erBase > UST) erNIC = round2((erBase - UST) * er.rate);
    } else if (erBase > er.secondaryThreshold) {
      erNIC = round2((erBase - er.secondaryThreshold) * er.rate);
    }
  }

  // Capital gains: annual exempt amount to residential property first, then other gains.
  // Gains use up whatever basic rate band income has left.
  const cgt = params.cgt;
  let remainingAEA = cgt.annualExemptAmount;
  const gainsOther = Math.max(0, inputs.gainsOther || 0);
  const gainsRes = Math.max(0, inputs.gainsResidential || 0);
  const propAEA = Math.min(remainingAEA, gainsRes); remainingAEA -= propAEA;
  const otherAEA = Math.min(remainingAEA, gainsOther); remainingAEA -= otherAEA;

  // All taxable income, including income charged at nil rates, uses up the basic rate band
  let basicRoomForCGT = Math.max(0, it.basicRateLimit - taxableAfterPA);

  const propTaxable = Math.max(0, gainsRes - propAEA);
  const propInBasic = Math.min(propTaxable, basicRoomForCGT);
  let cgtPropTax = propInBasic * cgt.rates.basic + (propTaxable - propInBasic) * cgt.rates.higher;
  basicRoomForCGT = Math.max(0, basicRoomForCGT - propInBasic);

  const otherTaxable = Math.max(0, gainsOther - otherAEA);
  const otherInBasic = Math.min(otherTaxable, basicRoomForCGT);
  let cgtOtherTax = otherInBasic * cgt.rates.basic + (otherTaxable - otherInBasic) * cgt.rates.higher;

  cgtPropTax = round2(cgtPropTax);
  cgtOtherTax = round2(cgtOtherTax);
  const cgtTotal = round2(cgtPropTax + cgtOtherTax);

  const hicbc = round2(hicbcCharge(ANI, inputs.children || 0, params));

  // Totals. Employer NICs count at the assumed share borne by the employee.
  const totalPersonalNIC = round2(eeNIC + seNIC);
  const totalTax = round2(
    incomeTax
    + totalPersonalNIC
    + (inputs.includeEmployerNIC ? erNIC * params.assumptions.employerNicIncidence : 0)
    + cgtTotal
    + hicbc
  );
  const totalIncome = (inputs.employmentIncome || 0) + (inputs.selfEmployedProfit || 0)
    + (inputs.savingsInterest || 0) + (inputs.dividends || 0) + propertyProfit;
  // Average rate: total tax over everything it is charged on, so both share one base. That is
  // all income and gains entered, plus the employer NI counted as the user's when it is on.
  const employerNicBorne = inputs.includeEmployerNIC ? erNIC * params.assumptions.employerNicIncidence : 0;
  const rateBase = totalIncome + gainsOther + gainsRes + employerNicBorne;
  const effectiveRate = rateBase > 0 ? round2(totalTax / rateBase * 100) : 0;

  return {
    breakdown: {
      incomeTax,
      componentTaxes,
      eeNIC,
      seNIC,
      totalPersonalNIC,
      erNIC,
      cgt: cgtTotal,
      cgtProperty: cgtPropTax,
      cgtOther: cgtOtherTax,
      hicbc,
      reducers: {
        marriageAllowanceApplied: maApplied,
        marriageAllowanceValue: maApplied ? it.marriageAllowance.credit : 0,
        financeCostRelief,
      },
      zeroRateSavings: { srsApplied, psaApplied, divAllowanceApplied: divAllowApplied },
    },
    totals: { totalTax, totalIncome, effectiveRatePct: effectiveRate },
    internals: { ANI, PA, taxableAfterPA },
    // Band-by-band income tax, for the breakdown table (not part of the golden master)
    detail: {
      incomeTaxBands: itx.rows,
      savingsStatus: itx.status,
      allowances: { personalAllowance: PA, blindPersonsAllowance: bpa },
      nic: nicDetail(nicBase, selfEmployedProfit, overSPA, erNIC, inputs, params),
      cgt: [
        { component: 'residential', band: 'basic', amount: propInBasic, rate: cgt.rates.basic },
        { component: 'residential', band: 'higher', amount: propTaxable - propInBasic, rate: cgt.rates.higher },
        { component: 'other', band: 'basic', amount: otherInBasic, rate: cgt.rates.basic },
        { component: 'other', band: 'higher', amount: otherTaxable - otherInBasic, rate: cgt.rates.higher },
      ].filter((r) => r.amount > 0),
      cgtExempt: { residential: propAEA, other: otherAEA },
      hicbc: hicbcDetail(ANI, inputs.children || 0, params),
      rateBase,
      employerNicBorne,
    },
  };
}
