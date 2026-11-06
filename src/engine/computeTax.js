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
// components of income. ITA 2007 s25(2): "in the way which will result in the greatest
// reduction" in tax. From 2027-28 s25(3A) adds that they go against income other than
// property, savings and dividends first (params incomeTax.otherIncomeFirst); before that
// even other income is a free choice, because a little allowance set against savings or
// dividends can lift their nil-rate amounts out of the basic rate band.
//
// So one component is fixed (other income from 2027-28, nothing before) and the rest is
// split three ways: x on the first free component (property from 2027-28, other income
// before; property is part of other income until then), td on dividends, the remainder on
// savings. Tax is piecewise linear in (x, td), and every kink lies on a line x = c, td = c
// or x + td = c (where a component's top, or the end of a nil-rate amount, meets a band
// limit, the starting rate band or an amount's size). The lowest tax is therefore at a
// crossing of two such lines, and trying every crossing finds it exactly.
//
// `cost(split)` returns the income tax for a split, after tax reductions. Ties keep the
// statutory order (first free component, then savings, then dividends).
function allocateAllowances(allowances, ns, pr, sv, dv, params, cost) {
  const it = params.incomeTax;
  const otherFirst = !!it.otherIncomeFirst;
  if (!otherFirst && pr > 0) throw new Error('Property is a separate component only in years where s25(3A) applies');
  const nsFixed = otherFirst ? Math.min(allowances, ns) : 0;
  const R = Math.min(allowances, ns + pr + sv + dv) - nsFixed; // allowance left to place
  const X = otherFirst ? pr : ns;     // the first free component
  const below = otherFirst ? ns - nsFixed : 0; // taxable income stacked under it
  const split = (x, td) => ({
    nsTaxable: otherFirst ? ns - nsFixed : ns - x,
    prTaxable: otherFirst ? pr - x : 0,
    svTaxable: sv - (R - x - td),
    dvTaxable: dv - td,
  });
  // Statutory order: the first free component, then savings, then dividends
  const xStat = Math.min(R, X);
  const tdStat = Math.max(0, Math.min(dv, R - xStat - sv));
  if (it.allowanceAllocation !== 'greatestReduction' || R <= 0) return split(xStat, tdStat);

  const total = below + X + sv + dv - R; // the same whatever the split
  const status = total > Math.max(it.basicRateLimit, it.additionalRateThreshold) ? 'additional'
    : total > it.basicRateLimit ? 'higher' : 'basic';
  const psa = params.savings.personalSavingsAllowance[status] || 0;
  const da = params.dividends.allowance;
  const srb = params.savings.startingRateBand;
  const limits = [it.basicRateLimit, it.additionalRateThreshold];

  // Top of the first free component: below + X - x. Top of savings: below + X + sv - R + td.
  const xLines = [0, Math.min(R, X), ...[...limits, srb, ...limits.map((l) => l - psa)].map((l) => below + X - l)];
  const tdLines = [0, Math.min(R, dv), dv - da,
    ...[...limits, srb, srb + psa, ...limits.map((l) => l - da)].map((l) => l - (below + X + sv - R))];
  const sumLines = [R, R - sv, R - sv + psa]; // savings taxable of 0, sv and psa
  const xs = new Set([...xLines, ...sumLines.flatMap((s) => tdLines.map((t) => s - t))]);

  let best = split(xStat, tdStat);
  let bestCost = cost(best);
  for (const x of xs) {
    if (!(x >= 0 && x <= Math.min(R, X))) continue;
    for (const td of new Set([...tdLines, ...sumLines.map((s) => s - x)])) {
      if (!(td >= 0 && td <= Math.min(R, dv)) || R - x - td < 0 || R - x - td > sv) continue;
      const sp = split(x, td);
      const c = cost(sp);
      if (c < bestCost - 1e-9) { best = sp; bestCost = c; }
    }
  }
  return best;
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
  // liable above the basic rate, then finance cost relief for landlords (ITTOIA 2005
  // s274AA): the relief rate times the lowest of finance costs, property profit and adjusted
  // total income. That is net income less savings and dividends, less every allowance
  // deducted at Step 3 wherever it was set (s274AA(6)), so it doesn't depend on the split.
  const financeCosts = Math.max(0, inputs.propertyFinanceCosts || 0);
  const PA = paAfterTaper(ANI, it);
  const allowancesDeducted = Math.min(PA + bpa, ANI);
  const adjustedTotalIncome = Math.max(0, nonSavingsIncome + propertyIncome - allowancesDeducted);
  const reductions = (x) => {
    const ma = inputs.marriageAllowanceRecipient && x.maEligible ? it.marriageAllowance.credit : 0;
    const fcrBase = Math.min(financeCosts, propertyProfit, adjustedTotalIncome);
    const fcr = financeCosts > 0 ? fcrBase * params.property.financeCostReliefRate : 0;
    return { ma, fcr };
  };

  // Personal Allowance (tapered, above) plus Blind Person's Allowance
  const alloc = allocateAllowances(PA + bpa, nonSavingsIncome, propertyIncome, savingsInterest, dividendIncome, params,
    (sp) => {
      const x = incomeTaxOn(sp.nsTaxable, sp.prTaxable, sp.svTaxable, sp.dvTaxable, params);
      const r = reductions(x);
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
  const red = reductions(itx);
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
