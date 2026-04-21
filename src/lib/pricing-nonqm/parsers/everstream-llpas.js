/**
 * Everstream Elite DSCR LLPA parser (XLSX).
 *
 * Handles the three Elite DSCR sheets in Everstream's LLPA workbook:
 *   "Elite DSCR 1 LLPAs"  → tier 'elite_1'
 *   "Elite DSCR 2 LLPAs"  → tier 'elite_2'
 *   "Elite DSCR 5 LLPAs"  → tier 'elite_5'
 *
 * Each sheet has five logical blocks we care about:
 *   1. Fixed-rate FICO×CLTV grid (9 occupancy×purpose sections)
 *   2. Fixed-rate Price Caps (parallel grid, cols 13+)
 *   3. ARM FICO×CLTV grid (same 9 sections, starting ~row 110)
 *   4. ARM Price Caps
 *   5. Global LLPAs (property type, loan size, DSCR ratio, features)
 *   6. Prepayment Penalty matrix (structure × term years)
 *   7. Service Release Premium (state × CLTV)
 *
 * Core DSCR Plus / Expanded Prime Plus LLPAs (Core Non-QM sheet) have a
 * different layout and are NOT handled here — follow-up PR.
 *
 * Returns a flat array of DB-ready rows for nonqm_adjustment_rules.
 */

import * as XLSX from 'xlsx';

const LENDER_CODE = 'everstream';

const FICO_BANDS = [
  { min: 800, max: 850, label: '800+' },
  { min: 780, max: 799, label: '780-799' },
  { min: 760, max: 779, label: '760-779' },
  { min: 740, max: 759, label: '740-759' },
  { min: 720, max: 739, label: '720-739' },
  { min: 700, max: 719, label: '700-719' },
  { min: 680, max: 699, label: '680-699' },
  { min: 660, max: 679, label: '660-679' },
  { min: 640, max: 659, label: '640-659' },
  { min: 620, max: 639, label: '620-639' },
];

// CLTV bands (10 columns) — order matches the sheet left-to-right.
const CLTV_BANDS = [
  { min: 0,     max: 50 },
  { min: 50.01, max: 55 },
  { min: 55.01, max: 60 },
  { min: 60.01, max: 65 },
  { min: 65.01, max: 70 },
  { min: 70.01, max: 75 },
  { min: 75.01, max: 80 },
  { min: 80.01, max: 85 },
  { min: 85.01, max: 90 },
  { min: 90.01, max: 95 },
];

// 9 section labels in the FICO×CLTV block, exact left-col strings.
// Emits the canonical scenario vocab (agency-native occupancy +
// flat pricing-shaped loan_purpose), not Everstream's sheet labels.
// See Work/Dev/audits/SCENARIO-VOCABULARY-AUDIT-2026-04-20.md §2.
const SECTION_MAP = {
  'Primary Purchase':    { occupancy: 'primary',    loan_purpose: 'purchase'  },
  'Primary NCO Refi':    { occupancy: 'primary',    loan_purpose: 'rate_term' },
  'Primary CO Refi':     { occupancy: 'primary',    loan_purpose: 'cashout'   },
  'Second Purchase':     { occupancy: 'secondary',  loan_purpose: 'purchase'  },
  'Second NCO Refi':     { occupancy: 'secondary',  loan_purpose: 'rate_term' },
  'Second CO Refi':      { occupancy: 'secondary',  loan_purpose: 'cashout'   },
  'NOO Purchase':        { occupancy: 'investment', loan_purpose: 'purchase'  },
  'NOO NCO Refi':        { occupancy: 'investment', loan_purpose: 'rate_term' },
  'NOO CO Refi':         { occupancy: 'investment', loan_purpose: 'cashout'   },
};

const TIER_SHEET_MAP = {
  'Elite DSCR 1 LLPAs': 'elite_1',
  'Elite DSCR 2 LLPAs': 'elite_2',
  'Elite DSCR 5 LLPAs': 'elite_5',
};

/**
 * Parse a single XLSX workbook buffer. Returns { rules, tiers_seen, skipped }.
 */
export function parseEverstreamLlpasXlsx(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rules = [];
  const tiers_seen = [];
  const skipped = [];

  for (const [sheetName, tier] of Object.entries(TIER_SHEET_MAP)) {
    const sh = wb.Sheets[sheetName];
    if (!sh) {
      skipped.push(`missing sheet: ${sheetName}`);
      continue;
    }
    tiers_seen.push(tier);
    const data = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: null });
    parseSheet(data, tier, rules, skipped);
  }

  return { lender_code: LENDER_CODE, rules, tiers_seen, skipped };
}

/**
 * Parse one DSCR sheet's rows into rule objects.
 */
function parseSheet(data, tier, rules, skipped) {
  // ── 1. Find section start rows by scanning col A. ──
  const sectionRows = [];
  for (let i = 0; i < data.length; i++) {
    const label = cellStr(data[i]?.[0]);
    if (label && SECTION_MAP[label]) {
      sectionRows.push({ row: i, label });
    }
  }

  // Each sheet has 18 section markers: 9 fixed + 9 arm.
  // First 9 → fixed. Remaining → arm.
  const fixedSections = sectionRows.slice(0, 9);
  const armSections = sectionRows.slice(9, 18);

  // ── 2. Parse fixed-rate LLPA grid (cols 1-10) + price cap (cols 14-23) ──
  for (const s of fixedSections) {
    extractFicoCltvGrid(data, s.row, s.label, tier, 'fixed', 1,  'llpa_points', rules);
    extractFicoCltvGrid(data, s.row, s.label, tier, 'fixed', 14, 'price_cap',   rules);
  }
  // ── 3. Parse ARM grid + price cap ──
  for (const s of armSections) {
    extractFicoCltvGrid(data, s.row, s.label, tier, 'arm', 1,  'llpa_points', rules);
    extractFicoCltvGrid(data, s.row, s.label, tier, 'arm', 14, 'price_cap',   rules);
  }

  // ── 4. Global LLPAs, Prepay, SRP ──
  const globalRow = findRow(data, 0, /^Global LLPAs$/i);
  if (globalRow >= 0) {
    const prepayHeaderRow = findRow(data, 1, /^Prepayment Penalty Term/i, globalRow);
    const srpHeaderRow    = findRow(data, 0, /^STATE$/, prepayHeaderRow || globalRow);

    const globalEnd = prepayHeaderRow > 0 ? prepayHeaderRow - 1 : data.length;
    extractGlobalLlpas(data, globalRow + 1, globalEnd, tier, rules);

    if (prepayHeaderRow >= 0) {
      const prepayEnd = srpHeaderRow > 0 ? srpHeaderRow - 1 : data.length;
      extractPrepay(data, prepayHeaderRow + 1, prepayEnd, tier, rules);
    }
    if (srpHeaderRow >= 0) {
      extractSrp(data, srpHeaderRow + 1, data.length, tier, rules);
    }
  } else {
    skipped.push(`${tier}: no Global LLPAs section`);
  }
}

/**
 * Read a 10×10 FICO×CLTV block starting just below the section label row.
 * startCol is the first CLTV data column (1 for LLPA grid, 14 for price cap).
 * payload is either 'llpa_points' or 'price_cap' — which rule column to populate.
 */
function extractFicoCltvGrid(data, sectionRow, sectionLabel, tier, productType, startCol, payload, rules) {
  const match = SECTION_MAP[sectionLabel];
  if (!match) return;

  // The 10 FICO rows sit immediately below the section label row.
  for (let i = 0; i < FICO_BANDS.length; i++) {
    const row = data[sectionRow + 1 + i];
    if (!row) continue;
    const fico = FICO_BANDS[i];

    for (let j = 0; j < CLTV_BANDS.length; j++) {
      const rawVal = row[startCol + j];
      const num = parseCell(rawVal);
      if (num === null && !isNa(rawVal)) continue;
      const cltv = CLTV_BANDS[j];

      const rule = {
        lender_code: LENDER_CODE,
        tier,
        product_type: productType,
        rule_type: 'fico_cltv_grid',
        occupancy: match.occupancy,
        loan_purpose: match.loan_purpose,
        fico_min: fico.min,
        fico_max: fico.max,
        cltv_min: cltv.min,
        cltv_max: cltv.max,
        not_offered: isNa(rawVal),
        raw_label: `${sectionLabel} / FICO ${fico.label} / CLTV ${cltv.min}-${cltv.max} / ${payload}`,
      };
      if (!isNa(rawVal)) rule[payload] = num;
      rules.push(rule);
    }
  }
}

/**
 * Parse Global LLPA rows. Each row = one label + 10 CLTV values.
 * Each (label × CLTV) becomes a rule. Labels map to property_type / loan_size / dscr / feature.
 */
function extractGlobalLlpas(data, startRow, endRow, tier, rules) {
  for (let r = startRow; r < endRow; r++) {
    const row = data[r];
    if (!row) continue;
    const label = cellStr(row[0]);
    if (!label) continue;

    const classified = classifyGlobalLabel(label);
    if (!classified) continue;

    for (let j = 0; j < CLTV_BANDS.length; j++) {
      const rawVal = row[1 + j];
      const num = parseCell(rawVal);
      if (num === null && !isNa(rawVal)) continue;
      const cltv = CLTV_BANDS[j];

      rules.push({
        lender_code: LENDER_CODE,
        tier,
        product_type: null,
        rule_type: classified.rule_type,
        cltv_min: cltv.min,
        cltv_max: cltv.max,
        property_type:  classified.property_type  ?? null,
        loan_size_min:  classified.loan_size_min  ?? null,
        loan_size_max:  classified.loan_size_max  ?? null,
        dscr_ratio_min: classified.dscr_ratio_min ?? null,
        dscr_ratio_max: classified.dscr_ratio_max ?? null,
        feature:        classified.feature        ?? null,
        doc_type:       classified.doc_type       ?? null,
        llpa_points:    isNa(rawVal) ? null : num,
        not_offered:    isNa(rawVal),
        raw_label:      label,
      });
    }
  }
}

/**
 * Classify a Global LLPA row-label into structured fields.
 * Returns null for labels we don't recognize (skipped).
 */
function classifyGlobalLabel(label) {
  const l = label.trim();

  // Property type
  if (/^SFR$/i.test(l))                 return { rule_type: 'property_type', property_type: 'sfr' };
  if (/^PUD$/i.test(l))                 return { rule_type: 'property_type', property_type: 'pud' };
  if (/^Condo$/i.test(l))               return { rule_type: 'property_type', property_type: 'condo' };
  if (/Non.?Warrantable Condo/i.test(l)) return { rule_type: 'property_type', property_type: 'nonwarr_condo' };
  if (/^(NYC )?Coop$/i.test(l))         return { rule_type: 'property_type', property_type: 'coop' };
  if (/Townhome|Attached/i.test(l))     return { rule_type: 'property_type', property_type: 'townhome' };
  if (/^2 unit/i.test(l))               return { rule_type: 'property_type', property_type: '2unit' };
  if (/^3 unit/i.test(l))               return { rule_type: 'property_type', property_type: '3unit' };
  if (/^4 unit/i.test(l))               return { rule_type: 'property_type', property_type: '4unit' };

  // Features
  if (/Escrow Waiver/i.test(l))         return { rule_type: 'feature', feature: 'escrow_waiver' };
  if (/^IO$/i.test(l))                  return { rule_type: 'feature', feature: 'io' };
  if (/40 ?Yr Term|40 Amortization/i.test(l)) return { rule_type: 'feature', feature: '40yr_term' };
  if (/Short Term Rental/i.test(l))     return { rule_type: 'feature', feature: 'short_term_rental' };
  if (/ITIN/i.test(l))                  return { rule_type: 'feature', feature: 'itin' };
  if (/Non.?Permanent Resident/i.test(l)) return { rule_type: 'feature', feature: 'non_permanent_resident' };
  if (/Reserves < ?12 Months/i.test(l)) return { rule_type: 'feature', feature: 'reserves_lt_12mo' };
  if (/< ?6 Months Reserves/i.test(l))  return { rule_type: 'feature', feature: 'reserves_lt_6mo' };
  if (/>80 LTV/i.test(l))               return { rule_type: 'feature', feature: 'ltv_gt_80' };

  // Loan size bands
  const lsMatch = l.match(/^>=?\s*Minimum Loan Amount/i);
  if (lsMatch) return { rule_type: 'loan_size', loan_size_min: 0, loan_size_max: 250000 };
  const sizeRange = l.match(/^>\s*\$?([\d.,]+)\s*(MM|K|mm|k)?\s*(?:<=?\s*\$?([\d.,]+)\s*(MM|K|mm|k)?)?/);
  if (sizeRange) {
    const min = parseSize(sizeRange[1], sizeRange[2]);
    const max = sizeRange[3] ? parseSize(sizeRange[3], sizeRange[4]) : null;
    return { rule_type: 'loan_size', loan_size_min: min, loan_size_max: max };
  }

  // DSCR ratio bands
  const dscrMatch = l.match(/(?:DSCR\s*)?(>=?|<=?|<|>)\s*(\d+(?:\.\d+)?)(?:\s*(<=?|<|>=?|>)\s*(\d+(?:\.\d+)?))?/i);
  if (dscrMatch && /DSCR|^[<>=]/.test(l)) {
    const [, op1, v1, op2, v2] = dscrMatch;
    let min = null, max = null;
    if (op1.startsWith('>')) min = Number(v1);
    if (op1.startsWith('<')) max = Number(v1);
    if (op2?.startsWith('<')) max = Number(v2);
    if (op2?.startsWith('>')) min = Number(v2);
    return { rule_type: 'dscr_ratio', dscr_ratio_min: min, dscr_ratio_max: max };
  }

  return null;
}

function parseSize(numStr, unit) {
  const n = Number(numStr.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const u = (unit || '').toUpperCase();
  if (u === 'MM') return n * 1_000_000;
  if (u === 'K')  return n * 1_000;
  return n;
}

/**
 * Prepay rows: col A = structure, cols 1..5 = year terms (1-5 years).
 */
function extractPrepay(data, startRow, endRow, tier, rules) {
  const structures = {
    'No Penalty':                      'no_penalty',
    'Six Months Interest':             'six_months_interest',
    'Fixed - 5%':                      'fixed_5',
    'Fixed - 1%':                      'fixed_1',
    'Declining - 5%/4%/3%/2%/1%':      'declining_54321',
    'Declining - 5%/4%/3%':            'declining_543',
    'Declining - 3%/2%/1%':            'declining_321',
    'Declining - 5%/4%':               'declining_54',
    'Declining - 2%/1%':               'declining_21',
  };

  for (let r = startRow; r < endRow; r++) {
    const row = data[r];
    if (!row) continue;
    const labelRaw = cellStr(row[0]);
    if (!labelRaw) continue;
    // Normalize label (strip trailing whitespace, collapse)
    const label = labelRaw.trim().replace(/\s+/g, ' ');
    // Find nearest matching structure key
    let structureKey = null;
    for (const [k, v] of Object.entries(structures)) {
      if (label.toLowerCase().startsWith(k.toLowerCase().slice(0, 18))) {
        structureKey = v;
        break;
      }
    }
    if (!structureKey) continue;

    for (let years = 1; years <= 5; years++) {
      const rawVal = row[years];
      const num = parseCell(rawVal);
      if (num === null && !isNa(rawVal)) continue;
      rules.push({
        lender_code: LENDER_CODE,
        tier,
        product_type: null,
        rule_type: 'prepay',
        prepay_years: years,
        feature: structureKey,
        llpa_points: isNa(rawVal) ? null : num,
        not_offered: isNa(rawVal),
        raw_label: `${label} / ${years}yr`,
      });
    }
  }
}

/**
 * SRP rows: col A = 2-letter state, cols 1-10 = CLTV values.
 */
function extractSrp(data, startRow, endRow, tier, rules) {
  for (let r = startRow; r < endRow; r++) {
    const row = data[r];
    if (!row) continue;
    const state = cellStr(row[0]);
    if (!state || !/^[A-Z]{2}$/.test(state.trim())) continue;

    for (let j = 0; j < CLTV_BANDS.length; j++) {
      const rawVal = row[1 + j];
      const num = parseCell(rawVal);
      if (num === null && !isNa(rawVal)) continue;
      const cltv = CLTV_BANDS[j];
      rules.push({
        lender_code: LENDER_CODE,
        tier,
        product_type: null,
        rule_type: 'state_srp',
        state: state.trim(),
        cltv_min: cltv.min,
        cltv_max: cltv.max,
        llpa_points: isNa(rawVal) ? null : num,
        not_offered: isNa(rawVal),
        raw_label: `${state} CLTV ${cltv.min}-${cltv.max}`,
      });
    }
  }
}

// ── Cell helpers ────────────────────────────────────────────────────

function cellStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function isNa(v) {
  if (v === null || v === undefined) return false;
  return /^na$/i.test(String(v).trim());
}

/**
 * Parse a cell value as a number. Returns null for non-numeric / na / empty.
 */
function parseCell(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || isNa(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function findRow(data, col, regex, startRow = 0) {
  for (let i = startRow; i < data.length; i++) {
    const v = cellStr(data[i]?.[col]);
    if (v && regex.test(v)) return i;
  }
  return -1;
}
