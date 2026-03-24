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

/**
 * Run the pricing engine for a specific loan type + term.
 * Finds the true par rate (lowest cost, fees in) — zero points to the borrower.
 * Lender fee excluded from display cost/APR to match national avg reporting.
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
    state: 'CO',
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

    // FEES OUT par: find par per lender (costBeforeFees ≈ 0), then pick best lender.
    // costBeforeFees = borrower cost EXCLUDING lender fee (industry standard display).
    // Negative = borrower credit, positive = borrower cost.
    // This matches how MND, Freddie Mac, and wholesale rate sheets report rates.
    // Only consider results within ±2 points of par (filters out lenders without competitive pricing).
    const viable = result.results.filter(r => Math.abs(r.costBeforeFees) <= 2);
    const byLender = {};
    for (const r of viable) {
      const lid = r.lender;
      if (!byLender[lid] || Math.abs(r.costBeforeFees) < Math.abs(byLender[lid].costBeforeFees)) {
        byLender[lid] = r;
      }
    }
    // Pick the lender whose fees-out par gives the lowest rate
    const lenderPars = Object.values(byLender);
    if (!lenderPars.length) return null;
    const best = lenderPars.reduce((b, r) => r.rate < b.rate ? r : b);

    if (!best) return null;

    // Display cost is fees-out (excludes lender fee)
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
