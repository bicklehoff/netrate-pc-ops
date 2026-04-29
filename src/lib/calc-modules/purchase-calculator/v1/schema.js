/**
 * purchase-calculator v1 — input schema (zod).
 *
 * Splits inputs into:
 *   - scenario: borrower + property facts that come from a quote's
 *     scenario row when attached. Includes annual_income because the
 *     DTI + max-affordable computations require it.
 *   - config: MLO-tunable assumptions. v1 surfaces PMI rate, closing-
 *     cost percentage, and DTI thresholds so the standalone can be
 *     re-skinned for a different lender's underwriting policy without
 *     a code change. v1 standalone UI doesn't expose these for editing
 *     (defaults applied) — leave that for Phase 9 picker.
 */

import { z } from 'zod';

export const schema = z.object({
  scenario: z.object({
    home_price: z.number().positive(),
    down_payment_pct: z.number().min(0).max(100),
    rate: z.number().min(1).max(20),
    term_years: z.number().int().min(10).max(40).default(30),
    property_tax_rate_pct: z.number().min(0).max(10).default(0.6),
    annual_insurance: z.number().min(0).default(1200),
    monthly_hoa: z.number().min(0).default(0),
    annual_income: z.number().min(0).default(0),
  }),
  config: z.object({
    pmi_annual_rate: z.number().min(0).default(0.005),
    closing_cost_pct: z.number().min(0).default(0.03),
    dti_comfortable: z.number().min(0).default(36),
    dti_qualifying: z.number().min(0).default(45),
  }),
});
