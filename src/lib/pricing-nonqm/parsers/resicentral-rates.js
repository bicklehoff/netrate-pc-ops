/**
 * ResiCentral DSCR rate sheet parser (XLSX).
 *
 * Source spec: `Work/Dev/RESICENTRAL-LLPA-INVENTORY-2026-04-27.md` §4.
 *
 * Each in-scope tab follows the same layout:
 *
 *   row 12        program name in col A (informational)
 *   row 14        variant headers in cols B / H / N (3 variants per program)
 *   row 15        "Days to Lock" label in cols D / J / P (informational)
 *   row 16        per-column headers — rate label + 30/45/60 lock-day cols
 *   row 17+       rate ladder — col B/H/N = note rate, cols D-F/J-L/P-R = prices
 *
 * Variant filter per program (§4.4 of inventory):
 *
 *   Premier           30Y Fixed ✅   30Y Fixed IO ❌   40Yr Fixed/40Yr Fixed IO ✅ (treat as 40Y Fixed)
 *   Investor Premier  30Y Fixed ✅   30Y Fixed IO ❌   40 Year Fixed IO ❌
 *   Elite             30Y Fixed ✅   30Y Fixed IO ❌   40 Year Fixed IO ❌
 *   Select            30Y Fixed & 30Y IO ✅ (treat as 30Y Fixed)   15Y Fixed ✅   40Y Fixed IO ❌
 *
 * Result: 6 in-scope (program × term) ladders × 3 lock days × ~50 rates
 * ≈ 900 product rows.
 *
 * The Elite tab also contains a 5/6 ARM section after the fixed ladder.
 * That's out of scope for D9c.6 — the parser stops scanning each variant
 * column when it encounters a non-numeric cell in the rate column (the
 * "DSCR Elite 5/6 Arm" header is the natural break).
 *
 * Effective date is parsed from the filename pattern
 * `<lender_id>_<MMDDYYYY>_<seq>.xlsx`. The workbook itself has only
 * "Indicative pricing" boilerplate, no machine-readable date.
 */

import * as XLSX from 'xlsx';
import { parseCell, cellStr } from './lib/cells.js';
import { parseEffectiveDateFromFilename } from './lib/effective-date.js';

const LENDER_CODE = 'resicentral';

// Tab name → tier (snake_case, lender-scoped per AD-3 — no semantic
// overlap with Everstream's elite_1/elite_2/elite_5).
const TIER_TAB_MAP = {
  'DSCR Premier':           'premier',
  'DSCR Investor Premier':  'investor_premier',
  'DSCR Elite':             'elite',
  'DSCR Select':            'select',
};

// Anchor rows / columns. Per §4 of inventory.
const VARIANT_HEADER_ROW = 14;
const RATE_AXIS_HEADER_ROW = 16;
const LADDER_START_ROW = 17;
const LOCK_DAYS = [30, 45, 60];

// Each variant occupies 6 columns: [rateCol, blank, price30, price45, price60, blank]
// 0-indexed (XLSX → array): col B = 1, H = 7, N = 13.
const VARIANT_LAYOUT = [
  { rateCol: 1,  priceCols: [3, 4, 5]    },
  { rateCol: 7,  priceCols: [9, 10, 11]  },
  { rateCol: 13, priceCols: [15, 16, 17] },
];

// Static spec of expected variant headers per (tier, rateCol). The parser
// validates row 14 against `match` to confirm we're parsing the right
// column. If a column doesn't match, it lands in skipped[] rather than
// being mistakenly tagged with a stale config. Variants flagged
// in_scope:false are intentionally filtered (skip without a warning).
const VARIANT_EXPECTED = {
  premier: {
    1:  { match: /^DSCR Premier 30 Year Fixed$/i,                 term: 30, in_scope: true,  label: '30Y Fixed' },
    7:  { match: /^DSCR Premier 30 Year Fixed IO$/i,              term: 30, in_scope: false, label: '30Y IO' },
    13: { match: /^DSCR Premier 40Yr Fixed\/40Yr Fixed IO$/i,     term: 40, in_scope: true,  label: '40Y Fixed (combined w/ IO)' },
  },
  investor_premier: {
    1:  { match: /^DSCR Investor Premier 30 Year Fixed$/i,        term: 30, in_scope: true,  label: '30Y Fixed' },
    7:  { match: /^DSCR Investor Premier 30 Year Fixed IO$/i,     term: 30, in_scope: false, label: '30Y IO' },
    13: { match: /^DSCR Investor Premier 40 Year Fixed IO$/i,     term: 40, in_scope: false, label: '40Y IO' },
  },
  elite: {
    1:  { match: /^DSCR Elite 30 Year Fixed$/i,                   term: 30, in_scope: true,  label: '30Y Fixed' },
    7:  { match: /^DSCR Elite 30 Year Fixed IO$/i,                term: 30, in_scope: false, label: '30Y IO' },
    13: { match: /^DSCR Elite 40 Year Fixed IO$/i,                term: 40, in_scope: false, label: '40Y IO' },
  },
  select: {
    1:  { match: /^DSCR Select 30 Year Fixed & 30 Year IO$/i,     term: 30, in_scope: true,  label: '30Y Fixed (combined w/ IO)' },
    7:  { match: /^DSCR Select 15 Year Fixed$/i,                  term: 15, in_scope: true,  label: '15Y Fixed' },
    13: { match: /^DSCR Select 40 Year Fixed IO$/i,               term: 40, in_scope: false, label: '40Y IO' },
  },
};

/**
 * Parse the workbook buffer.
 *
 * @param {Buffer|ArrayBuffer} buf
 * @param {string} [filename] - source filename, used to extract effective_at
 * @returns {{
 *   lender_code: string,
 *   effective_at: string|null,    // ISO timestamp or null
 *   products: Array<Object>,      // DB-ready rows for nonqm_rate_products
 *   nonqm_count: number,
 *   total_rows: number,
 *   tiers_seen: string[],
 *   skipped: string[],
 * }}
 */
export function parseResicentralRatesXlsx(buf, filename = '') {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const products = [];
  const tiersSeen = [];
  const skipped = [];

  for (const [tabName, tier] of Object.entries(TIER_TAB_MAP)) {
    const sh = wb.Sheets[tabName];
    if (!sh) {
      skipped.push(`missing tab: ${tabName}`);
      continue;
    }
    const data = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: null });

    // Sanity-check the rate axis header row before processing variants.
    if (!isRateAxisRow(data[RATE_AXIS_HEADER_ROW])) {
      skipped.push(`${tier}: row ${RATE_AXIS_HEADER_ROW} not the expected Rate header — layout drift?`);
      continue;
    }

    const before = products.length;
    parseTab(data, tier, products, skipped);
    if (products.length > before) tiersSeen.push(tier);
  }

  const effectiveDate = parseEffectiveDateFromFilename(filename);

  return {
    lender_code: LENDER_CODE,
    effective_at: effectiveDate ? effectiveDate.toISOString() : null,
    products,
    nonqm_count: products.length,
    total_rows: products.length,
    tiers_seen: tiersSeen,
    skipped,
  };
}

/**
 * Validate that row 16 looks like the Rate axis header — col 1 / 7 / 13
 * should each say "Rate", and the price columns should carry the lock
 * day labels. We only check the rate cells (cheapest signal).
 */
function isRateAxisRow(row) {
  if (!row) return false;
  return /^Rate$/i.test(cellStr(row[1])) &&
         /^Rate$/i.test(cellStr(row[7])) &&
         /^Rate$/i.test(cellStr(row[13]));
}

/**
 * Parse all 3 variant ladders in a single tab.
 */
function parseTab(data, tier, products, skipped) {
  const variantHeaderRow = data[VARIANT_HEADER_ROW] ?? [];
  const expected = VARIANT_EXPECTED[tier];
  if (!expected) {
    skipped.push(`${tier}: no VARIANT_EXPECTED entry — coding error`);
    return;
  }

  for (const layout of VARIANT_LAYOUT) {
    const rateCol = layout.rateCol;
    const cfg = expected[rateCol];
    if (!cfg) continue;

    const headerText = cellStr(variantHeaderRow[rateCol]);
    if (!cfg.match.test(headerText)) {
      // Layout drift — record but don't crash. The other variants in the
      // tab may still parse cleanly.
      skipped.push(
        `${tier} col ${rateCol}: variant header ${JSON.stringify(headerText)} ` +
        `doesn't match expected ${cfg.match} (expected: ${cfg.label})`
      );
      continue;
    }

    if (!cfg.in_scope) continue;   // intentionally filtered (e.g. IO variants)

    extractLadder(data, tier, rateCol, layout.priceCols, cfg, products);
  }
}

/**
 * Walk a single variant's rate ladder, emitting one product row per
 * (rate × lock-day) pair. Stops scanning when the rate column transitions
 * from numeric to non-empty text — the natural break for the Elite ARM
 * section that follows the fixed ladder.
 */
function extractLadder(data, tier, rateCol, priceCols, cfg, products) {
  for (let r = LADDER_START_ROW; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;

    const rawRate = row[rateCol];
    if (rawRate === null || rawRate === undefined || rawRate === '') continue; // blank — keep scanning

    const rate = parseCell(rawRate);
    if (rate === null) {
      // Non-numeric text in the rate column — section transition (e.g.
      // "DSCR Elite 5/6 Arm"). Stop scanning this variant.
      break;
    }

    for (let li = 0; li < LOCK_DAYS.length; li++) {
      const price = parseCell(row[priceCols[li]]);
      if (price === null) continue;

      products.push({
        lender_code: LENDER_CODE,
        loan_type: 'dscr',
        tier,
        product_type: 'fixed',
        term: cfg.term,
        arm_fixed_period: null,
        arm_adj_period: null,
        lock_days: LOCK_DAYS[li],
        note_rate: rate,
        final_base_price: price,
        raw_product_name: `ResiCentral DSCR ${tier} ${cfg.term}yr Fixed`,
      });
    }
  }
}
