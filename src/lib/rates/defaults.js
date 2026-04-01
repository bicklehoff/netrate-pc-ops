/**
 * Default borrower scenario used across the site.
 *
 * Matches MND (Mortgage News Daily) assumptions: 780 FICO, 75% LTV, purchase.
 * Used by: homepage, pricing API, pricing engine, rate history, calculators.
 *
 * Change here → changes everywhere.
 */

// FHA standard baseline limit (65% of conforming limit)
// Single source of truth — update here when FHFA raises limits
export const FHA_BASELINE_LIMIT = Math.round(832750 * 0.65); // $541,288

export const DEFAULT_SCENARIO = {
  fico: 780,
  loanAmount: 400000,
  ltv: 75,
  downPaymentPct: 25,    // 100 - ltv
  propertyValue: 533334, // $400K / $533,334 = 74.999% — safely in the ≤75 LTV band
  loanPurpose: 'purchase',
  propertyType: 'sfr',
  term: 30,
  lockDays: 30,
  state: 'CO',
  currentPayoff: 400000, // for refi scenarios
  currentRate: 7.125,    // for refi scenarios
};
