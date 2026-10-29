// Deterministic test-case generator for the golden master.
//
// Each case has `ui` (what a user would type into the original page, with pension
// contributions as percentages) and `inputs` (the exact object the original
// window.computeTaxes() would pass to compute()). The derivation below copies the
// expressions in legacy/original.html lines 2286-2317 so the floating-point values match.

export const THRESHOLDS = [5000, 12570, 37700, 50270, 60000, 80000, 100000, 112570, 125140];
export const AGES = [18, 20, 21, 40, 65, 66, 70];

// mulberry32: small, fast, seedable PRNG
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_UI = {
  age: 40, empInc: 0, seInc: 0, pensSacPct: 0, pensEmpPct: 0,
  marriage: false, blind: false, divInc: 0, savInc: 0,
  cgtGain: 0, cgtProp: 0, cbKids: 0, incErNI: false,
};

// Mirrors window.computeTaxes() in the original (readNumber: +value || 0).
export function uiToInputs(ui, engineOnly = {}) {
  const grossEmployment = +ui.empInc || 0;
  const pensSacPct = (+ui.pensSacPct || 0) / 100;
  const pensEmpPct = (+ui.pensEmpPct || 0) / 100;
  const salarySacrifice = Math.max(0, grossEmployment * pensSacPct);
  const pensionNetPay = Math.max(0, grossEmployment * pensEmpPct);
  return {
    employmentIncome: grossEmployment,
    selfEmployedProfit: +ui.seInc || 0,
    savingsInterest: +ui.savInc || 0,
    dividends: +ui.divInc || 0,
    gainsOther: +ui.cgtGain || 0,
    gainsResidential: +ui.cgtProp || 0,
    carriedInterest: engineOnly.carriedInterest || 0,
    salarySacrifice,
    pensionNetPay,
    pensionRASNet: engineOnly.pensionRASNet || 0,
    blind: !!ui.blind,
    marriageAllowanceRecipient: !!ui.marriage,
    children: +(ui.cbKids || 0),
    age: +ui.age || 0,
    includeEmployerNIC: !!ui.incErNI,
  };
}

export function generateCases(seed = 20261029, randomCount = 6000) {
  const cases = [];
  const add = (group, uiPatch, engineOnly) => {
    const ui = { ...BASE_UI, ...uiPatch };
    cases.push({
      id: cases.length,
      group,
      ui,
      ...(engineOnly ? { engineOnly } : {}),
      inputs: uiToInputs(ui, engineOnly),
    });
  };

  // 1. Every threshold, -£1 / exact / +£1, through each income type and the
  //    toggles that interact with thresholds.
  for (const t of THRESHOLDS) {
    for (const d of [-1, 0, 1]) {
      const v = t + d;
      add('threshold:employment', { empInc: v });
      add('threshold:employment+erNI', { empInc: v, incErNI: true });
      add('threshold:employment+2kids', { empInc: v, cbKids: 2 });
      add('threshold:employment+marriage', { empInc: v, marriage: true });
      add('threshold:employment+blind', { empInc: v, blind: true });
      add('threshold:employment+savings2k', { empInc: v, savInc: 2000 });
      add('threshold:employment+dividends3k', { empInc: v, divInc: 3000 });
      add('threshold:employment+gains20k', { empInc: v, cgtGain: 20000, cgtProp: 10000 });
      add('threshold:self-employment', { seInc: v });
      add('threshold:dividends', { divInc: v });
      add('threshold:savings', { savInc: v });
      add('threshold:employment-under21-erNI', { empInc: v, age: 20, incErNI: true });
      // total income at the threshold, split between salary and investment income
      add('threshold:split-savings', { empInc: Math.max(0, v - 8000), savInc: 8000 });
      add('threshold:split-dividends', { empInc: Math.max(0, v - 8000), divInc: 8000 });
    }
  }

  // 2. Every toggle and age band.
  const incomes = [0, 9000, 15000, 30000, 55000, 70000, 110000, 200000];
  for (const age of AGES) {
    for (const incErNI of [false, true]) {
      for (const marriage of [false, true]) {
        for (const blind of [false, true]) {
          for (const empInc of incomes) {
            for (const cbKids of [0, 2]) {
              add('toggles', { age, incErNI, marriage, blind, empInc, cbKids });
            }
          }
        }
      }
    }
  }
  for (const age of AGES) {
    for (const seInc of [5000, 20000, 60000]) add('toggles:self-employed-age', { age, seInc });
    for (const pensSacPct of [5, 10]) add('toggles:salary-sacrifice-age', { age, empInc: 45000, pensSacPct, incErNI: true });
  }
  // A blank age field reads as 0 in the original
  add('toggles:age-blank', { age: 0, empInc: 40000, incErNI: true });
  add('toggles:age-blank-se', { age: 0, seInc: 40000 });

  // 3. Seeded random combinations across all inputs.
  const r = rng(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const chance = (p) => r() < p;
  // Mostly round pounds (the inputs step in £100s), sometimes pence
  const money = (max) => {
    const scale = pick([1000, 10000, 50000, 100000, max]);
    let v = r() * Math.min(scale, max);
    if (chance(0.15)) return Math.round(v * 100) / 100;
    if (chance(0.5)) return Math.round(v / 100) * 100;
    return Math.round(v);
  };
  const nearThreshold = () => pick(THRESHOLDS) + Math.round((r() - 0.5) * 4000);
  for (let i = 0; i < randomCount; i++) {
    const ui = {
      age: chance(0.6) ? pick(AGES) : 16 + Math.floor(r() * 75),
      empInc: chance(0.7) ? (chance(0.25) ? nearThreshold() : money(400000)) : 0,
      seInc: chance(0.3) ? (chance(0.2) ? nearThreshold() : money(250000)) : 0,
      pensSacPct: chance(0.3) ? Math.round(r() * 40) / 2 : 0,
      pensEmpPct: chance(0.3) ? Math.round(r() * 30) / 2 : 0,
      marriage: chance(0.15),
      blind: chance(0.1),
      divInc: chance(0.3) ? money(200000) : 0,
      savInc: chance(0.3) ? money(80000) : 0,
      cgtGain: chance(0.2) ? money(300000) : 0,
      cgtProp: chance(0.12) ? money(300000) : 0,
      cbKids: chance(0.25) ? 1 + Math.floor(r() * 5) : 0,
      incErNI: chance(0.5),
    };
    add('random', ui);
  }

  // 4. Engine paths the page has no input for (carried interest, relief-at-source
  //    pension). Run through compute() only, so the port covers every branch.
  for (let i = 0; i < 150; i++) {
    const ui = {
      empInc: money(300000), divInc: chance(0.4) ? money(100000) : 0,
      savInc: chance(0.4) ? money(50000) : 0, cgtGain: chance(0.4) ? money(100000) : 0,
      cgtProp: chance(0.3) ? money(100000) : 0, age: pick(AGES),
    };
    add('engine-only:carried-interest', ui, { carriedInterest: money(500000) });
    add('engine-only:ras-pension', ui, { pensionRASNet: money(40000) });
  }

  return cases;
}
