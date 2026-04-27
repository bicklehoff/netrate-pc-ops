/**
 * ResiCentral DSCR LLPA parser (XLSX) — Premier + Investor Premier + Elite.
 *
 * Source spec: `Work/Dev/RESICENTRAL-LLPA-INVENTORY-2026-04-27.md` §5
 * (with §10.6 noting per-program layout differences).
 *
 * Two layouts in play:
 *
 *   Premier + Investor Premier — single-col labels:
 *     col 3 = label (DSCR ratio band / UPB row / property type / prepay / etc.)
 *     cols 4-12 = 9 LTV bands (0-50% through 85.01-90%)
 *     FICO grid: 10 bands (780-999 down to 600-619)
 *
 *   Elite (D9c.6.5b) — 2-col category + sub-label, forward-filled:
 *     col 3 = category (e.g. "DSCR Additional Adjust", "Housing History",
 *             "Prepayment Penalty"); forward-fills across blank rows
 *     col 4 = sub-label (e.g. ">=1.25", "1x30x12", "60 Months")
 *     cols 5-11 = 7 LTV bands (0-50% through 75.01-80%; Elite caps at 80% LTV)
 *     FICO grid: 9 bands (760-999 down to 600-619; no 780+ tier)
 *     State row "CT, IL, NJ, NY" + "Other Price Adjustments" (NJ Prepay
 *     overrides) are dropped — none of those states are in NetRate's license.
 *
 *   Select (D9c.6.5c, deferred) — cols 2+3 layout, Tier 2 LLPAs only.
 *
 * Implements the four locked decisions from §10:
 *   Q1 — Loan Amount Adj table → `rule_type='loan_size_secondary'`
 *   Q3 — Pricing Special rows → `rule_type='pricing_special'` with
 *        FICO/DSCR/LTV gates in the existing schema columns
 *   Q4 — Prepay term + structure split into separate `rule_type` values:
 *        `prepay_term` (matches by prepay_years) and `prepay_structure`
 *        (matches by feature: 'declining' / 'fixed_5' / 'six_months_interest')
 *   AD-7 — LICENSED_STATES filter is applied at parse time (no state-
 *        specific rows in Premier/InvPremier; filter codified in
 *        lender-display.js for D9c.6.5b/c when state rows show up)
 */

import * as XLSX from 'xlsx';
import { cellStr, parseCell } from './lib/cells.js';
import { findRowByTextInCol, findCellByText } from './lib/anchor-by-text.js';
import { extractFicoLtvGrid } from './lib/fico-ltv-grid.js';
import { extractFeatureLtvGrid } from './lib/feature-ltv-grid.js';

const LENDER_CODE = 'resicentral';

// ResiCentral expresses LLPAs as decimal fractions of par (e.g.
// `0.01125` = 1.125 points), while the rest of the pricer stack and
// Everstream's data use points directly. Confirmed 2026-04-27 by
// comparing a known DSCR Select 30Yr Fixed scenario in LoanSifter:
//   - Workbook value `0.005` (Pricing Special) → LS shows `+0.500` pts
//   - Workbook value `-0.01125` (No PPP)        → LS shows `-1.125` pts
// Multiplying by 100 brings LLPAs into points so they sum correctly
// with `final_base_price` (which IS in points natively).
//
// Does NOT apply to: note_rate (in percent), final_base_price (points),
// price_cap (points). Those pass through unchanged.
const LLPA_SCALE = 100;

/**
 * Apply LLPA_SCALE and round to 6 decimals to clean up float artifacts
 * (e.g. 0.00875 * 100 = 0.8750000000000001 → 0.875). Used by the inline
 * block extractors (Loan Amount Adj, Misc Adjustments) which don't go
 * through the shared utilities' valueScale path.
 */
function scaleLlpa(rawValue) {
  return Math.round(rawValue * LLPA_SCALE * 1_000_000) / 1_000_000;
}

// Map of tab name → { tier, shape }. `shape` selects the parser variant:
//   'premier_shaped' — single-col labels, 9 LTV bands, 10 FICO bands.
//   'elite_shaped'   — 2-col category+sub-label, 7 LTV bands, 9 FICO bands.
const TIER_TAB_MAP_IN_SCOPE = {
  'DSCR Premier LLPAs':           { tier: 'premier',          shape: 'premier_shaped' },
  'DSCR Investor Premier LLPAs':  { tier: 'investor_premier', shape: 'premier_shaped' },
  'DSCR Elite LLPAs':             { tier: 'elite',            shape: 'elite_shaped'   },
};

// Tabs known to exist but deferred per inventory §10.6.
const TIER_TAB_MAP_DEFERRED = {
  'DSCR Select LLPA': 'select',     // singular per inventory
};

// 10 FICO bands top-to-bottom, matching Premier + InvPremier sheet order.
const FICO_BANDS = [
  { min: 780, max: 999, label: '780-999' },
  { min: 760, max: 779, label: '760-779' },
  { min: 740, max: 759, label: '740-759' },
  { min: 720, max: 739, label: '720-739' },
  { min: 700, max: 719, label: '700-719' },
  { min: 680, max: 699, label: '680-699' },
  { min: 660, max: 679, label: '660-679' },
  { min: 640, max: 659, label: '640-659' },
  { min: 620, max: 639, label: '620-639' },
  { min: 600, max: 619, label: '600-619' },
];

// Elite caps the FICO grid at 760+ (no 780+ tier), so its top row covers
// the full 760-999 range in a single band.
const FICO_BANDS_ELITE = [
  { min: 760, max: 999, label: '760-999' },
  { min: 740, max: 759, label: '740-759' },
  { min: 720, max: 739, label: '720-739' },
  { min: 700, max: 719, label: '700-719' },
  { min: 680, max: 699, label: '680-699' },
  { min: 660, max: 679, label: '660-679' },
  { min: 640, max: 659, label: '640-659' },
  { min: 620, max: 639, label: '620-639' },
  { min: 600, max: 619, label: '600-619' },
];

// 9 LTV bands left-to-right, matching cols 4-12 of the LLPA tabs.
const LTV_BANDS = [
  { min: 0,     max: 50 },
  { min: 50.01, max: 55 },
  { min: 55.01, max: 60 },
  { min: 60.01, max: 65 },
  { min: 65.01, max: 70 },
  { min: 70.01, max: 75 },
  { min: 75.01, max: 80 },
  { min: 80.01, max: 85 },
  { min: 85.01, max: 90 },
];

// Elite caps at 80% LTV — drops the top two bands.
const LTV_BANDS_ELITE = LTV_BANDS.slice(0, 7);

// Anchor columns/cols. Per §5.1-§5.5 of the inventory.
// Premier + InvPremier shape:
const FICO_GRID_DATA_START_COL = 4;
const FEATURE_GRID_LABEL_COL = 3;
const FEATURE_GRID_DATA_START_COL = 4;
// Elite shape (per §10.6 + r-by-r inspection 2026-04-27):
const ELITE_FICO_GRID_DATA_START_COL = 5;
const ELITE_FEATURE_CATEGORY_COL = 3;
const ELITE_FEATURE_SUBLABEL_COL = 4;
const ELITE_FEATURE_DATA_START_COL = 5;
// Side blocks (same column positions across all programs in this sheet):
const MAX_PRICE_LABEL_COL = 6;
const MAX_PRICE_VALUE_COL = 7;
const LOAN_AMOUNT_LABEL_COL = 9;
const LOAN_AMOUNT_VALUE_COL = 11;
const MISC_LABEL_COL = 3;
const MISC_VALUE_COL = 4;

/**
 * Parse a ResiCentral DSCR LLPA workbook buffer.
 * Returns { lender_code, rules, tiers_seen, skipped }.
 */
export function parseResicentralLlpasXlsx(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rules = [];
  const tiers_seen = [];
  const skipped = [];

  for (const [tabName, { tier, shape }] of Object.entries(TIER_TAB_MAP_IN_SCOPE)) {
    const sh = wb.Sheets[tabName];
    if (!sh) {
      skipped.push(`missing tab: ${tabName}`);
      continue;
    }
    const data = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: null });
    const before = rules.length;
    if (shape === 'elite_shaped') {
      parseEliteTab(data, tier, rules, skipped);
    } else {
      parseTab(data, tier, rules, skipped);
    }
    if (rules.length > before) tiers_seen.push(tier);
  }

  // Note deferred tabs in skipped[] for visibility.
  for (const [tabName, tier] of Object.entries(TIER_TAB_MAP_DEFERRED)) {
    if (wb.Sheets[tabName]) {
      skipped.push(`${tier}: deferred to D9c.6.5c (cols 2+3 layout — see inventory §10.6)`);
    }
  }

  return { lender_code: LENDER_CODE, rules, tiers_seen, skipped };
}

/**
 * Parse one DSCR LLPA tab (Premier or Investor Premier shape).
 */
function parseTab(data, tier, rules, skipped) {
  const baseFields = {
    lender_code: LENDER_CODE,
    tier,
    product_type: null,
    occupancy: 'investment',         // DSCR is always NOO per AD-3
  };

  // ── 1. FICO×LTV grid ────────────────────────────────────────────
  const ficoAnchor = findCellByText(data, /^FICO\s+Score\s*\/\s*LTV/i);
  if (!ficoAnchor) {
    skipped.push(`${tier}: no "FICO Score/LTV Ratio" anchor`);
    return;
  }
  const ficoStartRow = findRowByTextInCol(
    data, FEATURE_GRID_LABEL_COL, /^\d{3}\s*-\s*\d{3,4}$/,
    { startRow: ficoAnchor.row }
  );
  if (ficoStartRow < 0) {
    skipped.push(`${tier}: couldn't locate first FICO band row after FICO anchor`);
    return;
  }
  rules.push(...extractFicoLtvGrid(
    data, ficoStartRow,
    { fico: FICO_BANDS, ltv: LTV_BANDS },
    {
      startCol: FICO_GRID_DATA_START_COL,
      payloadField: 'llpa_points',
      ruleType: 'fico_cltv_grid',
      ltvKey: 'cltv',
      baseFields: { ...baseFields, loan_purpose: null },     // ResiCentral doesn't split FICO grid by purpose
      rawLabelFn: (fico, ltv) => `${tier}/FICO ${fico.label}/CLTV ${ltv.min}-${ltv.max}`,
      valueScale: LLPA_SCALE,
    }
  ));

  // ── 2. Feature×LTV grid ────────────────────────────────────────
  const featureAnchor = findCellByText(
    data, /^Product\s+Feature\s*\/\s*LTV/i,
    { startRow: ficoStartRow + FICO_BANDS.length }
  );
  if (!featureAnchor) {
    skipped.push(`${tier}: no "Product Feature/LTV Ratio" anchor`);
    return;
  }
  // Axis row carries "Feature" in the label col + LTV bands.
  const featureAxisRow = findRowByTextInCol(
    data, FEATURE_GRID_LABEL_COL, /^Feature$/i,
    { startRow: featureAnchor.row }
  );
  if (featureAxisRow < 0) {
    skipped.push(`${tier}: no "Feature" axis row after feature anchor`);
    return;
  }

  // Feature grid ends at the "Fees" header (col 3) — the 3-block side-by-side
  // layout (Fees / Max Price / Loan Amount Adj) starts there.
  const feesRow = findRowByTextInCol(
    data, MISC_LABEL_COL, /^Fees$/i,
    { startRow: featureAxisRow }
  );
  const featureEnd = feesRow > 0 ? feesRow : data.length;

  rules.push(...extractFeatureLtvGrid(
    data, featureAxisRow + 1, featureEnd, LTV_BANDS,
    classifyFeatureLabel,
    {
      labelCol: FEATURE_GRID_LABEL_COL,
      startCol: FEATURE_GRID_DATA_START_COL,
      ltvKey: 'cltv',
      baseFields,
      valueScale: LLPA_SCALE,
    }
  ));

  // ── 3. Max Price block (under "Max Price <ProgramName>" header) ──
  // ── 4. Loan Amount Adj block (under "Loan Amount Adj" header) ────
  if (feesRow > 0) {
    parseMaxPriceBlock(data, feesRow + 1, baseFields, rules);
    parseLoanAmountAdjBlock(data, feesRow + 1, baseFields, rules);
  }

  // ── 5. Misc Adjustments block ──────────────────────────────────
  const miscRow = findRowByTextInCol(
    data, MISC_LABEL_COL, /^Misc\s+Adjustments$/i,
    { startRow: feesRow > 0 ? feesRow : 0 }
  );
  if (miscRow >= 0) {
    parseMiscAdjustments(data, miscRow + 1, baseFields, rules);
  }
}

/**
 * Classify a Premier/InvPremier feature-grid label into structured fields.
 * Returns null for labels we don't recognize (notes, asterisks) so the
 * shared `extractFeatureLtvGrid` skips them.
 */
function classifyFeatureLabel(label) {
  const l = label.trim();

  // ─── DSCR ratio bands ───
  if (/^No Ratio$/i.test(l)) {
    return { rule_type: 'dscr_ratio', dscr_ratio_min: null, dscr_ratio_max: 0, feature: 'no_ratio' };
  }
  // "DSCR 0.75 - 0.89" / "DSCR 0.85 - 0.99" / "DSCR 0.90 - 0.99" / "DSCR 1.00 - 1.24" / etc.
  const dscrRange = l.match(/^DSCR\s+(\d+\.\d+)\s*-\s*(\d+\.\d+)$/i);
  if (dscrRange) {
    return { rule_type: 'dscr_ratio', dscr_ratio_min: Number(dscrRange[1]), dscr_ratio_max: Number(dscrRange[2]) };
  }
  // "DSCR => 1.50" or "DSCR >= 1.50"
  const dscrGte = l.match(/^DSCR\s*=?>=?\s*(\d+\.\d+)$/i);
  if (dscrGte) {
    return { rule_type: 'dscr_ratio', dscr_ratio_min: Number(dscrGte[1]), dscr_ratio_max: null };
  }

  // ─── UPB bands (LTV-banded loan-size LLPAs from §5.2) ───
  // "UPB <=150K"
  const upbLte = l.match(/^UPB\s*<=?\s*\$?(\d+(?:\.\d+)?)\s*([Kk]|[Mm]+)?$/);
  if (upbLte) {
    return { rule_type: 'loan_size', loan_size_min: 0, loan_size_max: scaleAmount(upbLte[1], upbLte[2]) };
  }
  // "UPB >150K - 250K" / "UPB > 1.5mm - 2.0mm"
  const upbGtRange = l.match(/^UPB\s*>\s*\$?(\d+(?:\.\d+)?)\s*([Kk]|[Mm]+)?\s*-\s*\$?(\d+(?:\.\d+)?)\s*([Kk]|[Mm]+)?$/);
  if (upbGtRange) {
    return {
      rule_type: 'loan_size',
      loan_size_min: scaleAmount(upbGtRange[1], upbGtRange[2]) + 1,
      loan_size_max: scaleAmount(upbGtRange[3], upbGtRange[4]),
    };
  }
  // "UPB 250,001-350,000" / "UPB 1,000,001 - 1,500,000"
  const upbExplicit = l.match(/^UPB\s+([\d,]+)\s*-\s*([\d,]+)$/);
  if (upbExplicit) {
    return {
      rule_type: 'loan_size',
      loan_size_min: Number(upbExplicit[1].replace(/,/g, '')),
      loan_size_max: Number(upbExplicit[2].replace(/,/g, '')),
    };
  }

  // ─── Loan purpose ───
  if (/^Cash Out\s*\/\s*Debt Consolidation$/i.test(l)) {
    return { rule_type: 'loan_purpose', loan_purpose: 'cashout' };
  }

  // ─── Property type ───
  if (/Non.?Warrantable Condo/i.test(l))   return { rule_type: 'property_type', property_type: 'nonwarr_condo' };
  if (/^Condo$/i.test(l))                  return { rule_type: 'property_type', property_type: 'condo' };
  if (/^2 Unit Property$/i.test(l))        return { rule_type: 'property_type', property_type: '2unit' };
  if (/^3-4 Unit Property$/i.test(l))      return { rule_type: 'property_type', property_type: '3_4unit' };

  // ─── Prepay TERM (Q4 split) ───
  // "5yr PPP" / "4yr PPP" / "3yr PPP" / "2yr PPP" / "1yr PPP"
  const prepayTerm = l.match(/^(\d+)\s*yr\s*PPP/i);
  if (prepayTerm) {
    return { rule_type: 'prepay_term', prepay_years: Number(prepayTerm[1]) };
  }
  // "No PPP" or "No PPP* (exception ...)"
  if (/^No\s*PPP\b/i.test(l)) {
    return { rule_type: 'prepay_term', prepay_years: 0 };
  }

  // ─── Prepay STRUCTURE (Q4 split) ───
  if (/Declining\s+Prepay/i.test(l))          return { rule_type: 'prepay_structure', feature: 'declining' };
  if (/5%\s*Flat\s+Prepay/i.test(l))          return { rule_type: 'prepay_structure', feature: 'fixed_5' };
  if (/6\s*Months?\s+Interest\s+Prepay/i.test(l)) return { rule_type: 'prepay_structure', feature: 'six_months_interest' };

  // ─── Term + IO feature ───
  if (/^30\s*YR\s*IO/i.test(l))                  return { rule_type: 'feature', feature: 'io_30' };
  if (/^40\s*YR\s*IO/i.test(l))                  return { rule_type: 'feature', feature: 'io_40' };
  if (/40\s*yr\s*Fully\s*Amortized/i.test(l))    return { rule_type: 'feature', feature: 'term_40_amortized' };

  // ─── Pricing Special (LTV-banded; FICO/DSCR gates in label, encoded in fico_min/dscr_ratio_min cols) ───
  if (/^Pricing\s+Special.*700\+?\s*FICO.*>=?\s*1\s*DSCR/i.test(l)) {
    return { rule_type: 'pricing_special', fico_min: 700, dscr_ratio_min: 1.0 };
  }

  return null;     // unrecognized → skipped by the grid extractor
}

function scaleAmount(numStr, unit) {
  const n = Number(String(numStr).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const u = (unit || '').toLowerCase();
  if (u === 'mm' || u === 'mmm' || u === 'm') return n * 1_000_000;
  if (u === 'k') return n * 1_000;
  return n;
}

/**
 * Max Price block (per §5.4): col 6 = PPP term label, col 7 = price cap.
 * Maps to `rule_type='prepay_term'` rules with `price_cap` populated.
 *
 * Matches the existing pricer model where prepay_term rules carry the
 * cap (see `price-dscr.js` cap-application logic).
 */
function parseMaxPriceBlock(data, startRow, baseFields, rules) {
  for (let r = startRow; r < startRow + 10; r++) {
    const row = data[r];
    if (!row) continue;
    const label = cellStr(row[MAX_PRICE_LABEL_COL]);
    if (!label) continue;
    const value = parseCell(row[MAX_PRICE_VALUE_COL]);
    if (value === null) continue;

    let prepayYears = null;
    const m = label.match(/^(\d+)\s*yr\s*PPP/i);
    if (m) prepayYears = Number(m[1]);
    else if (/^No\s*PPP/i.test(label)) prepayYears = 0;
    else continue;

    rules.push({
      ...baseFields,
      rule_type: 'prepay_term',
      prepay_years: prepayYears,
      price_cap: value,
      not_offered: false,
      raw_label: `Max Price / ${label}`,
    });
  }
}

/**
 * Loan Amount Adj block (per §5.3): col 9 = label, col 11 = LLPA.
 * Maps to `rule_type='loan_size_secondary'` per Q1 — distinct from the
 * LTV-banded `loan_size` rules emitted by the feature grid.
 */
function parseLoanAmountAdjBlock(data, startRow, baseFields, rules) {
  for (let r = startRow; r < startRow + 12; r++) {
    const row = data[r];
    if (!row) continue;
    const label = cellStr(row[LOAN_AMOUNT_LABEL_COL]);
    if (!label || label.startsWith('*')) continue;
    const value = parseCell(row[LOAN_AMOUNT_VALUE_COL]);
    if (value === null) continue;

    const range = parseLoanAmountLabel(label);
    if (!range) continue;
    rules.push({
      ...baseFields,
      rule_type: 'loan_size_secondary',
      loan_size_min: range.min,
      loan_size_max: range.max,
      llpa_points: scaleLlpa(value),
      not_offered: false,
      raw_label: `Loan Amount Adj / ${label}`,
    });
  }
}

function parseLoanAmountLabel(label) {
  // "Min Loan Amount-$199,999"
  const minMatch = label.match(/^Min\s+Loan\s+Amount\s*-\s*\$?([\d,]+)$/i);
  if (minMatch) {
    return { min: 0, max: Number(minMatch[1].replace(/,/g, '')) };
  }
  // "$200,000-$749,999" / "$750,000-$999,999"
  const numRange = label.match(/^\$?([\d,]+)\s*-\s*\$?([\d,]+)$/);
  if (numRange) {
    return { min: Number(numRange[1].replace(/,/g, '')), max: Number(numRange[2].replace(/,/g, '')) };
  }
  // "$1MM-$1,999,999" / "$2MM-$3,000,000"
  const mmHi = label.match(/^\$?(\d+(?:\.\d+)?)\s*([Mm]+|[Kk])\s*-\s*\$?([\d,]+)$/);
  if (mmHi) {
    return { min: scaleAmount(mmHi[1], mmHi[2]), max: Number(mmHi[3].replace(/,/g, '')) };
  }
  return null;
}

/**
 * Misc Adjustments block (per §5.5): col 3 = label, col 4 = flat LLPA.
 *
 * - "Guideline Exception" → flat `feature` rule with `feature='guideline_exception'`
 * - "January Pricing Special (700+ FICO & LTV ≤ 80)" → `pricing_special`
 *   with FICO/LTV gates encoded in fico_min / cltv_min / cltv_max
 */
function parseMiscAdjustments(data, startRow, baseFields, rules) {
  for (let r = startRow; r < startRow + 8; r++) {
    const row = data[r];
    if (!row) continue;
    const label = cellStr(row[MISC_LABEL_COL]);
    if (!label) continue;
    const value = parseCell(row[MISC_VALUE_COL]);
    if (value === null) continue;

    if (/^Guideline\s+Exception$/i.test(label)) {
      rules.push({
        ...baseFields,
        rule_type: 'feature',
        feature: 'guideline_exception',
        llpa_points: scaleLlpa(value),
        not_offered: false,
        raw_label: `Misc / ${label}`,
      });
    } else if (/^January\s+Pricing\s+Special/i.test(label)) {
      rules.push({
        ...baseFields,
        rule_type: 'pricing_special',
        fico_min: 700,
        cltv_min: 0,
        cltv_max: 80,
        llpa_points: scaleLlpa(value),
        not_offered: false,
        raw_label: `Misc / ${label}`,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Elite shape (D9c.6.5b) — 2-col category + sub-label, 7 LTV bands,
// 9 FICO bands, in-license rows only.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Parse one DSCR LLPA tab in the Elite shape.
 * Layout described at the top of this file + inventory §10.6.
 *
 * State row (CT/IL/NJ/NY) and the "Other Price Adjustments" NJ Prepay
 * override block are dropped at parse time — none of those states are
 * in NetRate's license, so storing rules that can never match would be
 * dead weight.
 */
function parseEliteTab(data, tier, rules, skipped) {
  const baseFields = {
    lender_code: LENDER_CODE,
    tier,
    product_type: null,
    occupancy: 'investment',
  };

  // ── 1. FICO×LTV grid (cols 5-11, FICO labels in col 4) ─────────
  const ficoAnchor = findCellByText(data, /^FICO\s+Score\s*\/\s*LTV/i);
  if (!ficoAnchor) {
    skipped.push(`${tier}: no "FICO Score/LTV Ratio" anchor`);
    return;
  }
  const ficoStartRow = findRowByTextInCol(
    data, ELITE_FEATURE_SUBLABEL_COL, /^\d{3}\s*-\s*\d{3,4}$/,
    { startRow: ficoAnchor.row }
  );
  if (ficoStartRow < 0) {
    skipped.push(`${tier}: couldn't locate first FICO band row after FICO anchor`);
    return;
  }
  rules.push(...extractFicoLtvGrid(
    data, ficoStartRow,
    { fico: FICO_BANDS_ELITE, ltv: LTV_BANDS_ELITE },
    {
      startCol: ELITE_FICO_GRID_DATA_START_COL,
      payloadField: 'llpa_points',
      ruleType: 'fico_cltv_grid',
      ltvKey: 'cltv',
      baseFields: { ...baseFields, loan_purpose: null },
      rawLabelFn: (fico, ltv) => `${tier}/FICO ${fico.label}/CLTV ${ltv.min}-${ltv.max}`,
      valueScale: LLPA_SCALE,
    }
  ));

  // ── 2. Feature×LTV grid — 2-col forward-fill ───────────────────
  const featureAnchor = findCellByText(
    data, /^Product\s+Feature\s*\/\s*LTV/i,
    { startRow: ficoStartRow + FICO_BANDS_ELITE.length }
  );
  if (!featureAnchor) {
    skipped.push(`${tier}: no "Product Feature/LTV Ratio" anchor`);
    return;
  }
  // The Elite axis row puts "Product Feature" in col 3 and "LTV Ratio"
  // header in col 9 (per inspection r33). Look for the LTV-band header
  // row (cells with "0-50%" etc. in cols 5+) to bound the data start.
  const featureAxisRow = findRowByTextInCol(
    data, ELITE_FEATURE_DATA_START_COL, /^0\s*-\s*50/i,
    { startRow: featureAnchor.row }
  );
  if (featureAxisRow < 0) {
    skipped.push(`${tier}: no LTV-band header row after feature anchor`);
    return;
  }

  // Feature grid ends at the "Fees" header (col 3 — same as Premier).
  const feesRow = findRowByTextInCol(
    data, MISC_LABEL_COL, /^Fees$/i,
    { startRow: featureAxisRow }
  );
  const featureEnd = feesRow > 0 ? feesRow : data.length;

  rules.push(...extractFeatureLtvGrid(
    data, featureAxisRow + 1, featureEnd, LTV_BANDS_ELITE,
    classifyEliteFeatureLabel,
    {
      categoryCol: ELITE_FEATURE_CATEGORY_COL,
      labelCol: ELITE_FEATURE_SUBLABEL_COL,
      startCol: ELITE_FEATURE_DATA_START_COL,
      ltvKey: 'cltv',
      baseFields,
      valueScale: LLPA_SCALE,
    }
  ));

  // ── 3. Max Price block (col 6/7) ───────────────────────────────
  // ── 4. Loan Amount Adj block (col 9/11) ────────────────────────
  // Both share the same column positions as Premier/InvPremier; the
  // existing helpers handle them. The "Other Price Adjustments" NJ
  // Prepay override block sits below in the same col 6/7, but its
  // labels ("Other Price Adjustments" header + "60 Months", "48 Months"
  // etc.) don't match parseMaxPriceBlock's `\d+ yr PPP|No PPP` regex,
  // so they get filtered out without an explicit drop.
  if (feesRow > 0) {
    parseMaxPriceBlock(data, feesRow + 1, baseFields, rules);
    parseLoanAmountAdjBlock(data, feesRow + 1, baseFields, rules);
  }

  // ── 5. Misc Adjustments block ──────────────────────────────────
  const miscRow = findRowByTextInCol(
    data, MISC_LABEL_COL, /^Misc\s+Adjustments$/i,
    { startRow: feesRow > 0 ? feesRow : 0 }
  );
  if (miscRow >= 0) {
    parseMiscAdjustments(data, miscRow + 1, baseFields, rules);
  }
}

/**
 * Classify an Elite feature-grid (category, sub-label) pair into rule fields.
 * Returns null to skip — used both for unrecognized rows and out-of-license
 * State rows (CT/IL/NJ/NY).
 */
function classifyEliteFeatureLabel(subLabel, ctx) {
  const cat = (ctx?.category || '').trim();
  const l = subLabel.trim();

  // ─── DSCR ratio bands (category "DSCR Additional Adjust") ───
  if (/^DSCR\s+Additional\s+Adjust/i.test(cat)) {
    if (/^>=?\s*1\.25$/.test(l))           return { rule_type: 'dscr_ratio', dscr_ratio_min: 1.25 };
    if (/^1\.00\s*-\s*1\.24$/.test(l))     return { rule_type: 'dscr_ratio', dscr_ratio_min: 1.0,  dscr_ratio_max: 1.24 };
    if (/^\.?75\s*-\s*\.?99$/.test(l))     return { rule_type: 'dscr_ratio', dscr_ratio_min: 0.75, dscr_ratio_max: 0.99 };
    if (/^<\s*\.?75$/.test(l))             return { rule_type: 'dscr_ratio', dscr_ratio_min: null, dscr_ratio_max: 0.74 };
  }

  // ─── Housing History — mortgage-late tradelines ───
  if (/^Housing\s+History/i.test(cat)) {
    if (/^1x30x12$/i.test(l))   return { rule_type: 'feature', feature: 'mortgage_lates_1x30x12' };
    if (/^0x60x12$/i.test(l))   return { rule_type: 'feature', feature: 'mortgage_lates_0x60x12' };
  }

  // ─── Housing Event Seasoning (months since BK / FC / SS) ───
  // The workbook splits the category name "Housing Event Seasoning" across
  // two physical rows (r41 col 3 = "Housing Event", r42 col 3 = "Seasoning"),
  // so the forward-fill sees two distinct categories. Treat them as one.
  if (/^Housing\s+Event$/i.test(cat) || /^Seasoning$/i.test(cat)) {
    if (/^>=?\s*36\s*Mo/i.test(l))   return { rule_type: 'feature', feature: 'event_seasoning_36plus' };
    if (/^24\s*-\s*35\s*Mo/i.test(l)) return { rule_type: 'feature', feature: 'event_seasoning_24_35' };
  }

  // ─── Loan Balance (UPB bands, separate from feature-grid loan_size) ───
  if (/^Loan\s+Balance/i.test(cat)) {
    return parseLoanBalanceLabel(l);
  }

  // ─── Purpose ───
  if (/^Purpose$/i.test(cat)) {
    if (/^Purchase$/i.test(l))                     return { rule_type: 'loan_purpose', loan_purpose: 'purchase' };
    if (/^R\/T\s*Refi$/i.test(l))                  return { rule_type: 'loan_purpose', loan_purpose: 'refinance' };
    if (/^Cash-?Out\s+Refi\s*>=?\s*720$/i.test(l)) return { rule_type: 'loan_purpose', loan_purpose: 'cashout', fico_min: 720 };
    if (/^Cash-?Out\s+Refi\s*<\s*720$/i.test(l))   return { rule_type: 'loan_purpose', loan_purpose: 'cashout', fico_max: 719 };
  }

  // ─── Property Type ───
  if (/^Property\s+Type/i.test(cat)) {
    if (/^Condotel$/i.test(l))      return { rule_type: 'property_type', property_type: 'condotel' };
    if (/^Condo$/i.test(l))         return { rule_type: 'property_type', property_type: 'condo' };
    if (/^2-?4\s*Unit$/i.test(l))   return { rule_type: 'property_type', property_type: '2_4unit' };
  }

  // ─── State (out-of-license — drop) ───
  if (/^State$/i.test(cat)) {
    return null;     // CT/IL/NJ/NY are not in CA/CO/OR/TX
  }

  // ─── Amortization (40-yr, IO) ───
  if (/^Amortization/i.test(cat)) {
    if (/^40\s*Year\s*Maturity$/i.test(l))   return { rule_type: 'feature', feature: 'term_40_amortized' };
    if (/^Interest\s*Only$/i.test(l))        return { rule_type: 'feature', feature: 'io_30' };
  }

  // ─── Prepayment Penalty — JOINT (term × structure) per row ───
  // Elite emits two PPP blocks: "Prepayment Penalty" (declining structure)
  // and "5% Fixed" (fixed-5 structure). Each cell is a single LLPA for the
  // specific (structure, term, LTV) combination — DIFFERENT values for the
  // same term across the two structure blocks (e.g. declining 60-Mo @ 0-50%
  // = +0.75 pts, 5%-Fixed 60-Mo @ 0-50% = +0.875 pts), which means the
  // LLPAs can't be decomposed into independent term + structure parts.
  // This is the same joint model as Everstream's `prepay_joint` rule_type.
  // The pricer matches on (prepay_years, feature) together — see
  // price-dscr.js prepay_joint block.
  if (/^Prepayment\s+Penalty$/i.test(cat) || /^5%\s*Fixed$/i.test(cat)) {
    const term = parsePrepayTermLabel(l);
    if (term === null) return null;
    const structure = /^5%\s*Fixed$/i.test(cat) ? 'fixed_5' : 'declining';
    return { rule_type: 'prepay_joint', prepay_years: term, feature: structure };
  }

  // ─── Other / Escrow Waiver ───
  if (/^Other$/i.test(cat) && /^Escrow\s+Waiver$/i.test(l)) {
    return { rule_type: 'feature', feature: 'escrow_waiver' };
  }

  return null;     // unrecognized → skipped by the grid extractor
}

/**
 * Parse Elite Loan Balance UPB labels into loan_size_min/max ranges.
 * Examples:
 *   "<=$150,000"
 *   "$150,001 - $250,000"
 *   "$3,000,001 - $3,500,000"
 */
function parseLoanBalanceLabel(label) {
  const lte = label.match(/^<=?\s*\$?([\d,]+)$/);
  if (lte) {
    return { rule_type: 'loan_size', loan_size_min: 0, loan_size_max: Number(lte[1].replace(/,/g, '')) };
  }
  const range = label.match(/^\$?([\d,]+)\s*-\s*\$?([\d,]+)$/);
  if (range) {
    return {
      rule_type: 'loan_size',
      loan_size_min: Number(range[1].replace(/,/g, '')),
      loan_size_max: Number(range[2].replace(/,/g, '')),
    };
  }
  return null;
}

/**
 * Parse a prepay term sub-label into `prepay_years`.
 *   "60 Months" → 5
 *   "48 Months" → 4
 *   "12 Months" → 1
 *   "No Penalty" → 0
 */
function parsePrepayTermLabel(label) {
  if (/^No\s*Penalty$/i.test(label)) return 0;
  const m = label.match(/^(\d+)\s*Months$/i);
  if (m) {
    const months = Number(m[1]);
    if (months % 12 === 0) return months / 12;
  }
  return null;
}
