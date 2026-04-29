/**
 * refinance-calculator v1 — compute.
 *
 * Rate-pulling archetype per spec §4 — `needsRates: true`. Lifted
 * verbatim from src/components/RefinanceCalc/useRefinanceEngine.js.
 * The fetch path goes through `services.fetchRates` (was a direct
 * /api/pricing POST) so quote-send-time can swap in frozen services
 * without changing the module.
 *
 * Returns ALL 4 strategy outcomes (noCost, zeroOop, lowest, custom).
 * StandaloneView picks which to render based on UI state. Embedded +
 * PDF views consume the frozen result and render only the preset the
 * MLO selected at send time (per AD-12a).
 *
 * Optimization opportunity (not v1): preset/custom-rate changes
 * currently re-trigger fetchRates. /api/pricing is cached so cost is
 * low, but a useCompute extension could distinguish scenario-input
 * changes from config changes. Tracked as future work; ships
 * functionally for now.
 */

import { calculatePI } from '@/lib/rates/engine';
import { STATE_DEFAULTS, computeEscrowSetup } from '@/components/RefinanceCalc/shared';

/**
 * @param {{
 *   scenario: import('./schema.js').schema,
 *   config: { active_preset: string, custom_selected_rate: number | null },
 * }} input
 * @param {import('../../types.js').ModuleServices} services
 */
export async function compute(input, services) {
  if (!services?.fetchRates) {
    throw new Error('refinance-calculator: services.fetchRates is required');
  }

  const { scenario, config } = input;
  const stateInfo = STATE_DEFAULTS[scenario.state] || STATE_DEFAULTS.CO;
  const bal = scenario.current_balance;
  const curRate = scenario.current_rate;
  const curPmt = scenario.current_payment;
  const propVal = scenario.property_value;
  const ficoVal = scenario.fico;
  const ins = scenario.annual_insurance;
  const escBal = scenario.escrow_balance;
  const effectiveTax = scenario.annual_tax != null
    ? scenario.annual_tax
    : Math.round(propVal * stateInfo.taxRate);

  // 30-day accrual to estimate payoff at closing
  const dailyInterest = (bal * (curRate / 100)) / 365;
  const accruedInterest = Math.round(dailyInterest * 30);
  const estimatedPayoff = bal + accruedInterest;

  const today = new Date();
  const closeDate = new Date(today.getTime() + 30 * 86400000);
  const defaultRenewal = new Date(today.getFullYear(), today.getMonth() + 6, 1)
    .toISOString()
    .slice(0, 10);
  const effectiveRenewal = scenario.insurance_renewal || defaultRenewal;

  const escrow = computeEscrowSetup({
    doesEscrow: scenario.does_escrow,
    effectiveTax,
    annualInsurance: ins,
    closeDate,
    effectiveRenewal,
    stateInfo,
  });

  const thirdPartyCosts = stateInfo.hardCosts;

  // Cash flow back within ~30 days of close
  const skippedPayment = curPmt;
  const escrowRefund = scenario.does_escrow ? escBal : 0;
  const totalCashBack = skippedPayment + escrowRefund;

  // Pull live rates via the framework's fetchRates service.
  const fetched = await services.fetchRates({
    loanAmount: estimatedPayoff,
    loanPurpose: 'refinance',
    loanType: 'conventional',
    creditScore: ficoVal,
    propertyValue: propVal,
    term: 30,
    productType: 'fixed',
    lockDays: 30,
    state: scenario.state,
  });

  const effectiveDate = fetched.effectiveDate || null;

  // Group results by rate level — pick best (highest finalPrice) per
  // unique rate. Filter to a sensible band so the ladder isn't 50 wide.
  const byRate = {};
  for (const r of fetched.results || []) {
    const key = r.rate.toFixed(3);
    if (!byRate[key] || r.finalPrice > byRate[key].finalPrice) {
      byRate[key] = r;
    }
  }
  const apiRates = Object.values(byRate)
    .sort((a, b) => a.rate - b.rate)
    .filter((r) => r.rate >= 4 && r.rate <= 9);

  if (apiRates.length === 0) {
    return {
      strategies: null,
      apiRates: [],
      effectiveDate,
      escrow,
      thirdPartyCosts,
      skippedPayment,
      escrowRefund,
      totalCashBack,
      estimatedPayoff,
      accruedInterest,
      warnings: ['No rates available in the 4-9% band for this scenario.'],
    };
  }

  const softCosts = escrow.total;

  function buildResult(rateEntry, loanAmount, cashToClose) {
    const payment = calculatePI(rateEntry.rate, loanAmount);
    const monthlySavings = curPmt - payment;
    const ltv = (loanAmount / propVal) * 100;
    const netCashFlow = cashToClose - totalCashBack;
    const netSpend = Math.max(0, netCashFlow);
    let breakeven = null;
    if (monthlySavings > 0 && netSpend > 0) {
      breakeven = Math.ceil(netSpend / monthlySavings);
    } else if (monthlySavings > 0) {
      breakeven = 0;
    }
    return {
      rate: rateEntry.rate,
      finalPrice: rateEntry.finalPrice,
      rebateDollars: rateEntry.rebateDollars || 0,
      discountDollars: rateEntry.discountDollars || 0,
      lenderFee: rateEntry.lenderFee || 0,
      lender: rateEntry.lender,
      program: rateEntry.program,
      loanAmount,
      payment,
      monthlySavings,
      cashToClose,
      netCashFlow,
      ltv,
      breakeven,
      skippedPayment,
      escrowRefund,
      totalCashBack,
    };
  }

  // No-Cost: lowest rate where rebate ≥ hard costs
  let noCostRate = null;
  for (const r of apiRates) {
    const totalHard = thirdPartyCosts + (r.lenderFee || 0);
    if ((r.rebateDollars || 0) >= totalHard) {
      noCostRate = r;
      break;
    }
  }
  if (!noCostRate) noCostRate = apiRates[apiRates.length - 1];
  const noCost = buildResult(noCostRate, estimatedPayoff, softCosts);
  const noCostHardCosts = thirdPartyCosts + (noCostRate.lenderFee || 0);
  noCost.explanation = noCostRate.rebateDollars >= noCostHardCosts
    ? `${noCostRate.rate.toFixed(3)}% is the lowest rate where lender credit ($${Math.round(noCostRate.rebateDollars).toLocaleString('en-US')}) covers your $${noCostHardCosts.toLocaleString('en-US')} in hard closing costs.`
    : `No rate fully covers hard costs. ${noCostRate.rate.toFixed(3)}% generates the most credit ($${Math.round(noCostRate.rebateDollars || 0).toLocaleString('en-US')}).`;

  // Zero Out of Pocket: par rate (closest finalPrice to 100)
  let parRate = apiRates[0];
  let minDist = Infinity;
  for (const r of apiRates) {
    const dist = Math.abs(r.finalPrice - 100);
    if (dist < minDist) {
      minDist = dist;
      parRate = r;
    }
  }
  const totalCostsToRoll = thirdPartyCosts + (parRate.lenderFee || 0) + softCosts;
  const creditApplied = Math.min(parRate.rebateDollars || 0, totalCostsToRoll);
  const netRollIn = totalCostsToRoll - creditApplied;
  const zeroOopLoan = estimatedPayoff + netRollIn;
  const zeroOop = buildResult(parRate, zeroOopLoan, 0);
  zeroOop.explanation = `${parRate.rate.toFixed(3)}% is the par rate. $${Math.round(netRollIn).toLocaleString('en-US')} in costs rolled into your new loan. Zero cash to close.`;

  // Lowest Rate: lowest available rate, may cost points
  const lowestRate = apiRates[0];
  const pointsCost = lowestRate.discountDollars || 0;
  const lowestCashToClose = pointsCost + softCosts;
  const lowest = buildResult(lowestRate, estimatedPayoff, lowestCashToClose);
  lowest.explanation = `${lowestRate.rate.toFixed(3)}% is the lowest available rate.${
    pointsCost > 0 ? ` You pay $${Math.round(pointsCost).toLocaleString('en-US')} in discount points.` : ''
  }`;

  // Custom: user-picked rate from the ladder, defaults to par
  let customRate = null;
  if (config.custom_selected_rate != null) {
    customRate = apiRates.find((r) => r.rate === config.custom_selected_rate);
  }
  if (!customRate) customRate = parRate;
  const customHardCosts = thirdPartyCosts + (customRate.lenderFee || 0);
  let customCashToClose;
  let customLoanAmt = estimatedPayoff;
  if ((customRate.rebateDollars || 0) >= customHardCosts) {
    customCashToClose = softCosts;
  } else {
    const shortfall = customHardCosts - (customRate.rebateDollars || 0);
    customCashToClose = shortfall + softCosts;
  }
  const custom = buildResult(customRate, customLoanAmt, customCashToClose);
  const customCredit = customRate.rebateDollars || 0;
  const customPoints = customRate.discountDollars || 0;
  if (customCredit > 0) {
    custom.explanation = `At ${customRate.rate.toFixed(3)}%, lender credit is $${Math.round(customCredit).toLocaleString('en-US')}.`;
  } else if (customPoints > 0) {
    custom.explanation = `At ${customRate.rate.toFixed(3)}%, you pay $${Math.round(customPoints).toLocaleString('en-US')} in points.`;
  } else {
    custom.explanation = `${customRate.rate.toFixed(3)}% is approximately par — no credit, no points.`;
  }

  return {
    strategies: { noCost, zeroOop, lowest, custom },
    apiRates,
    effectiveDate,
    escrow,
    thirdPartyCosts,
    skippedPayment,
    escrowRefund,
    totalCashBack,
    estimatedPayoff,
    accruedInterest,
    activePreset: config.active_preset,
    snapshotMeta: { ratesEffectiveDate: effectiveDate },
  };
}
