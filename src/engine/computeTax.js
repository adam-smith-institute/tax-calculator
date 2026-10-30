// ASI tax engine (England and Northern Ireland).
//
// computeTax(inputs, params) is pure: no DOM, no globals, no I/O. Every rate and threshold
// comes from `params` (one JSON file per tax year in /params). All amounts are annual £.
//
// This is a port of compute() in legacy/original.html. Phase 1 requires it to reproduce
// the original to the penny on every field (tests/golden/as-shipped.json), so the
// arithmetic follows the original's expressions and their order; do not "tidy" an
// expression without re-running the golden master.

export const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

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

function hicbcCharge(ani, nChildren, params) {
  const { thresholdStart: start, thresholdEnd: end, stepPounds, percentPerStep } = params.hicbc;
  const cb = childBenefitAnnual(nChildren, params.childBenefit);
  if (cb <= 0) return 0;
  if (ani <= start) return 0;
  if (ani >= end) return round2(cb);
  const over = ani - start;
  const pct = clamp((over / stepPounds) * percentPerStep, 0, 1);
  return round2(cb * pct);
}

// Taxpayer status for the Personal Savings Allowance and Marriage Allowance tests.
function taxpayerBand(totalTaxableAfterPA, it) {
  if (totalTaxableAfterPA <= it.higherRateThreshold - it.personalAllowance) return 'basic';
  if (totalTaxableAfterPA <= it.additionalRateThreshold - it.personalAllowance) return 'higher';
  return 'additional';
}

// Tax `amount` through the basic, higher and additional bands at `rates`, given that
// `already` of taxable income (after allowances) has been taxed below it. Band limits
// are in taxable-income space: basic up to basicTop, higher up to higherTop.
function taxThroughBands(amount, already, rates, basicTop, higherTop) {
  let tax = 0;
  let remaining = amount;
  const higherBandWidth = Math.max(0, higherTop - basicTop);
  const basicRoom = Math.max(0, basicTop - Math.min(already, basicTop));
  const higherRoom = Math.max(0, higherBandWidth - Math.max(0, already - basicTop));

  if (basicRoom > 0 && remaining > 0) {
    const slice = Math.min(remaining, basicRoom);
    tax += slice * rates.basic;
    remaining -= slice;
    already += slice;
  }
  if (higherRoom > 0 && remaining > 0) {
    const slice = Math.min(remaining, higherRoom);
    tax += slice * rates.higher;
    remaining -= slice;
    already += slice;
  }
  if (remaining > 0) {
    tax += remaining * rates.additional;
    already += remaining;
  }
  return { tax, already };
}

/**
 * @param {object} inputs
 *   employmentIncome, selfEmployedProfit, savingsInterest, dividends, gainsOther,
 *   gainsResidential: £ a year
 *   salarySacrifice, pensionNetPay: £ a year
 *   blind, marriageAllowanceRecipient, includeEmployerNIC: boolean
 *   children: number of children for Child Benefit; age: years (0 = not given)
 * @param {object} params  one of the files in /params
 */
export function computeTax(inputs, params) {
  const it = params.incomeTax;
  const sav = params.savings;
  const div = params.dividends;
  const nic = params.nic;

  const bpa = inputs.blind ? it.blindPersonsAllowance : 0;
  const salarySacrifice = inputs.salarySacrifice || 0;
  const pensionNetPay = inputs.pensionNetPay || 0;

  // Employment income after salary sacrifice and net-pay pension contributions
  const employmentIncome = Math.max(0, (inputs.employmentIncome || 0) - (salarySacrifice + pensionNetPay));

  // Self-employment profit less the trading allowance
  const rawSelfEmployedProfit = Math.max(0, inputs.selfEmployedProfit || 0);
  const tradingAllowance = Math.min(params.selfEmployment.tradingAllowance, rawSelfEmployedProfit);
  const selfEmployedProfit = Math.max(0, rawSelfEmployedProfit - tradingAllowance);

  const nonSavingsIncome = employmentIncome + selfEmployedProfit;
  const savingsInterest = Math.max(0, inputs.savingsInterest || 0);
  const dividendIncome = Math.max(0, inputs.dividends || 0);

  // Adjusted net income
  const totalIncomeBeforePA = nonSavingsIncome + savingsInterest + dividendIncome;
  const ANI = Math.max(0, totalIncomeBeforePA);

  // Personal Allowance (tapered) plus Blind Person's Allowance, set against
  // non-savings income first, then savings, then dividends
  const PA = paAfterTaper(ANI, it);
  let remainingAllowance = PA + bpa;
  const applyAllowance = (amount) => {
    const used = Math.min(remainingAllowance, amount);
    remainingAllowance -= used;
    return amount - used;
  };
  const nsTaxable = applyAllowance(nonSavingsIncome);
  const svTaxablePreZeroRates = applyAllowance(savingsInterest);
  const dvTaxablePreZeroRates = applyAllowance(dividendIncome);

  // Starting rate for savings: reduced £ for £ by taxable non-savings income
  const srsAvail = Math.max(0, sav.startingRateBand - nsTaxable);
  const srsApplied = Math.min(srsAvail, svTaxablePreZeroRates);
  const savingsAfterSRS = svTaxablePreZeroRates - srsApplied;

  // Personal Savings Allowance, by taxpayer status
  const taxableAfterPA = nsTaxable + savingsAfterSRS + dvTaxablePreZeroRates;
  const band = taxpayerBand(taxableAfterPA, it);
  const PSA = sav.personalSavingsAllowance[band] || 0;
  const psaApplied = Math.min(PSA, savingsAfterSRS);
  const savingsAfterPSA = savingsAfterSRS - psaApplied;

  // Dividend allowance
  const divAllowApplied = Math.min(div.allowance, dvTaxablePreZeroRates);
  const dividendsAfterAllowance = dvTaxablePreZeroRates - divAllowApplied;

  // Band limits in taxable-income space
  const basicLimitExt = it.basicRateLimit;
  const higherTop = Math.max(basicLimitExt, it.additionalRateThreshold);

  // Non-savings, then savings, then dividends, each at its own rates
  let alreadyTaxed = 0;
  let nonSavingsTax = 0;
  if (nsTaxable > 0) {
    const r = taxThroughBands(nsTaxable, alreadyTaxed, it.rates, basicLimitExt, higherTop);
    nonSavingsTax += r.tax;
    alreadyTaxed = r.already;
  }
  let savingsTax = 0;
  if (savingsAfterPSA > 0) {
    const r = taxThroughBands(savingsAfterPSA, alreadyTaxed, sav.rates, basicLimitExt, higherTop);
    savingsTax += r.tax;
    alreadyTaxed = r.already;
  }
  let dividendTax = 0;
  if (dividendsAfterAllowance > 0) {
    const r = taxThroughBands(dividendsAfterAllowance, alreadyTaxed, div.rates, basicLimitExt, higherTop);
    dividendTax += r.tax;
    alreadyTaxed = r.already;
  }

  let incomeTax = round2(nonSavingsTax + savingsTax + dividendTax);
  const componentTaxes = { nonSavings: round2(nonSavingsTax), savings: round2(savingsTax), dividends: round2(dividendTax) };

  // Marriage Allowance (recipient): a tax reduction, if a basic-rate taxpayer
  const maApplied = !!inputs.marriageAllowanceRecipient && taxpayerBand(taxableAfterPA, it) === 'basic';
  if (maApplied) incomeTax = Math.max(0, round2(incomeTax - it.marriageAllowance.credit));

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

  // Over State Pension age: no employee Class 1 or Class 4 NICs
  if (age && age >= nic.statePensionAge) {
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

  let basicRoomForCGT = Math.max(0, basicLimitExt - taxableAfterPA);

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
    + (inputs.savingsInterest || 0) + (inputs.dividends || 0);
  const effectiveRate = totalIncome > 0 ? round2(totalTax / totalIncome * 100) : 0;

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
      },
      zeroRateSavings: { srsApplied, psaApplied, divAllowanceApplied: divAllowApplied },
    },
    totals: { totalTax, totalIncome, effectiveRatePct: effectiveRate },
    internals: { ANI, PA, taxableAfterPA },
  };
}
