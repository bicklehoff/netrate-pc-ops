import { PLF_TABLE } from './plf-table';
import { FOA_PLF_CORRECTION } from './constants';
import { FOA_PRICING } from './rate-sheet';

// Floor rate to nearest 0.125% increment (matches LOS behavior)
function floorToEighth(rate) {
  return Math.floor(rate / 0.125) * 0.125;
}

// Find PLF key — floor to nearest 0.125%, then find closest table key
function findPlfKey(rate) {
  const floored = floorToEighth(rate);
  const target = floored.toFixed(3);
  let bestKey = null;
  let bestDiff = 999;
  for (const k of Object.keys(PLF_TABLE)) {
    const diff = Math.abs(parseFloat(k) - parseFloat(target));
    if (diff < bestDiff) {
      bestDiff = diff;
      bestKey = k;
    }
  }
  return bestKey;
}

// PLU bucket index: 0-10% → 0, 10-20% → 1, ..., 90-100% → 9
function getPluBucket(plu) {
  if (plu <= 0) return 0;
  return Math.min(Math.floor(plu * 10), 9);
}

/**
 * Run margin sweep across all FOA rate sheet margins.
 * Returns rows for every margin, plus sweet spot analysis.
 */
export function runOptimizerSweep({
  age,
  homeValue,
  fhaLimit = 1209750,
  existingLiens = 0,
  origFee = 0,
  thirdPartyCosts = 0,
  oneYearCMT,
  tenYearCMT,
  mipRate = 0.50,
  targetComp = 5000,
}) {
  const mca = Math.min(homeValue, fhaLimit);
  const ufmip = mca * 0.02;
  const mandatoryObligations = existingLiens + ufmip + origFee + thirdPartyCosts;

  const margins = Object.keys(FOA_PRICING)
    .map(k => parseFloat(k))
    .sort((a, b) => a - b);

  const rows = [];

  for (const marginNum of margins) {
    const margin = marginNum.toFixed(3);
    const expectedRate = tenYearCMT + marginNum;
    const initialRate = oneYearCMT ? oneYearCMT + marginNum : null;

    const plfKey = findPlfKey(expectedRate);
    const plfRaw = PLF_TABLE[plfKey]?.[Math.min(Math.max(Math.floor(age), 62), 99)];
    if (!plfRaw) {
      rows.push({ margin, viable: false, reason: 'No PLF data' });
      continue;
    }

    const plf = plfRaw * FOA_PLF_CORRECTION;
    const pl = mca * plf;
    const plu = mandatoryObligations / pl;

    if (plu > 1.0) {
      rows.push({
        margin, viable: false, reason: 'Shortfall',
        expectedRate, plf, pl, mandatoryObligations, plu,
      });
      continue;
    }

    const bucket = getPluBucket(plu);
    const premium = FOA_PRICING[marginNum][bucket];
    const upb = mandatoryObligations;
    const compDollars = upb * (premium - 100) / 100;
    const availableFunds = pl - mandatoryObligations;
    const locGrowth = initialRate !== null ? initialRate + mipRate : null;

    rows.push({
      margin, viable: true,
      expectedRate, initialRate, plf, pl, plu,
      bucket, premium, upb, compDollars, availableFunds, locGrowth,
      mandatoryObligations,
    });
  }

  // Analysis
  const viable = rows.filter(r => r.viable);
  const byTarget = [...viable].sort((a, b) =>
    Math.abs(a.compDollars - targetComp) - Math.abs(b.compDollars - targetComp)
  );
  const sweetSpot = byTarget[0] || null;

  const over = viable.filter(r => r.compDollars >= targetComp)
    .sort((a, b) => b.availableFunds - a.availableFunds);
  const borrowerBest = over[0] || null;

  const lowestRate = viable[0] || null;

  return { rows, sweetSpot, borrowerBest, lowestRate, viable };
}
