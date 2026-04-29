/**
 * cost-of-waiting v1 — input schema (zod).
 *
 * Splits inputs into:
 *   - scenario: facts about the borrower's existing loan (loan_amount,
 *     term, current_rate). When this module is attached to a quote,
 *     these come from the quote's scenario row. When standalone, the
 *     user enters them directly.
 *   - config: knobs the calculator presents. newRate is the rate being
 *     compared to current_rate; defaults to whatever rate the standalone
 *     view's parRate prop provided. Investment-return assumptions are
 *     defaults that the standalone shows but doesn't expose for editing
 *     in the v1 UI (locked for now to keep the borrower view simple).
 */

import { z } from 'zod';

export const schema = z.object({
  scenario: z.object({
    loan_amount: z.number().positive(),
    term: z.number().int().min(10).max(40).default(30),
    current_rate: z.number().min(1).max(20),
  }),
  config: z.object({
    newRate: z.number().min(1).max(20),
    sp500ReturnRate: z.number().default(0.07),
    cdReturnRate: z.number().default(0.045),
  }),
});
