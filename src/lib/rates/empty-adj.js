/**
 * Empty lender-adjustment fallback.
 *
 * Some lenders don't have rows in `adjustment_rules` — for example, TLS, where
 * LLPAs are already baked into the product codes on the rate sheet. When
 * `getDbLenderAdj()` returns null for these lenders, callers should fall back
 * to this empty shape so pricing proceeds with zero adjustments instead of
 * failing or short-circuiting.
 *
 * Used by `price-scenario.js` — the single canonical pricing path since D9b.3
 * retired `homepage-db.js`. Historical context: the parallel `homepage-db.js`
 * engine previously hard-failed on missing adj rows, cascading to the homepage
 * fallback rate — fixed in the D3 homepage-EMPTY_ADJ-fallback remediation
 * (Work/Dev/audits/D0-VERIFICATION-D3-PRICING-2026-04-15.md) before the engine
 * itself was retired.
 *
 * Keeping this as a single constant prevents drift between the two pricing
 * paths. Do not copy-paste this shape into another file — import from here.
 */

export const EMPTY_ADJ = Object.freeze({
  ficoLtvGrids: { core: { '>15yr': { purchase: {}, refinance: {}, cashout: {} } } },
  srp: { core: { withImpounds: {}, withoutImpounds: {} } },
  riskBased: {},
  loanAmountAdj: {},
  investorAdj: {},
  productFeatures: [],
  productLoanAmount: [],
  eliteFhaFicoLoanAmt: [],
  eliteFhaPurposeLtv: [],
});
