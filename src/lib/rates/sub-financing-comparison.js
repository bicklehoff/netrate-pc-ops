/**
 * Sub Financing Comparison
 *
 * Compares two refinance strategies when a borrower has a second lien:
 *   Option A: Keep the second lien — rate/term refi on first only
 *   Option B: Pay off the second — cash-out refi, one loan
 *
 * Uses the pricing engine to run both scenarios and compares total cost.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { calculatePI, calculateAPR, getFicoBand, getLtvBandIndex } from './engine';

// Inline LLPA calculation (simplified for comparison — uses GSE standard)
// Import the full grids from pricing.js would create a circular dep,
// so we duplicate the essential lookup here.

const GSE_REFI_LLPA = {
  '>=800':   [0, 0, 0, 0.125, 0.5, 1.0, 1.0, 1.0, 1.125],
  '780-799': [0, 0, 0, 0.125, 0.5, 1.0, 1.0, 1.0, 1.125],
  '760-779': [0, 0, 0.125, 0.375, 0.875, 1.375, 1.25, 1.25, 1.375],
  '740-759': [0, 0, 0.25, 0.75, 1.125, 1.75, 1.625, 1.625, 1.75],
  '720-739': [0, 0, 0.5, 1.0, 1.625, 2.125, 2.0, 1.875, 2.0],
  '700-719': [0, 0, 0.625, 1.25, 1.875, 2.5, 2.25, 2.25, 2.375],
  '680-699': [0, 0, 0.875, 1.625, 2.25, 2.875, 2.625, 2.375, 2.5],
  '660-679': [0, 0.375, 1.5, 2.25, 2.875, 3.375, 2.875, 2.75, 2.875],
  '640-659': [0, 0.5, 1.875, 2.625, 3.375, 3.875, 3.375, 3.125, 3.25],
  '620-639': [0, 0.625, 2.375, 3.125, 4.125, 4.5, 4.25, 3.125, 3.25],
};

const GSE_CASHOUT_LLPA = {
  '>=800':   [0.375, 0.375, 0.625, 0.875, 1.375],
  '780-799': [0.375, 0.375, 0.625, 0.875, 1.375],
  '760-779': [0.375, 0.375, 0.875, 1.25, 1.875],
  '740-759': [0.375, 0.375, 1.0, 1.625, 2.375],
  '720-739': [0.375, 0.5, 1.375, 2.0, 2.75],
  '700-719': [0.375, 0.5, 1.625, 2.625, 3.25],
  '680-699': [0.375, 0.625, 2.0, 2.875, 3.75],
  '660-679': [0.75, 1.25, 3.125, 4.375, 5.125],
  '640-659': [0.875, 1.875, 3.625, 5.125, 5.625],
  '620-639': [1.0, 2.0, 4.0, 5.5, 5.75],
};

const SUB_FIN_ADJUSTER = [0.625, 0.625, 0.625, 0.875, 1.125, 1.125, 1.125, 1.875, 1.875];

// Broker comp
const COMP_RATE = 0.02;
const COMP_CAP_REFI = 3595;

function calcComp(loanAmount) {
  return Math.min(loanAmount * COMP_RATE, COMP_CAP_REFI);
}

function lookupLLPA(grid, ficoBand, ltvIdx, maxIdx) {
  const useIdx = Math.min(ltvIdx, maxIdx);
  return grid[ficoBand]?.[useIdx] ?? 0;
}

/**
 * Compare keep-second-lien vs cash-out-payoff strategies.
 *
 * @param {Object} params
 * @param {number} params.firstMortgageBalance - Current first mortgage balance
 * @param {number} params.secondLienBalance - Current second lien balance (HELOC, 2nd mortgage)
 * @param {number} params.secondLienPayment - Monthly payment on the second lien
 * @param {number} params.secondLienRate - Interest rate on second lien (for display)
 * @param {number} params.propertyValue - Current property value
 * @param {number} params.creditScore - Borrower FICO
 * @param {number} params.currentFirstRate - Current first mortgage rate
 * @param {number} params.term - Loan term in years (default 30)
 * @param {number} params.lenderFee - Lender origination fee (default 1195)
 * @param {number} params.thirdPartyCosts - Estimated third party costs (default 2800)
 *
 * @returns {Object} Comparison results
 */
export function compareSubFinancingOptions(params) {
  const {
    firstMortgageBalance,
    secondLienBalance,
    secondLienPayment = 0,
    secondLienRate = 0,
    propertyValue,
    creditScore = 780,
    currentFirstRate,
    term = 30,
    lenderFee = 1195,
    thirdPartyCosts = 2800,
  } = params;

  const ficoBand = getFicoBand(creditScore);

  // ── Current situation ──
  const currentFirstPayment = calculatePI(currentFirstRate, firstMortgageBalance, term);
  const currentTotalPayment = currentFirstPayment + secondLienPayment;

  // ── Option A: Keep the second — rate/term refi on first only ──
  const optA_loanAmount = firstMortgageBalance;
  const optA_ltv = (optA_loanAmount / propertyValue) * 100;
  const optA_cltv = ((optA_loanAmount + secondLienBalance) / propertyValue) * 100;
  const optA_ltvIdx = getLtvBandIndex(optA_cltv); // Use CLTV for LLPA lookup
  const optA_comp = calcComp(optA_loanAmount);
  const optA_compPts = (optA_comp / optA_loanAmount) * 100;

  // LLPA: refi grid at CLTV + sub financing adjuster
  const optA_baseLlpa = lookupLLPA(GSE_REFI_LLPA, ficoBand, optA_ltvIdx, 8);
  const optA_subFinLlpa = SUB_FIN_ADJUSTER[Math.min(optA_ltvIdx, 8)] ?? 0;
  const optA_totalLlpa = optA_baseLlpa + optA_subFinLlpa;

  // Total pricing hit (LLPA + comp, in points)
  const optA_totalPts = optA_totalLlpa + optA_compPts;
  const optA_totalDollars = (optA_totalPts / 100) * optA_loanAmount;

  // Estimate the rate adjustment from LLPA (rough: 1 point ≈ 0.25% rate)
  // This is approximate — real pricing comes from the rate sheet
  const optA_rateAdj = optA_totalLlpa * 0.25;

  const optA_payment = calculatePI(currentFirstRate - 0.75 + optA_rateAdj, optA_loanAmount, term);
  const optA_totalMonthly = optA_payment + secondLienPayment;

  // ── Option B: Pay off the second — cash-out refi ──
  const optB_loanAmount = firstMortgageBalance + secondLienBalance;
  const optB_ltv = (optB_loanAmount / propertyValue) * 100;
  const optB_ltvIdx = getLtvBandIndex(optB_ltv);
  const optB_comp = calcComp(optB_loanAmount);
  const optB_compPts = (optB_comp / optB_loanAmount) * 100;

  // LLPA: cash-out grid at LTV (no sub financing — we're paying it off)
  const optB_cashoutMaxIdx = 4; // cash-out grid only goes to 80% LTV
  const optB_baseLlpa = lookupLLPA(GSE_CASHOUT_LLPA, ficoBand, optB_ltvIdx, optB_cashoutMaxIdx);
  const optB_totalLlpa = optB_baseLlpa; // no sub financing adjuster
  const optB_totalPts = optB_totalLlpa + optB_compPts;
  const optB_totalDollars = (optB_totalPts / 100) * optB_loanAmount;

  const optB_rateAdj = optB_totalLlpa * 0.25;
  const optB_payment = calculatePI(currentFirstRate - 0.625 + optB_rateAdj, optB_loanAmount, term);
  const optB_totalMonthly = optB_payment; // no second lien payment

  // ── Comparison ──
  const SUB_FEE = 200; // subordination fee charged by second lien holder for Option A
  const monthlySavings = optA_totalMonthly - optB_totalMonthly;
  const pricingDifference = optA_totalDollars - optB_totalDollars;
  const closingCosts = lenderFee + thirdPartyCosts;
  const optA_closingCosts = closingCosts + SUB_FEE; // Option A has sub fee on top

  // Which option wins?
  let winner, reason;
  if (optB_ltv > 80) {
    // Cash-out refi above 80% LTV is restricted or unavailable for conventional
    winner = 'keepSecond';
    reason = 'Cash-out refi would exceed 80% LTV — most lenders cap cash-out at 80%.';
  } else if (monthlySavings > 50 && pricingDifference > 0) {
    winner = 'payoff';
    reason = `Paying off the second saves $${Math.round(monthlySavings)}/mo and $${Math.round(Math.abs(pricingDifference)).toLocaleString()} in pricing adjustments.`;
  } else if (monthlySavings < -50) {
    winner = 'keepSecond';
    reason = `Keeping the second lien results in a lower total payment by $${Math.round(Math.abs(monthlySavings))}/mo.`;
  } else {
    winner = 'close';
    reason = 'Both options are similar — the decision depends on your preference for simplifying to one payment vs. keeping flexibility.';
  }

  return {
    current: {
      firstMortgageBalance,
      firstPayment: Math.round(currentFirstPayment),
      secondLienBalance,
      secondLienPayment: Math.round(secondLienPayment),
      secondLienRate,
      totalMonthly: Math.round(currentTotalPayment),
      propertyValue,
      creditScore,
    },
    optionA: {
      label: 'Keep Your Second Lien',
      description: 'Rate/term refi on first mortgage only. HELOC/second stays in place.',
      loanAmount: optA_loanAmount,
      ltv: Math.round(optA_ltv * 100) / 100,
      cltv: Math.round(optA_cltv * 100) / 100,
      llpa: {
        base: Math.round(optA_baseLlpa * 1000) / 1000,
        subFinancing: Math.round(optA_subFinLlpa * 1000) / 1000,
        total: Math.round(optA_totalLlpa * 1000) / 1000,
      },
      compPoints: Math.round(optA_compPts * 1000) / 1000,
      totalPricingHit: Math.round(optA_totalPts * 1000) / 1000,
      totalPricingDollars: Math.round(optA_totalDollars),
      estimatedPayment: Math.round(optA_payment),
      secondLienPayment: Math.round(secondLienPayment),
      totalMonthly: Math.round(optA_totalMonthly),
      closingCosts: optA_closingCosts,
      subFee: SUB_FEE,
    },
    optionB: {
      label: 'Pay Off the Second (Cash-Out Refi)',
      description: 'Cash-out refi rolls the second lien into one new mortgage. One payment.',
      loanAmount: optB_loanAmount,
      ltv: Math.round(optB_ltv * 100) / 100,
      cltv: Math.round(optB_ltv * 100) / 100, // CLTV = LTV when no second
      llpa: {
        cashOut: Math.round(optB_baseLlpa * 1000) / 1000,
        subFinancing: 0,
        total: Math.round(optB_totalLlpa * 1000) / 1000,
      },
      compPoints: Math.round(optB_compPts * 1000) / 1000,
      totalPricingHit: Math.round(optB_totalPts * 1000) / 1000,
      totalPricingDollars: Math.round(optB_totalDollars),
      estimatedPayment: Math.round(optB_payment),
      secondLienPayment: 0,
      totalMonthly: Math.round(optB_totalMonthly),
      closingCosts: closingCosts,
      ltv80Warning: optB_ltv > 80,
    },
    comparison: {
      winner,
      reason,
      monthlySavings: Math.round(monthlySavings),
      pricingDifference: Math.round(pricingDifference),
      closingCosts,
      // Break-even: if cash-out has higher closing costs but lower payment
      breakEvenMonths: monthlySavings > 0
        ? Math.ceil(closingCosts / monthlySavings)
        : null,
    },
  };
}
