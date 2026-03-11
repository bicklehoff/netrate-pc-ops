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
 * Auto-pick 3 rates when the user hasn't selected any for comparison.
 * Picks: lowest rate (highest cost), par rate, highest credit rate.
 */
export function getAutoPickRates(visibleRates) {
  let parRate = visibleRates[0];
  let minAbsAdj = Infinity;
  visibleRates.forEach(r => {
    if (Math.abs(r.adjPrice) < minAbsAdj) { minAbsAdj = Math.abs(r.adjPrice); parRate = r; }
  });

  const costRates = visibleRates.filter(r => r.adjPrice > 0.15);
  const creditRates = visibleRates.filter(r => r.adjPrice < -0.15);

  const picks = [parRate];
  if (costRates.length > 0) picks.unshift(costRates[costRates.length - 1]);
  if (creditRates.length > 0) picks.push(creditRates[0]);

  const seen = new Set();
  return picks.filter(r => {
    if (seen.has(r.rate)) return false;
    seen.add(r.rate);
    return true;
  }).slice(0, 3);
}
