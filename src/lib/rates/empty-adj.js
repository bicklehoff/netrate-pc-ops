/**
 * Empty lender-adjustment fallback.
 *
 * Some lenders don't have rows in `adjustment_rules` — for example, TLS, where
 * LLPAs are already baked into the product codes on the rate sheet. When
 * `getDbLenderAdj()` returns null for these lenders, callers should fall back
 * to this empty shape so pricing proceeds with zero adjustments instead of
 * failing or short-circuiting.
 *
 * Used by `price-scenario.js` — the canonical pricing orchestrator. The old
 * parallel `homepage-db.js` engine also used this fallback; that engine has
 * been retired (homepage.js now calls priceScenario directly). Historical
 * context of the hard-fail fix lives in
 * Work/Dev/audits/D0-VERIFICATION-D3-PRICING-2026-04-15.md.
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
