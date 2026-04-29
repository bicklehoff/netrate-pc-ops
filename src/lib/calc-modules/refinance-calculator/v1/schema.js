/**
 * refinance-calculator v1 — input schema (zod).
 *
 * scenario: facts about the borrower's existing loan + property. When
 *   attached to a quote, these come from the quote's scenario row.
 * config: borrower's preset preference + custom-rate selection (UI
 *   state but lives in input shape so useCompute re-runs on change).
 *   v1 standalone re-fetches /api/pricing on preset/custom-rate change
 *   — accepted cost; optimization tracked as future work.
 */

import { z } from 'zod';

export const schema = z.object({
  scenario: z.object({
    current_balance: z.number().positive(),
    current_rate: z.number().min(1).max(20),
    current_payment: z.number().min(0),
    property_value: z.number().positive(),
    fico: z.number().int().min(300).max(850).default(780),
    state: z.string().default('CO'),
    does_escrow: z.boolean().default(true),
    escrow_balance: z.number().min(0).default(0),
    annual_tax: z.number().min(0).nullable().default(null),
    annual_insurance: z.number().min(0).default(0),
    insurance_renewal: z.string().nullable().default(null),
  }),
  config: z.object({
    active_preset: z.enum(['noCost', 'zeroOop', 'lowestRate', 'custom']).default('noCost'),
    custom_selected_rate: z.number().nullable().default(null),
  }),
});
