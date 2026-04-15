/**
 * Everstream rate sheet CSV parser.
 *
 * Input: Everstream's daily rate CSV, 5 columns:
 *   Product, Commit Period, Note Rate, FinalBasePrice, Release Time
 *
 * Output: array of rows suitable for INSERT into nonqm_rate_products.
 *
 * The CSV contains ALL Everstream products — forward conventional/FHA/VA as well
 * as DSCR + Expanded Prime Plus (bank statement). This parser filters to the
 * Non-QM subset only; the forward products will be handled by the existing
 * forward pricing engine.
 *
 * Product name taxonomy seen in real sheets (April 2026):
 *
 *   DSCR Plus 10/6 Arm Core                    → { loan_type: 'dscr', tier: 'core', type: 'arm', arm: 10/6 }
 *   DSCR Plus Fixed 30 Core                    → { loan_type: 'dscr', tier: 'core', type: 'fixed', term: 30 }
 *   DSCR Rate Sheet1 30 Yr. Fixed Elite        → { loan_type: 'dscr', tier: 'elite_1', type: 'fixed', term: 30 }
 *   DSCR Rate Sheet1 7yr/6m ARM Elite          → { loan_type: 'dscr', tier: 'elite_1', type: 'arm', arm: 7/6 }
 *   DSCR Rate Sheet2 30 Yr. Fixed Elite        → { loan_type: 'dscr', tier: 'elite_2', ... }
 *   DSCR Select Rate Sheet5 10yr/6m ARM Elite  → { loan_type: 'dscr', tier: 'elite_5', ... }
 *   Expanded Prime Plus Fixed 30 Core          → { loan_type: 'bankstatement', tier: 'core', ... }
 *   Expanded Prime Plus 7/6 Arm Core           → { loan_type: 'bankstatement', tier: 'core', type: 'arm', ... }
 *
 * For DSCR ARMs the amortization term is always 30 years (the leading number is
 * the fixed-rate period). Fixed-rate DSCRs have explicit term in the product name.
 */

const LENDER_CODE = 'everstream';

/**
 * Parse the CSV content string into an object:
 *   { effective_at, products: [...], nonqm_count, total_count }
 * where products is an array of DB-ready rows for nonqm_rate_products.
 */
export function parseEverstreamRatesCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  if (!header || !/^Product,Commit Period,Note Rate,FinalBasePrice,Release Time/i.test(header)) {
    throw new Error('Unexpected CSV header — expected Everstream 5-column format');
  }

  const products = [];
  let effectiveAt = null;
  let totalRows = 0;
  const skipped = [];

  for (const line of lines) {
    totalRows++;
    const parts = line.split(',');
    if (parts.length < 5) continue;
    const [rawProduct, commitPeriodStr, noteRateStr, finalBasePriceStr, releaseTimeStr] = parts;

    // Capture the release time (assumes it's uniform across the file)
    if (!effectiveAt && releaseTimeStr) {
      effectiveAt = parseReleaseTime(releaseTimeStr);
    }

    const parsed = parseProductName(rawProduct);
    if (!parsed) continue; // not a non-QM product we care about

    const row = {
      lender_code: LENDER_CODE,
      loan_type: parsed.loan_type,
      tier: parsed.tier,
      product_type: parsed.product_type,
      term: parsed.term,
      arm_fixed_period: parsed.arm_fixed_period,
      arm_adj_period: parsed.arm_adj_period,
      lock_days: parseInt(commitPeriodStr, 10),
      note_rate: Number(noteRateStr),
      final_base_price: Number(finalBasePriceStr),
      raw_product_name: rawProduct,
    };

    // Sanity check the numeric fields — skip obviously bad rows
    if (
      !Number.isFinite(row.note_rate) ||
      !Number.isFinite(row.final_base_price) ||
      !Number.isFinite(row.lock_days) ||
      !parsed.tier ||
      !parsed.product_type
    ) {
      skipped.push(rawProduct);
      continue;
    }

    products.push(row);
  }

  return {
    lender_code: LENDER_CODE,
    effective_at: effectiveAt,
    total_rows: totalRows,
    nonqm_count: products.length,
    products,
    skipped,
  };
}

/**
 * Parse a product name string into { loan_type, tier, product_type, term, arm_* }.
 * Returns null if the product isn't a Non-QM product we care about.
 */
export function parseProductName(name) {
  if (typeof name !== 'string') return null;
  const n = name.trim();

  let loan_type = null;
  if (/^DSCR/i.test(n)) loan_type = 'dscr';
  else if (/^Expanded Prime Plus/i.test(n)) loan_type = 'bankstatement';
  else return null;

  // Tier detection — check specific patterns first, fall back to Core.
  let tier = null;
  if (/Rate Sheet1\b/i.test(n)) tier = 'elite_1';
  else if (/Rate Sheet2\b/i.test(n)) tier = 'elite_2';
  else if (/Rate Sheet5\b/i.test(n) || /\bSelect\b/i.test(n)) tier = 'elite_5';
  else if (/\bCore\b/i.test(n)) tier = 'core';
  else if (/\bElite\b/i.test(n)) {
    // Elite-named row without Sheet1/2/5 — shouldn't happen but protect against it.
    tier = 'elite_1';
  }

  // Product type + term + ARM detection
  let product_type = null;
  let term = null;
  let arm_fixed_period = null;
  let arm_adj_period = null;

  // ARM patterns: "7/6 Arm", "7yr/6m ARM", "5/6 ARM"
  const armMatch =
    n.match(/(\d+)\s*yr\s*\/\s*(\d+)\s*m\s*arm/i) ||
    n.match(/(\d+)\s*\/\s*(\d+)\s*arm/i);

  if (armMatch) {
    product_type = 'arm';
    arm_fixed_period = Number(armMatch[1]);
    arm_adj_period = Number(armMatch[2]); // expressed in months
    term = 30; // Everstream DSCR/NonQM ARMs are always 30yr amort
  } else {
    // Fixed patterns: "Fixed 30", "Fixed 15", "30 Yr. Fixed"
    const fixedMatch =
      n.match(/Fixed\s+(\d+)/i) ||
      n.match(/(\d+)\s*Yr\.?\s*Fixed/i);
    if (fixedMatch) {
      product_type = 'fixed';
      term = Number(fixedMatch[1]);
    }
  }

  return { loan_type, tier, product_type, term, arm_fixed_period, arm_adj_period };
}

/**
 * Everstream ships release time as "4/15/2026 10:40" (US date, no seconds, local time).
 * Parse into an ISO timestamp. The lender publishes in Mountain time so we anchor there.
 */
function parseReleaseTime(s) {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, mm, dd, yyyy, hh, min] = m;
  // Treat as UTC-equivalent instant. Downstream consumers can rebase if needed.
  return new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min, 0)).toISOString();
}
