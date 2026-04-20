/**
 * Quote date defaults — closing / funding / first-payment derivation.
 *
 * Canonical source for rules previously duplicated in:
 *   - QuoteScenarioForm.js (getDefaultClosingDate, deriveFromClosing)
 *   - QuoteWizard.js (defaultClosingDate, defaultFundingDate,
 *     firstPaymentFromClosing) — the QB-3 regression caught in the D7 audit
 *
 * Rules:
 *   - Default closing date = 4 business days BEFORE the last business day
 *     of the current month (or next month if the computed date is past).
 *   - Default funding date: CO + TX purchase = same day as closing.
 *     CA + OR purchase = closing + 3 business days. All refinances (including
 *     cashout) = closing + 3 business days (TILA rescission period).
 *   - First payment date = 1st of the 2nd month after closing (estimate;
 *     fee editor refines from funding day when lender-specific rules apply).
 *
 * Date-rule source-of-truth candidate — a future ref_funding_rules table
 * (D9d scope) would replace this module's hardcoded CO/TX/CA/OR logic.
 */

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function addBusinessDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return fmtDate(d);
}

export function getDefaultClosingDate(today = new Date()) {
  const anchor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (let offset = 0; offset <= 1; offset++) {
    const y = anchor.getFullYear();
    const m = anchor.getMonth() + offset;
    const lastDay = new Date(y, m + 1, 0);
    while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
      lastDay.setDate(lastDay.getDate() - 1);
    }
    const closing = new Date(lastDay);
    let count = 0;
    while (count < 4) {
      closing.setDate(closing.getDate() - 1);
      if (closing.getDay() !== 0 && closing.getDay() !== 6) count++;
    }
    if (closing >= anchor) return fmtDate(closing);
  }
  return fmtDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 15));
}

export function getDefaultFundingDate(closingStr, state, purpose) {
  if (!closingStr) return '';
  const isRefi = purpose === 'refinance' || purpose === 'cashout';
  const needsDelay = isRefi || state === 'CA' || state === 'OR';
  return needsDelay ? addBusinessDays(closingStr, 3) : closingStr;
}

export function getFirstPaymentDate(closingStr) {
  if (!closingStr) return '';
  const [y, m] = closingStr.split('-').map(Number);
  const fp = new Date(y, m + 1, 1);
  return `${fp.getFullYear()}-${String(fp.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Convenience: given closing + state + purpose, return the full defaults
 * bundle. Used by QuoteScenarioForm on mount and on state/purpose change.
 */
export function deriveFromClosing(closingStr, state, purpose) {
  if (!closingStr) return {};
  return {
    funding_date: getDefaultFundingDate(closingStr, state, purpose),
    first_payment_date: getFirstPaymentDate(closingStr),
  };
}
