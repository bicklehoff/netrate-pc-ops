/**
 * Escrow calculation from loan dates.
 *
 * Given closing date + first payment date, computes:
 *   - Insurance months (prepaid annual premium + escrow cushion)
 *   - Tax months in escrow (months to next tax due + cushion)
 *   - Daily interest (per diem for days from closing to end of month)
 *
 * State tax due date schedules:
 *   CO: April 30 (1st half) / June 15 (2nd half) — semi-annual
 *   CA: November 1 (1st half) / February 1 (2nd half) — semi-annual
 *   TX: January 31 — annual
 *   OR: November 15 — annual
 *   Default: 6-month generic estimate
 */

// [ [month (0-indexed), day], ... ] per state — all due dates in a year
const TAX_DUE_DATES = {
  CO: [[3, 30], [5, 15]],          // April 30, June 15
  CA: [[10, 1], [1, 1]],           // Nov 1, Feb 1 (Feb 1 is month index 1)
  TX: [[0, 31]],                   // Jan 31
  OR: [[10, 15]],                  // Nov 15
};

const ESCROW_CUSHION_MONTHS = 2;   // Standard lender cushion added to reserve months

/**
 * Find the next tax due date on or after the given date.
 * Returns a Date object.
 */
function nextTaxDueDate(fromDate, state) {
  const dueDates = TAX_DUE_DATES[state] || [[5, 1], [11, 1]]; // Default: Jun 1, Dec 1
  const year = fromDate.getFullYear();

  const candidates = [];

  // Try current year and next year to cover year-boundary cases
  for (const yearOffset of [0, 1]) {
    for (const [month, day] of dueDates) {
      const d = new Date(year + yearOffset, month, day);
      if (d >= fromDate) candidates.push(d);
    }
  }

  candidates.sort((a, b) => a - b);
  return candidates[0];
}

/**
 * Calculate months between two dates (ceiling — partial month counts as full).
 */
function monthsBetween(from, to) {
  const yearDiff = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  const dayDiff = to.getDate() - from.getDate();
  const rawMonths = yearDiff * 12 + monthDiff + (dayDiff > 0 ? 1 : 0);
  return Math.max(rawMonths, 0);
}

/**
 * Calculate escrow months + per diem interest from loan dates.
 *
 * @param {Object} params
 * @param {Date|string} params.closingDate
 * @param {Date|string} [params.firstPaymentDate]  — optional, for per-diem calc
 * @param {string}      [params.state]             — state code
 * @param {number}      [params.annualRate]         — interest rate (e.g. 6.75) for per diem
 * @param {number}      [params.loanAmount]         — for per diem dollar calc
 *
 * @returns {{
 *   insuranceMonths: number,
 *   taxMonths: number,
 *   daysToEndOfMonth: number,
 *   perDiemInterest: number,    — daily $ interest
 *   prepaidInterestTotal: number — days × perDiemInterest
 * }}
 */
export function calculateEscrow({ closingDate, state = 'CO', annualRate = 0, loanAmount = 0 }) {
  const closing = closingDate instanceof Date ? closingDate : new Date(closingDate);
  if (isNaN(closing.getTime())) {
    return defaultEscrow(state);
  }

  // ── Insurance months ──────────────────────────────────────────────────────
  // Lenders collect: 12 months prepaid (at close) + cushion months in escrow
  // The cushion ensures the escrow account never goes negative between payment
  // and insurance renewal. Standard = 2 months.
  const insuranceMonths = ESCROW_CUSHION_MONTHS; // Escrow portion only; prepaid (12 mo) is section F

  // ── Tax months ────────────────────────────────────────────────────────────
  // Months from closing → next tax due date + cushion
  const nextDue = nextTaxDueDate(closing, state);
  const rawTaxMonths = monthsBetween(closing, nextDue);
  const taxMonths = rawTaxMonths + ESCROW_CUSHION_MONTHS;

  // ── Per diem interest ─────────────────────────────────────────────────────
  // Interest from closing date through end of the closing month.
  // First payment covers the following month's interest, so borrower pays
  // the remaining days of the closing month in advance at closing.
  const endOfClosingMonth = new Date(closing.getFullYear(), closing.getMonth() + 1, 0); // Last day of month
  const daysToEndOfMonth = endOfClosingMonth.getDate() - closing.getDate();
  const perDiemInterest = annualRate > 0 && loanAmount > 0
    ? Math.round((loanAmount * (annualRate / 100) / 365) * 100) / 100
    : 0;
  const prepaidInterestTotal = Math.round(perDiemInterest * daysToEndOfMonth * 100) / 100;

  return {
    insuranceMonths,
    taxMonths,
    daysToEndOfMonth,
    perDiemInterest,
    prepaidInterestTotal,
  };
}

/**
 * Default escrow values when no closing date is provided.
 * Uses template defaults (set in seed / DB) — no hardcoded fallbacks here.
 * The caller uses template.escrowInsuranceMonths / escrowTaxMonths instead.
 */
function defaultEscrow(state) {
  const taxMonthsDefault = { CO: 3, CA: 4, TX: 3, OR: 3 };
  return {
    insuranceMonths: ESCROW_CUSHION_MONTHS,
    taxMonths: taxMonthsDefault[state] ?? 3,
    daysToEndOfMonth: 0,
    perDiemInterest: 0,
    prepaidInterestTotal: 0,
  };
}
