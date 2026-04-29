/**
 * refi-analyzer v1 — input schema (zod).
 *
 * Splits inputs into:
 *   - scenario: facts about the borrower's existing loan + the refi
 *     candidate (current_balance, current_rate, remaining_term + the
 *     proposed new_rate, new_term). When attached to a quote, scenario
 *     fields come from the quote's scenario row.
 *   - config: things the calculator presents that aren't loan facts —
 *     closing_costs estimate + the borrower's intended hold period (the
 *     time horizon the verdict is computed against).
 */

import { z } from 'zod';

export const schema = z.object({
  scenario: z.object({
    current_balance: z.number().positive(),
    current_rate: z.number().min(1).max(20),
    remaining_term_years: z.number().min(1).max(40).default(27),
    new_rate: z.number().min(1).max(20),
    new_term_years: z.number().int().min(10).max(40).default(30),
  }),
  config: z.object({
    closing_costs: z.number().min(0).default(4000),
    hold_years: z.number().min(0).max(40).default(7),
  }),
});
