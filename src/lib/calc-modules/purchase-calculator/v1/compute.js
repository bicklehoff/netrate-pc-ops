/**
 * purchase-calculator v1 — pure compute.
 *
 * No services — pure local archetype. Lifted from
 * src/app/tools/purchase-calculator/content.js useMemo block. Same
 * numbers, same iterative max-affordable solver. Returns dtiTone
 * ('good' | 'neutral' | 'bad') instead of baked Tailwind classes;
 * views map tone → styling (Phase 3 pattern).
 */

import { calculateMonthlyPI } from '@/lib/mortgage-math';

const MAX_AFFORDABLE_ITERATIONS = 20;
const MAX_AFFORDABLE_TARGET_DTI = 0.45;

/**
 * @param {{
 *   scenario: {
 *     home_price: number, down_payment_pct: number, rate: number,
 *     term_years: number, property_tax_rate_pct: number,
 *     annual_insurance: number, monthly_hoa: number, annual_income: number,
 *   },
 *   config: {
 *     pmi_annual_rate: number, closing_cost_pct: number,
 *     dti_comfortable: number, dti_qualifying: number,
 *   },
 * }} input
 */
export function compute(input) {
  const { scenario, config } = input;
  const price = scenario.home_price;
  const dp = scenario.down_payment_pct / 100;
  const r = scenario.rate;
  const termYears = scenario.term_years;
  const tax = scenario.property_tax_rate_pct / 100;
  const ins = scenario.annual_insurance;
  const hoaAmt = scenario.monthly_hoa;
  const grossIncome = scenario.annual_income;

  const downPayment = price * dp;
  const loanAmount = price - downPayment;
  const monthlyPI = calculateMonthlyPI(r, loanAmount, termYears) || 0;
  const monthlyTax = (price * tax) / 12;
  const monthlyIns = ins / 12;
  const monthlyPMI = dp < 0.2 ? (loanAmount * config.pmi_annual_rate) / 12 : 0;
  const totalMonthly = monthlyPI + monthlyTax + monthlyIns + monthlyPMI + hoaAmt;
  const cashToClose = downPayment + loanAmount * config.closing_cost_pct;

  const monthlyIncome = grossIncome / 12;
  const dti = monthlyIncome > 0 ? (totalMonthly / monthlyIncome) * 100 : 0;

  let dtiTone;
  let dtiLabel;
  if (monthlyIncome <= 0) {
    dtiTone = 'neutral';
    dtiLabel = 'Income not provided';
  } else if (dti <= config.dti_comfortable) {
    dtiTone = 'good';
    dtiLabel = 'Comfortable';
  } else if (dti <= config.dti_qualifying) {
    dtiTone = 'neutral';
    dtiLabel = 'Qualifying';
  } else {
    dtiTone = 'bad';
    dtiLabel = 'Over limit';
  }

  // Max affordable price at 45% DTI — iterative solve.
  // Starts at the user's home_price and converges to the price where
  // total monthly payment equals 45% of monthly income.
  let maxPrice = price;
  if (monthlyIncome > 0) {
    const maxMonthly = monthlyIncome * MAX_AFFORDABLE_TARGET_DTI;
    for (let i = 0; i < MAX_AFFORDABLE_ITERATIONS; i++) {
      const mLoan = maxPrice * (1 - dp);
      const mPI = calculateMonthlyPI(r, mLoan, termYears) || 0;
      const mTax = (maxPrice * tax) / 12;
      const mPMI = dp < 0.2 ? (mLoan * config.pmi_annual_rate) / 12 : 0;
      const mTotal = mPI + mTax + monthlyIns + mPMI + hoaAmt;
      if (mTotal <= 0) break;
      const ratio = maxMonthly / mTotal;
      maxPrice *= ratio;
      if (Math.abs(ratio - 1) < 0.001) break;
    }
  }

  return {
    downPayment,
    loanAmount,
    monthlyPI,
    monthlyTax,
    monthlyIns,
    monthlyPMI,
    totalMonthly,
    cashToClose,
    closingCostsEstimate: loanAmount * config.closing_cost_pct,
    dti,
    dtiLabel,
    dtiTone,
    maxPrice,
    hoaAmt,
  };
}
