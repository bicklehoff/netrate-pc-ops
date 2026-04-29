/**
 * refi-analyzer v1 — pure compute.
 *
 * No services — pure local archetype per spec §4. Lifted verbatim from
 * src/app/tools/refi-analyzer/content.js useMemo block. Same numbers.
 *
 * Result includes a `verdict` string + a `verdictTone` ('good' | 'bad' |
 * 'neutral') so view layers don't bake the color logic. View components
 * map tone → their own styling (Tailwind classes for HTML, hex colors
 * for PDF).
 */

import { calculateMonthlyPI } from '@/lib/mortgage-math';

/**
 * @param {{
 *   scenario: {
 *     current_balance: number,
 *     current_rate: number,
 *     remaining_term_years: number,
 *     new_rate: number,
 *     new_term_years: number,
 *   },
 *   config: { closing_costs: number, hold_years: number },
 * }} input
 * @returns {object}
 */
export function compute(input) {
  const { scenario, config } = input;
  const bal = scenario.current_balance;
  const curRate = scenario.current_rate;
  const remYrs = scenario.remaining_term_years;
  const remMo = remYrs * 12;
  const nRate = scenario.new_rate;
  const nYrs = scenario.new_term_years;
  const nMo = nYrs * 12;
  const costs = config.closing_costs;
  const hold = config.hold_years * 12;

  const currentPmt = calculateMonthlyPI(curRate, bal, remYrs) || 0;
  const newPmt = calculateMonthlyPI(nRate, bal, nYrs) || 0;
  const monthlySavings = currentPmt - newPmt;

  const breakEvenMonths = monthlySavings > 0 ? Math.ceil(costs / monthlySavings) : Infinity;

  const currentTotalInterest = currentPmt * remMo - bal;
  const newTotalInterest = newPmt * nMo - bal;
  const interestSaved = currentTotalInterest - newTotalInterest;

  const holdMo = Math.min(hold, remMo);
  const currentCostOverHold = currentPmt * holdMo;
  const newCostOverHold = newPmt * Math.min(hold, nMo) + costs;
  const netSavingsOverHold = currentCostOverHold - newCostOverHold;

  let verdict;
  let verdictTone;
  if (monthlySavings <= 0) {
    verdict = "Not Worth It — New rate doesn't save money";
    verdictTone = 'bad';
  } else if (breakEvenMonths <= hold) {
    verdict = "Worth It — You'll recoup costs and save";
    verdictTone = 'good';
  } else {
    verdict = 'Maybe — Break-even is past your hold period';
    verdictTone = 'neutral';
  }

  // Replace Infinity with null for clean JSONB serialization (frozen
  // result lives in quotes.attached_modules — Infinity is not valid JSON).
  const breakEvenMonthsSerialized = Number.isFinite(breakEvenMonths) ? breakEvenMonths : null;

  return {
    currentPmt,
    newPmt,
    monthlySavings,
    breakEvenMonths: breakEvenMonthsSerialized,
    interestSaved,
    currentCostOverHold,
    newCostOverHold,
    netSavingsOverHold,
    verdict,
    verdictTone,
  };
}
