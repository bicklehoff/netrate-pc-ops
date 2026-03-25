/**
 * Default borrower scenario used across the site.
 *
 * Matches MND (Mortgage News Daily) assumptions: 780 FICO, 80% LTV, purchase.
 * Used by: homepage, pricing API, pricing engine, rate history, calculators.
 *
 * Change here → changes everywhere.
 */

export const DEFAULT_SCENARIO = {
  fico: 780,
  loanAmount: 400000,
  ltv: 80,
  propertyValue: 500000,
  loanPurpose: 'purchase',
  propertyType: 'sfr',
  term: 30,
  lockDays: 30,
  state: 'CO',
};
