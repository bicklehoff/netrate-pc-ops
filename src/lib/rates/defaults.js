/**
 * Default borrower scenario used across the site.
 *
 * Matches MND (Mortgage News Daily) assumptions: 780 FICO, 75% LTV, purchase.
 * Used by: homepage, pricing API, pricing engine, rate history, calculators.
 *
 * Change here → changes everywhere.
 */

export const DEFAULT_SCENARIO = {
  fico: 780,
  loanAmount: 400000,
  ltv: 75,
  downPaymentPct: 25,    // 100 - ltv
  propertyValue: 533333, // loanAmount / (ltv / 100) — keeps LTV at 75.00%
  loanPurpose: 'purchase',
  propertyType: 'sfr',
  term: 30,
  lockDays: 30,
  state: 'CO',
  currentPayoff: 400000, // for refi scenarios
  currentRate: 7.125,    // for refi scenarios
};
