/**
 * Shared mortgage math utilities.
 *
 * Used by pricing snapshots, BRP display, and calculators.
 */

/**
 * Calculate monthly principal & interest payment.
 * @param {number} ratePercent — annual interest rate as a percentage (e.g. 6.5)
 * @param {number} loanAmount — loan amount in dollars
 * @param {number} termYears — loan term in years (default 30)
 * @returns {number|null} — monthly P&I rounded to 2 decimals, or null if inputs invalid
 */
export function calcMonthlyPI(ratePercent, loanAmount, termYears = 30) {
  if (!ratePercent || !loanAmount || ratePercent <= 0 || loanAmount <= 0) return null;
  const r = ratePercent / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return Math.round((loanAmount / n) * 100) / 100;
  const payment = (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(payment * 100) / 100;
}
