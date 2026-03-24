/**
 * Homepage Rate Computation
 * Server-side only — computes consumer-friendly rates from parsed rate sheet data.
 * Used by page.js (homepage) to display live rates in hero card, rates table, and ticker.
 *
 * Reference scenario: 760+ FICO, $400K loan, 75% LTV, rate/term refi
 * (matches the homepage disclaimer text)
 */

import { priceRates, calculatePI } from './engine';
import { priceScenario } from './pricing';

// ─── Reference Scenario ─────────────────────────────────────────
// This scenario matches the homepage disclaimers:
//   "760+ FICO · $400K · Purchase · 75% LTV"

const REFERENCE_SCENARIO = {
  purpose: 'purchase',
  propertyType: 'sfr',
  fico: 760,
  loanAmount: 400000,
  ltv: 75,
  propertyValue: 533333, // $400K / 75% LTV
};

// ─── Date Formatting ─────────────────────────────────────────────

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * "3/5/2026" → "March 5, 2026"
 */
export function formatEffectiveDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const month = MONTHS_FULL[parseInt(parts[0], 10) - 1];
  const day = parseInt(parts[1], 10);
  const year = parts[2];
  return `${month} ${day}, ${year}`;
}

/**
 * "3/5/2026" → "Mar 5, 2026"
 */
export function formatEffectiveDateShort(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const month = MONTHS_SHORT[parseInt(parts[0], 10) - 1];
  const day = parseInt(parts[1], 10);
  const year = parts[2];
  return `${month} ${day}, ${year}`;
}

// ─── APR Calculation ─────────────────────────────────────────────

/**
 * Calculate APR using binary search.
 * APR = the rate at which P&I on (loanAmount - financeCharges) equals
 * the P&I at the note rate on the full loanAmount.
 *
 * Finance charges = lender fees + borrower-paid points - lender credits
 * If net is negative (credit exceeds fees), APR ≈ note rate.
 */
function calculateAPR(noteRate, loanAmount, financeCharges, termYears = 30) {
  const monthlyPayment = calculatePI(noteRate, loanAmount, termYears);
  const amountFinanced = loanAmount - Math.max(0, financeCharges);

  // If no net finance charges, APR equals note rate
  if (amountFinanced >= loanAmount) {
    return noteRate;
  }

  // Binary search: find rate where P&I on amountFinanced = monthlyPayment
  let low = noteRate;
  let high = noteRate + 5;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const testPayment = calculatePI(mid, amountFinanced, termYears);
    if (testPayment < monthlyPayment) {
      low = mid;
    } else {
      high = mid;
    }
  }
  // Round to 2 decimal places
  return Math.round(((low + high) / 2) * 100) / 100;
}

// ─── Main Computation (Legacy — GCS live/ format) ────────────────

/**
 * Compute homepage display rates from raw lender data (old Sunwest format).
 * Kept for backward compatibility — new code should use computeHomepageRatesFromParsed().
 */
export function computeHomepageRates(lenderData) {
  if (!lenderData?.rateTable30yr) return null;

  const scenario = REFERENCE_SCENARIO;
  const rates = priceRates(scenario, lenderData);
  const lenderFees = lenderData.lender?.lenderFees ?? 0;

  if (!rates.length) return null;

  let parIdx = 0;
  let minAbsAdj = Infinity;
  rates.forEach((r, i) => {
    if (Math.abs(r.adjPrice) < minAbsAdj) {
      minAbsAdj = Math.abs(r.adjPrice);
      parIdx = i;
    }
  });

  const parRate = rates[parIdx];
  const rawDate = lenderData.lender?.effectiveDate ?? null;
  const financeCharges = lenderFees + (parRate.adjPrice / 100) * scenario.loanAmount;
  const apr = calculateAPR(parRate.rate, scenario.loanAmount, financeCharges);

  return {
    effectiveDate: rawDate,
    effectiveDateFormatted: formatEffectiveDate(rawDate),
    effectiveDateShort: formatEffectiveDateShort(rawDate),
    effectiveTime: lenderData.lender?.effectiveTime ?? null,
    lenderFees,
    conv30: {
      rate: parRate.rate,
      apr,
      payment: Math.round(parRate.monthlyPI),
      points: Math.round(parRate.adjPrice * 1000) / 1000,
      creditDollars: Math.round(parRate.creditDollars),
    },
  };
}

// ─── Main Computation (Parsed Rate Data + Full Pricing Engine) ───

// MND adjusts their published rates for ~0.5 points of cost. To compare apples-to-apples,
// we find the lowest rate where cost (ex-lender fee) is between 0.3 and 0.7 points.
// This matches the industry standard "rate with typical points" that MND/Freddie publish.
const MND_POINTS_TARGET = 0.5;
const MND_POINTS_MIN = 0.3;
const MND_POINTS_MAX = 0.7;

/**
 * Run the pricing engine for a specific loan type + term.
 * Finds the best rate at ~0.5 points cost (ex-lender fee) to match how MND reports.
 *
 * @returns {{ rate, apr, payment, lenderFee, ... } | null}
 */
function priceProduct(allPrograms, loanType, term) {
  const scenario = {
    loanAmount: REFERENCE_SCENARIO.loanAmount,
    loanPurpose: 'purchase',
    loanType,
    category: 'agency',
    creditScore: REFERENCE_SCENARIO.fico,
    propertyValue: REFERENCE_SCENARIO.propertyValue,
    propertyType: REFERENCE_SCENARIO.propertyType,
    occupancy: 'primary',
    term,
    employmentType: 'w2',
    subFinancing: false,
    subFinancingBalance: 0,
    includeBuydowns: false,
    includeIO: false,
  };

  const options = { lockDays: 30, termFilter: term, productType: 'fixed' };

  try {
    const result = priceScenario(scenario, allPrograms, options);
    if (!result?.results?.length) return null;

    // Find lowest rate where costBeforeFees (ex-lender fee) is ~0.5 points.
    // This matches MND's "adjusted for points" methodology.
    const candidates = result.results.filter(r =>
      r.costBeforeFees >= MND_POINTS_MIN && r.costBeforeFees <= MND_POINTS_MAX
    );

    let best;
    if (candidates.length > 0) {
      // Among candidates in the 0.3-0.7 range, pick lowest rate
      best = candidates.reduce((b, r) => r.rate < b.rate ? r : b);
    } else {
      // Fallback: closest to 0.5 points
      best = result.results.reduce((b, r) =>
        Math.abs(r.costBeforeFees - MND_POINTS_TARGET) < Math.abs(b.costBeforeFees - MND_POINTS_TARGET) ? r : b
      );
    }

    if (!best) return null;

    const displayCostPts = best.costBeforeFees;
    const displayCostDollars = (displayCostPts / 100) * REFERENCE_SCENARIO.loanAmount;

    const financeCharges = Math.max(0, displayCostDollars + (best.upfrontMI || 0));
    const apr = calculateAPR(best.rate, REFERENCE_SCENARIO.loanAmount, financeCharges, term);

    return {
      rate: best.rate,
      apr,
      payment: Math.round(best.monthlyPI),
      totalPayment: Math.round(best.totalPayment),
      costPoints: Math.round(displayCostPts * 1000) / 1000,
      costDollars: Math.round(displayCostDollars),
      lenderFee: best.lenderFee,
      lenderFeePoints: best.lenderFeePoints,
      costPointsFeesIn: best.costPoints,
      costDollarsFeesIn: best.costDollars,
      lender: best.lender,
    };
  } catch {
    return null;
  }
}

/**
 * Compute homepage display rates from parsed-rates.json using the full pricing engine.
 * Same LLPAs, broker comp, and lender fees as the Rate Tool.
 *
 * @param {Object} parsedData — parsed-rates.json ({ lenders: [{lenderId, programs, llpas}], date })
 * @returns {Object|null} { date, dateShort, conv30, conv15, fha30, va30 }
 */
export function computeHomepageRatesFromParsed(parsedData) {
  if (!parsedData?.lenders?.length) return null;

  const { lenders, date } = parsedData;

  // Format date: "2026-03-24" → "Mar 24, 2026"
  let dateShort = null;
  let dateFull = null;
  if (date) {
    const [y, m, d] = date.split('-').map(Number);
    dateShort = `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
    dateFull = `${MONTHS_FULL[m - 1]} ${d}, ${y}`;
  }

  return {
    date,
    dateFull,
    dateShort,
    conv30: priceProduct(lenders, 'conventional', 30),
    conv15: priceProduct(lenders, 'conventional', 15),
    fha30: priceProduct(lenders, 'fha', 30),
    va30: priceProduct(lenders, 'va', 30),
  };
}
