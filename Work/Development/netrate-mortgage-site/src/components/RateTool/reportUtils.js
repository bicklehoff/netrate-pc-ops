// Shared utilities for the Comparison Report and print views.
// Extracted from RateQuotePrintView.js for reuse.

export const PURPOSE_LABELS = {
  purchase: 'Purchase',
  refi: 'Rate/Term Refinance',
  cashout: 'Cash-Out Refinance',
};

export const PROP_LABELS = {
  sfr: 'Single Family',
  condo: 'Condo',
  townhome: 'Townhome',
};

/** Format dollar amount: $1,234 or -$1,234 */
export const fmtDollar = (v) => {
  if (v === null || v === undefined) return '—';
  const prefix = v < 0 ? '-' : '';
  return `${prefix}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

/** Format dollar with accounting parens for negatives: ($1,234) */
export const fmtDollarAcct = (v) => {
  if (v === null || v === undefined) return '—';
  if (v < 0) return `($${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })})`;
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

/** Format P&I payment: $1,234.56 */
export const fmtPI = (v) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Auto-pick 3 rates for comparison.
 * Picks: discounted rate (~0.75 pts buy-down), par rate, no-cost option.
 * Rates array from priceRates() is sorted HIGH→LOW by rate number.
 * Returns picks sorted LOW→HIGH (ascending by rate).
 */
export function getAutoPickRates(rates, lenderFees = 0, thirdPartyCosts = 0) {
  if (!rates.length) return [];

  // 1. Par rate: closest adjusted price to zero
  let parRate = rates[0];
  let minAbsAdj = Infinity;
  rates.forEach(r => {
    if (Math.abs(r.adjPrice) < minAbsAdj) { minAbsAdj = Math.abs(r.adjPrice); parRate = r; }
  });

  // 2. No-cost option: lowest rate where lender credit covers all loan costs
  // Rates are HIGH→LOW; no-cost candidates are higher rates with big credits.
  // Last candidate = lowest rate that still qualifies — best no-cost deal.
  const totalFixed = lenderFees + thirdPartyCosts;
  const noCostCandidates = rates.filter(r => (totalFixed + r.creditDollars) <= 0);
  const noCostRate = noCostCandidates.length > 0
    ? noCostCandidates[noCostCandidates.length - 1]
    : null;

  // 3. Discounted rate: moderate buy-down, adjPrice closest to 0.75 points
  const costRates = rates.filter(r => r.adjPrice >= 0.25);
  const discountRate = costRates.length > 0
    ? costRates.reduce((best, r) =>
        Math.abs(r.adjPrice - 0.75) < Math.abs(best.adjPrice - 0.75) ? r : best
      )
    : null;

  // Collect unique picks, sorted by rate ascending (low→high)
  const picks = new Map();
  if (discountRate) picks.set(discountRate.rate, discountRate);
  picks.set(parRate.rate, parRate);
  if (noCostRate) picks.set(noCostRate.rate, noCostRate);

  return Array.from(picks.values()).sort((a, b) => a.rate - b.rate).slice(0, 3);
}
