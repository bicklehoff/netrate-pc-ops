import { PLF_TABLE } from './plf-table';
import { DEFAULT_FHA_LIMIT, DEFAULT_MIP_RATE, FOA_PLF_CORRECTION } from './constants';
import { ASL_PRICING, MH_FIXED_RATES, getLLPAAdjustment, getASLPricing } from './rate-sheet';

// ============================================
// PLF LOOKUP
// Two modes:
//   round (default) — rounds to nearest 0.125%, matches interactive calc / old index.html
//   floor + FOA correction — floors to nearest 0.125%, applies correction, matches LOS
// ============================================
export function lookupPLF(expectedRate, age, { useFloor = false, applyCorrection = false } = {}) {
  if (!PLF_TABLE) return null;
  const clampedAge = Math.min(Math.max(Math.floor(age), 62), 99);

  let rounded;
  if (useFloor) {
    rounded = Math.floor(expectedRate / 0.125) * 0.125;
  } else {
    rounded = Math.round(expectedRate * 8) / 8;
  }
  const clamped = Math.min(Math.max(rounded, 3.0), 18.875);
  const key = clamped.toFixed(3);

  let plf = null;
  if (PLF_TABLE[key] && PLF_TABLE[key][clampedAge] !== undefined) {
    plf = PLF_TABLE[key][clampedAge];
  } else {
    const key2 = parseFloat(clamped).toFixed(3);
    if (PLF_TABLE[key2] && PLF_TABLE[key2][clampedAge] !== undefined) {
      plf = PLF_TABLE[key2][clampedAge];
    }
  }

  if (plf !== null && applyCorrection) {
    plf = plf * FOA_PLF_CORRECTION;
  }

  return plf;
}

// ============================================
// ORIGINATION FEE (HUD formula)
// ============================================
export function calcOriginationFee(homeValue) {
  let fee;
  if (homeValue <= 200000) {
    fee = homeValue * 0.02;
  } else {
    fee = 200000 * 0.02 + (homeValue - 200000) * 0.01;
  }
  return Math.min(Math.max(fee, 2500), 6000);
}

// ============================================
// AGE CALCULATIONS
// ============================================
export function calcAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function getYoungestAge(borrowerDOB, coBorrowerDOB) {
  const a1 = calcAge(borrowerDOB);
  const a2 = calcAge(coBorrowerDOB);
  if (a1 !== null && a2 !== null) return Math.min(a1, a2);
  return a1 || a2;
}

// ============================================
// ARM SCENARIO CALCULATION
// ============================================
export function calculateARMScenario({
  margin, oneYearCMT, tenYearCMT, mipRate = DEFAULT_MIP_RATE,
  homeValue, fhaLimit = DEFAULT_FHA_LIMIT,
  existingLiens = 0, origFee = 0, thirdPartyCosts = 0, lenderCredit = 0,
  age, productType = 'cmtMonthlyCap5',
}) {
  // Note rate = 1yr CMT + margin (the actual accrual rate on the ARM)
  // Expected rate = 10yr CMT + margin (HUD's long-term projection for PLF lookup)
  const noteRate = oneYearCMT ? oneYearCMT + margin : null;
  const expectedRate = tenYearCMT ? tenYearCMT + margin : (oneYearCMT ? oneYearCMT + margin : null);
  if (expectedRate === null) return null;
  const effectiveRate = expectedRate + mipRate;
  const capAmount = productType === 'cmtMonthlyCap5' ? 5 : 10;
  const lifetimeCap = noteRate !== null ? noteRate + capAmount : null;

  const plf = lookupPLF(expectedRate, age);
  if (plf === null) return null;

  const mca = Math.min(homeValue, fhaLimit);
  const principalLimit = mca * plf;
  const ufmip = mca * 0.02;
  const totalCosts = ufmip + origFee + thirdPartyCosts - lenderCredit;
  const netPL = principalLimit - totalCosts;
  const cashToBorrower = netPL - existingLiens;
  const mandatoryObligations = existingLiens + totalCosts;
  const sixtyPctLimit = principalLimit * 0.60;
  const initialDrawLimit = Math.max(sixtyPctLimit, mandatoryObligations + principalLimit * 0.10);
  const locGrowthRate = noteRate !== null ? noteRate + mipRate : null;

  // Line of Credit breakdown
  const locYear1 = Math.max(initialDrawLimit - mandatoryObligations, 0);
  const locAfterYear1 = Math.max(netPL - existingLiens - locYear1, 0);

  // Projected LOC growth
  const locBase = Math.max(cashToBorrower, 0);
  const gr = locGrowthRate !== null ? locGrowthRate / 100 : 0;
  const locProj5 = locBase * Math.pow(1 + gr, 5);
  const locProj10 = locBase * Math.pow(1 + gr, 10);
  const locProj15 = locBase * Math.pow(1 + gr, 15);
  const locProj20 = locBase * Math.pow(1 + gr, 20);

  // Broker Compensation
  const upb = totalCosts + existingLiens + Math.max(cashToBorrower, 0);
  const pluPct = principalLimit > 0 ? Math.min((upb / principalLimit) * 100, 100) : 0;
  const aslPriceRaw = getASLPricing(ASL_PRICING, margin, pluPct);
  const llpaAdj = getLLPAAdjustment(age);
  const aslPrice = aslPriceRaw ? aslPriceRaw + llpaAdj : null;
  const yspBps = aslPrice ? aslPrice - 100 : null;
  const yspDollar = (yspBps !== null && upb > 0) ? (yspBps / 100) * upb : null;
  const totalComp = (yspDollar || 0) + origFee - lenderCredit;

  return {
    productType, margin,
    noteRate, expectedRate, effectiveRate, lifetimeCap,
    plf, mca, principalLimit, ufmip, origFee,
    thirdPartyCosts, lenderCredit, totalCosts, netPL,
    cashToBorrower, mandatoryObligations,
    initialDrawLimit, locYear1, locAfterYear1,
    locGrowthRate, annualCostPct: effectiveRate,
    locProj5, locProj10, locProj15, locProj20,
    upb, pluPct, aslPrice, aslPriceRaw, llpaAdj, yspBps, yspDollar, totalComp,
  };
}

// ============================================
// FIXED SCENARIO CALCULATION
// ============================================
export function calculateFixedScenario({
  fixedRate, mipRate = DEFAULT_MIP_RATE,
  homeValue, fhaLimit = DEFAULT_FHA_LIMIT,
  existingLiens = 0, origFee = 0, thirdPartyCosts = 0, lenderCredit = 0,
  age,
}) {
  const noteRate = fixedRate;
  const expectedRate = fixedRate;
  const effectiveRate = fixedRate + mipRate;

  const plf = lookupPLF(fixedRate, age);
  if (plf === null) return null;

  const mca = Math.min(homeValue, fhaLimit);
  const principalLimit = mca * plf;
  const ufmip = mca * 0.02;
  const totalCosts = ufmip + origFee + thirdPartyCosts - lenderCredit;
  const netPL = principalLimit - totalCosts;
  const cashToBorrower = netPL - existingLiens;

  // Fixed broker comp: Lender Paid plan
  const fixedRateInfo = MH_FIXED_RATES.find(fr => Math.abs(fr.rate - fixedRate) < 0.005);
  const fixedPrice = fixedRateInfo ? fixedRateInfo.lenderPaidPrice : null;
  const fixedYspBps = fixedPrice ? fixedPrice - 100 : null;
  const fixedUPB = totalCosts + existingLiens + Math.max(cashToBorrower, 0);
  const fixedYspDollar = (fixedYspBps !== null && fixedUPB > 0) ? (fixedYspBps / 100) * fixedUPB : null;
  const fixedPluPct = principalLimit > 0 ? Math.min((fixedUPB / principalLimit) * 100, 100) : 0;
  const totalComp = (fixedYspDollar || 0) + origFee - lenderCredit;

  return {
    productType: 'fixed', margin: null,
    noteRate, expectedRate, effectiveRate, lifetimeCap: null,
    plf, mca, principalLimit, ufmip, origFee,
    thirdPartyCosts, lenderCredit, totalCosts, netPL,
    cashToBorrower, mandatoryObligations: existingLiens + totalCosts,
    initialDrawLimit: null, locYear1: null, locAfterYear1: null,
    locGrowthRate: null, annualCostPct: effectiveRate,
    locProj5: null, locProj10: null, locProj15: null, locProj20: null,
    upb: fixedUPB, pluPct: fixedPluPct,
    aslPrice: fixedPrice, aslPriceRaw: fixedPrice, llpaAdj: null,
    yspBps: fixedYspBps, yspDollar: fixedYspDollar, totalComp,
    fixedMHFee: fixedRateInfo ? fixedRateInfo.mhFee : null,
  };
}

// ============================================
// CALCULATE ALL 3 SCENARIOS
// ============================================
export function calculateAllScenarios(state) {
  const age = getYoungestAge(state.borrowerDOB, state.coBorrowerDOB);
  if (!age || !state.homeValue) return [null, null, null];

  const results = [];
  for (let i = 0; i < 3; i++) {
    const common = {
      homeValue: state.homeValue,
      fhaLimit: state.fhaLimit || DEFAULT_FHA_LIMIT,
      existingLiens: state.existingLiens || 0,
      origFee: state.origFee || 0,
      thirdPartyCosts: state.thirdPartyCosts || 0,
      lenderCredit: state.lenderCredit || 0,
      mipRate: state.mipRate ?? DEFAULT_MIP_RATE,
      age,
    };

    if (state.productTypes[i] === 'fixed') {
      if (!state.fixedRates[i]) {
        results.push(null);
        continue;
      }
      results.push(calculateFixedScenario({ ...common, fixedRate: state.fixedRates[i] }));
    } else {
      const hasIndex = (state.oneYearCMT > 0) || (state.tenYearCMT > 0);
      if (!hasIndex || !state.margins[i]) {
        results.push(null);
        continue;
      }
      results.push(calculateARMScenario({
        ...common,
        margin: state.margins[i],
        oneYearCMT: state.oneYearCMT,
        tenYearCMT: state.tenYearCMT,
        productType: state.productTypes[i],
      }));
    }
  }
  return results;
}
