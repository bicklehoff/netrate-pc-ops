// FHA program constants — single source of truth for regulatory values.
//
// When HUD updates any of these, this file is the single edit point.
// Search the codebase for `FHA_UFMIP_RATE` before updating to confirm no
// literal `0.0175` / `0.0085` crept back in.

/**
 * FHA Upfront Mortgage Insurance Premium — financed into the loan at closing.
 *
 * Source: HUD Mortgagee Letter 2023-05 (effective 2023-03-20).
 * Current rate: 1.75% of the base loan amount for FHA Forward mortgages.
 * Last verified: 2026-04-20.
 *
 * This is the regulatory baseline. Per-lender overrides (if a lender negotiates
 * a different arrangement — extremely rare) come from `rate_lenders.fha_ufmip`
 * and are applied in `src/lib/rates/pricing-v2.js` as
 *   `brokerConfig?.fhaUfmip || FHA_UFMIP_RATE`
 */
export const FHA_UFMIP_RATE = 0.0175;
