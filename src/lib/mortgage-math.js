/**
 * Shared mortgage math utilities.
 * Single source of truth for PI calculation, LTV, and other formulas
 * used across: public rate tool, MLO quote generator, borrower My Rates,
 * rate alert cron, and scenario alerts.
 */

/**
 * Calculate monthly principal & interest payment.
 * @param {number} annualRate - Annual interest rate as a percentage (e.g. 6.5)
 * @param {number} loanAmount - Loan amount in dollars
 * @param {number} termYears - Loan term in years (default 30)
 * @returns {number|null} Monthly P&I payment, or null if inputs invalid
 */
export function calculateMonthlyPI(annualRate, loanAmount, termYears = 30) {
  if (!annualRate || !loanAmount) return null;
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return loanAmount / n;
  return (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Calculate LTV ratio.
 * Uses Math.floor to avoid rounding up into a worse LLPA band.
 * @param {number} loanAmount
 * @param {number} propertyValue
 * @returns {number} LTV as a percentage (e.g. 80.00)
 */
export function calculateLTV(loanAmount, propertyValue) {
  if (!propertyValue || propertyValue <= 0) return 0;
  return Math.floor((loanAmount / propertyValue) * 10000) / 100;
}

/**
 * Format a number as currency.
 * @param {number} value
 * @returns {string} Formatted string (e.g. "$1,234.56")
 */
export function formatDollar(value) {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
