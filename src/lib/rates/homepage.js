/**
 * Homepage Rate Computation
 * Server-side only — computes consumer-friendly rates from raw GCS rate sheet data.
 * Used by page.js (homepage) to display live rates in hero card, rates table, and ticker.
 *
 * Reference scenario: 760+ FICO, $400K loan, 75% LTV, rate/term refi
 * (matches the homepage disclaimer text)
 */

import { priceRates, calculatePI } from './engine';

// ─── Reference Scenario ─────────────────────────────────────────
// This scenario matches the homepage disclaimers:
//   "760+ FICO · $400K · Rate/Term Refi"
//   "Rates assume 760+ FICO, rate/term refinance, $400K loan, 75% LTV"

const REFERENCE_SCENARIO = {
  purpose: 'refi',
  propertyType: 'sfr',
  fico: 760,
  loanAmount: 400000,
  ltv: 75,
  propertyValue: 533333, // $400K / 75% LTV
  currentPayoff: 400000,
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

// ─── Main Computation ────────────────────────────────────────────

/**
 * Compute homepage display rates from raw lender data.
 *
 * @param {Object} lenderData — Raw GCS lender file (e.g., amwest.json)
 * @returns {Object|null} Structured rates for homepage display, or null if data is invalid
 *
 * Return shape:
 * {
 *   effectiveDate: "3/5/2026",
 *   effectiveDateFormatted: "March 5, 2026",
 *   effectiveDateShort: "Mar 5, 2026",
 *   effectiveTime: "8:00 AM PST",
 *   lenderFees: 1295,
 *   conv30: { rate, apr, payment, points, creditDollars, isPar: true },
 * }
 */
export function computeHomepageRates(lenderData) {
  if (!lenderData?.rateTable30yr) return null;

  const scenario = REFERENCE_SCENARIO;
  const rates = priceRates(scenario, lenderData);
  const lenderFees = lenderData.lender?.lenderFees ?? 0;

  if (!rates.length) return null;

  // Find par rate (adjPrice closest to 0)
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

  // APR for par rate
  const financeCharges = lenderFees + (parRate.adjPrice / 100) * scenario.loanAmount;
  const apr = calculateAPR(parRate.rate, scenario.loanAmount, financeCharges);

  return {
    // Dates
    effectiveDate: rawDate,
    effectiveDateFormatted: formatEffectiveDate(rawDate),
    effectiveDateShort: formatEffectiveDateShort(rawDate),
    effectiveTime: lenderData.lender?.effectiveTime ?? null,

    // Metadata
    lenderFees,

    // Par rate for 30-year conventional (hero card + featured row)
    conv30: {
      rate: parRate.rate,
      apr,
      payment: Math.round(parRate.monthlyPI),
      points: Math.round(parRate.adjPrice * 1000) / 1000,
      creditDollars: Math.round(parRate.creditDollars),
    },
  };
}
