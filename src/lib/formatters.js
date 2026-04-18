/**
 * Shared number formatters for user-facing displays.
 *
 * Rules (see memory/feedback_number_formatting.md):
 *   1. Rates = 3 decimals always (5.990%, 0.000%)
 *   2. Zeros show as real numbers ($0, 0.000%) — not placeholders
 *   3. Dollars = en-US thousands separators always ($1,000,000)
 *
 * The em-dash (—) is reserved for truly-missing data (null / undefined /
 * non-finite). A computed value of zero must render as the literal zero.
 */

/**
 * Format an interest rate. Always 3 decimals.
 * @param {number} n — rate as a percentage (e.g. 5.875 for 5.875%)
 * @returns {string} e.g. "5.875%" or "—" if n is null/NaN/Infinity
 */
export function fmtRate(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(3) + '%';
}

/**
 * Format a dollar amount. Integer, en-US thousands separators.
 * Zero renders as "$0", not "—". Negative values keep their sign.
 * @param {number} n — dollar amount
 * @returns {string} e.g. "$1,000,000" or "$0" or "-$500" or "—" if null
 */
export function fmtDollars(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return sign + '$' + Math.abs(rounded).toLocaleString('en-US');
}

/**
 * Format a generic percentage (LTV, DTI, CLTV — NOT mortgage rates).
 * For mortgage rates, use fmtRate (3 decimals).
 * @param {number} n — percentage value (e.g. 75 for 75%)
 * @param {number} [decimals=1] — decimals to show
 * @returns {string} e.g. "75.5%" or "—" if null/NaN
 */
export function fmtPct(n, decimals = 1) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(decimals) + '%';
}
