/**
 * Default borrower scenario — last-known-good fallback for server-side
 * pricing calls AND initial form state for the RateTool client component.
 *
 * As of D9b.5 (migration 010), the server-side source of truth is the
 * `site_scenarios` table — row `homepage_default` mirrors these values
 * exactly. Server pricing code loads via `loadSiteScenario('homepage_default')`
 * which falls back to these constants if the DB read fails.
 *
 * The RateTool client component still seeds its initial form state from
 * these constants (can't easily fetch from DB for first render). Keep
 * this file in sync with the DB seed row when admin-tuning the homepage
 * default. If the two ever drift, the borrower sees the DB values on the
 * homepage rate card but the RateTool starts with the stale constants
 * until they type anything.
 *
 * Matches MND (Mortgage News Daily) assumptions: 780 FICO, 75% LTV, purchase.
 */

// FHA baseline (65% of 1-unit conforming baseline) is sourced from
// ref_conforming_baselines via getConformingBaseline() in ref-loan-limits.js.
// Server code that needs the threshold reads it from the DAL; this file
// stays UI-friendly (sync constants for client form seeding).

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
