/**
 * cost-of-waiting v1 — pure compute.
 *
 * No services — pure local archetype per spec §4. All inputs come in
 * via the validated arg; the result is fully serializable JSONB-friendly
 * (numbers + arrays of {months, lost} / {years, extraPrincipal, sp500, cds}).
 *
 * Lifted verbatim from src/app/tools/cost-of-waiting/content.js useMemo
 * block. No behavior change — same numbers, same table, same opportunity-
 * cost projection. The standalone view will swap to call this via the
 * useCompute hook in StandaloneView.js.
 */

import { calculateMonthlyPI } from '@/lib/mortgage-math';

const WAIT_MONTHS = [1, 2, 3, 6, 9, 12, 18, 24, 36];
const HORIZON_YEARS = [5, 10, 15, 20];

/**
 * @param {{
 *   scenario: { loan_amount: number, term: number, current_rate: number },
 *   config:   { newRate: number, sp500ReturnRate: number, cdReturnRate: number }
 * }} input
 * @returns {object}
 */
export function compute(input) {
  const { scenario, config } = input;
  const loan = scenario.loan_amount;
  const curRate = scenario.current_rate;
  const nRate = config.newRate;
  const termYears = scenario.term;

  if (nRate >= curRate) {
    // Soft case — not an error, but no savings to surface. Caller (the
    // standalone view's empty-state) handles this by showing a hint.
    return {
      eligible: false,
      reason: 'newRate must be lower than currentRate to surface savings',
      warnings: ['New rate is not lower than current rate — no savings to compute.'],
    };
  }

  const months = termYears * 12;
  const currentPmt = calculateMonthlyPI(curRate, loan, termYears) || 0;
  const newPmt = calculateMonthlyPI(nRate, loan, termYears) || 0;
  const monthlySavings = currentPmt - newPmt;

  const table = WAIT_MONTHS.map((m) => ({
    months: m,
    lost: monthlySavings * m,
  }));

  const lifetimeSavings = monthlySavings * months;
  const totalInterestCurrent = currentPmt * months - loan;
  const totalInterestNew = newPmt * months - loan;
  const interestSaved = totalInterestCurrent - totalInterestNew;

  // Future-value of an annuity: PMT × ((1+r)^n − 1) / r
  const fvAnnuity = (monthlyPmt, annualReturn, years) => {
    const r = annualReturn / 12;
    const n = years * 12;
    if (!r) return monthlyPmt * n;
    return monthlyPmt * ((Math.pow(1 + r, n) - 1) / r);
  };

  // Extra-principal paydown vs base schedule, snapshotted at each horizon.
  const r = nRate / 100 / 12;
  let balanceExtra = loan;
  let balanceBase = loan;
  let monthsPaidOff = 0;
  let totalInterestExtra = 0;
  const horizonMonthsSet = new Set(HORIZON_YEARS.map((y) => y * 12));
  const equityAdvantage = {};
  let paidOff = false;

  for (let m = 1; m <= months; m++) {
    if (balanceBase > 0) {
      const intBase = balanceBase * r;
      const princBase = Math.min(newPmt - intBase, balanceBase);
      balanceBase -= princBase;
    }
    if (balanceExtra > 0) {
      const intExtra = balanceExtra * r;
      totalInterestExtra += intExtra;
      const princExtra = Math.min(newPmt + monthlySavings - intExtra, balanceExtra);
      balanceExtra -= princExtra;
      if (balanceExtra <= 0 && !paidOff) {
        monthsPaidOff = m;
        paidOff = true;
      }
    }
    if (horizonMonthsSet.has(m)) {
      const yr = m / 12;
      equityAdvantage[yr] = Math.max(0, balanceBase - balanceExtra);
    }
  }
  if (!paidOff) monthsPaidOff = months;

  const totalInterestBase = newPmt * months - loan;
  const interestSavedExtra = totalInterestBase - totalInterestExtra;
  const yearsSaved = Math.round(((months - monthsPaidOff) / 12) * 10) / 10;

  const opportunities = HORIZON_YEARS.map((yr) => ({
    years: yr,
    extraPrincipal: equityAdvantage[yr] || 0,
    sp500: fvAnnuity(monthlySavings, config.sp500ReturnRate, yr),
    cds: fvAnnuity(monthlySavings, config.cdReturnRate, yr),
  }));

  return {
    eligible: true,
    currentPmt,
    newPmt,
    monthlySavings,
    table,
    lifetimeSavings,
    interestSaved,
    opportunities,
    yearsSaved,
    interestSavedExtra,
  };
}
