/**
 * NetRate Mortgage — Pricing Engine
 * Pure functions, no UI dependencies.
 * Ported from rate-tool-branded.html
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

export function calculateLLPA(scenario, rateData) {
  const { fico, ltv, purpose, propertyType, loanAmount } = scenario;
  const ficoBand = getFicoBand(fico);
  const ltvIdx = getLtvBandIndex(ltv);
  let total = 0;
  const breakdown = [];

  let matrix;
  if (purpose === "purchase") matrix = rateData.purchaseLlpa;
  else if (purpose === "cashout") matrix = rateData.cashoutLlpa;
  else matrix = rateData.refiLlpa;

  const maxIdx = purpose === "cashout" ? 4 : 8;
  const useIdx = Math.min(ltvIdx, maxIdx);
  const baseAdj = matrix[ficoBand]?.[useIdx] ?? 0;
  total += baseAdj;
  breakdown.push({ label: `FICO/LTV (${ficoBand}, ${rateData.ltvBands[ltvIdx]})`, value: baseAdj });

  if (propertyType === "condo") {
    const condoAdj = rateData.additionalLlpa.condo[Math.min(ltvIdx, 8)] ?? 0;
    total += condoAdj;
    breakdown.push({ label: "Attached Condo", value: condoAdj });
  }

  for (const tier of rateData.loanAmtAdj) {
    if (loanAmount >= tier.min && loanAmount <= tier.max) {
      total += tier.adj;
      breakdown.push({ label: `Loan Amount ($${(tier.min/1000).toFixed(0)}K-$${(tier.max/1000).toFixed(0)}K)`, value: tier.adj });
      break;
    }
  }

  return { total, breakdown, ficoBand, ltvBand: rateData.ltvBands[ltvIdx] };
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

export function priceRates(scenario, rateData, lockPeriod = "30day") {
  const llpa = calculateLLPA(scenario, rateData);
  const colIdx = lockPeriod === "45day" ? 2 : 1;
  const lenderFees = rateData.lender?.lenderFees || 0;

  return rateData.rateTable30yr.map(row => {
    const rate = row[0];
    const basePrice = row[colIdx];
    const adjPrice = basePrice + llpa.total;
    const creditDollars = (adjPrice / 100) * scenario.loanAmount;
    const monthlyPI = calculatePI(rate, scenario.loanAmount);
    // APR: net finance charges = lender fees minus any lender credit
    const netCharges = Math.max(0, lenderFees - creditDollars);
    const apr = calculateAPR(rate, scenario.loanAmount, netCharges);
    return { rate, basePrice, adjPrice, creditDollars, monthlyPI, apr };
  }).filter(r => r.adjPrice > -6 && r.adjPrice < 5);
}
