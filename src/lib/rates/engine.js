/**
 * NetRate Mortgage — Rate Math Helpers
 * Pure functions, no UI dependencies.
 *
 * This file used to contain a full pricing engine (priceRates, calculateLLPA)
 * that ran against static JSON rate data. That engine was deleted when the DB
 * became the source of truth — see src/lib/rates/pricing-v2.js for the math
 * and src/lib/rates/price-scenario.js for the entry point.
 *
 * Only pure math helpers remain here.
 */

export function getFicoBand(fico) {
  if (fico >= 800) return ">=800";
  if (fico >= 780) return "780-799";
  if (fico >= 760) return "760-779";
  if (fico >= 740) return "740-759";
  if (fico >= 720) return "720-739";
  if (fico >= 700) return "700-719";
  if (fico >= 680) return "680-699";
  if (fico >= 660) return "660-679";
  if (fico >= 640) return "640-659";
  return "620-639";
}

export function getLtvBandIndex(ltv) {
  if (ltv <= 30) return 0;
  if (ltv <= 60) return 1;
  if (ltv <= 70) return 2;
  if (ltv <= 75) return 3;
  if (ltv <= 80) return 4;
  if (ltv <= 85) return 5;
  if (ltv <= 90) return 6;
  if (ltv <= 95) return 7;
  return 8;
}

export function calculatePI(rate, loanAmount, termYears = 30) {
  const r = rate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return loanAmount / n;
  return loanAmount * r / (1 - Math.pow(1 + r, -n));
}

/**
 * Calculate APR using binary search.
 * APR = the rate at which P&I on (loanAmount - netFinanceCharges) equals
 * the P&I at the note rate on loanAmount.
 */
export function calculateAPR(noteRate, loanAmount, netFinanceCharges, termYears = 30) {
  if (netFinanceCharges <= 0) return noteRate; // credit exceeds fees — APR ≈ note rate
  const targetPayment = calculatePI(noteRate, loanAmount, termYears);
  const adjustedLoan = loanAmount - netFinanceCharges;
  if (adjustedLoan <= 0) return noteRate;
  let lo = noteRate;
  let hi = noteRate + 5;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const payment = calculatePI(mid, adjustedLoan, termYears);
    if (payment < targetPayment) lo = mid;
    else hi = mid;
    if (Math.abs(hi - lo) < 0.0001) break;
  }
  return Math.round(((lo + hi) / 2) * 1000) / 1000;
}
